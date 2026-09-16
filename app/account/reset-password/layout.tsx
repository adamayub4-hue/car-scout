import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password",
  alternates: { canonical: "/account/reset-password" },
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
