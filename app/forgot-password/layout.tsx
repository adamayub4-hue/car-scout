import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Password recovery",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
