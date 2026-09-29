import { NextResponse } from "next/server";
import { OWNER_TRAFFIC_RANGES, ownerTrafficDateWindow, type OwnerTrafficRange } from "../../../lib/owner-traffic";
import { authorizeTrafficOwner, getOwnerTraffic, OwnerTrafficError } from "../../../lib/server-traffic";

export const runtime = "nodejs";

const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };

export async function GET(request: Request) {
  try {
    await authorizeTrafficOwner(request.headers.get("authorization"));
    const params = new URL(request.url).searchParams;
    const range = params.get("range") ?? "7d";
    const dates = range === "custom" ? { from: params.get("from") || "", to: params.get("to") || "" } : undefined;
    if (["range", "from", "to"].some(key => params.getAll(key).length > 1) || !OWNER_TRAFFIC_RANGES.includes(range as OwnerTrafficRange)
      || (range !== "custom" && (params.has("from") || params.has("to"))) || (dates && !ownerTrafficDateWindow(dates))) {
      return NextResponse.json({ code: "invalid_range", error: "Choose a reporting period or valid UK dates, up to 31 days inclusive, ending no later than today." }, { status: 400, headers });
    }
    return NextResponse.json(await getOwnerTraffic(range as OwnerTrafficRange, dates), { headers });
  } catch (error) {
    if (error instanceof OwnerTrafficError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: error.status, headers });
    }
    return NextResponse.json({ code: "unavailable", error: "Website traffic is temporarily unavailable. Please try again shortly." }, { status: 503, headers });
  }
}
