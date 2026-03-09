import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndex } from "@/components/blog/blog-index";
import {
  BlogLocale,
  getBlogIndexCopy,
  getBlogPath,
  getIndexableBlogPosts,
  isBlogLocale,
} from "@/lib/content/blog";
import { BRAND_NAME, getSiteUrl } from "@/lib/utils/site";

const siteUrl = getSiteUrl();

const buildLanguages = () => ({
  en: `${siteUrl}${getBlogPath("en")}`,
  "pt-BR": `${siteUrl}${getBlogPath("pt-br")}`,
  "es-ES": `${siteUrl}${getBlogPath("es")}`,
});

export async function generateMetadata({
  params,
}: {
  params: { locale: string } | Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isBlogLocale(locale) || locale === "en") return {};

  const typedLocale = locale as BlogLocale;
  const copy = getBlogIndexCopy(typedLocale);
  const url = `${siteUrl}${getBlogPath(typedLocale)}`;
  const title = `${copy.eyebrow} | ${BRAND_NAME}`;

  return {
    title,
    description: copy.subtitle,
    alternates: {
      canonical: url,
      languages: buildLanguages(),
    },
    openGraph: {
      title,
      description: copy.subtitle,
      url,
      type: "website",
    },
  };
}

export default async function BlogLocalePage({
  params,
}: {
  params: { locale: string } | Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isBlogLocale(locale) || locale === "en") {
    notFound();
  }

  const typedLocale = locale as BlogLocale;
  const posts = getIndexableBlogPosts(typedLocale);
  return <BlogIndex locale={typedLocale} posts={posts} />;
}
