import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback and support",
  alternates: { canonical: "/support" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
