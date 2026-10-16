"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Profile = { id: string; email: string; created_at: string };
type Selection = { id: string; email: string; ownerId: string };
type Props = {
  profiles: readonly Profile[];
  ownerId: string;
  protectedUserIds: readonly string[];
  totalAccounts: number;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onDeleted: (email: string) => Promise<void>;
  onRefresh: () => void;
  onAccessChanged: () => void;
};

async function withDeadline<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Request timed out")), 15000);
    })]);
  } finally { clearTimeout(timer); }
}

export default function AccountManagement({ profiles, ownerId, protectedUserIds, totalAccounts, disabled = false, onBusyChange, onDeleted, onRefresh, onAccessChanged }: Props) {
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [message, setMessage] = useState("");
  const [initialOwnerId] = useState(ownerId);
  const dialogRef = useRef<HTMLDialogElement>(null), cancelRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const mounted = useRef(false), generation = useRef(0), pending = useRef(false), locked = useRef(false);
  const identity = useRef<string | null>(ownerId), selected = useRef<Selection | null>(null), typed = useRef("");
  const latest = useRef({ profiles, ownerId, protectedUserIds, disabled, onBusyChange, onDeleted, onRefresh, onAccessChanged });
  useLayoutEffect(() => {
    latest.current = { profiles, ownerId, protectedUserIds, disabled, onBusyChange, onDeleted, onRefresh, onAccessChanged };
  }, [profiles, ownerId, protectedUserIds, disabled, onBusyChange, onDeleted, onRefresh, onAccessChanged]);

  useEffect(() => {
    const presence = mounted, lifecycle = generation, currentIdentity = identity, currentSelection = selected;
    mounted.current = true;
    // React can replay effect setup after cleanup without remounting state.
    // Restore only the original verified owner, never an access-loss lock.
    if (!locked.current && latest.current.ownerId === initialOwnerId) identity.current = initialOwnerId;
    const subscriptionGeneration = generation.current;
    const subscription = getSupabaseBrowserClient()?.auth.onAuthStateChange((_event, session) => {
      if (!mounted.current || generation.current !== subscriptionGeneration) return;
      const nextId = session?.user.id ?? null;
      if (nextId === identity.current) return;
      generation.current++;
      identity.current = null;
      selected.current = null; typed.current = ""; locked.current = true; pending.current = false;
      setSelection(null); setConfirmation(""); setQuery(""); setMessage(""); setBusy(false); setAccessLost(true);
      latest.current.onBusyChange(false);
      dialogRef.current?.close();
      // The parent observes the same auth event and clears its private records.
      // Do not start Supabase work inside its synchronous auth callback.
    });
    return () => { presence.current = false; lifecycle.current++; currentIdentity.current = null; currentSelection.current = null; subscription?.data.subscription.unsubscribe(); };
  }, [initialOwnerId]);

  const isProtected = (profile: Profile) => profile.id === latest.current.ownerId || latest.current.protectedUserIds.includes(profile.id);
  const emailOf = (profile: Profile) => typeof profile.email === "string" ? profile.email.trim() : "";
  function openConfirmation(profile: Profile, trigger: HTMLButtonElement) {
    if (!mounted.current || pending.current || locked.current || latest.current.disabled || !identity.current || identity.current !== latest.current.ownerId || isProtected(profile)) return;
    const currentProfile = latest.current.profiles.find(item => item.id === profile.id);
    if (!currentProfile || !emailOf(currentProfile) || emailOf(currentProfile) !== emailOf(profile)) return;
    const next = { id: profile.id, email: emailOf(currentProfile), ownerId: identity.current };
    selected.current = next; typed.current = ""; triggerRef.current = trigger;
    setSelection(next); setConfirmation(""); setMessage("");
    dialogRef.current?.showModal();
    cancelRef.current?.focus({ preventScroll: true });
  }
  function closeConfirmation() {
    if (!mounted.current || pending.current) return;
    selected.current = null; typed.current = "";
    setSelection(null); setConfirmation("");
    dialogRef.current?.close();
    triggerRef.current?.focus({ preventScroll: true });
  }
  function loseAccess() {
    generation.current++;
    identity.current = null; selected.current = null; typed.current = ""; locked.current = true; pending.current = false;
    setSelection(null); setConfirmation(""); setQuery(""); setMessage(""); setBusy(false); setAccessLost(true);
    latest.current.onBusyChange(false);
    dialogRef.current?.close();
    latest.current.onAccessChanged();
  }
  async function confirmDeletion(event: FormEvent) {
    event.preventDefault();
    const target = selected.current;
    const profile = latest.current.profiles.find(item => item.id === target?.id);
    if (!mounted.current || !target || pending.current || locked.current || latest.current.disabled || !profile || isProtected(profile)
      || identity.current !== target.ownerId || latest.current.ownerId !== target.ownerId || emailOf(profile) !== target.email || typed.current.trim() !== target.email) return;
    const lifecycle = generation.current;
    const current = () => mounted.current && generation.current === lifecycle && identity.current === target.ownerId && latest.current.ownerId === target.ownerId;
    pending.current = true; setBusy(true); setMessage(""); latest.current.onBusyChange(true);
    let submitted = false, confirmed = false;
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Service unavailable");
      const auth = await withDeadline(client.auth.getUser());
      if (!current()) return;
      if (auth.error || auth.data.user?.id !== target.ownerId) { loseAccess(); return; }
      const admin = await withDeadline(client.from("admins").select("user_id").eq("user_id", target.ownerId).maybeSingle());
      if (!current()) return;
      if (admin.error || admin.data?.user_id !== target.ownerId) { loseAccess(); return; }
      // The RPC repeats every permission, protected-target and email check in
      // one database transaction. No profile/auth rows are deleted client-side.
      submitted = true;
      const result = await withDeadline(client.rpc("delete_user_account", { target_user_id: target.id, confirmation_email: target.email }));
      if (!current()) return;
      if (result.error?.code === "42501") { loseAccess(); return; }
      if (result.error || result.data !== target.id) throw new Error("Deletion not confirmed");
      confirmed = true;
      locked.current = true; setRequiresRefresh(true);
      setMessage("Account deletion confirmed. Reloading the dashboard’s account records…");
      await latest.current.onDeleted(target.email);
    } catch {
      if (!current()) return;
      if (!submitted) { loseAccess(); return; }
      locked.current = true; setRequiresRefresh(true);
      setMessage(confirmed
        ? "The account was deleted, but the dashboard could not be refreshed. Refresh account records now."
        : "The deletion could not be confirmed and may have completed. Refresh account records before trying anything else.");
    } finally {
      if (current()) { pending.current = false; setBusy(false); latest.current.onBusyChange(false); }
    }
  }

  if (accessLost || !ownerId || initialOwnerId !== ownerId) return <section className="mt-8 rounded-2xl border border-outline/15 p-5"><p role="alert" className="text-sm text-warning">Owner access changed or could not be verified. Sign in again and refresh the dashboard before managing accounts.</p></section>;
  const matches = profiles.filter(profile => emailOf(profile).toLocaleLowerCase("en-GB").includes(query.trim().toLocaleLowerCase("en-GB")));
  const shown = matches.slice(0, 50);
  return <section aria-labelledby="account-management-heading" className="mt-8 rounded-2xl border border-outline/15 bg-panel p-5 sm:p-6">
    <h2 id="account-management-heading" className="text-xl font-bold">Manage accounts</h2>
    <p className="mt-2 text-sm leading-6 text-muted">Find accounts by email and remove only those you recognise. The owner and other administrator accounts are protected.</p>
    <label htmlFor="account-email-search" className="mt-4 block text-sm font-semibold">Search account emails</label>
    <input id="account-email-search" value={query} onChange={event => setQuery(event.target.value)} disabled={busy}
      placeholder="Type an email address" type="search" autoComplete="off"
      className="mt-2 min-h-12 w-full rounded-xl border border-outline/20 bg-background px-3 py-3 text-base outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50" />
    <p className="mt-2 text-xs leading-5 text-subtle">Search covers {profiles.length.toLocaleString("en-GB")} loaded accounts{totalAccounts > profiles.length ? ` from ${totalAccounts.toLocaleString("en-GB")} registered accounts; only the newest 1,000 are loaded` : ""}. {matches.length > 50 ? `Showing the first 50 of ${matches.length.toLocaleString("en-GB")} matches. Narrow the search to find a specific account.` : `${matches.length.toLocaleString("en-GB")} matching ${matches.length === 1 ? "account" : "accounts"}.`}</p>
    {requiresRefresh && <div role="alert" className="mt-4 rounded-xl border border-warning/30 p-3 text-sm text-warning"><p>{message}</p><button type="button" disabled={busy} onClick={() => latest.current.onRefresh()} className="mt-3 min-h-11 rounded-lg border border-current px-3 py-2 font-semibold disabled:opacity-50">Refresh account records</button></div>}
    <ul className="mt-4 divide-y divide-outline/10">
      {shown.map(profile => <li key={profile.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="break-all text-sm font-semibold">{emailOf(profile) || "Email unavailable"}</p><p className="mt-1 text-xs text-subtle">Joined {new Date(profile.created_at).toLocaleDateString("en-GB")}</p></div>
        {profile.id === ownerId || protectedUserIds.includes(profile.id) ? <span className="text-xs font-semibold text-muted">{profile.id === ownerId ? "Owner account · protected" : "Administrator · protected"}</span>
          : <button type="button" disabled={busy || requiresRefresh || disabled || !emailOf(profile)} onClick={event => openConfirmation(profile, event.currentTarget)}
            aria-label={`Delete account ${emailOf(profile) || "with unavailable email"}`}
            className="min-h-11 rounded-lg border border-rose-300/30 px-3 py-2 text-sm font-semibold text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:cursor-not-allowed disabled:opacity-40">Delete account</button>}
      </li>)}
    </ul>
    {!shown.length && <p role="status" className="py-4 text-sm text-muted">No loaded accounts match that email.</p>}
    <dialog ref={dialogRef} aria-labelledby="delete-account-title" aria-describedby="delete-account-warning"
      onCancel={event => { if (pending.current) event.preventDefault(); else closeConfirmation(); }}
      onClose={() => { if (!pending.current && mounted.current) { selected.current = null; typed.current = ""; setSelection(null); setConfirmation(""); triggerRef.current?.focus({ preventScroll: true }); } }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-outline/20 bg-panel p-5 text-foreground shadow-2xl backdrop:bg-slate-950/70 sm:p-6">
      <h3 id="delete-account-title" className="text-xl font-bold">Permanently delete this account?</h3>
      <form onSubmit={confirmDeletion}>
        {selection && <>
        <p className="mt-3 break-all font-semibold text-danger">{selection.email}</p>
        <p id="delete-account-warning" className="mt-3 text-sm leading-6 text-muted">This permanently removes this account’s sign-in, profile, saved items, submitted reports and recorded account actions. This cannot be undone. Website visitor reports are separate.</p>
        <label htmlFor="delete-account-email" className="mt-4 block text-sm font-semibold">Type this exact email address to confirm</label>
        <input id="delete-account-email" type="text" inputMode="email" autoComplete="off" autoCorrect="off" spellCheck={false} value={confirmation} disabled={busy || requiresRefresh}
          onChange={event => { typed.current = event.target.value; setConfirmation(event.target.value); }}
          className="mt-2 min-h-12 w-full rounded-xl border border-outline/20 bg-background px-3 py-3 text-base outline-none focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50" />
        {message && <p role={requiresRefresh ? "alert" : "status"} className="mt-3 text-sm leading-6 text-warning">{message}</p>}
        {requiresRefresh && <button type="button" disabled={busy} onClick={() => latest.current.onRefresh()} className="mt-3 min-h-11 rounded-lg border border-outline/20 px-3 py-2 text-sm font-semibold text-link disabled:opacity-50">Refresh account records</button>}
        </>}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button ref={cancelRef} type="button" disabled={busy} onClick={closeConfirmation} className="min-h-11 rounded-lg border border-outline/20 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={!selection || busy || requiresRefresh || disabled || confirmation.trim() !== selection.email} className="min-h-11 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Deleting account…" : "Permanently delete account"}</button>
        </div>
      </form>
    </dialog>
  </section>;
}
