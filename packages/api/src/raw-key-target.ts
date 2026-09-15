/**
 * Raw-request-target extraction for `GET /v1/keys` (spec §0.A, §9.2).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS MODULE EXISTS
 * ---------------------------------------------------------------------------
 * The previous guard validated the value the framework handed the handler — a Next.js
 * dynamic path parameter, or a `URLSearchParams` value — and assumed that value had been
 * decoded exactly once. That assumption is a property of the deployment platform, not of
 * the protocol, and it was false in production.
 *
 * Measured against `https://www.agenid.com` on 2026-09-15, before this module existed:
 *
 *     /v1/keys/<ULID>                    200   (canonical)
 *     /v1/keys/<ULID encoded once>       200
 *     /v1/keys/<ULID encoded twice>      200   <-- DEFECT: an alias resolved
 *     /v1/keys/<ULID encoded three×>     400
 *
 * while a local `next start` returned 400 for the twice-encoded form. The same
 * application code reached opposite security decisions on two platforms.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS ACTUALLY MEASURED, RATHER THAN ASSUMED
 * ---------------------------------------------------------------------------
 * Vercel applies RFC 3986 path normalization ahead of the Next.js router: it decodes
 * percent-escapes in the request path and re-encodes the characters that are structurally
 * significant in a path (`/`, `#`, and NUL, which its edge refuses outright). Next then
 * decodes the dynamic segment a second time, which is the extra decode.
 *
 * That the second decode belongs to Next — and therefore happens AFTER routing, on the
 * segment as it appears in `req.url` — is not inferred. It is proved by a request the
 * edge cannot have decoded twice:
 *
 *     GET /v1/keys/%252F   ->  reached THIS route's handler
 *
 * If the platform had decoded twice before routing, the path would have become
 * `/v1/keys//` and could not have matched a single dynamic segment at all. It matched,
 * so the value Next routed on still read `%2F`. The raw target this module reads is
 * therefore at most one normalization away from the wire, on every platform.
 *
 * The query string is left alone: `?key_id=agenid%253Akey%253A<ULID>` returns 400 in
 * production today, so no upstream decode is applied there. This module decodes query
 * values itself, exactly once, so that half is platform-independent by construction.
 *
 * ---------------------------------------------------------------------------
 * THE INVARIANT
 * ---------------------------------------------------------------------------
 * §0.A defines two representations and assigns each a position. In a path, the wire form
 * is a bare key-ULID — and a bare key-ULID contains no percent sign. So the rule is
 * stated on the raw target and needs no decode of its own:
 *
 *     THE PATH SEGMENT, AS IT APPEARS IN THE RAW REQUEST TARGET,
 *     MUST BE THE LITERAL WIRE FORM. ANY PERCENT-ESCAPE IS REFUSED.
 *
 * This is decode-count-independent in the only sense that matters: no multiply-encoded
 * spelling resolves on any platform. Locally and in `@agenid/api` the raw target is the
 * wire target, so a singly-encoded segment is refused too. On Vercel a single layer of
 * unreserved-character encoding is removed before any application code runs, and is
 * therefore indistinguishable from the canonical spelling — that is RFC 3986 §2.3
 * equivalence performed by the platform, not an alias this code accepts. Everything
 * beyond one layer still carries a percent sign into the raw target and is refused
 * identically everywhere. The set of resolvable keys is the same on both.
 *
 * The honest residual, stated rather than glossed: on Vercel this application cannot
 * observe whether a client sent `01M2…` or `%30%31…`, because the platform has already
 * collapsed them. It can observe, and does refuse, every spelling that is not RFC-
 * equivalent to the canonical one.
 */
import { KEY_ERROR_MESSAGES } from "./serve-key.js";

export type RawTargetResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** A fragment is never transmitted (RFC 3986 §3.5), so a target carrying one is
 *  unresolvable by construction. §9.2 requires 400, never silent truncation. */
const ENCODED_HASH = /%23/i;

/**
 * Reduce any request-target spelling to origin form (`/path?query`). `Request.url` is an
 * absolute URL; Fastify's `req.raw.url` is already origin-form. Neither is parsed with
 * `URL`, whose own normalization is exactly the layer this module exists to see past.
 */
export function originForm(url: string): string {
  const schemeEnd = url.indexOf("://");
  if (schemeEnd === -1) return url;
  const slash = url.indexOf("/", schemeEnd + 3);
  return slash === -1 ? "/" : url.slice(slash);
}

function splitTarget(url: string): RawTargetResult<{ path: string; query: string }> {
  const target = originForm(url);
  if (target.includes("#")) return { ok: false, message: KEY_ERROR_MESSAGES.fragment };
  const q = target.indexOf("?");
  return {
    ok: true,
    value: { path: q === -1 ? target : target.slice(0, q), query: q === -1 ? "" : target.slice(q + 1) },
  };
}

/**
 * The last path segment of the raw target, refused outright if it carries any
 * percent-escape. A `%23` is reported as the fragment it is, because that is the failure
 * §0.A names explicitly; every other escape is reported as a non-literal wire form.
 */
export function rawKeyPathSegment(url: string): RawTargetResult<string> {
  const split = splitTarget(url);
  if (!split.ok) return split;
  const path = split.value.path;
  const segment = path.slice(path.lastIndexOf("/") + 1);
  if (ENCODED_HASH.test(segment)) return { ok: false, message: KEY_ERROR_MESSAGES.fragment };
  if (segment.includes("%")) return { ok: false, message: KEY_ERROR_MESSAGES.path_not_literal };
  return { ok: true, value: segment };
}

/**
 * The message a `/v1/keys` request target fails with, or `null` if the target itself is
 * well-formed and the failure lies further in.
 *
 * This exists so that a request the ROUTER rejects before any handler runs — Fastify's
 * `FST_ERR_BAD_URL` on `/v1/keys/%`, for instance, raised while find-my-way decodes the
 * path parameter — is answered with the same sentence the handler would have produced.
 * Without it the two registries would still agree on the status and the error code and
 * disagree on the reason, which is the drift this whole surface is trying to end.
 */
export function rawKeyTargetFailure(url: string): string | null {
  const split = splitTarget(url);
  if (!split.ok) return split.message;
  const rest = split.value.path.slice("/v1/keys".length);
  const result = rest === "" || rest === "/" ? rawKeyQueryValues(url) : rawKeyPathSegment(url);
  return result.ok ? null : result.message;
}

/**
 * Every value the raw query supplied for `key_id`, each percent-decoded EXACTLY ONCE.
 *
 * Written against the raw query rather than `URLSearchParams` for two reasons. The decode
 * count becomes a property of this function instead of of whichever parser the framework
 * happens to use, which is the whole point of the module; and `+` is not treated as a
 * space, because `application/x-www-form-urlencoded` is a form convention and a key
 * reference is not a form field — a `+` therefore survives into validation and is
 * refused, rather than silently becoming a character the sender did not write.
 */
export function rawKeyQueryValues(url: string): RawTargetResult<string[]> {
  const split = splitTarget(url);
  if (!split.ok) return split;
  const values: string[] = [];
  for (const pair of split.value.query.split("&")) {
    if (pair.length === 0) continue;
    const eq = pair.indexOf("=");
    const rawName = eq === -1 ? pair : pair.slice(0, eq);
    if (rawName !== "key_id") continue;
    const rawValue = eq === -1 ? "" : pair.slice(eq + 1);
    if (ENCODED_HASH.test(rawValue)) return { ok: false, message: KEY_ERROR_MESSAGES.fragment };
    try {
      values.push(decodeURIComponent(rawValue));
    } catch {
      // A malformed escape (`%`, `%2`, `%ZZ`) is not a key reference in any spelling.
      return { ok: false, message: KEY_ERROR_MESSAGES.malformed_escape };
    }
  }
  return { ok: true, value: values };
}
