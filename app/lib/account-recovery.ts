import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

const RECOVERY_KEY = "mekivo:password-recovery:v1";
export const RECOVERY_WINDOW_MS = 15 * 60 * 1_000;
type Identity = { userId: string; sessionId: string };
type RecoveryGrant = Identity & { expiresAt: number };
export type RecoveryTarget = Identity & { email: string };
let memoryGrant: RecoveryGrant | null = null;

function tokenIdentity(token: string): Identity | null {
  try {
    const payload = token.split(".")[1];
    const claims = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof claims.sub !== "string" || !claims.sub || typeof claims.session_id !== "string" || !/^[a-f0-9-]{36}$/i.test(claims.session_id)) return null;
    // UI binding only. Supabase verifies the credential before accepting a
    // recovery link or updating the password; decoded claims are not authority.
    return { userId: claims.sub, sessionId: claims.session_id };
  } catch { return null; }
}

function sessionIdentity(session: Session | null): Identity | null {
  const identity = session?.access_token ? tokenIdentity(session.access_token) : null;
  return identity?.userId === session?.user.id ? identity : null;
}

export function clearPasswordRecovery() {
  memoryGrant = null;
  try { window.sessionStorage.removeItem(RECOVERY_KEY); } catch { /* Storage may be blocked. */ }
}

export function passwordRecoveryGrant(now = Date.now()): RecoveryGrant | null {
  try {
    const stored = window.sessionStorage.getItem(RECOVERY_KEY);
    if (stored) memoryGrant = JSON.parse(stored);
  } catch { /* The memory grant still supports this page if storage is blocked. */ }
  const grant = memoryGrant;
  if (!grant || typeof grant.userId !== "string" || typeof grant.sessionId !== "string" || !Number.isSafeInteger(grant.expiresAt)
    || grant.expiresAt <= now || grant.expiresAt > now + RECOVERY_WINDOW_MS) {
    clearPasswordRecovery(); return null;
  }
  return grant;
}

function rememberRecovery(session: Session | null) {
  const identity = sessionIdentity(session);
  if (!identity) { clearPasswordRecovery(); return; }
  memoryGrant = { ...identity, expiresAt: Date.now() + RECOVERY_WINDOW_MS };
  // Per-tab identifiers/expiry only: no passwords, email, URLs or tokens.
  try { window.sessionStorage.setItem(RECOVERY_KEY, JSON.stringify(memoryGrant)); } catch { /* Reload requires a new link when storage is blocked. */ }
}

export function passwordRecoveryTarget(session: Session | null): RecoveryTarget | null {
  const grant = passwordRecoveryGrant(), identity = sessionIdentity(session);
  if (!grant || !identity || grant.userId !== identity.userId || grant.sessionId !== identity.sessionId) return null;
  return { ...identity, email: session?.user.email || "your account" };
}

/** Attach at singleton creation: another component may consume the URL and emit
 * PASSWORD_RECOVERY before the reset page subscribes. A short per-tab marker
 * preserves that genuine intent through component ordering and page reloads.
 */
export function observePasswordRecovery(auth: Pick<SupabaseClient["auth"], "onAuthStateChange">, localCallback: Identity | null) {
  let expected = localCallback;
  auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      const identity = sessionIdentity(session);
      // Supabase broadcasts this event to other tabs too. Only this document's
      // actual callback may create an intent, and only for its exact identity.
      if (expected && identity?.userId === expected.userId && identity.sessionId === expected.sessionId) {
        expected = null; rememberRecovery(session);
      } else if (passwordRecoveryGrant() && !passwordRecoveryTarget(session)) clearPasswordRecovery();
      return;
    }
    if (event === "SIGNED_OUT") { clearPasswordRecovery(); return; }
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      if (passwordRecoveryGrant() && !passwordRecoveryTarget(session)) clearPasswordRecovery();
    }
  });
}

/** Read callback shape only; never preserve or echo secret URL values. */
export function invalidPasswordRecoveryLink(href: string) {
  try {
    const url = new URL(href), query = url.searchParams, hash = new URLSearchParams(url.hash.slice(1));
    if ([query, hash].some(params => ["error", "error_code", "error_description"].some(key => params.has(key)))) return true;
    if (query.has("code") || query.has("token_hash") || query.has("token")) return true;
    if (["access_token", "refresh_token", "type"].some(key => hash.has(key))) {
      return hash.get("type") !== "recovery" || ["access_token", "refresh_token", "expires_in", "token_type"].some(key => !hash.get(key));
    }
    return false;
  } catch { return true; }
}

/** Call before creating the client, which will consume and clear the fragment. */
export function passwordRecoveryCallbackIdentity(): Identity | null {
  try {
    if (invalidPasswordRecoveryLink(window.location.href)) return null;
    const params = new URLSearchParams(new URL(window.location.href).hash.slice(1));
    return params.get("type") === "recovery" ? tokenIdentity(params.get("access_token") || "") : null;
  } catch { return null; }
}

/** Bind the actual update to the chosen recovery credential. The shared client
 * can switch identities during updateUser's asynchronous session lookup. This
 * isolated client neither persists/broadcasts a login nor signs anything out.
 */
export async function updateRecoveryPassword(session: Session, password: string) {
  const target = passwordRecoveryTarget(session);
  if (!target) throw new Error("Recovery session changed. Request a new recovery link.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Password recovery is temporarily unavailable.");
  const isolated = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const confirmed = await isolated.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  if (confirmed.error) throw confirmed.error;
  const current = passwordRecoveryTarget(confirmed.data.session);
  if (!current || current.userId !== target.userId || current.sessionId !== target.sessionId || confirmed.data.user?.id !== target.userId) {
    throw new Error("Recovery session changed. Request a new recovery link.");
  }
  const result = await isolated.auth.updateUser({ password });
  if (result.error) throw result.error;
  if (result.data.user?.id !== target.userId) throw new Error("The password update could not be confirmed.");
  return result.data.user;
}
