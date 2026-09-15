import { serveKeyQuery, keyPreflight, keyMethodNotAllowed } from "@/lib/serve-key";

export const dynamic = "force-dynamic";

/**
 * Spec §9.2 — `GET /v1/keys?key_id={percent-encoded logical id}`. Resolves identically
 * to the path form; both delegate to the same builder.
 *
 * The raw request target is passed down rather than `URLSearchParams`, for the same
 * reason the path route passes `req.url`: the decode count becomes a property of this
 * registry instead of of whichever parser the framework happens to use. It is also what
 * carries EVERY value supplied for `key_id` — a repeated parameter is ambiguous,
 * intermediaries disagree about whether the first, the last or a joined value wins, and
 * §9.2 requires this form to return *the identical document*, which an ambiguous request
 * cannot promise. So it is refused rather than silently first-won.
 *
 * Measured against production before this change: the query string is NOT normalized
 * upstream (`?key_id=agenid%253Akey%253A<ULID>` already returned 400), so this half was
 * already correct; it is moved onto the raw target so that both halves are decided the
 * same way and neither depends on a platform behaviour that could change.
 */
export async function GET(req: Request) {
  return serveKeyQuery(req.url);
}

export function OPTIONS() {
  return keyPreflight();
}

// Read-only surface. Exported explicitly so the 405 carries `Allow`, the CORS header and
// `no-store`, instead of Next's bare default. No mutation reaches any handler.
export const POST = keyMethodNotAllowed;
export const PUT = keyMethodNotAllowed;
export const PATCH = keyMethodNotAllowed;
export const DELETE = keyMethodNotAllowed;
