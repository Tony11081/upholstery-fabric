import Link from "next/link";
import type { Metadata } from "next";
import { getCategories, type CategoryWithChildren } from "@/lib/data/products";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";

const title = "Categories";
const description =
  "Browse luxury fabric categories including tweed, silk, jacquard, coating, lining, and upholstery.";
const categoriesUrl = absoluteUrl("/categories");

export const metadata: Metadata = {
  title: "Categories",
  description,
  alternates: {
    canonical: categoriesUrl,
  },
  openGraph: {
    title: `${BRAND_NAME} | ${title}`,
    description,
    url: categoriesUrl,
    type: "website",
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | ${title}`,
    description,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  let categories: CategoryWithChildren[] = [];
  let hasError = false;
  try {
    categories = await getCategories();
  } catch (error) {
    console.error("Categories page failed to load", error);
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Categories</p>
          <h1 className="font-display text-3xl">Categories are refreshing</h1>
          <p className="text-sm text-muted">
            The category view is refreshing. Please try again in a moment.
          </p>
          <div className="pt-4">
            <Link href="/" className="text-sm underline underline-offset-4">
              Return home
            </Link>
          </div>
        </div>
      </main>
    );
  }
  const parents = categories.filter((category) => !category.parentId);
  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${BRAND_NAME} Categories`,
    url: categoriesUrl,
    description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: parents.map((parent, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: parent.nameEn,
        url: absoluteUrl(`/categories/${parent.slug}`),
      })),
    },
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Categories</p>
          <h1 className="font-display text-3xl leading-tight">Browse by fabric type</h1>
          <p className="text-sm text-muted">
            Explore designer textile categories, refreshed with new archive arrivals.
          </p>
        </div>

        {parents.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
            Categories are being curated. Please check back soon.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {parents.map((parent) => (
            <section
              key={parent.id}
              className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">{parent.nameEn}</h2>
                <Link
                  href={`/categories/${parent.slug}`}
                  className="text-xs uppercase tracking-[0.18em] text-ink underline underline-offset-4"
                >
                  Explore
                </Link>
              </div>

              {parent.children.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {parent.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/categories/${child.slug}`}
                      className="rounded-full border border-border bg-contrast px-3 py-2 text-xs uppercase tracking-[0.18em] text-ink transition hover:border-ink"
                    >
                      {child.nameEn}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">More specialized textile groups are coming soon.</p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
