import { NextResponse, type NextRequest } from "next/server";

/**
 * Content negotiation for the universal resolver (spec §13/§14):
 *   GET /a/<agenid>  Accept: application/json  → the raw resolution envelope
 *   GET /a/<agenid>  (browser)                  → the Verification Card UI
 * Same identity, two representations, one URL.
 */
export function proxy(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  const wantsJson = /\bapplication\/json\b/.test(accept) && !/\btext\/html\b/.test(accept);
  if (wantsJson) {
    const id = request.nextUrl.pathname.slice("/a/".length);
    return NextResponse.rewrite(new URL(`/api/resolve/${id}`, request.url));
  }
}

export const config = { matcher: "/a/:path*" };
