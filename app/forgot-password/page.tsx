"use client";
import Link from "next/link";
import { useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); const client = getSupabaseBrowserClient(); if (!client) return;
    setLoading(true); setMessage("");
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: "https://carscout.uk/reset-password" });
    setLoading(false);
    setMessage(error ? error.message : "If that address has an account, a recovery link is on its way.");
  };
  return <main className="min-h-screen bg-[#07101e] px-4 py-10 text-white"><section className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/[0.035] p-7"><Link href="/account" className="text-sm text-sky-300">← Back to sign in</Link><h1 className="mt-6 text-3xl font-bold">Reset your password</h1><p className="mt-3 text-sm leading-6 text-slate-400">Enter your account email and we&apos;ll send a secure recovery link.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm text-slate-300">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none focus:border-sky-400/60" /></label>{message && <p role="status" className="text-sm text-sky-200">{message}</p>}<button disabled={loading} className="w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60">{loading ? "Sending…" : "Send recovery link"}</button></form></section></main>;
}
