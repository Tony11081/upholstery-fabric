import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/utils/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/account",
          "/bag",
          "/checkout",
          "/order",
          "/track-order",
          "/wishlist",
        ],
      },
    ],
    host: siteUrl,
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
