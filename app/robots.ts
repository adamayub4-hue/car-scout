import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://carscout.uk/sitemap.xml",
    host: "https://carscout.uk",
  };
}
