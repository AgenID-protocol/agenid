import { serveKeyPath, keyPreflight, keyMethodNotAllowed } from "@/lib/serve-key";

export const dynamic = "force-dynamic";

/** Spec §9.2 — `GET /v1/keys/{key-ULID}`, the canonical resolver path and the target of
 *  every resolution envelope's `operator_key.discovery.registry_path`. The segment is the
 *  WIRE form (a bare ULID) and is validated as such: Next.js has already decoded it once,
 *  so a reference still carrying a percent sign was encoded twice by its sender and is
 *  refused rather than decoded again (§0.A defines two forms, not a family of aliases).
 *  A URI fragment is refused in both its raw and `%23` spellings. */
export async function GET(_req: Request, ctx: { params: Promise<{ key_ulid: string }> }) {
  const { key_ulid } = await ctx.params;
  return serveKeyPath(key_ulid);
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
