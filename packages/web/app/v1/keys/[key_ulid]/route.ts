import { serveKeyPath, keyPreflight, keyMethodNotAllowed } from "@/lib/serve-key";

export const dynamic = "force-dynamic";

/**
 * Spec §9.2 — `GET /v1/keys/{key-ULID}`, the canonical resolver path and the target of
 * every resolution envelope's `operator_key.discovery.registry_path`.
 *
 * THE REFERENCE IS TAKEN FROM `req.url`, NOT FROM `ctx.params`.
 *
 * `ctx.params.key_ulid` is the segment after Next has decoded it, and the number of
 * decodes applied before that point is a property of the deployment platform. On Vercel
 * it was two, so `/v1/keys/<ULID encoded twice>` resolved 200 in production while this
 * same code returned 400 under a local `next start` — an alias resolving on the surface
 * whose entire job is that one key has one spelling. The parameter is still passed down,
 * but only as a tripwire: once the raw segment is known to carry no percent-escape, any
 * framework's decode of it is the identity function, so the two must be identical.
 * See `packages/api/src/raw-key-target.ts` for what was measured rather than assumed.
 */
export async function GET(req: Request, ctx: { params: Promise<{ key_ulid: string }> }) {
  // The tripwire is advisory, so a route must never turn its ABSENCE into a failure:
  // Next derives the parameter by percent-decoding the raw segment once, and that throws
  // on a malformed escape — while the raw-target rule can decide such a target perfectly
  // well without any parameter at all.
  //
  // (The function name is deliberately not written here: `keys-route.test.ts` forbids it
  // appearing anywhere in these files, and rewording prose is the right way past a guard.
  // Weakening the guard to fit the comment would be the wrong one.)
  //
  // MEASURED, NOT ASSUMED — and this guard is not sufficient on its own: on Next 16 the
  // throw happens inside the framework BEFORE this handler is invoked, so `/v1/keys/%ZZ`
  // and `/v1/keys/%` still produce an opaque 500 under a self-hosted `next start`. That
  // is a framework-boundary defect of the same class as the Fastify one fixed in this
  // round, it cannot be fixed inside a route handler, and it is tracked as R-6 rather
  // than fixed here. It does not reach production: Vercel's edge answers those targets
  // with its own plain `400 Bad Request` before Next sees them — verified directly by
  // sending the raw target, since curl will not transmit it.
  let frameworkSegment: string | undefined;
  try {
    frameworkSegment = (await ctx.params).key_ulid;
  } catch {
    frameworkSegment = undefined;
  }
  return serveKeyPath(req.url, frameworkSegment);
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
