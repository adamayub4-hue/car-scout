import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://mekivo.uk", changeFrequency: "weekly", priority: 1 },
    { url: "https://mekivo.uk/privacy", changeFrequency: "yearly", priority: 0.3 },
    { url: "https://mekivo.uk/terms", changeFrequency: "yearly", priority: 0.3 },
    { url: "https://mekivo.uk/support", changeFrequency: "monthly", priority: 0.5 },
    { url: "https://mekivo.uk/guides", changeFrequency: "monthly", priority: 0.8 },
    { url: "https://mekivo.uk/guides/buying-a-used-car", changeFrequency: "monthly", priority: 0.75 },
    { url: "https://mekivo.uk/guides/finding-the-right-car-part", changeFrequency: "monthly", priority: 0.75 },
    { url: "https://mekivo.uk/guides/checking-part-compatibility", changeFrequency: "monthly", priority: 0.75 },
  ];
}
