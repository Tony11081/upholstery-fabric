import Image from "next/image";
import Link from "next/link";
import { BlogLocale, BlogPost, formatBlogDate, getBlogIndexCopy, getBlogPath } from "@/lib/content/blog";

type BlogIndexProps = {
  locale: BlogLocale;
  posts: BlogPost[];
};

export function BlogIndex({ locale, posts }: BlogIndexProps) {
  const copy = getBlogIndexCopy(locale);

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">{copy.eyebrow}</p>
          <h1 className="font-display text-3xl">{copy.title}</h1>
          <p className="text-sm text-muted">{copy.subtitle}</p>
        </header>

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
            {copy.emptyState}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={`${post.locale}-${post.slug}`}
                href={getBlogPath(locale, post.slug)}
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
                      Journal
                    </div>
                  )}
                </div>
                <div className="space-y-2 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">
                    {formatBlogDate(locale, post.publishAt)}
                  </p>
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
