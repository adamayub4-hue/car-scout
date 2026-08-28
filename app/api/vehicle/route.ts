import { NextResponse } from "next/server";

const endpoint =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
const motEndpoint = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

const lookupWindowMs = 60_000;
const lookupLimit = 8;
const lookupBuckets = new Map<string, { count: number; resetAt: number }>();
let motToken: { value: string; expiresAt: number } | null = null;

function cleanRegistration(value: unknown) {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
    : "";
}

function json(body: object, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0", ...headers },
  });
}

function clientAddress(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown"
  ).trim();
}

function rateLimit(request: Request) {
  const now = Date.now();
  const key = clientAddress(request);
  const current = lookupBuckets.get(key);

  if (!current || current.resetAt <= now) {
    lookupBuckets.set(key, { count: 1, resetAt: now + lookupWindowMs });
    return null;
  }

  if (current.count >= lookupLimit) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  }

  current.count += 1;
  return null;
}

async function getMotAccessToken() {
  const clientId = process.env.DVSA_MOT_CLIENT_ID;
  const clientSecret = process.env.DVSA_MOT_CLIENT_SECRET;
  const tokenUrl = process.env.DVSA_MOT_TOKEN_URL;
  const scope = process.env.DVSA_MOT_SCOPE;

  if (!clientId || !clientSecret || !tokenUrl || !scope) return null;
  if (motToken && motToken.expiresAt > Date.now() + 60_000) return motToken.value;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    console.warn("DVSA MOT token request failed", {
      status: response.status,
      error: typeof payload?.error === "string" ? payload.error : undefined,
    });
    return null;
  }
  const payload = await response.json().catch(() => null);
  if (!payload?.access_token) return null;

  motToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 1_200) * 1_000,
  };
  return motToken.value;
}

async function getMotVehicle(registrationNumber: string) {
  const apiKey = process.env.DVSA_MOT_API_KEY;
  if (!apiKey) return null;

  const token = await getMotAccessToken();
  if (!token) return null;

  const response = await fetch(`${motEndpoint}/${encodeURIComponent(registrationNumber)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.warn("DVSA MOT vehicle request failed", { status: response.status });
    return null;
  }
  return response.json().catch(() => null);
}

export async function POST(request: Request) {
  if (process.env.ENABLE_DVLA_LOOKUP !== "true") {
    return json(
      {
        error:
          "Registration lookup is not available yet. Please use Make & model for now.",
      },
      503,
    );
  }

  const retryAfter = rateLimit(request);
  if (retryAfter !== null) {
    return json(
      { error: "Too many registration checks. Please wait a minute and try again." },
      429,
      { "Retry-After": String(retryAfter) },
    );
  }

  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 1_024) {
    return json({ error: "The registration request is too large." }, 413);
  }

  const body = await request.json().catch(() => null);
  const registrationNumber = cleanRegistration(body?.registrationNumber);

  if (registrationNumber.length < 5) {
    return json({ error: "Enter a valid UK registration." }, 400);
  }

  const apiKey = process.env.DVLA_API_KEY;
  if (!apiKey) {
    return json(
      {
        error:
          "Live registration lookup is not connected yet. Please use Make & model for now.",
      },
      503,
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ registrationNumber }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.errors?.[0]?.detail;
      return json(
        { error: detail || "We could not identify that vehicle." },
        response.status === 400 || response.status === 404
          ? response.status
          : 502,
      );
    }

    // VES deliberately omits the model. The DVSA MOT History API supplies it,
    // so enrich the response when those separately-issued credentials exist.
    const motVehicle = await getMotVehicle(registrationNumber).catch(() => null);

    return json({
      vehicle: {
        registrationNumber: payload.registrationNumber,
        make: motVehicle?.make || payload.make,
        model: motVehicle?.model || undefined,
        yearOfManufacture: payload.yearOfManufacture,
        engineCapacity: payload.engineCapacity,
        fuelType: payload.fuelType,
        colour: payload.colour,
        motStatus: payload.motStatus,
        taxStatus: payload.taxStatus,
      },
    });
  } catch {
    return json(
      { error: "The vehicle lookup service is temporarily unavailable." },
      502,
    );
  }
}
