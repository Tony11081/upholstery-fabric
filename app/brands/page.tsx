import { getBrands } from "@/lib/data/brands";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND_NAME, absoluteUrl } from "@/lib/utils/site";

export const metadata: Metadata = {
  title: "Shop by Brand",
  description: "Browse luxury products by your favorite brands",
  alternates: {
    canonical: absoluteUrl("/brands"),
  },
};

export const revalidate = 3600; // 1 hour

export default async function BrandsPage() {
  const brands = await getBrands();

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Curated brands</p>
          <h1 className="font-display text-4xl md:text-5xl">Shop by Brand</h1>
          <p className="mx-auto max-w-2xl text-muted">
            Discover luxury products from the world's most prestigious brands
          </p>
        </div>

        {brands.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-12 text-center">
            <p className="text-muted">No brands available at the moment</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                href={`/brands/${brand.slug}`}
                className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-ink/30 hover:shadow-[var(--shadow-soft)]"
              >
                <div className="space-y-2">
                  <h2 className="font-display text-xl group-hover:text-ink/80 transition">
                    {brand.name}
                  </h2>
                  {brand._count && (
                    <p className="text-sm text-muted">
                      {brand._count.products} {brand._count.products === 1 ? "product" : "products"}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
