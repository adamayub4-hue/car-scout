import { existingGuides } from "./existing-guides";
import { newGuides } from "./new-guides";

export const guides = [...existingGuides, ...newGuides];

export function getGuide(slug: string) {
  const guide = guides.find((entry) => entry.slug === slug);
  if (!guide) throw new Error(`Unknown guide: ${slug}`);
  return guide;
}
