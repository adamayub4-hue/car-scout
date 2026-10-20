export const siteName = "Mekivo";
export const siteUrl = "https://mekivo.uk/";
export const siteTitle = "Mekivo | UK Used Cars, Motorbikes & Parts";
export const siteDescription = "Find your next car, motorbike or part. Browse live eBay listings and open searches on other UK marketplaces.";

// These are Mekivo's previously verified public accounts. Same-name profiles
// on other networks must not be linked without confirming ownership.
export const socialProfiles = [
  { id: "facebook", name: "Facebook", url: "https://www.facebook.com/profile.php?id=61593568512387" },
  { id: "instagram", name: "Instagram", url: "https://www.instagram.com/mekivo.uk/" },
  { id: "tiktok", name: "TikTok", url: "https://www.tiktok.com/@mekivo.uk" },
] as const;

export const officialProfiles = socialProfiles.map((profile) => profile.url);

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
      description: "Mekivo helps people find UK used cars, motorbikes and replacement parts, with live eBay listings and links to search other marketplaces.",
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
