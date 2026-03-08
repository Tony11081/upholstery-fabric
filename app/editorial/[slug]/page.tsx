import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProductPrice } from "@/lib/utils/pricing";
import { DropReservationForm } from "@/components/editorial/drop-reservation-form";
import { ShoppingList } from "@/components/editorial/shopping-list";
import { BRAND_NAME, DEFAULT_OG_IMAGE, absoluteUrl } from "@/lib/utils/site";

export async function generateMetadata({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.contentPost.findUnique({
    where: { slug },
    select: { title: true, excerpt: true, coverImage: true, status: true, slug: true },
  });
  if (!post || post.status !== "PUBLISHED") {
    return {
      title: "Editorial",
      robots: { index: false, follow: false },
    };
  }
  const url = absoluteUrl(`/editorial/${post.slug}`);
  const ogImage = post.coverImage
    ? post.coverImage.startsWith("http")
      ? post.coverImage
      : absoluteUrl(post.coverImage)
    : absoluteUrl(DEFAULT_OG_IMAGE);
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: `${BRAND_NAME} | ${post.title}`,
      description: post.excerpt ?? undefined,
      url,
      type: "article",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${BRAND_NAME} | ${post.title}`,
      description: post.excerpt ?? undefined,
      images: [ogImage],
    },
  };
}

export default async function EditorialDetailPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await prisma.contentPost.findUnique({
    where: { slug },
    include: {
      products: {
        include: {
          product: {
            include: {
              images: { orderBy: { sortOrder: "asc" } },
              category: true,
              reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } },
            },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!post || post.status !== "PUBLISHED") {
    notFound();
  }

  const products = post.products.map((item) => item.product);
  const shoppingItems = products.map((product) => {
    const cover = product.images.find((image) => image.isCover) ?? product.images[0];
    return {
      id: product.id,
      slug: product.slug,
      titleEn: product.titleEn,
      price: getProductPrice(product),
      currency: product.currency,
      image: cover?.url ?? null,
      category: product.category?.nameEn ?? null,
    };
  });

  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-8 sm:px-6 md:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">{post.type}</p>
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

        {post.body && (
          <article className="prose prose-neutral max-w-none text-sm text-ink">
            {post.body.split("\n").map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </article>
        )}

        {post.type === "DROP" && <DropReservationForm contentId={post.id} />}

        {shoppingItems.length > 0 && <ShoppingList items={shoppingItems} />}
      </div>
    </main>
  );
}
