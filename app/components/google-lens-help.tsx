export default function GoogleLensHelp() {
  return (
    <details className="group mb-4 rounded-2xl border border-outline/15 bg-overlay/[0.025] p-4">
      <summary className="min-h-11 cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
        <span className="font-bold">Identify a part from a photo</span>
        <span className="mt-1 block pl-4 text-sm text-muted">Free with Google Lens</span>
      </summary>
      <div className="pt-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>Open Google and tap the camera icon. On a phone, you can also use the Google app.</li>
          <li>Take or choose a clear photo of the part.</li>
          <li>Come back here, add your vehicle details and search the suggested part name.</li>
        </ol>
        <a href="https://lens.google.com/" target="_blank" rel="noopener noreferrer" className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-center font-bold text-slate-950 transition hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link">
          Open Google Lens <span aria-hidden="true">↗</span><span className="sr-only"> (opens Google in a new tab)</span>
        </a>
        <p className="mt-3 text-xs leading-5 text-subtle">Opens Google in a new tab. You choose your photo there. Suggestions do not confirm that a part fits your vehicle.</p>
      </div>
    </details>
  );
}
