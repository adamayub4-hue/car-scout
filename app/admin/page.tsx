"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Profile = { id: string; email: string; created_at: string };
type Complaint = { id: string; user_id: string; subject: string; message: string; status: "open" | "in_progress" | "resolved"; created_at: string };
type EventRow = { id: number; user_id: string; event_name: string; created_at: string };
type SavedRow = { id: string; user_id: string; kind: string; title: string; created_at: string };

async function withDeadline<T>(request: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(request), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Request timed out")), 15000);
    })]);
  } finally { clearTimeout(timer); }
}

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null), [profiles, setProfiles] = useState<Profile[]>([]), [complaints, setComplaints] = useState<Complaint[]>([]), [events, setEvents] = useState<EventRow[]>([]), [saved, setSaved] = useState<SavedRow[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null), [ownerLinkLoading, setOwnerLinkLoading] = useState(false), [ownerLinkMessage, setOwnerLinkMessage] = useState("");
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ users: 0, open: 0, saved: 0 });
  const [savingId, setSavingId] = useState<string | null>(null), [saveError, setSaveError] = useState<string | null>(null);
  const requestId = useRef(0), saving = useRef(false);
  const emails = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.email])), [profiles]);
  const load = async () => {
    const id = ++requestId.current;
    setLoading(true); setLoadError(null); setSaveError(null); setAllowed(null);
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("Service unavailable");
      const authResult = await withDeadline(client.auth.getUser());
      if (id !== requestId.current) return;
      if (!authResult.data.user) { setSignedIn(false); setAllowed(false); return; }
      if (authResult.error) throw authResult.error;
      setSignedIn(true);
      const adminResult = await withDeadline(client.from("admins").select("user_id").eq("user_id", authResult.data.user.id).maybeSingle());
      if (id !== requestId.current) return;
      if (adminResult.error) throw adminResult.error;
      if (!adminResult.data) { setAllowed(false); return; }
      setAllowed(true);
      const [p, c, e, s, open] = await withDeadline(Promise.all([
        client.from("profiles").select("id,email,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1000),
        client.from("complaints").select("*").order("status", { ascending: true }).order("created_at", { ascending: false }).limit(1000),
        client.from("activity_events").select("id,user_id,event_name,created_at").order("created_at", { ascending: false }).limit(100),
        client.from("saved_items").select("id,user_id,kind,title,created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
        client.from("complaints").select("id", { count: "exact", head: true }).neq("status", "resolved"),
      ]));
      if (id !== requestId.current) return;
      if ([p, c, e, s, open].some((result) => result.error) || p.count === null || s.count === null || open.count === null || !p.data || !c.data || !e.data || !s.data) throw new Error("Incomplete dashboard data");
      setProfiles(p.data as Profile[]); setComplaints(c.data as Complaint[]); setEvents(e.data as EventRow[]); setSaved(s.data as SavedRow[]);
      setCounts({ users: p.count, open: open.count, saved: s.count });
    } catch {
      if (id === requestId.current) setLoadError("We couldn’t load or verify the dashboard. Counts and reports are unavailable—not zero. Check your connection and retry, or sign in again.");
    } finally { if (id === requestId.current) setLoading(false); }
  };
  useEffect(() => { const lifecycle = requestId; const timer = window.setTimeout(() => void load(), 0); return () => { window.clearTimeout(timer); lifecycle.current++; }; }, []);
  const requestOwnerLink = async () => {
    const client = getSupabaseBrowserClient();
    if (!client) { setOwnerLinkMessage("Owner sign-in is temporarily unavailable."); return; }
    setOwnerLinkLoading(true); setOwnerLinkMessage("");
    const { error } = await client.auth.signInWithOtp({
      email: "adamayub4@gmail.com",
      options: { shouldCreateUser: false, emailRedirectTo: "https://mekivo.uk/admin" },
    });
    setOwnerLinkLoading(false);
    setOwnerLinkMessage(error ? "We couldn’t send the owner sign-in link. Try again shortly." : "A secure one-time sign-in link has been sent to the owner email address.");
  };
  const updateStatus = async (id: string, status: Complaint["status"]) => {
    if (saving.current) return;
    saving.current = true; setSavingId(id); setSaveError(null);
    const previous = complaints.find((row) => row.id === id)?.status;
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error("Service unavailable");
      const { data, error } = await withDeadline(client.from("complaints").update({ status, updated_at: new Date().toISOString() }).eq("id", id).select("id,status").single());
      if (error || !data || data.status !== status) throw new Error("Update not confirmed");
      setComplaints((rows) => rows.map((row) => row.id === id ? { ...row, status } : row));
      if (previous) setCounts((value) => ({ ...value, open: value.open + Number(status !== "resolved") - Number(previous !== "resolved") }));
    } catch { setSaveError("The status change could not be confirmed. Your last confirmed status is still shown. Refresh the dashboard before trying again."); }
    finally { saving.current = false; setSavingId(null); }
  };
  if (loadError) return <main className="min-h-screen bg-background p-8 text-foreground"><div className="mx-auto max-w-lg rounded-2xl border border-rose-300/30 p-6"><h1 className="text-2xl font-bold">Dashboard unavailable</h1><p role="alert" className="mt-3 text-muted">{loadError}</p><button type="button" onClick={() => void load()} className="mt-5 rounded-lg bg-sky-300 px-4 py-2 font-bold text-slate-950">Retry dashboard</button><Link href="/account" className="ml-4 text-link">Sign in</Link></div></main>;
  if (loading || allowed === null) return <main className="min-h-screen bg-background p-8 text-muted"><p role="status">Loading dashboard and checking owner access…</p></main>;
  if (!allowed) return <main className="min-h-screen bg-background p-8 text-foreground"><div className="mx-auto max-w-lg rounded-2xl border border-rose-300/20 p-6"><h1 className="text-2xl font-bold">Owner access only</h1><p className="mt-3 text-muted">This dashboard is protected by your owner account and database permissions.</p>{signedIn === false ? <><button type="button" disabled={ownerLinkLoading} onClick={() => void requestOwnerLink()} className="mt-5 w-full rounded-xl bg-sky-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-60">{ownerLinkLoading ? "Sending secure link…" : "Email me a secure owner sign-in link"}</button>{ownerLinkMessage && <p role="status" className="mt-3 text-sm text-muted">{ownerLinkMessage}</p>}<p className="mt-4 text-xs leading-5 text-subtle">The link works once and is sent only to the registered owner email. Owner permissions are checked again before this dashboard opens.</p></> : <p className="mt-4 text-sm text-danger">This signed-in account does not have owner permission.</p>}<Link href="/account" className="mt-5 inline-block text-link">Use the normal account sign-in →</Link></div></main>;
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between border-b border-outline/10 pb-6"><div><p className="text-xs font-bold uppercase tracking-wider text-link">Private owner area</p><h1 className="mt-1 text-3xl font-bold">Mekivo control centre</h1></div><Link href="/" className="text-sm text-muted">View site</Link></header>
    <button type="button" disabled={savingId !== null} onClick={() => void load()} className="mt-5 rounded-lg border border-outline/20 px-4 py-2 text-sm disabled:opacity-50">Refresh dashboard</button>
    {saveError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/30 p-4 text-danger">{saveError}</p>}
    {savingId && <p role="status" className="mt-4 text-muted">Saving report status…</p>}
    <section aria-labelledby="website-traffic-heading" className="mt-7 rounded-2xl border border-sky-300/25 bg-sky-400/5 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <h2 id="website-traffic-heading" className="text-xl font-bold">Website traffic</h2>
          <p className="mt-2 text-sm leading-6 text-muted">See website visitors, page views and where people came from. This includes people who browse and search without signing in.</p>
        </div>
        <a href="https://vercel.com/adamayub4-hues-projects/car-scout/analytics" target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center rounded-xl bg-sky-300 px-5 py-3 text-sm font-bold text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300">View website visitors <span aria-hidden="true" className="ml-2">↗</span><span className="sr-only"> (opens in a new tab)</span></a>
      </div>
      <p className="mt-3 text-xs leading-5 text-subtle">Opens your private Vercel traffic report. Choose the same dates when comparing visitors with your ad results.</p>
      <p className="mt-3 text-sm leading-6 text-muted">Signed-in owner visits are excluded automatically. Before testing on another browser or phone, <Link href="/traffic-settings" className="font-semibold text-link underline">exclude that browser from the reports</Link>. Earlier totals still include earlier testing.</p>
    </section>
    <section aria-labelledby="account-records-heading" className="mt-8">
      <h2 id="account-records-heading" className="text-xl font-bold">Account records</h2>
      <p className="mt-2 text-sm leading-6 text-muted">These are account totals and recorded actions, not website visitor counts. One person can make several actions, and visitors who are not signed in are not included.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        { label: "Registered accounts", value: counts.users, detail: "Current accounts, including the owner." },
        { label: "Unresolved reports", value: counts.open, detail: "Open reports and reports in progress." },
        { label: "Saved items", value: counts.saved, detail: "Items currently saved to accounts." },
        { label: "Recorded account actions", value: events.length, detail: "Up to 100 recent actions, not people." },
      ].map(({ label, value, detail }) => <div key={label} className="rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5"><strong className="text-3xl">{value}</strong><p className="mt-1 text-sm font-semibold">{label}</p><p className="mt-2 text-xs leading-5 text-subtle">{detail}</p></div>)}</div>
      <p className="mt-3 text-xs leading-5 text-subtle">These totals have no date filter. Use Refresh dashboard to load the latest account records. The report list shows up to 1,000 reports, with unresolved reports first.</p>
    </section>
    <section className="mt-8"><h2 className="text-xl font-bold">Suggestions, complaints and issues</h2><div className="mt-4 space-y-3">{complaints.length ? complaints.map((c) => <article key={c.id} className="rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-link">{emails[c.user_id] || c.user_id}</p><h3 className="mt-1 font-bold">{c.subject}</h3></div><select disabled={savingId !== null || saveError !== null} aria-label={`Status for ${c.subject}`} value={c.status} onChange={(e) => updateStatus(c.id, e.target.value as Complaint["status"])} className="rounded-lg border border-outline/10 bg-panel px-3 py-2 text-sm"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{c.message}</p><p className="mt-3 text-xs text-subtle">{new Date(c.created_at).toLocaleString("en-GB")}</p></article>) : <p className="rounded-xl border border-outline/10 p-5 text-muted">No feedback submitted.</p>}</div></section>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section><h2 className="text-xl font-bold">Newest accounts</h2><div className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">{profiles.slice(0, 20).map((p) => <div key={p.id} className="flex justify-between gap-3 border-b border-outline/5 py-3 text-sm last:border-0"><span>{p.email}</span><span className="text-subtle">{new Date(p.created_at).toLocaleDateString("en-GB")}</span></div>)}</div></section><section><h2 className="text-xl font-bold">Recently saved</h2><div className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">{saved.slice(0, 20).map((s) => <div key={s.id} className="border-b border-outline/5 py-3 text-sm last:border-0"><span className="text-xs text-link">{emails[s.user_id] || "User"} · {s.kind.replace("_", " ")}</span><p className="mt-1">{s.title}</p></div>)}</div></section></div>
    <section className="mt-8"><h2 className="text-xl font-bold">Recorded account actions</h2><div className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">{events.length ? events.slice(0, 30).map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 border-b border-outline/5 py-3 text-sm last:border-0"><span><span className="text-link">{emails[event.user_id] || "User"}</span> · {event.event_name.replaceAll("_", " ")}</span><time className="text-subtle">{new Date(event.created_at).toLocaleString("en-GB")}</time></div>) : <p className="text-muted">No account activity recorded.</p>}</div></section>
  </div></main>;
}
