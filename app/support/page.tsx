"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

type FeedbackKind = "suggestion" | "problem";

const fieldClass = "w-full rounded-xl border border-outline/10 bg-overlay/[0.06] px-4 py-3 text-foreground outline-none placeholder:text-subtle focus:border-sky-400/60";

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [kind, setKind] = useState<FeedbackKind>("suggestion");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const client = getSupabaseBrowserClient();
    if (!client || !user) return;
    setStatus("Sending…");
    const prefix = kind === "suggestion" ? "[Suggestion]" : "[Problem]";
    const { error } = await client.from("complaints").insert({ user_id: user.id, subject: `${prefix} ${subject}`, message });
    if (error) {
      setStatus(error.message.includes("limit") ? "You have sent several messages recently. Please try again in an hour." : "We could not send this. Please try again.");
      return;
    }
    setSubject("");
    setMessage("");
    setStatus(kind === "suggestion" ? "Thanks—your suggestion has been sent to the Mekivo owner." : "Your report has been sent to the Mekivo owner.");
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm font-semibold text-link">← Back to Mekivo</Link>
        <section className="mt-8 rounded-3xl border border-outline/10 bg-overlay/[0.035] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-link">Feedback and support</p>
          <h1 className="mt-2 text-3xl font-bold">Help improve Mekivo</h1>
          <p className="mt-3 text-sm leading-6 text-muted">Share an idea or report a problem. Every message goes to Mekivo&apos;s private owner dashboard.</p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-overlay/[0.04] p-1.5">
            {(["suggestion", "problem"] as FeedbackKind[]).map((value) => (
              <button key={value} type="button" aria-pressed={kind === value} onClick={() => { setKind(value); setStatus(""); }} className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${kind === value ? "bg-white text-slate-950" : "text-muted hover:text-foreground"}`}>
                {value === "suggestion" ? "Suggest an idea" : "Report a problem"}
              </button>
            ))}
          </div>

          {!isSupabaseConfigured() ? (
            <p className="mt-6 text-warning">Feedback accounts are being connected.</p>
          ) : loading ? (
            <p className="mt-6 text-muted">Checking your account…</p>
          ) : !user ? (
            <div className="mt-6 rounded-xl border border-outline/10 p-4 text-sm text-muted">Please <Link href="/account" className="font-semibold text-link">sign in or create an account</Link> before sending feedback. This helps prevent spam and lets you include your saved vehicle context.</div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-sm text-muted">
                {kind === "suggestion" ? "What is your idea?" : "What went wrong?"}
                <input required minLength={3} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={kind === "suggestion" ? "A short title for your suggestion" : "A short description of the problem"} className={`mt-2 ${fieldClass}`} />
              </label>
              <label className="block text-sm text-muted">
                {kind === "suggestion" ? "How would it improve Mekivo?" : "Tell us what happened"}
                <textarea required minLength={10} maxLength={4000} rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add enough detail for us to understand and act on it." className={`mt-2 resize-y ${fieldClass}`} />
              </label>
              {status && <p role="status" className="text-sm text-link">{status}</p>}
              <button className="rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">{kind === "suggestion" ? "Send suggestion" : "Send report"}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
