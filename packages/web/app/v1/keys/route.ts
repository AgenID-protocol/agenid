import { serveKeyQuery, keyPreflight, keyMethodNotAllowed } from "@/lib/serve-key";

export const dynamic = "force-dynamic";

/** Spec §9.2 — `GET /v1/keys?key_id={percent-encoded logical id}`. Resolves identically
 *  to the path form; both delegate to the same builder.
 *
 *  `getAll`, not `get`: a repeated `key_id` is ambiguous — intermediaries disagree about
 *  whether the first, the last or a joined value wins — and §9.2 requires this form to
 *  return *the identical document*, which an ambiguous request cannot promise. Every
 *  value is handed down so a duplicate is refused rather than silently first-won. */
export async function GET(req: Request) {
  return serveKeyQuery(new URL(req.url).searchParams.getAll("key_id"));
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
