"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../lib/supabase";

type SavedItem = {
  kind: "car_search" | "part_search" | "vehicle";
  title: string;
  data: Record<string, unknown>;
};

export default function SaveButton({ item }: { item: SavedItem }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  const save = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.push("/account?setup=required");
      return;
    }
    setState("saving");
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/account?returnTo=/");
      return;
    }
    const { error } = await supabase.from("saved_items").insert({
      user_id: auth.user.id,
      kind: item.kind,
      title: item.title,
      data: item.data,
    });
    if (error) {
      setState("error");
      setMessage("Could not save this yet. Please try again.");
      return;
    }
    void supabase.from("activity_events").insert({ user_id: auth.user.id, event_name: "save_item", metadata: { kind: item.kind } });
    setState("saved");
    setMessage("Saved to your account.");
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={save}
        disabled={state === "saving" || state === "saved"}
        className="rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-sky-300/50 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "saving" ? "Saving…" : state === "saved" ? "✓ Saved" : "Save to my account"}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${state === "error" ? "text-rose-300" : "text-emerald-300"}`} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
