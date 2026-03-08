import { HomeClient } from "@/components/home/home-client";
import { getCategories, getProductStats, getProducts, type ProductListItem } from "@/lib/data/products";
import Link from "next/link";
import type { Category } from "@prisma/client";
import type { Metadata } from "next";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";

export const metadata: Metadata = {
  title: "Luxury fabrics, archive textiles & premium upholstery",
  description:
    "Source luxury maison fabrics by the meter, including tweed, silk, jacquard, coating, lining, and upholstery selections.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: `${BRAND_NAME} | Luxury fabrics & designer textiles`,
    description:
      "Source luxury maison fabrics by the meter, including tweed, silk, jacquard, coating, lining, and upholstery selections.",
    url: absoluteUrl("/"),
    type: "website",
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 1200,
        height: 630,
        alt: `${BRAND_NAME} curated fabric archive`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND_NAME} | Luxury fabrics & designer textiles`,
    description:
      "Source luxury maison fabrics by the meter, including tweed, silk, jacquard, coating, lining, and upholstery selections.",
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export const revalidate = 60;

export default async function Home() {
  let categories: Category[] = [];
  let stats: { total: number; newCount: number; lastUpdated: Date | null } = {
    total: 0,
    newCount: 0,
    lastUpdated: null,
  };
  let initialRecommendations: {
    curated: ProductListItem[];
    ready: ProductListItem[];
  } = {
    curated: [],
    ready: [],
  };
  let hasError = false;

  try {
    const [loadedCategories, loadedStats, loadedCurated, loadedReady] = await Promise.all([
      getCategories(),
      getProductStats(),
      getProducts({ sort: "popular", limit: 6 }).catch(() => []),
      getProducts({ availability: "in_stock", sort: "ready", limit: 6 }).catch(() => []),
    ]);
    categories = loadedCategories;
    stats = loadedStats;
    initialRecommendations = {
      curated: JSON.parse(JSON.stringify(loadedCurated)) as ProductListItem[],
      ready: JSON.parse(JSON.stringify(loadedReady)) as ProductListItem[],
    };
  } catch (error) {
    console.error("Home page failed to load", error);
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Curated edit</p>
          <h1 className="font-display text-3xl">Refreshing the fabric archive</h1>
          <p className="text-sm text-muted">
            The fabric catalog is refreshing. Please try again in a moment.
          </p>
          <div className="pt-4">
            <Link href="/" className="text-sm underline underline-offset-4">
              Refresh
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const homeJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${BRAND_NAME} Fabric Archive`,
    url: absoluteUrl("/"),
    description:
      "Discover luxury maison fabrics, deadstock textiles, and premium upholstery selections with swatch support and tracked delivery.",
    inLanguage: "en",
  };

  return (
    <main className="min-h-screen bg-background text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <HomeClient
        categories={categories}
        stats={{
          ...stats,
          lastUpdated: stats.lastUpdated ? stats.lastUpdated.toISOString() : null,
        }}
        initialRecommendations={initialRecommendations}
      />
    </main>
  );
}
