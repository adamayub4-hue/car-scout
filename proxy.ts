import { NextResponse, type NextRequest } from "next/server";
import { legacySearchPath } from "./app/lib/search-routes";

// Keep already-published adverts and private saved/shared links working.
export function proxy(request: NextRequest) {
  const path = legacySearchPath(request.nextUrl.searchParams);
  if (!path) return NextResponse.next();
  const destination = request.nextUrl.clone();
  destination.pathname = path;
  return NextResponse.redirect(destination, 307);
}
export const config = { matcher: "/" };
