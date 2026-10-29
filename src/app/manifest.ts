import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/branding";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#172e48",
    icons: [
      { src: "/falconid-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/falconid-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
