"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { withRequestDeadline } from "../lib/saved-search";
import { getSupabaseBrowserClient } from "../lib/supabase";

export default function ResetPasswordPage() {
  const [ready, setReady] = useState(false), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const client = getSupabaseBrowserClient(); if (!client) return;
    let active = true;
    void withRequestDeadline(client.auth.getSession()).then(({ data, error }) => {
      if (error) throw error;
      if (active) setReady(Boolean(data.session));
    }).catch(() => { if (active) setMessage("We could not verify the recovery link. Request a new link or contact support."); });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (active && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "SIGNED_OUT")) setReady(Boolean(session));
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    const client = getSupabaseBrowserClient();
    if (!client) { setMessage("Password reset is temporarily unavailable."); return; }
    submitting.current = true; setLoading(true); setMessage("");
    try {
      const { error } = await withRequestDeadline(client.auth.updateUser({ password }));
      setMessage(error ? error.message : "Password updated. You can now return to your account.");
      if (!error) { setPassword(""); setConfirm(""); }
    } catch { setMessage("The password update could not be confirmed. Try signing in or request a new recovery link."); }
    finally { submitting.current = false; setLoading(false); }
  };

  return <main className="min-h-screen bg-background px-4 py-10 text-foreground"><section className="mx-auto max-w-md rounded-3xl border border-outline/10 bg-overlay/[0.035] p-7"><Link href="/account" className="text-sm text-link">← Account</Link><h1 className="mt-6 text-3xl font-bold">Choose a new password</h1>{ready ? <form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-sm text-muted">New password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-outline/10 bg-overlay/[0.06] px-4 py-3 text-foreground outline-none focus:border-sky-400/60" /></label><label className="block text-sm text-muted">Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-outline/10 bg-overlay/[0.06] px-4 py-3 text-foreground outline-none focus:border-sky-400/60" /></label>{message && <p role="status" className="text-sm text-link">{message}</p>}<button disabled={loading} className="w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">{loading ? "Updating…" : "Update password"}</button></form> : <div className="mt-5 text-muted"><p>Open the recovery link from your email to continue.</p>{message && <p role="status" className="mt-3">{message}</p>}<Link href="/forgot-password" className="mt-4 inline-block text-link">Request a new recovery link</Link></div>}</section></main>;
}
