import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: "https://carscout.uk", lastModified, changeFrequency: "weekly", priority: 1 },
    { url: "https://carscout.uk/privacy", lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: "https://carscout.uk/terms", lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: "https://carscout.uk/support", lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
