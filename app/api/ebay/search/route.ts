import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type CachedToken = {
  value: string;
  expiresAt: number;
};

type EbayItemSummary = {
  itemId?: string;
  title?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  price?: { value?: string; currency?: string };
  condition?: string;
  itemLocation?: { postalCode?: string; country?: string };
};

let cachedToken: CachedToken | null = null;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function getApplicationToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("EBAY_NOT_CONFIGURED");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
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
  });

  if (!response.ok) {
    throw new Error(`EBAY_TOKEN_${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) throw new Error("EBAY_TOKEN_MISSING");

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 7_200) * 1_000,
  };
  return cachedToken.value;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const type = request.nextUrl.searchParams.get("type") === "cars" ? "cars" : "parts";
  if (query.length < 2 || query.length > 160) {
    return json({ error: "Enter a search between 2 and 160 characters." }, 400);
  }

  try {
    const token = await getApplicationToken();
    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "12");
    // eBay UK: Cars (9801) and Vehicle Parts & Accessories (6030).
    url.searchParams.set("category_ids", type === "cars" ? "9801" : "6030");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        "Accept-Language": "en-GB",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const requestId = response.headers.get("x-ebay-c-request-id");
      console.error("eBay Browse search failed", response.status, requestId);
      return json({ error: "eBay search is temporarily unavailable." }, 502);
    }

    const payload = (await response.json()) as { itemSummaries?: EbayItemSummary[] };
    const items = (payload.itemSummaries ?? [])
      .filter((item) => item.title && item.itemWebUrl)
      .map((item) => ({
        id: item.itemId ?? item.itemWebUrl,
        title: item.title,
        url: item.itemWebUrl,
        image: item.image?.imageUrl ?? null,
        price: item.price?.value ?? null,
        currency: item.price?.currency ?? null,
        condition: item.condition ?? null,
        location: item.itemLocation?.postalCode ?? item.itemLocation?.country ?? null,
      }));

    return json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "EBAY_NOT_CONFIGURED") {
      return json({ error: "Live eBay search is not configured yet." }, 503);
    }
    console.error("eBay integration error", message);
    return json({ error: "eBay search is temporarily unavailable." }, 502);
  }
}
