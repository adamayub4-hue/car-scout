import type { Metadata } from "next";
import type { Guide } from "./types";

const siteUrl = "https://mekivo.uk";

export function guideMetadata(guide: Guide): Metadata {
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      url: `${siteUrl}/guides/${guide.slug}`,
      siteName: "Mekivo",
      locale: "en_GB",
      publishedTime: guide.publishedAt,
      modifiedTime: guide.updatedAt,
    },
    twitter: { card: "summary", title: guide.title, description: guide.description },
  };
}

export function guideStructuredData(guide: Guide) {
  const url = `${siteUrl}/guides/${guide.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: guide.title,
        description: guide.description,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        url,
        inLanguage: "en-GB",
        datePublished: guide.publishedAt,
        dateModified: guide.updatedAt,
        author: { "@type": "Organization", name: "Mekivo", url: siteUrl },
        publisher: { "@type": "Organization", name: "Mekivo", url: siteUrl },
        citation: guide.sources.map((source) => source.url),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${siteUrl}/guides` },
          { "@type": "ListItem", position: 3, name: guide.title, item: url },
        ],
      },
    ],
  };
}

export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
