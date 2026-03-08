import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";

export const dynamic = "force-dynamic";

const title = "Editorial";
const description = "Stories, drops, and care notes from the curated luxury edit.";
const editorialUrl = absoluteUrl("/editorial");

export const metadata: Metadata = {
  title: "Editorial",
  description,
  alternates: {
    canonical: editorialUrl,
  },
  openGraph: {
    title: `${BRAND_NAME} | ${title}`,
    description,
    url: editorialUrl,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | ${title}`,
    description,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export default async function EditorialPage() {
  const posts = await prisma.contentPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishAt: "desc" }, { createdAt: "desc" }],
    take: 24,
  });

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Editorial</p>
          <h1 className="font-display text-3xl">Stories, Drops, and Care</h1>
          <p className="text-sm text-muted">Curated edits, care notes, and upcoming releases.</p>
        </header>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
            Editorial stories are being prepared. Please check back soon.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/editorial/${post.slug}`}
                className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]"
              >
                <div className="relative aspect-[3/2] bg-contrast">
                  {post.coverImage ? (
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      sizes="(min-width: 768px) 50vw, 100vw"
                      className="object-cover transition duration-700 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.2em] text-muted">
                      {post.type}
                    </div>
                  )}
                </div>
                <div className="space-y-2 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{post.type}</p>
                  <h2 className="font-display text-xl leading-snug">{post.title}</h2>
                  {post.excerpt && <p className="text-sm text-muted">{post.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
