"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

type Product = { id: string; titleEn: string };
type Category = { id: string; nameEn: string };
type Discount = {
  id: string;
  name: string;
  scope: "GLOBAL" | "CATEGORY" | "PRODUCT";
  percentage: number;
  active: boolean;
  product?: Product | null;
  category?: Category | null;
};

export function DiscountsClient() {
  const toast = useToast();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    scope: "GLOBAL",
    percentage: "10",
    active: false,
    productId: "",
    categoryId: "",
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [discountRes, productRes, categoryRes] = await Promise.all([
        fetch("/api/admin/discounts"),
        fetch("/api/admin/products?limit=200"),
        fetch("/api/admin/categories"),
      ]);
      const discountJson = await discountRes.json();
      const productJson = await productRes.json();
      const categoryJson = await categoryRes.json();
      if (!discountRes.ok) {
        throw new Error(discountJson?.error?.message ?? "Unable to load discounts");
      }
      if (!productRes.ok) {
        throw new Error(productJson?.error?.message ?? "Unable to load products");
      }
      if (!categoryRes.ok) {
        throw new Error(categoryJson?.error?.message ?? "Unable to load categories");
      }
      setDiscounts(discountJson.data?.discounts ?? []);
      setProducts(productJson.data?.products ?? []);
      setCategories(categoryJson.data?.categories ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load discounts");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        scope: form.scope,
        percentage: Number(form.percentage),
        active: form.active,
        productId: form.scope === "PRODUCT" ? form.productId : null,
        categoryId: form.scope === "CATEGORY" ? form.categoryId : null,
      };
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create discount");
      }
      toast.success("Discount created");
      setForm({ name: "", scope: "GLOBAL", percentage: "10", active: false, productId: "", categoryId: "" });
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create discount");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (discount: Discount) => {
    try {
      const res = await fetch(`/api/admin/discounts/${discount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !discount.active }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to update discount");
      }
      toast.success("Discount updated");
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update discount");
    }
  };

  const handleDelete = async (discount: Discount) => {
    if (!confirm(`Delete discount ${discount.name}?`)) return;
    try {
      const res = await fetch(`/api/admin/discounts/${discount.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to delete discount");
      }
      toast.success("Discount deleted");
      await loadAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete discount");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-base font-medium">Create discount</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input
            label="Name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Input
            label="Percent"
            type="number"
            value={form.percentage}
            onChange={(event) => setForm((prev) => ({ ...prev, percentage: event.target.value }))}
          />
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">Scope</span>
            <select
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
              value={form.scope}
              onChange={(event) => setForm((prev) => ({ ...prev, scope: event.target.value }))}
            >
              <option value="GLOBAL">Global</option>
              <option value="CATEGORY">Category</option>
              <option value="PRODUCT">Product</option>
            </select>
          </label>
          {form.scope === "CATEGORY" && (
            <label className="flex flex-col gap-2 text-sm text-ink">
              <span className="font-medium text-ink">Category</span>
              <select
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
                value={form.categoryId}
                onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value }))}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nameEn}
                  </option>
                ))}
              </select>
            </label>
          )}
          {form.scope === "PRODUCT" && (
            <label className="flex flex-col gap-2 text-sm text-ink">
              <span className="font-medium text-ink">Product</span>
              <select
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
                value={form.productId}
                onChange={(event) => setForm((prev) => ({ ...prev, productId: event.target.value }))}
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.titleEn}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))}
            />
            Active now
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={handleCreate} loading={saving}>
            Create discount
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading discounts...</p>
        ) : discounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No discounts yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Scope</th>
                <th className="py-2 pr-2">Percent</th>
                <th className="py-2 pr-2">Target</th>
                <th className="py-2 pr-2">Active</th>
                <th className="py-2 pr-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((discount) => (
                <tr key={discount.id} className="border-b border-border/40">
                  <td className="py-3 pr-2">{discount.name}</td>
                  <td className="py-3 pr-2">{discount.scope}</td>
                  <td className="py-3 pr-2">{discount.percentage}%</td>
                  <td className="py-3 pr-2">
                    {discount.product?.titleEn ?? discount.category?.nameEn ?? "All products"}
                  </td>
                  <td className="py-3 pr-2">{discount.active ? "Yes" : "No"}</td>
                  <td className="py-3 pr-2 space-x-3">
                    <button className="underline underline-offset-4" onClick={() => handleToggle(discount)}>
                      {discount.active ? "Disable" : "Enable"}
                    </button>
                    <button className="underline underline-offset-4" onClick={() => handleDelete(discount)}>
                      Delete
                    </button>
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
