import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryClient } from "@/components/categories/category-client";
import { getCategoryBySlug } from "@/lib/data/products";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";

type Props = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return {
      title: "Category",
      robots: { index: false, follow: false },
    };
  }
  const title = category.nameEn;
  const description = `Explore curated ${category.nameEn.toLowerCase()} from the ${BRAND_NAME} edit, reviewed before dispatch.`;
  const url = absoluteUrl(`/categories/${category.slug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      images: [absoluteUrl(DEFAULT_OG_IMAGE)],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(DEFAULT_OG_IMAGE)],
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  let category;
  try {
    category = await getCategoryBySlug(slug);
  } catch (error) {
    console.error("Category page failed to load", error);
    return (
      <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Category</p>
          <h1 className="font-display text-3xl">Category temporarily unavailable</h1>
          <p className="text-sm text-muted">
            This category is refreshing. Please return to the category list.
          </p>
          <div className="pt-4">
            <Link href="/categories" className="text-sm underline underline-offset-4">
              Browse categories
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!category) {
    notFound();
  }

  const categoryUrl = absoluteUrl(`/categories/${category.slug}`);
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: absoluteUrl("/"),
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Categories",
      item: absoluteUrl("/categories"),
    },
    {
      "@type": "ListItem",
      position: 3,
      name: category.nameEn,
      item: categoryUrl,
    },
  ];
  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${categoryUrl}#collection`,
        url: categoryUrl,
        name: category.nameEn,
        description: `Explore curated ${category.nameEn.toLowerCase()} from the ${BRAND_NAME} edit, reviewed before dispatch.`,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${categoryUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Category</p>
          <h1 className="font-display text-3xl leading-tight">{category.nameEn}</h1>
          {category.parent && (
            <Link href="/categories" className="text-sm underline underline-offset-4">
              Back to categories
            </Link>
          )}
        </div>
        <CategoryClient slug={category.slug} name={category.nameEn} />
      </div>
    </main>
  );
}
