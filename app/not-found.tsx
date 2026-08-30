import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-link">404</p>
        <h1 className="mt-4 text-4xl font-bold">That road ends here.</h1>
        <p className="mt-4 leading-7 text-muted">The page you requested does not exist or has moved.</p>
        <Link href="/" className="mt-7 inline-flex rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">Return to Mekivo</Link>
      </div>
    </main>
  );
}
