import type { MetadataRoute } from "next";
import { guides } from "./lib/guides";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://mekivo.uk", lastModified: "2026-09-28", changeFrequency: "weekly", priority: 1 },
    { url: "https://mekivo.uk/privacy", lastModified: "2026-09-17", changeFrequency: "yearly", priority: 0.3 },
    { url: "https://mekivo.uk/terms", lastModified: "2026-09-16", changeFrequency: "yearly", priority: 0.3 },
    { url: "https://mekivo.uk/support", lastModified: "2026-09-16", changeFrequency: "monthly", priority: 0.5 },
    { url: "https://mekivo.uk/guides", lastModified: guides.map((guide) => guide.updatedAt).sort().at(-1), changeFrequency: "monthly", priority: 0.8 },
    ...guides.map((guide) => ({
      url: `https://mekivo.uk/guides/${guide.slug}`,
      lastModified: guide.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.75,
    })),
  ];
}
