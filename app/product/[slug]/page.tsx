import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdpContent } from "@/components/product/pdp-content";
import { getProductBySlug, getProducts, type ProductListItem } from "@/lib/data/products";
import Link from "next/link";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";
import { getBrandInfo } from "@/lib/utils/brands";
import { RelatedProducts } from "@/components/product/related-products";
import { getProductAttributeValues } from "@/lib/seo/product-attributes";

export const revalidate = 60;

type Props = {
  params: { slug: string } | Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) {
      return {
        title: "Product",
        robots: { index: false, follow: false },
      };
    }

    const title = product.titleEn;
    const description =
      product.descriptionEn ??
      "Curated luxury selection reviewed before dispatch, with secure hosted checkout and tracked delivery.";
    const url = absoluteUrl(`/product/${product.slug}`);
    const heroImage = product.images[0]?.url;
    const ogImage = heroImage
      ? heroImage.startsWith("http")
        ? heroImage
        : absoluteUrl(heroImage)
      : absoluteUrl(DEFAULT_OG_IMAGE);

    return {
      title,
      description,
      keywords: product.tags,
      alternates: { canonical: url },
      openGraph: {
        url,
        title,
        description,
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 1600,
            alt: product.titleEn,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
      other: {
        "og:type": "product",
      },
    };
  } catch (error) {
    console.error("Product metadata failed to load", error);
    return {
      title: "Product",
      robots: { index: false, follow: false },
    };
  }
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  let product;
  try {
    product = await getProductBySlug(slug);
  } catch (error) {
    console.error("Product page failed to load", error);
    return (
      <main className="min-h-screen bg-background px-4 pb-20 pt-10 sm:px-6 md:px-8">
        <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-border bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Product</p>
          <h1 className="font-display text-3xl">Product temporarily unavailable</h1>
          <p className="text-sm text-muted">
            This product is refreshing. Please refresh or return to the edit.
          </p>
          <div className="pt-4">
            <Link href="/" className="text-sm underline underline-offset-4">
              Back to home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!product) {
    notFound();
  }

  // Convert Prisma decimals to plain JSON before passing into a client component.
  const productPayload = JSON.parse(JSON.stringify(product));
  const brandInfo = getBrandInfo({ tags: product.tags, titleEn: product.titleEn });
  const brandTag = brandInfo?.tag ?? null;
  const brandName = brandInfo?.label ?? BRAND_NAME;
  const categorySlug = product.category?.slug ?? null;
  const [brandMatches, categoryMatches] = await Promise.all([
    brandTag ? getProducts({ brand: brandTag, sort: "popular", limit: 8 }) : Promise.resolve([]),
    categorySlug ? getProducts({ category: categorySlug, sort: "popular", limit: 8 }) : Promise.resolve([]),
  ]);
  const relatedProducts = dedupeProducts([...brandMatches, ...categoryMatches])
    .filter((item) => item.id !== product.id)
    .slice(0, 8);
  const relatedPayload = JSON.parse(JSON.stringify(relatedProducts)) as ProductListItem[];

  const productUrl = absoluteUrl(`/product/${product.slug}`);
  const price = product.discountedPrice ?? Number(product.price);
  const priceValidUntil = new Date();
  priceValidUntil.setMonth(priceValidUntil.getMonth() + 6);
  const attributes = getProductAttributeValues(product);
  const additionalProperty = [
    {
      "@type": "PropertyValue",
      name: "Selling unit",
      value: "1 yard",
    },
    ...(attributes.primaryMaterial
      ? [
          {
            "@type": "PropertyValue",
            name: "Material",
            value: attributes.primaryMaterial,
          },
        ]
      : []),
    ...(attributes.primaryColor
      ? [
          {
            "@type": "PropertyValue",
            name: "Color",
            value: attributes.primaryColor,
          },
        ]
      : []),
    ...(attributes.primarySize
      ? [
          {
            "@type": "PropertyValue",
            name: "Size",
            value: attributes.primarySize,
          },
        ]
      : []),
    ...(product.category?.nameEn
      ? [
          {
            "@type": "PropertyValue",
            name: "Category",
            value: product.category.nameEn,
          },
        ]
      : []),
  ];
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    url: productUrl,
    name: product.titleEn,
    description: product.descriptionEn ?? "",
    image: product.images.map((img) => (img.url.startsWith("http") ? img.url : absoluteUrl(img.url))),
    sku: product.slug,
    category: product.category?.nameEn ?? undefined,
    color:
      attributes.colors.length > 1
        ? attributes.colors.join(", ")
        : attributes.primaryColor ?? undefined,
    size:
      attributes.sizes.length > 1
        ? attributes.sizes.join(", ")
        : attributes.primarySize ?? undefined,
    material:
      attributes.materials.length > 1
        ? attributes.materials.join(", ")
        : attributes.primaryMaterial ?? undefined,
    additionalProperty: additionalProperty.length ? additionalProperty : undefined,
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    offers: {
      "@type": "Offer",
      "@id": `${productUrl}#offer`,
      url: productUrl,
      priceCurrency: product.currency,
      price: Number.isFinite(price) ? price.toFixed(2) : "0.00",
      itemCondition: "https://schema.org/NewCondition",
      availability: product.inventory > 0 ? "https://schema.org/InStock" : "https://schema.org/BackOrder",
      priceValidUntil: priceValidUntil.toISOString().slice(0, 10),
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceCurrency: product.currency,
        price: Number.isFinite(price) ? price.toFixed(2) : "0.00",
        unitText: "1 yard",
        referenceQuantity: {
          "@type": "QuantitativeValue",
          value: 1,
          unitCode: "YRD",
        },
      },
      seller: {
        "@type": "Organization",
        name: BRAND_NAME,
      },
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
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
        name: "Categories",
        item: absoluteUrl("/categories"),
      },
      ...(product.category
        ? [
            {
              "@type": "ListItem",
              position: 3,
              name: product.category.nameEn,
              item: absoluteUrl(`/categories/${product.category.slug}`),
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: product.category ? 4 : 3,
        name: product.titleEn,
        item: productUrl,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-4 sm:px-6 md:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <PdpContent product={productPayload} />
      <RelatedProducts
        title="You may also like"
        subtitle="More picks from the same edit and brand."
        products={relatedPayload}
      />
    </main>
  );
}

function dedupeProducts(products: ProductListItem[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}
