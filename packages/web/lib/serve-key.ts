/**
 * HTTP adapter for `GET /v1/keys/{key-ULID}` and `GET /v1/keys?key_id=<logical id>`
 * — spec §9.2 requires both wire forms and requires them to return an IDENTICAL
 * document. One response builder, used by both routes, is what makes that true by
 * construction rather than by review; a test asserts the two bodies are byte-identical.
 *
 * Everything this surface *decides* — how a reference is canonicalized, what counts as
 * a valid one, whether a stored document may be served, and what each error says — lives
 * in `@agenid/api`'s serve-key module, which the Fastify registry in that same package
 * also calls. This file only turns a result into a `Response`.
 *
 * It is a public, read-only discovery route. It resolves nothing about an agent, reports
 * no level, and consults no trust presentation — a key existing says nothing about
 * whether any agent has been checked by anyone.
 */
import { fetchKeyDocument, fetchKeyDocumentByQuery } from "@/lib/api";
import { KEY_RESPONSE_HEADERS, KEY_ALLOWED_METHODS } from "@agenid/api";

/** Matches the resolver's conventions: cross-origin readable, never cached. A cached
 *  copy of a key document is a cached copy of a revocation that has not happened yet.
 *  Defined once in @agenid/api so both registries send the same headers. */
const HEADERS: Record<string, string> = { ...KEY_RESPONSE_HEADERS };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** Preflight and response must agree on the origin header — a previous route in this
 *  repo answered OPTIONS with it and then sent responses without it. */
export function keyPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": HEADERS["access-control-allow-origin"] as string,
      "access-control-allow-methods": KEY_ALLOWED_METHODS,
      "access-control-max-age": "86400",
    },
  });
}

/**
 * An unsupported method on a resource that exists is 405, and RFC 9110 requires `Allow`
 * on it. Next's default 405 carries no `Allow`, no CORS header — so a browser verifier
 * saw an opaque network failure instead of "wrong method" — and a `public` cache
 * directive that contradicted this route's own `no-store` policy. Same builder, so the
 * three can no longer disagree.
 */
export function keyMethodNotAllowed(): Response {
  return new Response(
    JSON.stringify({ error: "method_not_allowed", message: "key discovery is read-only: use GET or OPTIONS" }),
    { status: 405, headers: { ...HEADERS, allow: KEY_ALLOWED_METHODS } },
  );
}

function respond(r: Awaited<ReturnType<typeof fetchKeyDocument>>): Response {
  if (r.document) return json(200, r.document);
  return json(r.status, { error: r.error, message: r.message, ...(r.key_id ? { key_id: r.key_id } : {}) });
}

/** `GET /v1/keys/{key-ULID}` — the path segment, already decoded by Next.js. */
export async function serveKeyPath(segment: string): Promise<Response> {
  return respond(await fetchKeyDocument(segment, "path"));
}

/** `GET /v1/keys?key_id=…` — every value supplied for that parameter. Passing them all
 *  is what lets a repeated parameter be refused rather than silently first-won. */
export async function serveKeyQuery(values: readonly string[]): Promise<Response> {
  return respond(await fetchKeyDocumentByQuery(values));
}
