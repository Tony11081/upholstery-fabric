import type { MetadataRoute } from "next";
import { BRAND_NAME } from "@/lib/utils/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} Luxury Fabrics`,
    short_name: BRAND_NAME,
    description:
      "Luxury maison fabrics, archive textiles, and premium upholstery yardage with swatch support and global delivery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f3ee",
    theme_color: "#1d1d1d",
    icons: [
      {
        src: "/og-default.svg",
        sizes: "1200x630",
        type: "image/svg+xml",
      },
    ],
  };
}
