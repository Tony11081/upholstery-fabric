"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import {
  ADMIN_EMAIL_TEMPLATES,
  buildAdminEmailTemplate,
  getDefaultAdminTemplateVariables,
  type AdminEmailTemplateId,
  type AdminEmailTemplateVariables,
} from "@/lib/email/admin-presets";

type EmailHealthPayload = {
  configured: boolean;
  canSend: boolean;
  verified: boolean;
  missing: string[];
  host?: string;
  port: number;
  secure: boolean;
  from?: string;
  verifyError?: string;
};

type SendResult = {
  sent: number;
  failed: number;
  sentTo: string[];
  failedItems: Array<{ email: string; error: string }>;
};

function parseHealthResponse(json: unknown) {
  if (!json || typeof json !== "object") return null;
  const payload = json as {
    data?: { health?: EmailHealthPayload; recommendedRecipient?: string };
    health?: EmailHealthPayload;
    recommendedRecipient?: string;
  };
  if (payload.data?.health) {
    return {
      health: payload.data.health,
      recommendedRecipient: payload.data.recommendedRecipient ?? "",
    };
  }
  if (payload.health) {
    return {
      health: payload.health,
      recommendedRecipient: payload.recommendedRecipient ?? "",
    };
  }
  return null;
}

export function SendEmailClient() {
  const toast = useToast();
  const [health, setHealth] = useState<EmailHealthPayload | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [sending, setSending] = useState(false);
  const [templateId, setTemplateId] = useState<AdminEmailTemplateId>("order-confirmed");
  const [templateVars, setTemplateVars] = useState<AdminEmailTemplateVariables>(() =>
    getDefaultAdminTemplateVariables(),
  );

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [html, setHtml] = useState("");

  const [result, setResult] = useState<SendResult | null>(null);

  const canSendNow = useMemo(() => {
    return Boolean(to.trim() && subject.trim() && (text.trim() || html.trim()));
  }, [to, subject, text, html]);

  const updateTemplateVariable = useCallback((key: keyof AdminEmailTemplateVariables, value: string) => {
    setTemplateVars((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const loadHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const res = await fetch("/api/admin/email/health");
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "加载邮件健康状态失败");
      }
      const parsed = parseHealthResponse(json);
      if (!parsed) {
        throw new Error("邮件健康状态解析失败");
      }
      setHealth(parsed.health);
      if (!to.trim() && parsed.recommendedRecipient) {
        setTo(parsed.recommendedRecipient);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载邮件健康状态失败");
    } finally {
      setLoadingHealth(false);
    }
  }, [to, toast]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const applyTemplate = useCallback(
    (silent?: boolean) => {
      const rendered = buildAdminEmailTemplate(templateId, templateVars);
      setSubject(rendered.subject);
      setText(rendered.text);
      setHtml(rendered.html);
      if (!silent) {
        toast.success("模板已应用");
      }
    },
    [templateId, templateVars, toast],
  );

  useEffect(() => {
    if (!subject && !text && !html) {
      applyTemplate(true);
    }
  }, [applyTemplate, html, subject, text]);

  const submit = useCallback(async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to,
          subject,
          text,
          html,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "发送邮件失败");
      }
      const payload = (json?.data ?? json) as SendResult;
      setResult(payload);
      if (payload.failed > 0) {
        toast.info(`已发送 ${payload.sent} 封，失败 ${payload.failed} 封`);
      } else {
        toast.success(`邮件已发送给 ${payload.sent} 位收件人`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送邮件失败");
    } finally {
      setSending(false);
    }
  }, [to, subject, text, html, toast]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg">SMTP 状态</h3>
            <p className="mt-1 text-xs text-muted">此页面与订单邮件共用同一 SMTP 通道。</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${
              health?.verified
                ? "border-green-300 bg-green-50 text-green-700"
                : health?.canSend
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-red-300 bg-red-50 text-red-700"
            }`}
          >
            {health?.verified ? "已验证" : health?.canSend ? "已配置" : "未配置"}
          </span>
        </div>
        <div className="mt-3 rounded-xl border border-border bg-contrast p-3 text-sm text-muted">
          <p>
            主机: <span className="text-ink">{health?.host ?? "-"}</span> / 端口:{" "}
            <span className="text-ink">{health?.port ?? "-"}</span> / TLS:{" "}
            <span className="text-ink">{health?.secure ? "true" : "false"}</span>
          </p>
          <p>
            发件人: <span className="text-ink">{health?.from ?? "-"}</span>
          </p>
          {health?.missing?.length ? (
            <p>
              缺失配置: <span className="text-ink">{health.missing.join(", ")}</span>
            </p>
          ) : null}
          {health?.verifyError ? (
            <p>
              验证错误: <span className="text-ink">{health.verifyError}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-3">
          <Button variant="ghost" onClick={loadHealth} disabled={loadingHealth}>
            {loadingHealth ? "检查中..." : "刷新 SMTP 状态"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="font-display text-lg">发送邮件</h3>
        <p className="mt-1 text-xs text-muted">
          可使用逗号、分号或换行一次发送给多个收件人。
        </p>

        <div className="mt-4 rounded-xl border border-border bg-contrast p-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">样式化模板</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-ink">
              <span className="font-medium">模板</span>
              <select
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
                value={templateId}
                onChange={(event) => setTemplateId(event.target.value as AdminEmailTemplateId)}
              >
                {ADMIN_EMAIL_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-xs text-muted md:pt-7">
              {ADMIN_EMAIL_TEMPLATES.find((template) => template.id === templateId)?.description}
            </div>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input
              label="客户姓名"
              value={templateVars.customerName}
              onChange={(event) => updateTemplateVariable("customerName", event.target.value)}
              placeholder="Tony Cheng"
            />
            <Input
              label="订单号"
              value={templateVars.orderNumber}
              onChange={(event) => updateTemplateVariable("orderNumber", event.target.value)}
              placeholder="UOOTD-RQ-2026-02-12345"
            />
            <Input
              label="付款链接"
              value={templateVars.paymentUrl}
              onChange={(event) => updateTemplateVariable("paymentUrl", event.target.value)}
              placeholder="https://..."
            />
            <Input
              label="物流跟踪链接"
              value={templateVars.trackingUrl}
              onChange={(event) => updateTemplateVariable("trackingUrl", event.target.value)}
              placeholder="https://..."
            />
            <Input
              label="预计送达"
              value={templateVars.estimatedDelivery}
              onChange={(event) => updateTemplateVariable("estimatedDelivery", event.target.value)}
              placeholder="5-9 个工作日"
            />
            <Input
              label="优惠码（可选）"
              value={templateVars.couponCode}
              onChange={(event) => updateTemplateVariable("couponCode", event.target.value)}
              placeholder="WELCOME10"
            />
            <Input
              label="客服邮箱"
              value={templateVars.supportEmail}
              onChange={(event) => updateTemplateVariable("supportEmail", event.target.value)}
              placeholder="support@luxuryootd.com"
            />
            <Input
              label="WhatsApp（可选）"
              value={templateVars.whatsappNumber}
              onChange={(event) => updateTemplateVariable("whatsappNumber", event.target.value)}
              placeholder="+8613462248923"
            />
            <Input
              label="网站地址"
              value={templateVars.siteUrl}
              onChange={(event) => updateTemplateVariable("siteUrl", event.target.value)}
              placeholder="https://luxuryootd.com"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => applyTemplate()}>
              应用模板到正文
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setTemplateVars(getDefaultAdminTemplateVariables())}
            >
              重置模板字段
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium">收件人</span>
            <textarea
              className="min-h-[90px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="user1@example.com, user2@example.com"
            />
          </label>
          <Input
            label="邮件主题"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="来自 UOOTD 的订单更新"
          />
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium">纯文本内容</span>
            <textarea
              className="min-h-[140px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="输入邮件正文..."
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium">HTML 内容（可选）</span>
            <textarea
              className="min-h-[160px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              placeholder="<p>输入 HTML 邮件内容...</p>"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={submit} loading={sending} disabled={!canSendNow || sending || !health?.canSend}>
            发送邮件
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSubject("");
              setText("");
              setHtml("");
              setResult(null);
            }}
          >
            清空内容
          </Button>
        </div>
      </div>

      {result ? (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <h3 className="font-display text-lg">发送结果</h3>
          <p className="mt-2 text-muted">
            成功: <span className="text-ink">{result.sent}</span> / 失败:{" "}
            <span className="text-ink">{result.failed}</span>
          </p>
          {result.sentTo.length ? (
            <p className="mt-2 text-muted">
              已发送至: <span className="text-ink">{result.sentTo.join(", ")}</span>
            </p>
          ) : null}
          {result.failedItems.length ? (
            <div className="mt-2 space-y-1 text-muted">
              {result.failedItems.map((item) => (
                <p key={item.email}>
                  {item.email}: <span className="text-ink">{item.error}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
