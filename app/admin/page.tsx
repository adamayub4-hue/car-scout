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
      if (authResult.error) throw authResult.error;
      if (!authResult.data.user) { setAllowed(false); return; }
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
  if (!allowed) return <main className="min-h-screen bg-background p-8 text-foreground"><div className="mx-auto max-w-lg rounded-2xl border border-rose-300/20 p-6"><h1 className="text-2xl font-bold">Owner access only</h1><p className="mt-3 text-muted">This dashboard is protected by database permissions.</p><Link href="/account" className="mt-5 inline-block text-link">Sign in to the owner account →</Link></div></main>;
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between border-b border-outline/10 pb-6"><div><p className="text-xs font-bold uppercase tracking-wider text-link">Private owner area</p><h1 className="mt-1 text-3xl font-bold">Mekivo control centre</h1></div><Link href="/" className="text-sm text-muted">View site</Link></header>
    <button type="button" disabled={savingId !== null} onClick={() => void load()} className="mt-5 rounded-lg border border-outline/20 px-4 py-2 text-sm disabled:opacity-50">Refresh dashboard</button>
    {saveError && <p role="alert" className="mt-4 rounded-xl border border-rose-300/30 p-4 text-danger">{saveError}</p>}
    {savingId && <p role="status" className="mt-4 text-muted">Saving report status…</p>}
    <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Users", counts.users], ["Open feedback", counts.open], ["Saved items", counts.saved], ["Recent activity (up to 100)", events.length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5"><strong className="text-3xl">{value}</strong><p className="mt-1 text-sm text-muted">{label}</p></div>)}</section>
    <p className="mt-3 text-xs text-subtle">User, open-feedback and saved-item totals include all available records. Report list shows up to 1,000 reports, with unresolved reports first. Account activity does not include anonymous visitors.</p>
    <section className="mt-8"><h2 className="text-xl font-bold">Suggestions, complaints and issues</h2><div className="mt-4 space-y-3">{complaints.length ? complaints.map((c) => <article key={c.id} className="rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-link">{emails[c.user_id] || c.user_id}</p><h3 className="mt-1 font-bold">{c.subject}</h3></div><select disabled={savingId !== null || saveError !== null} aria-label={`Status for ${c.subject}`} value={c.status} onChange={(e) => updateStatus(c.id, e.target.value as Complaint["status"])} className="rounded-lg border border-outline/10 bg-panel px-3 py-2 text-sm"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{c.message}</p><p className="mt-3 text-xs text-subtle">{new Date(c.created_at).toLocaleString("en-GB")}</p></article>) : <p className="rounded-xl border border-outline/10 p-5 text-muted">No feedback submitted.</p>}</div></section>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section><h2 className="text-xl font-bold">Newest users</h2><div className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">{profiles.slice(0, 20).map((p) => <div key={p.id} className="flex justify-between gap-3 border-b border-outline/5 py-3 text-sm last:border-0"><span>{p.email}</span><span className="text-subtle">{new Date(p.created_at).toLocaleDateString("en-GB")}</span></div>)}</div></section><section><h2 className="text-xl font-bold">Recently saved</h2><div className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">{saved.slice(0, 20).map((s) => <div key={s.id} className="border-b border-outline/5 py-3 text-sm last:border-0"><span className="text-xs text-link">{emails[s.user_id] || "User"} · {s.kind.replace("_", " ")}</span><p className="mt-1">{s.title}</p></div>)}</div></section></div>
    <section className="mt-8"><h2 className="text-xl font-bold">Recent account activity</h2><div className="mt-4 rounded-2xl border border-outline/10 bg-overlay/[0.035] p-5">{events.length ? events.slice(0, 30).map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 border-b border-outline/5 py-3 text-sm last:border-0"><span><span className="text-link">{emails[event.user_id] || "User"}</span> · {event.event_name.replaceAll("_", " ")}</span><time className="text-subtle">{new Date(event.created_at).toLocaleString("en-GB")}</time></div>) : <p className="text-muted">No account activity recorded.</p>}</div></section>
  </div></main>;
}
