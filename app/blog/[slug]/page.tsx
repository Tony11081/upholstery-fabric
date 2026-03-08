import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogArticle } from "@/components/blog/blog-article";
import { getBlogPath, getBlogPost } from "@/lib/content/blog";
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
  params: { slug: string } | Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost("en", slug);
  if (!post) return {};

  const title = `${post.title} | ${BRAND_NAME}`;
  const description = post.excerpt;
  const url = `${siteUrl}${getBlogPath("en", slug)}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: buildLanguages(slug),
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: { slug: string } | Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost("en", slug);
  if (!post) {
    notFound();
  }

  return <BlogArticle locale="en" post={post} />;
}
