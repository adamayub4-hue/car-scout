"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { accountRecoveryPath, safeSearchReturnUrl, withRequestDeadline } from "../lib/saved-search";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(""), [message, setMessage] = useState(""), [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const sending = useRef(false);
  useEffect(() => {
    const safeReturn = safeSearchReturnUrl(new URL(window.location.href).searchParams.get("returnTo"));
    const timer = window.setTimeout(() => setReturnTo(safeReturn), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); const client = getSupabaseBrowserClient();
    if (!client) { setMessage("Password recovery is temporarily unavailable. Email adamayub4@gmail.com for help."); return; }
    if (sending.current) return;
    sending.current = true; setLoading(true); setMessage("");
    try {
      const safeReturn = safeSearchReturnUrl(new URL(window.location.href).searchParams.get("returnTo"));
      const { error } = await withRequestDeadline(client.auth.resetPasswordForEmail(email, { redirectTo: "https://mekivo.uk" + accountRecoveryPath("/reset-password", safeReturn) }));
      setMessage(error ? error.message : "If that address has an account, a recovery link is on its way.");
    } catch { setMessage("We could not confirm the recovery request. Check your inbox before trying again."); }
    finally { sending.current = false; setLoading(false); }
  };
  return <main className="min-h-screen bg-background px-4 py-10 text-foreground"><section className="mx-auto max-w-md rounded-3xl border border-outline/10 bg-overlay/[0.035] p-7"><Link href={accountRecoveryPath("/account", returnTo)} className="text-sm text-link">← Back to sign in</Link><h1 className="mt-6 text-3xl font-bold">Reset your password</h1><p className="mt-3 text-sm leading-6 text-muted">Enter your account email and we&apos;ll send a secure recovery link.</p><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm text-muted">Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-outline/10 bg-overlay/[0.06] px-4 py-3 text-foreground focus:border-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link" /></label>{message && <p role="status" className="text-sm text-link">{message}</p>}<button disabled={loading} className="w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60">{loading ? "Sending…" : "Send recovery link"}</button></form></section></main>;
}
