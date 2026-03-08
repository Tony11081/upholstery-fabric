import Image from "next/image";
import Link from "next/link";
import { BlogLocale, BlogPost, formatBlogDate, getBlogIndexCopy, getBlogPath } from "@/lib/content/blog";

type BlogArticleProps = {
  locale: BlogLocale;
  post: BlogPost;
};

export function BlogArticle({ locale, post }: BlogArticleProps) {
  const copy = getBlogIndexCopy(locale);

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">
            {formatBlogDate(locale, post.publishAt)}
          </p>
          <h1 className="font-display text-3xl leading-tight">{post.title}</h1>
          {post.excerpt && <p className="text-sm text-muted">{post.excerpt}</p>}
        </header>

        {post.coverImage && (
          <div className="relative aspect-[3/2] overflow-hidden rounded-2xl border border-border bg-contrast">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(min-width: 768px) 70vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        )}

        <article className="prose prose-neutral max-w-none text-sm text-ink">
          {post.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </article>

        <div className="flex items-center gap-2 text-sm">
          <Link
            href={getBlogPath(locale)}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium"
          >
            {copy.backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
