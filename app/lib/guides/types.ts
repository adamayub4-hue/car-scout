export type Guide = {
  slug: string;
  title: string;
  description: string;
  intro: string[];
  sections: {
    id: string;
    title: string;
    paragraphs: string[];
    sourceIds: string[];
  }[];
  sources: { id: string; title: string; url: string }[];
  publishedAt: string;
  updatedAt: string;
  category: "cars" | "parts";
  relatedSlugs: string[];
};
