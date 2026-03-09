import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog/blog-article";
import {
  BlogLocale,
  getBlogPath,
  getBlogPost,
  isLegacyFashionBlogSlug,
  isBlogLocale,
} from "@/lib/content/blog";
import { BRAND_NAME, getSiteUrl } from "@/lib/utils/site";

const siteUrl = getSiteUrl();

const buildLanguages = (slug: string) => ({
  en: `${siteUrl}${getBlogPath("en", slug)}`,
  "pt-BR": `${siteUrl}${getBlogPath("pt-br", slug)}`,
  "es-ES": `${siteUrl}${getBlogPath("es", slug)}`,
});

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string } | Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isBlogLocale(locale) || locale === "en") return {};

  const typedLocale = locale as BlogLocale;
  const post = getBlogPost(typedLocale, slug);
  if (!post) return {};

  const url = `${siteUrl}${getBlogPath(typedLocale, slug)}`;
  const title = `${post.title} | ${BRAND_NAME}`;

  return {
    title,
    description: post.excerpt,
    robots: isLegacyFashionBlogSlug(slug)
      ? { index: false, follow: true }
      : undefined,
    alternates: {
      canonical: url,
      languages: buildLanguages(slug),
    },
    openGraph: {
      title,
      description: post.excerpt,
      url,
      type: "article",
    },
  };
}

export default async function BlogLocaleDetailPage({
  params,
}: {
  params: { locale: string; slug: string } | Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isBlogLocale(locale) || locale === "en") {
    notFound();
  }

  const typedLocale = locale as BlogLocale;
  const post = getBlogPost(typedLocale, slug);
  if (!post) {
    notFound();
  }

  return <BlogArticle locale={typedLocale} post={post} />;
}
