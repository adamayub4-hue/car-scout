export const siteName = "Mekivo";
export const siteUrl = "https://mekivo.uk/";
export const siteTitle = "Mekivo | Search UK Used Cars & Car Parts";
export const siteDescription = "Search UK used cars and car parts across marketplaces. Find a part by number or picture, then open listings on the original marketplace.";

// These are Mekivo's previously verified public accounts. Same-name profiles
// on other networks must not be linked without confirming ownership.
export const officialProfiles = [
  "https://www.instagram.com/mekivo.uk/",
  "https://www.tiktok.com/@mekivo.uk",
];

export const siteStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      name: siteName,
      alternateName: "mekivo.uk",
      url: siteUrl,
      description: siteDescription,
      inLanguage: "en-GB",
      publisher: { "@id": `${siteUrl}#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: siteName,
      alternateName: "mekivo.uk",
      url: siteUrl,
      description: "Mekivo helps people search UK used-car and replacement-parts marketplaces and visit the original listings.",
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}icons/mekivo-512.png`,
        width: 512,
        height: 512,
      },
      sameAs: officialProfiles,
    },
  ],
};
