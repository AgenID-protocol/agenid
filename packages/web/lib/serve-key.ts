/**
 * `GET /v1/keys/{key-ULID}` and `GET /v1/keys?key_id=<percent-encoded logical id>`
 * — spec §9.2 requires both wire forms and requires them to return an IDENTICAL
 * document. One response builder, used by both routes, is what makes that true by
 * construction rather than by review; a test asserts the two bodies are byte-identical.
 *
 * This is a public, read-only discovery route. It resolves a key document that is
 * already in the store and returns it verbatim. It does not verify anything, does
 * not report a level, does not consult trust presentation, and never touches an
 * agent record — a key existing says nothing about whether any agent is verified.
 */
import { fetchKeyDocument } from "@/lib/api";

/** Matches the resolver's conventions: cross-origin readable, never cached. A cached
 *  copy of a key document is a cached copy of a revocation that has not happened yet. */
const HEADERS: Record<string, string> = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

/** Preflight and response must agree on the origin header — a previous route in this
 *  repo answered OPTIONS with it and then sent responses without it. */
export function keyPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export async function serveKeyReference(ref: string | null): Promise<Response> {
  if (ref === null || ref === "") {
    return json(400, {
      error: "invalid_key_id",
      message: "key_id query parameter required (percent-encoded logical form), or use /v1/keys/<key-ULID>",
    });
  }
  const r = await fetchKeyDocument(ref);
  if (!r.document) {
    return json(r.status, { error: r.error, message: r.message, ...(r.key_id ? { key_id: r.key_id } : {}) });
  }
  return json(200, r.document);
}
