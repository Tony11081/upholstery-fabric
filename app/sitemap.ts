import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { isProd } from "@/lib/utils/env";
import { mockCategories, mockProducts } from "@/lib/data/mock-data";
import { BLOG_LOCALES, getBlogPath, getBlogPosts } from "@/lib/content/blog";
import { getSiteUrl } from "@/lib/utils/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/categories`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${siteUrl}/policies`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/help`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${siteUrl}/editorial`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const blogIndexRoutes = BLOG_LOCALES.map((locale) => ({
    url: `${siteUrl}${getBlogPath(locale)}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const blogPostRoutes = BLOG_LOCALES.flatMap((locale) =>
    getBlogPosts(locale).map((post) => ({
      url: `${siteUrl}${getBlogPath(locale, post.slug)}`,
      lastModified: new Date(post.publishAt),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  );

  try {
    const [products, categories, editorialPosts] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      prisma.category.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
      }),
      prisma.contentPost.findMany({
        where: { status: "PUBLISHED" },
        select: { slug: true, updatedAt: true, publishAt: true },
        orderBy: [{ publishAt: "desc" }, { updatedAt: "desc" }],
      }),
    ]);

    const productRoutes = products.map((product) => ({
      url: `${siteUrl}/product/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const categoryRoutes = categories.map((category) => ({
      url: `${siteUrl}/categories/${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    const editorialRoutes = editorialPosts.map((post) => ({
      url: `${siteUrl}/editorial/${post.slug}`,
      lastModified: post.updatedAt ?? post.publishAt ?? now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

    return [
      ...staticRoutes,
      ...blogIndexRoutes,
      ...blogPostRoutes,
      ...editorialRoutes,
      ...categoryRoutes,
      ...productRoutes,
    ];
  } catch (error) {
    console.error("Sitemap generation failed", error);
    if (isProd) {
      return [...staticRoutes, ...blogIndexRoutes, ...blogPostRoutes];
    }

    const mockProductRoutes = mockProducts().map((product) => ({
      url: `${siteUrl}/product/${product.slug}`,
      lastModified: product.updatedAt ?? now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const mockCategoryRoutes = mockCategories()
      .filter((category) => category.status === "ACTIVE")
      .map((category) => ({
        url: `${siteUrl}/categories/${category.slug}`,
        lastModified: category.updatedAt ?? now,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));

    return [
      ...staticRoutes,
      ...blogIndexRoutes,
      ...blogPostRoutes,
      ...mockCategoryRoutes,
      ...mockProductRoutes,
    ];
  }
}
