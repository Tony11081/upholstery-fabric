"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";
import { resolveImageUrl } from "@/lib/utils/image";

type Category = {
  id: string;
  nameEn: string;
  slug: string;
  parentId?: string | null;
};

type ProductImageInput = {
  url: string;
  alt?: string;
  label?: string;
  sortOrder?: number;
  isCover?: boolean;
};

type ProductResponse = {
  id: string;
  titleEn: string;
  slug: string;
  descriptionEn?: string | null;
  categoryId?: string | null;
  price: string;
  currency: string;
  inventory: number;
  tags: string[];
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  qaStatus?: "PENDING" | "APPROVED" | "REJECTED";
  qualityScore?: number;
  qualityNotes?: string | null;
  images: ProductImageInput[];
};

type FormState = {
  titleEn: string;
  slug: string;
  descriptionEn: string;
  categoryId: string;
  price: string;
  currency: string;
  inventory: string;
  tags: string;
  isNew: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  qaStatus: "PENDING" | "APPROVED" | "REJECTED";
  qualityNotes: string;
};

const emptyForm: FormState = {
  titleEn: "",
  slug: "",
  descriptionEn: "",
  categoryId: "",
  price: "",
  currency: "USD",
  inventory: "0",
  tags: "",
  isNew: false,
  isBestSeller: false,
  isActive: true,
  qaStatus: "PENDING",
  qualityNotes: "",
};

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<ProductImageInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [qualityScore, setQualityScore] = useState<number | null>(null);

  const isEdit = Boolean(productId);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.parentId ? `${category.nameEn} (child)` : category.nameEn,
      })),
    [categories],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [categoryRes, productRes] = await Promise.all([
          fetch("/api/admin/categories"),
          productId ? fetch(`/api/admin/products/${productId}`) : Promise.resolve(null),
        ]);
        if (!categoryRes.ok) {
          throw new Error("Unable to load categories");
        }
        const categoryJson = await categoryRes.json();
        if (active) {
          setCategories(categoryJson.data?.categories ?? []);
        }

        if (productRes) {
          if (!productRes.ok) {
            throw new Error("Unable to load product");
          }
          const productJson = await productRes.json();
          const product: ProductResponse = productJson.data?.product;
          if (product && active) {
            setForm({
              titleEn: product.titleEn ?? "",
              slug: product.slug ?? "",
              descriptionEn: product.descriptionEn ?? "",
              categoryId: product.categoryId ?? "",
              price: product.price?.toString() ?? "",
              currency: product.currency ?? "USD",
              inventory: String(product.inventory ?? 0),
              tags: (product.tags ?? []).join(", "),
              isNew: Boolean(product.isNew),
              isBestSeller: Boolean(product.isBestSeller),
              isActive: Boolean(product.isActive),
              qaStatus: product.qaStatus ?? "APPROVED",
              qualityNotes: product.qualityNotes ?? "",
            });
            setImages(product.images ?? []);
            setQualityScore(typeof product.qualityScore === "number" ? product.qualityScore : null);
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load product");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [productId, toast]);

  const updateField = (key: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/uploads", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Upload failed");
      }
      setImages((prev) => [
        ...prev,
        { url: json.data?.url ?? json.url, alt: form.titleEn, isCover: prev.length === 0 },
      ]);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAddImageUrl = () => {
    if (!imageUrl.trim()) return;
    setImages((prev) => [
      ...prev,
      { url: imageUrl.trim(), alt: form.titleEn, isCover: prev.length === 0 },
    ]);
    setImageUrl("");
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!form.titleEn || !form.price) {
        toast.error("Title and price are required");
        setSaving(false);
        return;
      }
        const payload = {
          titleEn: form.titleEn,
          slug: form.slug || undefined,
          descriptionEn: form.descriptionEn || undefined,
          categoryId: form.categoryId || null,
          price: Number(form.price),
          currency: form.currency,
          inventory: Number(form.inventory),
          tags: form.tags,
          isNew: form.isNew,
          isBestSeller: form.isBestSeller,
          isActive: form.isActive,
          qaStatus: form.qaStatus,
          qualityNotes: form.qualityNotes || undefined,
          images: images.map((image, index) => ({
            ...image,
            sortOrder: index,
            isCover: index === 0,
        })),
      };
      const res = await fetch(isEdit ? `/api/admin/products/${productId}` : "/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to save product");
      }
      toast.success(isEdit ? "Product updated" : "Product created");
      const returnedScore = json.data?.product?.qualityScore ?? json.product?.qualityScore;
      if (typeof returnedScore === "number") {
        setQualityScore(returnedScore);
      }
      if (!isEdit) {
        const newId = json.data?.product?.id ?? json.product?.id;
        if (newId) {
          router.push(`/admin/products/${newId}`);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit) return;
    if (!confirm("Delete this product?")) return;
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to delete product");
      }
      toast.success("Product deleted");
      router.push("/admin/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete product");
    }
  };

  if (loading) {
    return <div className="text-sm text-muted">Loading product...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Admin</p>
          <h1 className="font-display text-3xl">{isEdit ? "Edit product" : "New product"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/admin/products">Back to products</Link>
          </Button>
          {isEdit && (
            <Button variant="ghost" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button onClick={handleSave} loading={saving}>
            Save product
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <Input
            label="Title"
            value={form.titleEn}
            onChange={(event) => updateField("titleEn", event.target.value)}
            placeholder="Product title"
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(event) => updateField("slug", event.target.value)}
            placeholder="auto-generated if empty"
          />
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">Description</span>
            <textarea
              className="min-h-[120px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
              value={form.descriptionEn}
              onChange={(event) => updateField("descriptionEn", event.target.value)}
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Price"
              type="number"
              value={form.price}
              onChange={(event) => updateField("price", event.target.value)}
            />
            <Input
              label="Currency"
              value={form.currency}
              onChange={(event) => updateField("currency", event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Inventory"
              type="number"
              value={form.inventory}
              onChange={(event) => updateField("inventory", event.target.value)}
            />
            <label className="flex flex-col gap-2 text-sm text-ink">
              <span className="font-medium text-ink">Category</span>
              <select
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
                value={form.categoryId}
                onChange={(event) => updateField("categoryId", event.target.value)}
              >
                <option value="">Unassigned</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Input
            label="Tags (comma separated)"
            value={form.tags}
            onChange={(event) => updateField("tags", event.target.value)}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm text-ink">
              <span className="font-medium text-ink">QA status</span>
              <select
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
                value={form.qaStatus}
                onChange={(event) =>
                  updateField("qaStatus", event.target.value as FormState["qaStatus"])
                }
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </label>
            <Input
              label="Quality score"
              readOnly
              value={qualityScore !== null ? `${qualityScore}/100` : "Auto-score"}
            />
          </div>
          <label className="flex flex-col gap-2 text-sm text-ink">
            <span className="font-medium text-ink">Quality notes</span>
            <textarea
              className="min-h-[90px] rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
              value={form.qualityNotes}
              onChange={(event) => updateField("qualityNotes", event.target.value)}
              placeholder="Auto-generated notes can be edited."
            />
          </label>
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isNew}
                onChange={(event) => updateField("isNew", event.target.checked)}
              />
              New badge
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isBestSeller}
                onChange={(event) => updateField("isBestSeller", event.target.checked)}
              />
              Best seller
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateField("isActive", event.target.checked)}
              />
              Active listing
            </label>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border bg-surface p-6">
          <div className="space-y-2">
            <p className="text-sm font-medium text-ink">Images</p>
            <div className="flex gap-2">
              <Input
                label="Add image URL"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
              <Button variant="ghost" onClick={handleAddImageUrl}>
                Add
              </Button>
            </div>
            <label className="flex flex-col gap-2 text-sm text-ink">
              <span className="font-medium text-ink">Upload image</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    handleUpload(file);
                  }
                }}
              />
            </label>
          </div>
          {images.length === 0 ? (
            <p className="text-sm text-muted-foreground">No images yet.</p>
          ) : (
            <ul className="space-y-3">
              {images.map((image, index) => {
                const previewUrl = resolveImageUrl(image.url) ?? image.url;
                return (
                <li key={`${image.url}-${index}`} className="flex items-center gap-3 text-sm">
                  <div className="h-12 w-12 overflow-hidden rounded-md border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt={image.alt ?? ""} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="truncate text-xs text-muted-foreground">{image.url}</p>
                    {index === 0 && <span className="text-xs text-ink">Cover</span>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveImage(index)}>
                    Remove
                  </Button>
                </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
