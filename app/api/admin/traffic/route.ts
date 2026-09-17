import { NextResponse } from "next/server";
import { OWNER_TRAFFIC_RANGES, type OwnerTrafficRange } from "../../../lib/owner-traffic";
import { authorizeTrafficOwner, getOwnerTraffic, OwnerTrafficError } from "../../../lib/server-traffic";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

export async function GET(request: Request) {
  try {
    await authorizeTrafficOwner(request.headers.get("authorization"));
    const params = new URL(request.url).searchParams;
    const range = params.get("range") ?? "7d";
    if (params.getAll("range").length > 1 || !OWNER_TRAFFIC_RANGES.includes(range as OwnerTrafficRange)) {
      return NextResponse.json({ code: "invalid_range", error: "Choose the last 24 hours, 7 days or 30 days." }, { status: 400, headers });
    }
    return NextResponse.json(await getOwnerTraffic(range as OwnerTrafficRange), { headers });
  } catch (error) {
    if (error instanceof OwnerTrafficError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ code: "unavailable", error: "Website traffic is temporarily unavailable. Please try again shortly." }, { status: 503, headers });
  }
}
