import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog/blog-index";
import { getBlogPath, getIndexableBlogPosts } from "@/lib/content/blog";
import { BRAND_NAME, getSiteUrl } from "@/lib/utils/site";

const siteUrl = getSiteUrl();
const title = "Fabric Journal";
const description = "Designer fabric sourcing notes, care guidance, and upholstery-focused editorial updates.";

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
    title: `${title} | ${BRAND_NAME}`,
    description,
    url: `${siteUrl}${getBlogPath("en")}`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | ${BRAND_NAME}`,
    description,
  },
};

export default function BlogPage() {
  const posts = getIndexableBlogPosts("en");
  return <BlogIndex locale="en" posts={posts} />;
}
