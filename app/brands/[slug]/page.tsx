import { getBrandBySlug } from "@/lib/data/brands";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";
import { BrandProductsClient } from "@/components/brands/brand-products-client";
import { getProducts, type ProductListItem } from "@/lib/data/products";
import { getBrandSeoContent } from "@/lib/seo/catalog-pages";

type Props = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) {
    return {
      title: "Brand",
      robots: { index: false, follow: false },
    };
  }

  const seo = getBrandSeoContent(brand.name, brand.description);
  const title = `${brand.name} fabric by the yard`;
  const url = absoluteUrl(`/brands/${brand.slug}`);

  return {
    title,
    description: seo.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${title} | ${BRAND_NAME}`,
      description: seo.description,
      url,
      images: [absoluteUrl(DEFAULT_OG_IMAGE)],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${BRAND_NAME}`,
      description: seo.description,
      images: [absoluteUrl(DEFAULT_OG_IMAGE)],
    },
  };
}

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const [brand, loadedProducts] = await Promise.all([
    getBrandBySlug(slug),
    getProducts({ brand: slug, sort: "popular", limit: 24 }).catch(() => []),
  ]);

  if (!brand) {
    notFound();
  }

  const seo = getBrandSeoContent(brand.name, brand.description);
  const initialProducts = JSON.parse(JSON.stringify(loadedProducts)) as ProductListItem[];
  const brandUrl = absoluteUrl(`/brands/${brand.slug}`);
  const itemList = initialProducts.slice(0, 12).map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: absoluteUrl(`/product/${product.slug}`),
    name: product.titleEn,
  }));
  const brandJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${brandUrl}#collection`,
        url: brandUrl,
        name: `${brand.name} fabric by the yard`,
        description: seo.description,
        about: {
          "@type": "Brand",
          name: brand.name,
        },
        mainEntity: itemList.length
          ? {
              "@type": "ItemList",
              "@id": `${brandUrl}#items`,
              itemListElement: itemList,
            }
          : undefined,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${brandUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Brands",
            item: absoluteUrl("/brands"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: brand.name,
            item: brandUrl,
          },
        ],
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
    <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(brandJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Brand</p>
          <h1 className="font-display text-4xl md:text-5xl">{brand.name} fabric by the yard</h1>
          <p className="max-w-3xl text-muted">{seo.description}</p>
          <p className="text-sm text-muted">
            {brand._count?.products || 0} {brand._count?.products === 1 ? "product" : "products"}
          </p>
        </div>

        <section className="mb-10 grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)] md:grid-cols-[1.2fr,0.8fr]">
          <div className="space-y-3">
            <h2 className="font-display text-2xl">Why this brand page matters</h2>
            {seo.intro.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-muted">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="space-y-3">
            <h2 className="font-display text-xl">What buyers compare first</h2>
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
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Indexed brand catalog</p>
            <h2 className="font-display text-2xl">{brand.name} designer fabric listings</h2>
          </div>
          <BrandProductsClient slug={brand.slug} initialProducts={initialProducts} />
        </section>

        <section className="mt-10 space-y-3 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)]">
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
