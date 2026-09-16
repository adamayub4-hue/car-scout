import { NextResponse } from "next/server";
import { UpstreamTimeoutError, withUpstreamTimeout } from "../../lib/server-upstream";
import { readSmallJson, RequestBodyTooLargeError } from "../../lib/server-request";

const endpoint =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
const motEndpoint = "https://history.mot.api.gov.uk/v1/trade/vehicles/registration";

const lookupWindowMs = 60_000;
const lookupLimit = 8;
const maxLookupBuckets = 2_000;
// Best-effort per-instance throttling. Production-wide limits belong at the
// trusted edge or in a server-authorized atomic quota store.
const lookupBuckets = new Map<string, { count: number; resetAt: number }>();
let motToken: { value: string; expiresAt: number } | null = null;
let pendingMotToken: Promise<string | null> | null = null;

function cleanRegistration(value: unknown) {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
    : "";
}

function normaliseModel(make: unknown, model: unknown) {
  if (typeof model !== "string") return undefined;
  const cleanedModel = model.trim();
  if (!cleanedModel) return undefined;
  if (/^(UNKNOWN|NOT RECORDED|NOT STATED|N\/?A)$/i.test(cleanedModel)) {
    return undefined;
  }

  // DVSA sometimes returns Mercedes passenger-car classes as a single letter.
  // Expand only this well-defined format; never guess an unknown model.
  if (
    typeof make === "string" &&
    make.toUpperCase().startsWith("MERCEDES") &&
    /^[A-Z]$/i.test(cleanedModel)
  ) {
    return `${cleanedModel.toUpperCase()}-Class`;
  }

  return cleanedModel;
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
  ).trim().slice(0, 64);
}

function rateLimit(request: Request) {
  const now = Date.now();
  for (const [key, bucket] of lookupBuckets) {
    if (bucket.resetAt <= now) lookupBuckets.delete(key);
  }
  const key = clientAddress(request);
  const current = lookupBuckets.get(key);

  if (!current || current.resetAt <= now) {
    if (lookupBuckets.size >= maxLookupBuckets) {
      lookupBuckets.delete(lookupBuckets.keys().next().value!);
    }
    lookupBuckets.set(key, { count: 1, resetAt: now + lookupWindowMs });
    return null;
  }

  if (current.count >= lookupLimit) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  }

  current.count += 1;
  return null;
}

async function requestMotAccessToken() {
  const clientId = process.env.DVSA_MOT_CLIENT_ID;
  const clientSecret = process.env.DVSA_MOT_CLIENT_SECRET;
  const tokenUrl = process.env.DVSA_MOT_TOKEN_URL;
  const scope = process.env.DVSA_MOT_SCOPE;

  if (!clientId || !clientSecret || !tokenUrl || !scope) return null;
  if (motToken && motToken.expiresAt > Date.now() + 60_000) return motToken.value;

  const payload = await withUpstreamTimeout(async (signal) => {
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
      signal,
    });

    if (!response.ok) return null;
    return await response.json();
  }, 3_000);
  if (typeof payload?.access_token !== "string" || !payload.access_token) return null;

  motToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in) || 1_200) * 1_000,
  };
  return motToken.value;
}

function getMotAccessToken() {
  if (!pendingMotToken) {
    pendingMotToken = requestMotAccessToken().finally(() => { pendingMotToken = null; });
  }
  return pendingMotToken;
}

async function getMotVehicle(registrationNumber: string) {
  const apiKey = process.env.DVSA_MOT_API_KEY;
  if (!apiKey) return null;

  const token = await getMotAccessToken();
  if (!token) return null;

  return withUpstreamTimeout(async (signal) => {
    const response = await fetch(`${motEndpoint}/${encodeURIComponent(registrationNumber)}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-API-Key": apiKey,
      },
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) motToken = null;
      return null;
    }
    return response.json();
  }, 3_000);
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

  let body: { registrationNumber?: unknown } | null;
  try {
    body = await readSmallJson(request) as { registrationNumber?: unknown } | null;
  } catch (error) {
    return json({ error: error instanceof RequestBodyTooLargeError
      ? "The registration request is too large." : "The registration request could not be read." },
      error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
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
    const { response, payload } = await withUpstreamTimeout(async (signal) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ registrationNumber }),
        cache: "no-store",
        signal,
      });
      const payload = await response.json().catch(() => null);
      return { response, payload };
    });

    if (!response.ok) {
      return json(
        { error: response.status === 400 || response.status === 404
          ? "We could not identify that vehicle. Check the registration or use Make & model."
          : "The vehicle lookup service is temporarily unavailable." },
        response.status === 400 || response.status === 404
          ? response.status
          : 502,
      );
    }
    if (!payload || typeof payload.make !== "string") {
      return json({ error: "The vehicle lookup service returned incomplete data. Please use Make & model." }, 502);
    }

    // VES deliberately omits the model. The DVSA MOT History API supplies it,
    // so enrich the response when those separately-issued credentials exist.
    const motVehicle = await getMotVehicle(registrationNumber).catch(() => null);

    return json({
      vehicle: {
        registrationNumber: payload.registrationNumber,
        make: motVehicle?.make || payload.make,
        model: normaliseModel(motVehicle?.make || payload.make, motVehicle?.model),
        yearOfManufacture: payload.yearOfManufacture,
        engineCapacity: payload.engineCapacity,
        fuelType: payload.fuelType,
        colour: payload.colour,
        motStatus: payload.motStatus,
        taxStatus: payload.taxStatus,
      },
    });
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) {
      return json({ error: "The vehicle lookup took too long. Please try again or use Make & model." }, 504);
    }
    return json(
      { error: "The vehicle lookup service is temporarily unavailable." },
      502,
    );
  }
}
