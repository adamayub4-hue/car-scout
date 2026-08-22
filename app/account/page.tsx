"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

type SavedItem = {
  id: string;
  kind: "car_search" | "part_search" | "vehicle";
  title: string;
  data: Record<string, unknown>;
  created_at: string;
};

const inputClass = "w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-sky-400/60";

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

  const loadItems = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.from("saved_items").select("*").order("created_at", { ascending: false });
    setItems((data as SavedItem[]) || []);
  };

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
      if (data.user) void loadItems();
      if (data.user) void supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle().then(({ data: row }) => setIsAdmin(Boolean(row)));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void loadItems();
      else setItems([]);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
    } else if (isSignUp && !result.data.session) {
      setMessage("Check your email to confirm your account, then sign in.");
    } else {
      setUser(result.data.user);
      setMessage(isSignUp ? "Your account is ready." : "Welcome back.");
    }
  };

  const remove = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("saved_items").delete().eq("id", id);
    if (!error) setItems((current) => current.filter((item) => item.id !== id));
  };

  const signOut = async () => {
    await getSupabaseBrowserClient()?.auth.signOut();
    setUser(null);
  };

  const exportData = async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase || !user) return;
    const [profile, saved, complaints, activity] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id),
      supabase.from("saved_items").select("*").eq("user_id", user.id),
      supabase.from("complaints").select("*").eq("user_id", user.id),
      supabase.from("activity_events").select("*").eq("user_id", user.id),
    ]);
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile: profile.data, savedItems: saved.data, complaints: complaints.data, activity: activity.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "carscout-data.json"; link.click(); URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    if (isAdmin || !window.confirm("Permanently delete your CarScout account and all saved data? This cannot be undone.")) return;
    const { error } = await getSupabaseBrowserClient()!.rpc("delete_my_account");
    if (error) setMessage("We could not delete the account. Please contact support."); else { setUser(null); setItems([]); setMessage("Your account and stored data were deleted."); }
  };

  return (
    <main className="min-h-screen bg-[#07101e] px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link href="/" className="text-xl font-bold">← CarScout</Link>
          {user && <button type="button" onClick={signOut} className="text-sm text-slate-300 hover:text-white">Sign out</button>}
        </header>

        {!configured ? (
          <section className="mt-12 rounded-3xl border border-amber-300/25 bg-amber-300/[0.06] p-7">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Account setup in progress</p>
            <h1 className="mt-3 text-3xl font-bold">Accounts need their database connection</h1>
            <p className="mt-3 leading-7 text-slate-300">The account interface is installed, but the production Supabase URL and public key still need to be connected before customers can register.</p>
          </section>
        ) : loading && !user ? (
          <p className="mt-12 text-slate-400">Loading your account…</p>
        ) : user ? (
          <section className="mt-12">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-300">Your account</p>
            <h1 className="mt-2 text-3xl font-bold">Saved vehicles and searches</h1>
            <p className="mt-2 text-sm text-slate-400">Signed in as {user.email}</p>
            {items.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-slate-300">Nothing saved yet. Run a car or part search, then choose “Save to my account”.</div>
            ) : (
              <div className="mt-8 space-y-3">
                {items.map((item) => (
                  <article key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-sky-300">{item.kind.replace("_", " ")}</span>
                      <h2 className="mt-2 font-bold">{item.title}</h2>
                      <p className="mt-1 text-xs text-slate-500">Saved {new Date(item.created_at).toLocaleDateString("en-GB")}</p>
                    </div>
                    <button type="button" onClick={() => remove(item.id)} className="text-sm text-rose-300 hover:text-rose-200">Remove</button>
                  </article>
                ))}
              </div>
            )}
            <Link href="/" className="mt-8 inline-flex rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">Start a new search</Link>
            <section className="mt-10 border-t border-white/10 pt-7"><h2 className="text-lg font-bold">Your data</h2><p className="mt-2 text-sm text-slate-400">Download a copy of the information stored with your account.</p><button type="button" onClick={exportData} className="mt-4 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:border-sky-300/50">Download my data</button>{isAdmin ? <p className="mt-5 text-xs text-amber-300">The master owner account cannot be deleted from the customer interface.</p> : <div className="mt-7 border-t border-white/10 pt-6"><h3 className="font-bold text-rose-200">Delete account</h3><p className="mt-2 text-sm text-slate-400">Permanently removes your account, saved searches, reports and activity.</p><button type="button" onClick={deleteAccount} className="mt-4 rounded-xl border border-rose-300/30 px-4 py-2.5 text-sm font-semibold text-rose-200 hover:bg-rose-300/10">Delete my account</button></div>}</section>
          </section>
        ) : (
          <section className="mx-auto mt-12 max-w-md rounded-3xl border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-300">{isSignUp ? "Create account" : "Welcome back"}</p>
            <h1 className="mt-2 text-3xl font-bold">{isSignUp ? "Save your CarScout data" : "Sign in to CarScout"}</h1>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block text-sm text-slate-300">Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`mt-2 ${inputClass}`} /></label>
              <label className="block text-sm text-slate-300">Password<input required minLength={8} type="password" autoComplete={isSignUp ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`mt-2 ${inputClass}`} /></label>
              {message && <p role="status" className="text-sm text-sky-200">{message}</p>}
              <button disabled={loading} className="w-full rounded-xl bg-sky-400 px-5 py-3.5 font-bold text-slate-950 disabled:opacity-60">{loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}</button>
            </form>
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setMessage(""); }} className="mt-5 text-sm text-slate-300 hover:text-white">{isSignUp ? "Already have an account? Sign in" : "New to CarScout? Create an account"}</button>
            {!isSignUp && <Link href="/forgot-password" className="mt-4 block text-sm text-sky-300 hover:text-sky-200">Forgot your password?</Link>}
          </section>
        )}
      </div>
    </main>
  );
}
