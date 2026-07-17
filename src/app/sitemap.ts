import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://limon.lat/", changeFrequency: "monthly", priority: 1 },
  ];
}
