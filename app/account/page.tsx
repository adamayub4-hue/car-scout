"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSavedSearchUrl, safeSearchReturnUrl, withRequestDeadline } from "../lib/saved-search";
import { clearPendingListing, getPendingListingExpiresAt, getPendingListingSnapshotExpiresAt, getPendingListingToken, parseSavedListing, readPendingListing, saveListingToAccount, type SavedListingItem } from "../lib/saved-listings";
import SavedListingCard from "../components/saved-listing-card";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase";

type SavedItem = {
  id: string;
  kind: "car_search" | "part_search" | "vehicle" | "car_listing" | "part_listing";
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
  const [pendingListing, setPendingListing] = useState<{ token: string; item: SavedListingItem } | null>(null);
  const [pendingError, setPendingError] = useState("");
  const [page, setPage] = useState(0);
  const itemsRequest = useRef(0);
  const adminRequest = useRef(0);
  const activeUserId = useRef<string | null>(null);
  const accountVersion = useRef(0);
  const actionRunning = useRef(false);

  const loadAdminStatus = useCallback(async (userId: string | null | undefined) => {
    const supabase = getSupabaseBrowserClient();
    const request = ++adminRequest.current;
    if (!supabase || !userId) { setIsAdmin(false); return; }
    try {
      const { data: row, error } = await withRequestDeadline(supabase.from("admins").select("user_id").eq("user_id", userId).maybeSingle());
      if (request === adminRequest.current && activeUserId.current === userId) setIsAdmin(!error && Boolean(row));
    } catch { if (request === adminRequest.current && activeUserId.current === userId) setIsAdmin(false); }
  }, []);

  const loadItems = useCallback(async (userId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || activeUserId.current !== userId) return;
    const request = ++itemsRequest.current;
    setItemsLoading(true); setItemsError("");
    try {
      const { data, error } = await withRequestDeadline(supabase.from("saved_items").select("*").eq("user_id", userId).order("created_at", { ascending: false }));
      if (error || !data) throw error || new Error("Missing saved items");
      if (request === itemsRequest.current && activeUserId.current === userId) setItems(data as SavedItem[]);
    } catch {
      if (request === itemsRequest.current) setItemsError("We could not load your saved items. Your saved data has not been removed.");
    } finally { if (request === itemsRequest.current) setItemsLoading(false); }
  }, []);

  const updateAccount = useCallback((nextUser: User | null) => {
    if (activeUserId.current !== (nextUser?.id ?? null)) {
      activeUserId.current = nextUser?.id ?? null;
      accountVersion.current++;
      itemsRequest.current++; adminRequest.current++;
      actionRunning.current = false;
      setItems([]); setPage(0); setItemsLoading(false); setItemsError(""); setIsAdmin(false); setBusyAction(""); setMessage("");
    }
    setUser(nextUser); setLoading(false);
    if (nextUser) { void loadItems(nextUser.id); void loadAdminStatus(nextUser.id); }
  }, [loadItems, loadAdminStatus]);

  useEffect(() => {
    const lifecycle = itemsRequest;
    const adminLifecycle = adminRequest;
    const accountLifecycle = accountVersion;
    const userLifecycle = activeUserId;
    let active = true;
    let authRevision = 0;
    const params = new URLSearchParams(window.location.search);
    const requestedReturn = safeSearchReturnUrl(params.get("returnTo"));
    const requestedToken = params.has("saveListing") ? params.get("saveListing") : getPendingListingToken();
    const startup = window.setTimeout(() => {
      setReturnUrl(requestedReturn);
      if (requestedToken) {
        const item = readPendingListing(requestedToken);
        if (item) setPendingListing({ token: requestedToken, item });
        else setPendingError("That listing is no longer waiting to be saved in this browser. Return to your search and choose Save car or Save part again.");
      }
    }, 0);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return () => window.clearTimeout(startup);
    const update = (nextUser: User | null) => {
      if (!active) return;
      updateAccount(nextUser);
    };
    void withRequestDeadline(supabase.auth.getUser()).then(({ data, error }) => {
      if (error && error.name !== "AuthSessionMissingError") throw error;
      if (authRevision === 0) update(data.user);
    }).catch(() => { if (active && authRevision === 0) { setLoading(false); setMessage("We could not check your session. Try signing in again."); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const revision = ++authRevision;
      // Defer database calls until the auth callback has released its session lock.
      window.setTimeout(() => { if (revision === authRevision) update(session?.user ?? null); }, 0);
    });
    return () => { active = false; lifecycle.current++; adminLifecycle.current++; userLifecycle.current = null; accountLifecycle.current++; window.clearTimeout(startup); listener.subscription.unsubscribe(); };
  }, [updateAccount]);

  const pendingToken = pendingListing?.token;
  useEffect(() => {
    if (!pendingToken) return;
    const expiresAt = getPendingListingExpiresAt(pendingToken);
    const snapshotExpiresAt = getPendingListingSnapshotExpiresAt(pendingToken);
    if (!expiresAt) return;
    const refreshPending = () => {
      const item = readPendingListing(pendingToken);
      setPendingListing(current => current?.token === pendingToken ? item ? { token: pendingToken, item } : null : current);
    };
    const timers = [window.setTimeout(refreshPending, Math.max(1, expiresAt - Date.now()))];
    if (snapshotExpiresAt && snapshotExpiresAt > Date.now()) timers.push(window.setTimeout(refreshPending, snapshotExpiresAt - Date.now()));
    const visible = () => { if (document.visibilityState === "visible") refreshPending(); };
    document.addEventListener("visibilitychange", visible);
    return () => { timers.forEach(timer => window.clearTimeout(timer)); document.removeEventListener("visibilitychange", visible); };
  }, [pendingToken]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || actionRunning.current) return;
    const version = accountVersion.current;
    actionRunning.current = true; setLoading(true); setMessage("");
    try {
      const confirmationParams = new URLSearchParams();
      if (returnUrl) confirmationParams.set("returnTo", returnUrl);
      if (pendingListing) confirmationParams.set("saveListing", pendingListing.token);
      const confirmationUrl = `https://mekivo.uk/account${confirmationParams.size ? `?${confirmationParams}` : ""}`;
      const result = await withRequestDeadline(isSignUp
        ? supabase.auth.signUp({ email, password, options: { emailRedirectTo: confirmationUrl } })
        : supabase.auth.signInWithPassword({ email, password }));
      if (version !== accountVersion.current && result.data.user?.id !== activeUserId.current) return;
      if (result.error) setMessage(result.error.message);
      else if (isSignUp && !result.data.session) setMessage("Check your email to confirm your account, then sign in.");
      else {
        if (version === accountVersion.current) updateAccount(result.data.user);
        setMessage(isSignUp ? "Your account is ready." : "Welcome back.");
      }
    } catch { if (version === accountVersion.current) setMessage("Sign-in could not be confirmed. Check your connection and try again."); }
    finally { if (version === accountVersion.current) { actionRunning.current = false; setLoading(false); } }
  };

  const remove = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || activeUserId.current !== user.id || actionRunning.current) return;
    const version = accountVersion.current;
    actionRunning.current = true; setBusyAction(id); setMessage("");
    try {
      const { data, error } = await withRequestDeadline(supabase.from("saved_items").delete().eq("id", id).eq("user_id", user.id).select("id"));
      if (error || !data?.some(row => row.id === id)) throw error || new Error("Removal not confirmed");
      if (version === accountVersion.current) setItems(current => current.filter(item => item.id !== id));
    } catch { if (version === accountVersion.current) setMessage("We could not confirm removal. Refresh your saved items before trying again."); }
    finally { if (version === accountVersion.current) { actionRunning.current = false; setBusyAction(""); } }
  };

  const savePending = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !user || activeUserId.current !== user.id || !pendingListing || actionRunning.current) return;
    const selectedItem = readPendingListing(pendingListing.token);
    if (!selectedItem) {
      setPendingListing(null);
      setPendingError("That selection has expired or changed in this browser. Return to your search and choose Save car or Save part again.");
      return;
    }
    const version = accountVersion.current;
    actionRunning.current = true; setBusyAction("save-listing"); setMessage(""); setPendingError("");
    try {
      const result = await saveListingToAccount(supabase, user.id, selectedItem);
      if (version !== accountVersion.current) return;
      clearPendingListing(pendingListing.token);
      setPendingListing(null);
      setMessage(result.alreadySaved ? "This listing is already saved to your account." : "Listing saved to your account.");
      void loadItems(user.id);
    } catch { if (version === accountVersion.current) setPendingError("We could not confirm this listing was saved. Your selection is still here. Please try again."); }
    finally { if (version === accountVersion.current) { actionRunning.current = false; setBusyAction(""); } }
  };

  const dismissPending = () => {
    if (!pendingListing || actionRunning.current) return;
    clearPendingListing(pendingListing.token); setPendingListing(null); setPendingError("");
  };

  const signOut = async () => {
    if (actionRunning.current) return;
    const version = accountVersion.current;
    try {
      const result = await withRequestDeadline(getSupabaseBrowserClient()!.auth.signOut());
      if (result.error) throw result.error;
      if (version === accountVersion.current) updateAccount(null);
    } catch { if (version === accountVersion.current) setMessage("We could not sign you out. Please try again."); }
  };

  const exportData = async () => {
    const supabase = getSupabaseBrowserClient(); if (!supabase || !user || actionRunning.current) return;
    const version = accountVersion.current;
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
      if (version !== accountVersion.current) return;
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, savedItems, complaints, activity }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "mekivo-data.json"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Your complete data export is ready.");
    } catch { if (version === accountVersion.current) setMessage("We could not load all of your data, so no incomplete export was downloaded. Please try again."); }
    finally { if (version === accountVersion.current) { actionRunning.current = false; setBusyAction(""); } }
  };

  const deleteAccount = async () => {
    if (isAdmin || actionRunning.current || !window.confirm("Permanently delete your Mekivo account and all saved data? This cannot be undone.")) return;
    const version = accountVersion.current;
    actionRunning.current = true; setBusyAction("delete"); setMessage("");
    try {
      const { error } = await withRequestDeadline(getSupabaseBrowserClient()!.rpc("delete_my_account"));
      if (error) throw error;
      if (version !== accountVersion.current) return;
      await getSupabaseBrowserClient()!.auth.signOut({ scope: "local" });
      if (activeUserId.current && activeUserId.current !== user?.id) return;
      updateAccount(null); setMessage("Your account and stored data were deleted.");
    } catch { if (version === accountVersion.current) setMessage("Account deletion could not be confirmed. Please contact support before retrying."); }
    finally { if (version === accountVersion.current) { actionRunning.current = false; setBusyAction(""); } }
  };

  const pageSize = 12;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(items.length / pageSize) - 1));
  const pageItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-outline/10 pb-6">
          <Link href="/" className="text-xl font-bold">← Mekivo</Link>
          {user && <button type="button" disabled={Boolean(busyAction)} onClick={signOut} className="text-sm text-muted hover:text-foreground disabled:opacity-60">Sign out</button>}
        </header>

        {returnUrl && <div className="mt-6 rounded-2xl border border-sky-300/25 p-5 text-sm"><p>Your search is ready to resume. {user ? "Open it, then choose Save search." : "Sign in or create an account, then return to save it."}</p><Link href={returnUrl} className="mt-3 inline-block font-semibold text-link">Resume your search →</Link></div>}
        {pendingListing && <section aria-label="Listing waiting to be saved" className="mt-6 rounded-2xl border border-sky-300/25 p-4">
          <p className="mb-2 font-bold">Your {pendingListing.item.kind === "car_listing" ? "car" : "part"} is ready to save</p>
          <p className="mb-4 text-sm leading-6 text-muted">{user ? `Save this listing to ${user.email || "your signed-in account"}.` : "Sign in or create an account below, then choose Save. This selection stays in this browser for up to 24 hours while you confirm your email."}</p>
          <SavedListingCard item={pendingListing.item} action={<>
            {user && <button type="button" onClick={savePending} disabled={Boolean(busyAction)} className="rounded-xl bg-sky-400 px-4 py-2.5 font-bold text-slate-950 disabled:opacity-60">{busyAction === "save-listing" ? "Saving…" : pendingListing.item.kind === "car_listing" ? "Save this car" : "Save this part"}</button>}
            <button type="button" onClick={dismissPending} disabled={Boolean(busyAction)} className="text-muted disabled:opacity-60">Dismiss</button>
          </>} />
        </section>}
        {pendingError && <p role="alert" className="mt-4 text-sm text-danger">{pendingError}</p>}
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
            <h1 className="mt-2 text-3xl font-bold">Saved cars, parts and searches</h1>
            <p className="mt-2 text-sm text-muted">Signed in as {user.email}</p>
            {isAdmin && (
              <Link href="/admin" className="mt-6 flex items-center justify-between rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] p-5 transition hover:border-amber-200/60 hover:bg-amber-300/[0.12]">
                <span><span className="block text-xs font-bold uppercase tracking-wider text-warning">Master owner account</span><strong className="mt-1 block text-lg">Open Mekivo control centre</strong><span className="mt-1 block text-sm text-muted">View users, reports, feedback, saved items and recent activity.</span></span>
                <span aria-hidden="true" className="ml-4 text-2xl text-warning">→</span>
              </Link>
            )}
            {itemsLoading ? <p role="status" className="mt-8 text-muted">Loading your saved items…</p> : itemsError ? <div role="alert" className="mt-8 rounded-xl border border-rose-300/30 p-5"><p>{itemsError}</p><button type="button" onClick={() => void loadItems(user.id)} className="mt-3 font-semibold text-link">Retry saved items</button></div> : items.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-6 text-muted">Nothing saved yet. Search for cars or parts, then choose “Save car” or “Save part” on a listing. Choose “Save search” to keep your search filters too.</div>
            ) : (
              <div className="mt-8 space-y-3">
                {pageItems.map((item) => {
                  if (item.kind === "car_listing" || item.kind === "part_listing") {
                    const listing = parseSavedListing(item);
                    return listing ? <SavedListingCard key={`${user.id}:${item.id}`} item={listing} savedAt={item.created_at} userId={user.id} action={<button type="button" disabled={Boolean(busyAction)} onClick={() => remove(item.id)} className="text-danger disabled:opacity-60">{busyAction === item.id ? "Removing…" : "Remove"}</button>} /> : <article key={item.id} className="rounded-2xl border border-outline/10 p-5"><h2 className="font-bold">{item.title || "Saved listing"}</h2><p className="mt-2 text-sm text-muted">The saved listing details are unavailable. Search again to find current listings.</p><div className="mt-3 flex gap-4 text-sm"><Link href={item.kind === "car_listing" ? "/?mode=cars" : "/?mode=parts"} className="font-semibold text-link">Search again →</Link><button type="button" disabled={Boolean(busyAction)} onClick={() => remove(item.id)} className="text-danger">Remove</button></div></article>;
                  }
                  return (
                  <article key={item.id} className="flex items-start justify-between gap-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-link">{item.kind.replace("_", " ")}</span>
                      <h2 className="mt-2 font-bold">{item.title}</h2>
                      <p className="mt-1 text-xs text-subtle">Saved {new Date(item.created_at).toLocaleDateString("en-GB")}</p><Link href={getSavedSearchUrl({ kind: item.kind, title: item.title, data: item.data })} className="mt-3 inline-block text-sm font-semibold text-link">Run this search →</Link>
                    </div>
                    <button type="button" disabled={Boolean(busyAction)} onClick={() => remove(item.id)} className="text-sm text-danger hover:text-danger">Remove</button>
                  </article>
                  );
                })}
              </div>
            )}
            {!itemsLoading && !itemsError && items.length > pageSize && <nav aria-label="Saved items pages" className="mt-5 flex items-center justify-between gap-3 text-sm"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-xl border border-outline/15 px-4 py-2 text-link disabled:opacity-40">← Previous</button><p role="status" className="text-muted">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, items.length)} of {items.length}</p><button type="button" disabled={(currentPage + 1) * pageSize >= items.length} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-xl border border-outline/15 px-4 py-2 text-link disabled:opacity-40">Next →</button></nav>}
            <Link href="/" className="mt-8 inline-flex rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950">Start a new search</Link>
            <section className="mt-10 border-t border-outline/10 pt-7"><h2 className="text-lg font-bold">Your data</h2><p className="mt-2 text-sm text-muted">Download a copy of the information stored with your account.</p><button type="button" disabled={Boolean(busyAction)} onClick={exportData} className="mt-4 rounded-xl border border-outline/15 px-4 py-2.5 text-sm font-semibold hover:border-sky-300/50">Download my data</button>{isAdmin ? <p className="mt-5 text-xs text-warning">The master owner account cannot be deleted from the customer interface.</p> : <div className="mt-7 border-t border-outline/10 pt-6"><h3 className="font-bold text-danger">Delete account</h3><p className="mt-2 text-sm text-muted">Permanently removes your account, saved cars, parts and searches, reports and activity.</p><button type="button" disabled={Boolean(busyAction)} onClick={deleteAccount} className="mt-4 rounded-xl border border-rose-300/30 px-4 py-2.5 text-sm font-semibold text-danger hover:bg-rose-300/10">Delete my account</button></div>}</section>
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
