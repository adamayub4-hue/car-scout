"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { analyticsAudience } from "../lib/analytics-audience";
import { getSavedSearchUrl, withRequestDeadline } from "../lib/saved-search";

type SavedItem = {
  kind: "car_search" | "part_search" | "vehicle";
  title: string;
  data: Record<string, unknown>;
};

export default function SaveButton({ item }: { item: SavedItem }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const saving = useRef(false);

  const save = async () => {
    if (saving.current) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.push(`/account?setup=required&returnTo=${encodeURIComponent(getSavedSearchUrl(item))}`);
      return;
    }
    saving.current = true;
    setState("saving");
    setMessage("");
    try {
      const { data: auth, error: authError } = await withRequestDeadline(supabase.auth.getUser());
      if (authError && authError.name !== "AuthSessionMissingError") throw authError;
      if (!auth.user) {
        router.push(`/account?returnTo=${encodeURIComponent(getSavedSearchUrl(item))}`);
        setState("idle");
        return;
      }
      const { error } = await withRequestDeadline(supabase.from("saved_items").insert({
        user_id: auth.user.id,
        kind: item.kind,
        title: item.title,
        data: item.data,
      }));
      if (error) {
        setState("error");
        setMessage("Could not save this yet. Please try again.");
        return;
      }
      setState("saved");
      setMessage("Saved to your account.");
      // The save is already confirmed; optional telemetry must not hold up success.
      void Promise.resolve().then(() => analyticsAudience() === "included" ? supabase.from("activity_events").insert({ user_id: auth.user.id, event_name: "save_item", metadata: { kind: item.kind } }) : undefined).catch(() => {});
    } catch {
      setState("error");
      setMessage("We could not confirm this was saved. Check your account before trying again.");
    } finally { saving.current = false; }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={save}
        disabled={state === "saving" || state === "saved"}
        className="rounded-xl border border-outline/15 bg-overlay/[0.06] px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-sky-300/50 hover:bg-overlay/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "saving" ? "Saving…" : state === "saved" ? "✓ Saved" : "Save to my account"}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${state === "error" ? "text-danger" : "text-success"}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
