"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { accountRecoveryPath, safeSearchReturnUrl, withRequestDeadline } from "../lib/saved-search";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { clearPasswordRecovery, invalidPasswordRecoveryLink, passwordRecoveryGrant, passwordRecoveryTarget, updateRecoveryPassword, type RecoveryTarget } from "../lib/account-recovery";
import type { Session } from "@supabase/supabase-js";

const NEW_LINK = "This recovery link is invalid, expired or has already been used. Request a new link to continue.";
type RecoveryState = { status: "checking" | "ready" | "blocked" | "complete"; target: RecoveryTarget | null; message: string };

export default function ResetPasswordPage() {
  const [state, setState] = useState<RecoveryState>({ status: "checking", target: null, message: "" });
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [loading, setLoading] = useState(false);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const submitting = useRef(false), selectedTarget = useRef<RecoveryTarget | null>(null);

  useEffect(() => {
    const safeReturn = safeSearchReturnUrl(new URL(window.location.href).searchParams.get("returnTo"));
    const timer = window.setTimeout(() => setReturnTo(safeReturn), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true, revision = 0;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const block = (message: string) => {
      selectedTarget.current = null;
      if (!active) return;
      setPassword(""); setConfirm(""); setState({ status: "blocked", target: null, message });
    };
    if (invalidPasswordRecoveryLink(window.location.href)) {
      clearPasswordRecovery();
      const timer = window.setTimeout(() => block(NEW_LINK), 0);
      return () => { active = false; window.clearTimeout(timer); };
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      const timer = window.setTimeout(() => block("Password recovery is temporarily unavailable. Please try again later."), 0);
      return () => { active = false; window.clearTimeout(timer); };
    }
    const applySession = (session: Session | null) => {
      if (!active) return;
      const target = passwordRecoveryTarget(session), grant = passwordRecoveryGrant();
      if (!target || !grant) { block("Open a fresh recovery link from your email to choose a new password."); return; }
      const previous = selectedTarget.current;
      if (!previous || previous.userId !== target.userId || previous.sessionId !== target.sessionId) { setPassword(""); setConfirm(""); }
      selectedTarget.current = target;
      setState({ status: "ready", target, message: "" });
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => {
        if (!selectedTarget.current) return;
        clearPasswordRecovery(); block("This password reset session has expired. Request a new recovery link.");
      }, Math.max(1, grant.expiresAt - Date.now()));
    };
    void withRequestDeadline(client.auth.getSession()).then(({ data, error }) => {
      if (!active || revision !== 0) return;
      if (error) throw error;
      applySession(data.session);
    }).catch(() => { if (active && revision === 0) block("We could not verify the recovery link. Request a new link or contact support."); });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        revision++; applySession(session);
      }
    });
    return () => { active = false; if (expiryTimer) clearTimeout(expiryTimer); data.subscription.unsubscribe(); };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = selectedTarget.current;
    if (submitting.current || !target) return;
    if (password !== confirm) { setState(current => ({ ...current, message: "Passwords do not match." })); return; }
    const client = getSupabaseBrowserClient();
    if (!client) { setState(current => ({ ...current, message: "Password reset is temporarily unavailable." })); return; }
    submitting.current = true; setLoading(true); setState(current => ({ ...current, message: "" }));
    try {
      const session = await withRequestDeadline(client.auth.getSession());
      if (session.error) throw session.error;
      const current = passwordRecoveryTarget(session.data.session);
      if (!current || !session.data.session || selectedTarget.current?.userId !== target.userId || selectedTarget.current?.sessionId !== target.sessionId
        || current.userId !== target.userId || current.sessionId !== target.sessionId) throw new Error("Recovery session changed.");
      await withRequestDeadline(updateRecoveryPassword(session.data.session, password));
      if (selectedTarget.current?.userId !== target.userId || selectedTarget.current?.sessionId !== target.sessionId) return;
      clearPasswordRecovery(); selectedTarget.current = null; setPassword(""); setConfirm("");
      setState({ status: "complete", target, message: "Password updated. You can now return to your account." });
    } catch (error) {
      if (selectedTarget.current?.userId !== target.userId || selectedTarget.current?.sessionId !== target.sessionId) return;
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (code === "same_password" || code === "weak_password") {
        setState(current => ({ ...current, message: code === "same_password" ? "Choose a password you have not used for this account." : "Choose a stronger password with at least 8 characters." }));
      } else {
        clearPasswordRecovery(); selectedTarget.current = null; setPassword(""); setConfirm("");
        setState({ status: "blocked", target: null, message: "The password update could not be confirmed. Try signing in or request a new recovery link before trying again." });
      }
    } finally { submitting.current = false; setLoading(false); }
  };

  return <main className="min-h-screen bg-background px-4 py-10 text-foreground"><section className="mx-auto max-w-md rounded-3xl border border-outline/10 bg-overlay/[0.035] p-7"><Link href={accountRecoveryPath("/account", returnTo)} className="text-sm text-link">← Account</Link><h1 className="mt-6 text-3xl font-bold">Choose a new password</h1>
    {state.target && <p className="mt-4 break-words text-sm text-muted">{state.status === "complete" ? "Password updated for " : "Resetting password for "}<strong className="text-foreground">{state.target.email}</strong></p>}
    {state.status === "checking" ? <p role="status" className="mt-5 text-muted">Checking your recovery link…</p> : state.status === "ready" ? <form onSubmit={submit} aria-busy={loading} className="mt-7 space-y-4"><label className="block text-sm text-muted">New password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-outline/10 bg-overlay/[0.06] px-4 py-3 text-foreground focus:border-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link" /></label><label className="block text-sm text-muted">Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-outline/10 bg-overlay/[0.06] px-4 py-3 text-foreground focus:border-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link" /></label>{state.message && <p role="status" className="text-sm text-link">{state.message}</p>}<button disabled={loading} className="w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">{loading ? "Updating…" : "Update password"}</button></form> : <div className="mt-5 text-muted"><p role="status">{state.message}</p>{state.status === "complete" ? <Link href={accountRecoveryPath("/account", returnTo)} className="mt-4 inline-block text-link">Return to your account</Link> : <Link href={accountRecoveryPath("/forgot-password", returnTo)} className="mt-4 inline-block text-link">Request a new recovery link</Link>}</div>}
  </section></main>;
}
