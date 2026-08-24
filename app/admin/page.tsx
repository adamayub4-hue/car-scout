"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

type Profile = { id: string; email: string; created_at: string };
type Complaint = { id: string; user_id: string; subject: string; message: string; status: "open" | "in_progress" | "resolved"; created_at: string };
type EventRow = { id: number; user_id: string; event_name: string; created_at: string };
type SavedRow = { id: string; user_id: string; kind: string; title: string; created_at: string };

export default function AdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null), [profiles, setProfiles] = useState<Profile[]>([]), [complaints, setComplaints] = useState<Complaint[]>([]), [events, setEvents] = useState<EventRow[]>([]), [saved, setSaved] = useState<SavedRow[]>([]);
  const emails = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.email])), [profiles]);
  const load = async () => {
    const client = getSupabaseBrowserClient(); if (!client) { setAllowed(false); return; }
    const { data: auth } = await client.auth.getUser(); if (!auth.user) { setAllowed(false); return; }
    const { data: admin } = await client.from("admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
    if (!admin) { setAllowed(false); return; } setAllowed(true);
    const [p, c, e, s] = await Promise.all([
      client.from("profiles").select("*").order("created_at", { ascending: false }),
      client.from("complaints").select("*").order("created_at", { ascending: false }),
      client.from("activity_events").select("id,user_id,event_name,created_at").order("created_at", { ascending: false }).limit(100),
      client.from("saved_items").select("id,user_id,kind,title,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    setProfiles((p.data as Profile[]) || []); setComplaints((c.data as Complaint[]) || []); setEvents((e.data as EventRow[]) || []); setSaved((s.data as SavedRow[]) || []);
  };
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  const updateStatus = async (id: string, status: Complaint["status"]) => { const { error } = await getSupabaseBrowserClient()!.from("complaints").update({ status, updated_at: new Date().toISOString() }).eq("id", id); if (!error) setComplaints((rows) => rows.map((row) => row.id === id ? { ...row, status } : row)); };
  if (allowed === null) return <main className="min-h-screen bg-[#07101e] p-8 text-slate-400">Checking owner access…</main>;
  if (!allowed) return <main className="min-h-screen bg-[#07101e] p-8 text-white"><div className="mx-auto max-w-lg rounded-2xl border border-rose-300/20 p-6"><h1 className="text-2xl font-bold">Owner access only</h1><p className="mt-3 text-slate-400">This dashboard is protected by database permissions.</p><Link href="/account" className="mt-5 inline-block text-sky-300">Sign in to the owner account →</Link></div></main>;
  return <main className="min-h-screen bg-[#07101e] px-4 py-8 text-white"><div className="mx-auto max-w-6xl"><header className="flex items-center justify-between border-b border-white/10 pb-6"><div><p className="text-xs font-bold uppercase tracking-wider text-sky-300">Private owner area</p><h1 className="mt-1 text-3xl font-bold">Mekivo control centre</h1></div><Link href="/" className="text-sm text-slate-300">View site</Link></header>
    <section className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Users", profiles.length], ["Open feedback", complaints.filter((c) => c.status !== "resolved").length], ["Saved items", saved.length], ["Recent activity", events.length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><strong className="text-3xl">{value}</strong><p className="mt-1 text-sm text-slate-400">{label}</p></div>)}</section>
    <section className="mt-8"><h2 className="text-xl font-bold">Suggestions, complaints and issues</h2><div className="mt-4 space-y-3">{complaints.length ? complaints.map((c) => <article key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-sky-300">{emails[c.user_id] || c.user_id}</p><h3 className="mt-1 font-bold">{c.subject}</h3></div><select aria-label={`Status for ${c.subject}`} value={c.status} onChange={(e) => updateStatus(c.id, e.target.value as Complaint["status"])} className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{c.message}</p><p className="mt-3 text-xs text-slate-500">{new Date(c.created_at).toLocaleString("en-GB")}</p></article>) : <p className="rounded-xl border border-white/10 p-5 text-slate-400">No feedback submitted.</p>}</div></section>
    <div className="mt-8 grid gap-6 lg:grid-cols-2"><section><h2 className="text-xl font-bold">Newest users</h2><div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">{profiles.slice(0, 20).map((p) => <div key={p.id} className="flex justify-between gap-3 border-b border-white/5 py-3 text-sm last:border-0"><span>{p.email}</span><span className="text-slate-500">{new Date(p.created_at).toLocaleDateString("en-GB")}</span></div>)}</div></section><section><h2 className="text-xl font-bold">Recently saved</h2><div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">{saved.slice(0, 20).map((s) => <div key={s.id} className="border-b border-white/5 py-3 text-sm last:border-0"><span className="text-xs text-sky-300">{emails[s.user_id] || "User"} · {s.kind.replace("_", " ")}</span><p className="mt-1">{s.title}</p></div>)}</div></section></div>
    <section className="mt-8"><h2 className="text-xl font-bold">Recent account activity</h2><div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">{events.length ? events.slice(0, 30).map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-3 text-sm last:border-0"><span><span className="text-sky-300">{emails[event.user_id] || "User"}</span> · {event.event_name.replaceAll("_", " ")}</span><time className="text-slate-500">{new Date(event.created_at).toLocaleString("en-GB")}</time></div>) : <p className="text-slate-400">No account activity recorded.</p>}</div></section>
  </div></main>;
}
