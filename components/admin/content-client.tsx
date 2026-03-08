"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/useToast";

const TYPE_OPTIONS = ["EDITORIAL", "DROP", "GUIDE", "LOOKBOOK"] as const;
const STATUS_OPTIONS = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;

type ContentPost = {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  coverImage?: string | null;
  publishAt?: string | null;
  createdAt: string;
  productsCount: number;
  reservationsCount: number;
};

type Reservation = {
  id: string;
  email: string;
  status: string;
  createdAt: string;
  customerName?: string | null;
};

export function ContentClient() {
  const toast = useToast();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]>("EDITORIAL");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("DRAFT");
  const [publishAt, setPublishAt] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [productSlugs, setProductSlugs] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activeDropId, setActiveDropId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/content");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load content");
      }
      setPosts(json.data?.posts ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load content");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const createContent = async () => {
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: slug || undefined,
          excerpt: excerpt || undefined,
          type,
          status,
          publishAt: publishAt || undefined,
          coverImage: coverImage || undefined,
          productSlugs,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to create content");
      }
      if (json.data?.missingSlugs?.length) {
        toast.error(`Missing products: ${json.data.missingSlugs.join(", ")}`);
      } else {
        toast.success("Content created");
      }
      setTitle("");
      setSlug("");
      setExcerpt("");
      setPublishAt("");
      setCoverImage("");
      setProductSlugs("");
      loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create content");
    }
  };

  const loadReservations = async (contentId: string) => {
    try {
      const res = await fetch(`/api/admin/content/${contentId}/reservations`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load reservations");
      }
      setReservations(json.data?.reservations ?? []);
      setActiveDropId(contentId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load reservations");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Input label="Slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Excerpt"
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
          placeholder="Short editorial summary"
        />
        <Input
          label="Cover image URL"
          value={coverImage}
          onChange={(event) => setCoverImage(event.target.value)}
          placeholder="https://..."
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Type</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={type}
            onChange={(event) => setType(event.target.value as (typeof TYPE_OPTIONS)[number])}
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-ink">
          <span className="font-medium text-ink">Status</span>
          <select
            className="rounded-md border border-border bg-surface px-4 py-3 text-sm text-ink"
            value={status}
            onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="Publish date"
          type="datetime-local"
          value={publishAt}
          onChange={(event) => setPublishAt(event.target.value)}
        />
        <Input
          label="Product slugs (comma separated)"
          value={productSlugs}
          onChange={(event) => setProductSlugs(event.target.value)}
          placeholder="heritage-tote, sculpted-heel"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={createContent}>Create content</Button>
        <Button variant="ghost" onClick={loadPosts}>
          Refresh
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading content...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No content posts yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/60 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="py-2 pr-2">Post</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Products</th>
                <th className="py-2 pr-2">Reservations</th>
                <th className="py-2 pr-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className="border-b border-border/40 last:border-b-0">
                  <td className="py-3 pr-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{post.title}</span>
                      <span className="text-xs text-muted">/{post.slug}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-2">{post.type}</td>
                  <td className="py-3 pr-2">{post.status}</td>
                  <td className="py-3 pr-2">{post.productsCount}</td>
                  <td className="py-3 pr-2">{post.reservationsCount}</td>
                  <td className="py-3 pr-2">
                    {post.type === "DROP" ? (
                      <Button size="sm" variant="ghost" onClick={() => loadReservations(post.id)}>
                        View reservations
                      </Button>
                    ) : (
                      <span className="text-xs text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {activeDropId && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg">Drop reservations</h3>
            <Button size="sm" variant="ghost" onClick={() => setActiveDropId(null)}>
              Close
            </Button>
          </div>
          {reservations.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No reservations yet.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="font-medium">{reservation.email}</p>
                    <p className="text-xs text-muted">{reservation.status}</p>
                  </div>
                  <span className="text-xs text-muted">{new Date(reservation.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
