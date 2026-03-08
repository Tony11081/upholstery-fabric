"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type Product = {
  id: string;
  titleEn: string;
  slug: string;
  price: string;
  currency: string;
  inventory: number;
  isActive: boolean;
  isNew: boolean;
  isBestSeller: boolean;
  qaStatus?: "PENDING" | "APPROVED" | "REJECTED";
  qualityScore?: number;
};

type ImportResult = {
  created: number;
  failed: number;
  errorsCsv?: string;
};

type ImportError = {
  row: number;
  message: string;
  title?: string;
  slug?: string;
};

type PreviewRow = {
  row: number;
  titleEn: string;
  descriptionEn?: string | null;
  slug: string;
  categorySlug?: string;
  categoryName?: string;
  tags: string[];
  imageUrls: string[];
  price: number | null;
  currency: string;
  inventory: number;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  qualityScore?: number;
  qualityNotes?: string[];
  error?: string;
  warnings?: string[];
};

type PreviewEstimate = {
  totalTokens: number;
  totalCostUsd: number;
  perRowTokens: number;
  perRowCostUsd: number;
};

type OptimizationOverview = {
  totals: {
    pending: number;
    inProgress: number;
    done: number;
    failed: number;
  };
  dayStats: {
    queued: number;
    done: number;
    failed: number;
    successRate: number;
  };
  topErrors: Array<{ error: string; count: number }>;
  failedJobs: Array<{
    id: string;
    productId: string | null;
    error: string | null;
    status: string;
    attempts: number;
    createdAt: string;
    updatedAt: string;
  }>;
};

export function ProductsClient() {
  const toast = useToast();
  const lowStockThreshold = Number(process.env.NEXT_PUBLIC_LOW_STOCK_THRESHOLD ?? "5");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [qaStatus, setQaStatus] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [importing, setImporting] = useState(false);
  const [aiAssist, setAiAssist] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<ImportError[]>([]);
  const [usePreviewResults, setUsePreviewResults] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [previewEstimate, setPreviewEstimate] = useState<PreviewEstimate | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeLimit, setOptimizeLimit] = useState("100");
  const [optimizationOverview, setOptimizationOverview] = useState<OptimizationOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);

  const allSelected = useMemo(
    () => products.length > 0 && selected.length === products.length,
    [products.length, selected.length],
  );
  const hasPreviewErrors = useMemo(
    () => (previewRows ?? []).some((row) => Boolean(row.error)),
    [previewRows],
  );

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      if (qaStatus) params.set("qa", qaStatus);
      const res = await fetch(`/api/admin/products?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "加载商品失败");
      }
      setProducts(json.data?.products ?? []);
      setSelected([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载商品失败");
    } finally {
      setLoading(false);
    }
  }, [query, status, qaStatus, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const loadOptimizationOverview = useCallback(async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch("/api/admin/optimize-products?overview=1&limit=20");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? "加载优化状态失败");
      }
      setOptimizationOverview(json?.overview ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载优化状态失败");
    } finally {
      setOverviewLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOptimizationOverview();
  }, [loadOptimizationOverview]);

  const toggleSelected = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkApply = async () => {
    if (!bulkAction || selected.length === 0) {
      toast.error("请选择商品和批量操作");
      return;
    }
    const needsValue = ["set_inventory", "adjust_inventory", "set_price", "adjust_price"].includes(bulkAction);
    if (needsValue && !bulkValue) {
      toast.error("该操作需要填写数值");
      return;
    }
    try {
      const payload = {
        ids: selected,
        action: bulkAction,
        value: bulkValue ? Number(bulkValue) : undefined,
      };
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "批量更新失败");
      }
      toast.success("批量更新成功");
      setBulkValue("");
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量更新失败");
    }
  };

  const handleImport = async (file: File | null, useAi: boolean, usePreview: boolean) => {
    if (usePreview && (!previewRows || !previewToken)) {
      toast.error("请先生成预览结果");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      let res: Response;
      if (usePreview && previewRows) {
        const endpoint = "/api/admin/products/import?mode=ai&usePreview=1";
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ previewRows, previewToken }),
        });
      } else {
        if (!file) {
          throw new Error("请选择要导入的文件");
        }
        const formData = new FormData();
        formData.append("file", file);
        const endpoint = useAi ? "/api/admin/products/import?mode=ai" : "/api/admin/products/import";
        res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "导入失败");
      }
      const result: ImportResult = {
        created: json.data?.created ?? json.created ?? 0,
        failed: json.data?.failed ?? json.failed ?? 0,
        errorsCsv: json.data?.errorsCsv ?? json.errorsCsv,
      };
      setImportResult(result);
      toast.success("导入完成");
      setSelectedFile(null);
      setPreviewRows(null);
      setPreviewErrors([]);
      setUsePreviewResults(false);
      setPreviewToken(null);
      setPreviewEstimate(null);
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error("请选择要预览的文件");
      return;
    }
    if (!aiAssist) {
      toast.error("请先启用 AI 辅助后再预览");
      return;
    }
    setPreviewing(true);
    setPreviewRows(null);
    setPreviewErrors([]);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/admin/products/import?mode=ai&preview=1", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "预览失败");
      }
      const rows = (json.data?.preview ?? json.preview ?? []) as PreviewRow[];
      const errors = (json.data?.errors ?? json.errors ?? []) as ImportError[];
      const token = (json.data?.previewToken ?? json.previewToken ?? null) as string | null;
      const estimate = (json.data?.estimate ?? json.estimate ?? null) as PreviewEstimate | null;
      setPreviewRows(rows);
      setPreviewErrors(errors);
      setPreviewToken(token);
      setPreviewEstimate(estimate);
      setUsePreviewResults(Boolean(token) && errors.length === 0);
      toast.success("预览已生成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "预览失败");
    } finally {
      setPreviewing(false);
    }
  };

  const downloadErrors = () => {
    if (!importResult?.errorsCsv) return;
    const blob = new Blob([importResult.errorsCsv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "import-errors.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleAutoOptimize = async () => {
    const limit = Number(optimizeLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      toast.error("请输入大于 0 的优化数量");
      return;
    }

    setOptimizing(true);
    try {
      const res = await fetch("/api/admin/optimize-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto", limit: Math.floor(limit) }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? "批量优化失败");
      }
      const queued = Number(json?.queued ?? 0);
      const repaired = Number(json?.repaired ?? 0);
      const scanned = Number(json?.scanned ?? 0);
      toast.success(`本次扫描 ${scanned} 条，已修复 ${repaired} 条，已加入优化队列 ${queued} 条`);
      await loadOptimizationOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量优化失败");
    } finally {
      setOptimizing(false);
    }
  };

  const handleRetryFailed = async () => {
    setRetryingFailed(true);
    try {
      const res = await fetch("/api/admin/optimize-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_failed", limit: 30 }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? "失败任务重试失败");
      }
      toast.success(`已重试失败任务：${Number(json?.retried ?? 0)} 条`);
      await loadOptimizationOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "失败任务重试失败");
    } finally {
      setRetryingFailed(false);
    }
  };

  const handleQueueSingleOptimization = async (productId: string | null) => {
    if (!productId) return;
    try {
      const res = await fetch("/api/admin/optimize-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "queue", productId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? "重试失败");
      }
      toast.success(`已加入队列：${productId.slice(0, 8)}...`);
      await loadOptimizationOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重试失败");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          label="搜索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="按商品标题或 slug 搜索"
        />
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">状态</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">全部</option>
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">质检状态</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={qaStatus}
            onChange={(event) => setQaStatus(event.target.value)}
          >
            <option value="">全部</option>
            <option value="PENDING">待审核</option>
            <option value="APPROVED">已通过</option>
            <option value="REJECTED">已拒绝</option>
          </select>
        </label>
        <Button variant="ghost" onClick={loadProducts}>
          刷新
        </Button>
        <Button asChild>
          <Link href="/admin/products/new">新建商品</Link>
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(event) =>
                setSelected(event.target.checked ? products.map((product) => product.id) : [])
              }
            />
            全选
          </label>
          <select
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink"
            value={bulkAction}
            onChange={(event) => setBulkAction(event.target.value)}
          >
            <option value="">批量操作</option>
            <option value="set_active">设为启用</option>
            <option value="set_inactive">设为停用</option>
            <option value="set_inventory">设置库存</option>
            <option value="adjust_inventory">调整库存</option>
            <option value="set_price">设置价格</option>
            <option value="adjust_price">调整价格</option>
            <option value="mark_new">标记新品</option>
            <option value="mark_not_new">取消新品</option>
            <option value="mark_best_seller">标记热销</option>
            <option value="mark_not_best_seller">取消热销</option>
          </select>
          <Input
            label="数值"
            value={bulkValue}
            onChange={(event) => setBulkValue(event.target.value)}
            placeholder="用于价格或库存"
          />
          <Button variant="ghost" onClick={handleBulkApply}>
            应用
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="AI 批量优化数量"
            value={optimizeLimit}
            onChange={(event) => setOptimizeLimit(event.target.value)}
            placeholder="例如 100"
          />
          <Button loading={optimizing} onClick={handleAutoOptimize}>
            批量优化 / Auto optimize
          </Button>
          <p className="text-xs text-muted-foreground">
            点击后会调用 `/api/admin/optimize-products`，把未优化商品加入队列。
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">AI Optimization Monitor</p>
            <p className="mt-1 text-sm text-muted-foreground">
              查看 pending / failed / top error，并支持失败任务自动重试和单品一键重跑。
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={loadOptimizationOverview} disabled={overviewLoading}>
              {overviewLoading ? "刷新中..." : "刷新状态"}
            </Button>
            <Button variant="ghost" loading={retryingFailed} onClick={handleRetryFailed}>
              失败任务重试
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MetricCard label="Pending" value={optimizationOverview?.totals.pending ?? 0} />
          <MetricCard label="In Progress" value={optimizationOverview?.totals.inProgress ?? 0} />
          <MetricCard label="Done (24h)" value={optimizationOverview?.dayStats.done ?? 0} />
          <MetricCard label="Success Rate (24h)" value={`${optimizationOverview?.dayStats.successRate ?? 0}%`} />
        </div>

        {optimizationOverview?.topErrors?.length ? (
          <div className="mt-4 rounded-xl border border-border bg-contrast p-3">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Top Errors</p>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {optimizationOverview.topErrors.map((item) => (
                <div key={item.error} className="flex items-center justify-between gap-3">
                  <span className="line-clamp-1">{item.error}</span>
                  <span className="text-ink">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {optimizationOverview?.failedJobs?.length ? (
          <div className="mt-4 overflow-auto rounded-xl border border-border bg-contrast">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Attempts</th>
                  <th className="px-3 py-2">Updated</th>
                  <th className="px-3 py-2">Error</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {optimizationOverview.failedJobs.map((job) => (
                  <tr key={job.id} className="border-b border-border/40">
                    <td className="px-3 py-2 text-ink">{job.productId ?? "-"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{job.attempts}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(job.updatedAt).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{job.error ?? "-"}</td>
                    <td className="px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!job.productId}
                        onClick={() => handleQueueSingleOptimization(job.productId)}
                      >
                        一键重跑
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">暂无失败任务。</p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">导入 CSV / Excel</span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={importing}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setImportResult(null);
                  setPreviewRows(null);
                  setPreviewErrors([]);
                  setUsePreviewResults(false);
                  setPreviewToken(null);
                  setPreviewEstimate(null);
                }
              }}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={aiAssist}
              onChange={(event) => {
                setAiAssist(event.target.checked);
                setPreviewRows(null);
                setPreviewErrors([]);
                setUsePreviewResults(false);
                setPreviewToken(null);
                setPreviewEstimate(null);
              }}
            />
            AI 辅助（翻译、生成标题、自动分类）
          </label>
          <div className="text-sm text-muted-foreground">
            <a className="underline underline-offset-4" href="/templates/products-template.csv" download>
              CSV 模板
            </a>
            <span className="mx-2">·</span>
            <a className="underline underline-offset-4" href="/templates/products-template.xlsx" download>
              Excel 模板
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button
              variant="ghost"
              loading={previewing}
              disabled={!selectedFile || !aiAssist || previewing || importing}
              onClick={handlePreview}
            >
              AI 预览
            </Button>
            {aiAssist && previewRows && previewToken && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={usePreviewResults}
                  disabled={hasPreviewErrors}
                  onChange={(event) => setUsePreviewResults(event.target.checked)}
                />
                使用预览结果（跳过再次运行 AI）
              </label>
            )}
            <Button
              loading={importing}
              disabled={
                (!selectedFile && !(usePreviewResults && previewRows)) ||
                importing ||
                previewing ||
                (usePreviewResults && hasPreviewErrors)
              }
              onClick={() => handleImport(selectedFile, aiAssist, usePreviewResults)}
            >
              {aiAssist ? (usePreviewResults ? "导入（预览结果）" : "导入（AI）") : "导入"}
            </Button>
          </div>
          {importResult && (
            <div className="text-sm text-muted-foreground">
              已导入 {importResult.created} 条，失败 {importResult.failed} 条。
              {importResult.errorsCsv && (
                <button className="ml-2 underline underline-offset-4" onClick={downloadErrors}>
                  下载错误明细
                </button>
              )}
            </div>
          )}
        </div>
        {previewRows && (
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <div>
              已预览 {previewRows.length} 行
              {previewErrors.length ? `，错误 ${previewErrors.length} 行` : ""}。
            </div>
            {previewEstimate && (
              <div className="text-xs text-muted-foreground">
                预估成本：${previewEstimate.totalCostUsd.toFixed(4)}（{previewEstimate.totalTokens} tokens，约
                {previewEstimate.perRowTokens} tokens/行）
              </div>
            )}
            {hasPreviewErrors && (
              <div className="text-xs text-red-600">请先修复预览错误后再导入。</div>
            )}
            <div className="max-h-80 overflow-auto rounded-2xl border border-border bg-background">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border/60 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">行号</th>
                    <th className="px-3 py-2">标题</th>
                    <th className="px-3 py-2">分类</th>
                    <th className="px-3 py-2">价格</th>
                    <th className="px-3 py-2">库存</th>
                    <th className="px-3 py-2">质量</th>
                    <th className="px-3 py-2">标签</th>
                    <th className="px-3 py-2">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={`${row.row}-${row.slug}`} className="border-b border-border/40">
                      <td className="px-3 py-2 text-muted-foreground">{row.row}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-ink">{row.titleEn || "商品"}</div>
                        <div className="text-[11px] text-muted-foreground">{row.slug || "-"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-ink">{row.categoryName || row.categorySlug || "-"}</div>
                        {row.warnings?.length ? (
                          <div className="text-[11px] text-amber-600">{row.warnings.join(", ")}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink">
                        {row.price !== null ? `${row.currency} ${row.price}` : "-"}
                      </td>
                      <td className="px-3 py-2 text-ink">{row.inventory}</td>
                      <td className="px-3 py-2 text-ink">
                        {typeof row.qualityScore === "number" ? `${row.qualityScore}/100` : "-"}
                        {row.qualityNotes?.length ? (
                          <div className="text-[11px] text-amber-600">{row.qualityNotes.join(", ")}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink">{row.tags?.join(", ") || "-"}</td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <span className="text-xs text-red-600">{row.error}</span>
                        ) : (
                          <span className="text-xs text-emerald-600">可导入</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {aiAssist && !previewRows.length ? (
              <div className="text-xs text-muted-foreground">未找到可预览数据。</div>
            ) : null}
            {aiAssist && previewRows.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {usePreviewResults
                  ? "导入将直接使用当前预览结果，不会再次运行 AI。"
                  : "导入时将再次运行 AI，确保服务端处理结果一致。"}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">商品加载中...</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无商品。</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">选择</th>
                <th className="py-2 pr-2">标题</th>
                    <th className="py-2 pr-2">价格</th>
                    <th className="py-2 pr-2">库存</th>
                    <th className="py-2 pr-2">质检</th>
                    <th className="py-2 pr-2">质量分</th>
                    <th className="py-2 pr-2">状态</th>
                    <th className="py-2 pr-2">操作</th>
                  </tr>
                </thead>
                <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-border/40">
                  <td className="py-3 pr-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(product.id)}
                      onChange={() => toggleSelected(product.id)}
                    />
                  </td>
                  <td className="py-3 pr-2">
                    <div className="font-medium">{product.titleEn}</div>
                    <div className="text-xs text-muted-foreground">{product.slug}</div>
                  </td>
                  <td className="py-3 pr-2">
                    {product.currency} {product.price}
                  </td>
                  <td className="py-3 pr-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{product.inventory}</span>
                      {product.inventory <= 0 && (
                        <Badge tone="solid">缺货</Badge>
                      )}
                      {product.inventory > 0 && product.inventory <= lowStockThreshold && (
                        <Badge tone="outline">低库存</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-2 text-xs text-muted-foreground">
                    {product.qaStatus ?? "APPROVED"}
                  </td>
                  <td className="py-3 pr-2 text-xs text-muted-foreground">
                    {typeof product.qualityScore === "number" ? `${product.qualityScore}/100` : "--"}
                  </td>
                  <td className="py-3 pr-2">{product.isActive ? "启用" : "停用"}</td>
                  <td className="py-3 pr-2">
                    <Link href={`/admin/products/${product.id}`} className="underline underline-offset-4">
                      编辑
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-contrast p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
