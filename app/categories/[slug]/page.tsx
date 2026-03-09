import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryClient } from "@/components/categories/category-client";
import { getCategoryBySlug, getProducts, type ProductListItem } from "@/lib/data/products";
import { DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";
import { getCategorySeoContent } from "@/lib/seo/catalog-pages";

type Props = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    return {
      title: "Category",
      robots: { index: false, follow: false },
    };
  }
  const seo = getCategorySeoContent(category.nameEn, category.slug);
  const title = `${category.nameEn} fabric by the yard`;
  const description = seo.description;
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
  let initialProducts: ProductListItem[] = [];
  try {
    const [loadedCategory, loadedProducts] = await Promise.all([
      getCategoryBySlug(slug),
      getProducts({ category: slug, sort: "popular", limit: 24 }).catch(() => []),
    ]);
    category = loadedCategory;
    initialProducts = JSON.parse(JSON.stringify(loadedProducts)) as ProductListItem[];
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

  const seo = getCategorySeoContent(category.nameEn, category.slug);
  const categoryUrl = absoluteUrl(`/categories/${category.slug}`);
  const categoryHeading = `${category.nameEn} fabric by the yard`;
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
  const itemList = initialProducts.slice(0, 12).map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: absoluteUrl(`/product/${product.slug}`),
    name: product.titleEn,
  }));
  const categoryJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${categoryUrl}#collection`,
        url: categoryUrl,
        name: categoryHeading,
        description: seo.description,
        mainEntity: itemList.length
          ? {
              "@type": "ItemList",
              "@id": `${categoryUrl}#items`,
              itemListElement: itemList,
            }
          : undefined,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${categoryUrl}#breadcrumb`,
        itemListElement: breadcrumbItems,
      },
    ],
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: seo.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Category</p>
          <h1 className="font-display text-3xl leading-tight">{categoryHeading}</h1>
          <p className="max-w-3xl text-sm text-muted">{seo.description}</p>
          {category.parent && (
            <Link href="/categories" className="text-sm underline underline-offset-4">
              Back to categories
            </Link>
          )}
        </div>

        <section className="grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)] md:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-3">
            <h2 className="font-display text-2xl">How to shop this {category.nameEn.toLowerCase()} category</h2>
            {seo.intro.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-muted">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="space-y-3">
            <h2 className="font-display text-xl">What buyers usually compare</h2>
            <ul className="space-y-2 text-sm text-muted">
              {seo.highlights.map((highlight) => (
                <li key={highlight} className="rounded-xl border border-border bg-contrast px-4 py-3">
                  {highlight}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Indexed product list</p>
            <h2 className="font-display text-2xl">Designer {category.nameEn.toLowerCase()} listings</h2>
          </div>
          <CategoryClient slug={category.slug} name={category.nameEn} initialProducts={initialProducts} />
        </section>

        <section className="space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">FAQ</p>
            <h2 className="font-display text-2xl">Questions buyers ask before ordering</h2>
          </div>
          <div className="space-y-3">
            {seo.faqs.map((faq) => (
              <details key={faq.question} className="rounded-xl border border-border bg-contrast px-4 py-4">
                <summary className="cursor-pointer list-none text-sm font-medium text-ink">
                  {faq.question}
                </summary>
                <p className="mt-3 text-sm leading-6 text-muted">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
