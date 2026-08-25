import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: "https://mekivo.uk", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://mekivo.uk/privacy", lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: "https://mekivo.uk/terms", lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: "https://mekivo.uk/support", lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: "https://mekivo.uk/guides", lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: "https://mekivo.uk/guides/buying-a-used-car", lastModified, changeFrequency: "monthly", priority: 0.75 },
    { url: "https://mekivo.uk/guides/finding-the-right-car-part", lastModified, changeFrequency: "monthly", priority: 0.75 },
    { url: "https://mekivo.uk/guides/checking-part-compatibility", lastModified, changeFrequency: "monthly", priority: 0.75 },
  ];
}
