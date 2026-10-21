import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { observePasswordRecovery, passwordRecoveryCallbackIdentity } from "./account-recovery";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    const recoveryCallback = passwordRecoveryCallbackIdentity();
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    observePasswordRecovery(client.auth, recoveryCallback);
  }
  return client;
}
