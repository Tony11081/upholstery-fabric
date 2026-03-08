import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog/blog-index";
import { getBlogIndexCopy, getBlogPath, getBlogPosts } from "@/lib/content/blog";
import { BRAND_NAME, getSiteUrl } from "@/lib/utils/site";

const siteUrl = getSiteUrl();
const copy = getBlogIndexCopy("en");
const title = `${BRAND_NAME} Journal`;
const description = copy.subtitle;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${siteUrl}${getBlogPath("en")}`,
    languages: {
      en: `${siteUrl}${getBlogPath("en")}`,
      "pt-BR": `${siteUrl}${getBlogPath("pt-br")}`,
      "es-ES": `${siteUrl}${getBlogPath("es")}`,
    },
  },
  openGraph: {
    title,
    description,
    url: `${siteUrl}${getBlogPath("en")}`,
    type: "website",
  },
};

export default function BlogPage() {
  const posts = getBlogPosts("en");
  return <BlogIndex locale="en" posts={posts} />;
}
