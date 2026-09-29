"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSavedListing, saveListingToAccount, stagePendingListing } from "../lib/saved-listings";
import { withRequestDeadline } from "../lib/saved-search";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { EbayListing, Mode } from "../lib/search";

type Props = { item: EbayListing; searchType: Mode; searchUrl?: string };

export default function SaveListingButton(props: Props) {
  // A different listing must never inherit another card's saved or pending state.
  return <SaveListingAction key={`${props.searchType}:${props.item.id}:${props.item.url}`} {...props} />;
}

function SaveListingAction({ item, searchType, searchUrl }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const saving = useRef(false);
  const accountId = useRef<string | null | undefined>(undefined);
  const operation = useRef(0);
  const label = searchType === "cars" ? "car" : "part";

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const invalidateSave = () => {
      operation.current++;
      saving.current = false;
    };
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const nextAccount = session?.user.id ?? null;
      if (accountId.current === nextAccount) return;
      const previousAccount = accountId.current;
      accountId.current = nextAccount;
      // Initial session discovery and token refreshes are not account switches.
      if (previousAccount === undefined) return;
      invalidateSave();
      setState("idle");
      setMessage("");
    });
    return () => {
      invalidateSave();
      data.subscription.unsubscribe();
    };
  }, []);

  async function save() {
    if (saving.current || state === "saved") return;
    const attempt = ++operation.current;
    saving.current = true;
    setState("saving");
    setMessage("");
    try {
      const listing = createSavedListing(item, searchType, searchUrl);
      if (!listing) throw new Error("Invalid listing");
      const client = getSupabaseBrowserClient();
      if (!client) {
        setState("error");
        setMessage("Saving is temporarily unavailable. Please try again shortly.");
        return;
      }
      const { data, error } = await withRequestDeadline(client.auth.getUser());
      if (attempt !== operation.current) return;
      if (error && error.name !== "AuthSessionMissingError") throw error;
      const verifiedAccount = data.user?.id ?? null;
      if (accountId.current !== undefined && accountId.current !== verifiedAccount) {
        // A delayed getUser response must not save under the previous account.
        setState("idle");
        setMessage("");
        return;
      }
      accountId.current = verifiedAccount;
      if (!data.user) {
        const token = stagePendingListing(listing);
        if (!token) {
          setState("error");
          setMessage("Your browser could not keep this listing for sign-in. Allow site storage, then try again.");
          return;
        }
        router.push(`/account?saveListing=${encodeURIComponent(token)}`);
        setState("idle");
        return;
      }
      await saveListingToAccount(client, data.user.id, listing);
      if (attempt !== operation.current || accountId.current !== data.user.id) return;
      setState("saved");
      setMessage("Saved to your account.");
    } catch {
      if (attempt !== operation.current) return;
      setState("error");
      setMessage("We could not confirm this was saved. Check My saved items or try again.");
    } finally {
      if (attempt === operation.current) saving.current = false;
    }
  }

  return <div className="mt-3 border-t border-outline/10 pt-3">
    <button type="button" onClick={() => void save()} disabled={state === "saving" || state === "saved"}
      aria-label={state === "saved" ? `Saved ${label}: ${item.title}` : state === "error" ? `Retry saving ${label}: ${item.title}` : `Save ${label}: ${item.title}`}
      className="min-h-11 w-full rounded-xl border border-outline/20 bg-overlay/[0.04] px-3 py-2 text-sm font-semibold text-link transition hover:border-sky-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:cursor-not-allowed disabled:opacity-65">
      {state === "saving" ? "Saving…" : state === "saved" ? `✓ Saved ${label}` : state === "error" ? "Retry saving" : `Save ${label}`}
    </button>
    {message && <p role={state === "error" ? "alert" : "status"} className={`mt-2 text-xs leading-5 ${state === "error" ? "text-danger" : "text-success"}`}>{message}</p>}
    {(state === "saved" || state === "error") && <Link href="/account" className="mt-1 inline-block text-xs font-semibold text-link underline underline-offset-4">My saved items →</Link>}
  </div>;
}
