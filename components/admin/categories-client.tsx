"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type Category = {
  id: string;
  nameEn: string;
  slug: string;
  parentId?: string | null;
  children?: Category[];
  status?: "ACTIVE" | "PENDING";
};

export function CategoriesClient() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load categories");
      }
      setCategories(json.data?.categories ?? json.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load categories");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const parentOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: `${category.nameEn}${category.status === "PENDING" ? " (pending)" : ""}`,
      })),
    [categories],
  );

  const parents = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories],
  );

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update category");
      }
      toast.success("Category approved");
      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update category");
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setCreating(true);
    try {
      const payload = {
        nameEn: name.trim(),
        slug: slug.trim() || undefined,
        parentId: parentId || null,
      };
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create category");
      }
      toast.success("Category created");
      setName("");
      setSlug("");
      setParentId("");
      await loadCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create category");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Create</p>
          <h2 className="text-lg font-medium">New category</h2>
        </div>
        <Input
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Travel bags"
        />
        <Input
          label="Slug (optional)"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="auto-generated if empty"
        />
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Parent category (optional)</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">No parent</option>
            {parentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={handleCreate} loading={creating} className="w-full rounded-full">
          Create category
        </Button>
        <Button variant="ghost" onClick={loadCategories} loading={loading} className="w-full">
          Refresh list
        </Button>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Catalog</p>
              <h2 className="text-lg font-medium">Category structure</h2>
            </div>
            <span className="text-xs text-muted">{categories.length} total</span>
          </div>
          {loading ? (
            <p className="mt-4 text-sm text-muted">Loading categories...</p>
          ) : parents.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No categories created yet.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {parents.map((parent) => (
                <div key={parent.id} className="rounded-xl border border-border bg-contrast p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{parent.nameEn}</p>
                      <p className="text-xs text-muted">/{parent.slug}</p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
                        {parent.status ?? "ACTIVE"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {parent.children?.length ?? 0} subcategories
                      </span>
                      {parent.status === "PENDING" && (
                        <Button variant="ghost" onClick={() => handleApprove(parent.id)}>
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                  {parent.children && parent.children.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {parent.children.map((child) => (
                        <li key={child.id} className="flex items-center justify-between">
                          <div>
                            <span>{child.nameEn}</span>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">
                              {child.status ?? "ACTIVE"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted">/{child.slug}</span>
                            {child.status === "PENDING" && (
                              <Button variant="ghost" onClick={() => handleApprove(child.id)}>
                                Approve
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
