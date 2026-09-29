import { withUpstreamTimeout } from "./server-upstream";

type CachedToken = { value: string; expiresAt: number };
let cachedToken: CachedToken | null = null;
let pendingToken: Promise<string> | null = null;

export function clearEbayApplicationToken() { cachedToken = null; }

async function requestApplicationToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("EBAY_NOT_CONFIGURED");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const payload = await withUpstreamTimeout(async (signal) => {
    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "https://api.ebay.com/oauth/api_scope",
      }),
      cache: "no-store",
      signal,
    });

    if (!response.ok) throw new Error(`EBAY_TOKEN_${response.status}`);
    return await response.json() as { access_token?: string; expires_in?: number };
  });

  if (typeof payload?.access_token !== "string" || !payload.access_token) throw new Error("EBAY_TOKEN_MISSING");

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 7_200) * 1_000,
  };
  return cachedToken.value;
}

export function getApplicationToken() {
  if (!pendingToken) {
    pendingToken = requestApplicationToken().finally(() => { pendingToken = null; });
  }
  return pendingToken;
}
