"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSavedSearchUrl, safeSearchReturnUrl, withRequestDeadline } from "../lib/saved-search";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

type SavedItem = {
  id: string;
  kind: "car_search" | "part_search" | "vehicle";
  title: string;
  data: Record<string, unknown>;
  created_at: string;
};

const inputClass = "w-full rounded-xl border border-outline/10 bg-overlay/[0.06] px-4 py-3 text-foreground outline-none placeholder:text-subtle focus:border-sky-400/60";

export default function AccountPage() {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(configured);
  const [message, setMessage] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const itemsRequest = useRef(0);
  const actionRunning = useRef(false);

  const loadAdminStatus = useCallback(async (userId: string | null | undefined) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) { setIsAdmin(false); return; }
    try {
      const { data: row, error } = await withRequestDeadline(supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle());
      setIsAdmin(!error && Boolean(row));
    } catch { setIsAdmin(false); }
  }, []);

  const loadItems = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const request = ++itemsRequest.current;
    setItemsLoading(true); setItemsError("");
    try {
      const { data, error } = await withRequestDeadline(supabase.from("saved_items").select("*").order("created_at", { ascending: false }));
      if (error || !data) throw error || new Error("Missing saved items");
      if (request === itemsRequest.current) setItems(data as SavedItem[]);
    } catch {
      if (request === itemsRequest.current) setItemsError("We could not load your saved searches. Your saved data has not been removed.");
    } finally { if (request === itemsRequest.current) setItemsLoading(false); }
  }, []);

  useEffect(() => {
    const lifecycle = itemsRequest;
    let active = true;
    const requestedReturn = safeSearchReturnUrl(new URLSearchParams(window.location.search).get("returnTo"));
    const startup = window.setTimeout(() => setReturnUrl(requestedReturn), 0);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return () => window.clearTimeout(startup);
    const update = (nextUser: User | null) => {
      if (!active) return;
      setUser(nextUser); setLoading(false);
      if (nextUser) { void loadItems(); void loadAdminStatus(nextUser.id); }
      else { itemsRequest.current++; setItems([]); setItemsLoading(false); setItemsError(""); setIsAdmin(false); }
    };
    void withRequestDeadline(supabase.auth.getUser()).then(({ data, error }) => {
      if (error && error.name !== "AuthSessionMissingError") throw error;
      update(data.user);
    }).catch(() => { if (active) { setLoading(false); setMessage("We could not check your session. Try signing in again."); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer database calls until the auth callback has released its session lock.
      window.setTimeout(() => update(session?.user ?? null), 0);
    });
    return () => { active = false; lifecycle.current++; window.clearTimeout(startup); listener.subscription.unsubscribe(); };
  }, [loadItems, loadAdminStatus]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || actionRunning.current) return;
    actionRunning.current = true; setLoading(true); setMessage("");
    try {
      const confirmationUrl = `https://mekivo.uk/account${returnUrl ? `?returnTo=${encodeURIComponent(returnUrl)}` : ""}`;
      const result = await withRequestDeadline(isSignUp
        ? supabase.auth.signUp({ email, password, options: { emailRedirectTo: confirmationUrl } })
        : supabase.auth.signInWithPassword({ email, password }));
      if (result.error) setMessage(result.error.message);
      else if (isSignUp && !result.data.session) setMessage("Check your email to confirm your account, then sign in.");
      else {
        setUser(result.data.user); void loadItems(); void loadAdminStatus(result.data.user?.id);
        setMessage(isSignUp ? "Your account is ready." : "Welcome back.");
      }
    } catch { setMessage("Sign-in could not be confirmed. Check your connection and try again."); }
    finally { actionRunning.current = false; setLoading(false); }
  };

  const remove = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || actionRunning.current) return;
    actionRunning.current = true; setBusyAction(id); setMessage("");
    try {
      const { data, error } = await withRequestDeadline(supabase.from("saved_items").delete().eq("id", id).select("id"));
      if (error || !data?.some(row => row.id === id)) throw error || new Error("Removal not confirmed");
      setItems(current => current.filter(item => item.id !== id));
    } catch { setMessage("We could not confirm removal. Refresh your saved searches before trying again."); }
    finally { actionRunning.current = false; setBusyAction(""); }
  };

  const signOut = async () => {
    try {
      const result = await withRequestDeadline(getSupabaseBrowserClient()!.auth.signOut());
      if (result.error) throw result.error;
      itemsRequest.current++; setUser(null); setItems([]); setIsAdmin(false);
    } catch { setMessage("We could not sign you out. Please try again."); }
  };

  const exportData = async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase || !user || actionRunning.current) return;
    actionRunning.current = true; setBusyAction("export"); setMessage("");
    try {
      const readAll = async (table: string, column: string) => {
        const rows: Record<string, unknown>[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await withRequestDeadline(supabase.from(table).select("*").eq(column, user.id).order("id").range(offset, offset + 499));
          if (error || !data) throw error || new Error("Incomplete export");
          rows.push(...data);
          if (data.length < 500) return rows;
        }
      };
      const [profile, savedItems, complaints, activity] = await Promise.all([readAll("profiles", "id"), readAll("saved_items", "user_id"), readAll("complaints", "user_id"), readAll("activity_events", "user_id")]);
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, savedItems, complaints, activity }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "mekivo-data.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Your complete data export is ready.");
    } catch { setMessage("We could not load all of your data, so no incomplete export was downloaded. Please try again."); }
    finally { actionRunning.current = false; setBusyAction(""); }
  };

  const deleteAccount = async () => {
    if (isAdmin || actionRunning.current || !window.confirm("Permanently delete your Mekivo account and all saved data? This cannot be undone.")) return;
    actionRunning.current = true; setBusyAction("delete"); setMessage("");
    try {
      const { error } = await withRequestDeadline(getSupabaseBrowserClient()!.rpc("delete_my_account"));
      if (error) throw error;
      await getSupabaseBrowserClient()!.auth.signOut({ scope: "local" });
      itemsRequest.current++; setUser(null); setItems([]); setIsAdmin(false); setMessage("Your account and stored data were deleted.");
    } catch { setMessage("Account deletion could not be confirmed. Please contact support before retrying."); }
    finally { actionRunning.current = false; setBusyAction(""); }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-outline/10 pb-6">
          <Link href="/" className="text-xl font-bold">← Mekivo</Link>
          {user && <button type="button" onClick={signOut} className="text-sm text-muted hover:text-foreground">Sign out</button>}
        </header>

        {returnUrl && <div className="mt-6 rounded-2xl border border-sky-300/25 p-5 text-sm"><p>Your search is ready to resume. {user ? "Open it, then choose Save to my account." : "Sign in or create an account, then return to save it."}</p><Link href={returnUrl} className="mt-3 inline-block font-semibold text-link">Resume your search →</Link></div>}
        {message && user && <p role="status" className="mt-6 text-sm text-link">{message}</p>}
        {!configured ? (
          <section className="mt-12 rounded-3xl border border-amber-300/25 bg-amber-300/[0.06] p-7">
            <p className="text-xs font-bold uppercase tracking-wider text-warning">Account setup in progress</p>
            <h1 className="mt-3 text-3xl font-bold">Accounts are temporarily unavailable</h1>
            <p className="mt-3 leading-7 text-muted">Accounts are temporarily unavailable. You can still search for cars and parts without signing in.</p>
          </section>
        ) : loading && !user ? (
          <p className="mt-12 text-muted">Loading your account…</p>
        ) : user ? (
          <section className="mt-12">
            <p className="text-xs font-bold uppercase tracking-wider text-link">Your account</p>
            <h1 className="mt-2 text-3xl font-bold">Saved vehicles and searches</h1>
            <p className="mt-2 text-sm text-muted">Signed in as {user.email}</p>
            {isAdmin && (
              <Link href="/admin" className="mt-6 flex items-center justify-between rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] p-5 transition hover:border-amber-200/60 hover:bg-amber-300/[0.12]">
                <span><span className="block text-xs font-bold uppercase tracking-wider text-warning">Master owner account</span><strong className="mt-1 block text-lg">Open Mekivo control centre</strong><span className="mt-1 block text-sm text-muted">View users, reports, feedback, saved items and recent activity.</span></span>
                <span aria-hidden="true" className="ml-4 text-2xl text-warning">→</span>
              </Link>
            )}
            {itemsLoading ? <p role="status" className="mt-8 text-muted">Loading your saved searches…</p> : itemsError ? <div role="alert" className="mt-8 rounded-xl border border-rose-300/30 p-5"><p>{itemsError}</p><button type="button" onClick={() => void loadItems()} className="mt-3 font-semibold text-link">Retry saved searches</button></div> : items.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-6 text-muted">Nothing saved yet. Run a car or part search, then choose “Save to my account”.</div>
            ) : (
              <div className="mt-8 space-y-3">
                {items.map((item) => (
                  <article key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-link">{item.kind.replace("_", " ")}</span>
                      <h2 className="mt-2 font-bold">{item.title}</h2>
                      <p className="mt-1 text-xs text-subtle">Saved {new Date(item.created_at).toLocaleDateString("en-GB")}</p><Link href={getSavedSearchUrl(item)} className="mt-3 inline-block text-sm font-semibold text-link">Run this search →</Link>
                    </div>
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => remove(item.id)} className="text-sm text-danger hover:text-danger">Remove</button>
                  </article>
                ))}
              </div>
            )}
            <Link href="/" className="mt-8 inline-flex rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">Start a new search</Link>
            <section className="mt-10 border-t border-outline/10 pt-7"><h2 className="text-lg font-bold">Your data</h2><p className="mt-2 text-sm text-muted">Download a copy of the information stored with your account.</p><button type="button" disabled={Boolean(busyAction)} onClick={exportData} className="mt-4 rounded-xl border border-outline/15 px-4 py-2.5 text-sm font-semibold hover:border-sky-300/50">Download my data</button>{isAdmin ? <p className="mt-5 text-xs text-warning">The master owner account cannot be deleted from the customer interface.</p> : <div className="mt-7 border-t border-outline/10 pt-6"><h3 className="font-bold text-danger">Delete account</h3><p className="mt-2 text-sm text-muted">Permanently removes your account, saved searches, reports and activity.</p><button type="button" disabled={Boolean(busyAction)} onClick={deleteAccount} className="mt-4 rounded-xl border border-rose-300/30 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-rose-300/10">Delete my account</button></div>}</section>
          </section>
        ) : (
          <section className="mx-auto mt-12 max-w-md rounded-3xl border border-outline/10 bg-overlay/[0.035] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-link">{isSignUp ? "Create account" : "Welcome back"}</p>
            <h1 className="mt-2 text-3xl font-bold">{isSignUp ? "Save your Mekivo data" : "Sign in to Mekivo"}</h1>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-sm text-muted">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`mt-2 ${inputClass}`} /></label>
              <label className="block text-sm text-muted">Password<input required minLength={8} type="password" autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`mt-2 ${inputClass}`} /></label>
              {message && <p role="status" className="text-sm text-link">{message}</p>}
              <button disabled={loading} className="w-full rounded-xl bg-sky-400 px-5 py-3.5 font-bold text-slate-950 disabled:opacity-60">{loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}</button>
            </form>
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage(""); }} className="mt-5 text-sm text-muted hover:text-foreground">{isSignUp ? "Already have an account? Sign in" : "New to Mekivo? Create an account"}</button>
            {!isSignUp && <Link href="/forgot-password" className="mt-4 block text-sm text-link hover:text-link">Forgot your password?</Link>}
          </section>
        )}
      </div>
    </main>
  );
}
