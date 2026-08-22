import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "CarScout", short_name: "CarScout", description: "Search UK cars and vehicle parts.", start_url: "/", display: "standalone", background_color: "#07101e", theme_color: "#38bdf8", icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }] };
}
