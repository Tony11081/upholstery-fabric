import { getBrandBySlug } from "@/lib/data/brands";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/utils/site";
import { BrandProductsClient } from "@/components/brands/brand-products-client";

type Props = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) {
    return {
      title: "Brand",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: `${brand.name} - Shop Luxury Products`,
    description: brand.description || `Shop luxury products from ${brand.name}`,
    alternates: {
      canonical: absoluteUrl(`/brands/${brand.slug}`),
    },
  };
}

export const revalidate = 300; // 5 minutes

export default async function BrandPage({ params }: Props) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Brand</p>
          <h1 className="font-display text-4xl md:text-5xl">{brand.name}</h1>
          {brand.description && (
            <p className="max-w-2xl text-muted">{brand.description}</p>
          )}
          <p className="text-sm text-muted">
            {brand._count?.products || 0} {brand._count?.products === 1 ? "product" : "products"}
          </p>
        </div>

        <BrandProductsClient slug={brand.slug} />
      </div>
    </main>
  );
}
