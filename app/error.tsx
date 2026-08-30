"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-danger">Something went wrong</p>
        <h1 className="mt-4 text-4xl font-bold">Mekivo hit a bump.</h1>
        <p className="mt-4 leading-7 text-muted">Your search has not been submitted. Try loading this part of the site again.</p>
        <button type="button" onClick={reset} className="mt-7 rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">Try again</button>
      </div>
    </main>
  );
}
