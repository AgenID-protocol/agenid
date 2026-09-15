/**
 * Canonical key-discovery logic for `GET /v1/keys` (spec §0.A, §9.2).
 *
 * THIS IS THE ONLY IMPLEMENTATION. Both registries in this repository — the Fastify app
 * in this package and the Next.js routes in `packages/web` — are thin adapters over it.
 * Before this module existed they were two semantic implementations of one protocol
 * surface: `packages/web` re-validated the stored document against the strict schema,
 * checked it against the identifier it was indexed under, and returned fixed error text,
 * while the Fastify route did none of those and reflected the caller's own input back in
 * its 400. A registry's answer to "what key is this" must not depend on which HTTP
 * framework is in front of it.
 *
 * The rule this follows is the one `lib/register.ts` established for registration: a
 * route shapes a request and a response; it does not decide what an operation means.
 *
 * ---------------------------------------------------------------------------
 * SUPERSEDED: "ONE DECODE, NOT TWO"
 * ---------------------------------------------------------------------------
 * The section below described the rule as it was first written, and it was WRONG about
 * the thing it depended on. It assumed the value reaching this module had been decoded
 * exactly once by the transport layer. On Vercel it had been decoded twice, so a
 * twice-encoded key ULID resolved 200 in production while the same code returned 400
 * under a local `next start`. The security decision is now taken on the RAW REQUEST
 * TARGET, before any framework normalization can change what it means — see
 * `raw-key-target.ts`, which records what was measured rather than assumed, and
 * `resolveKeyFromRawPath` / `resolveKeyFromRawQuery` at the bottom of this file, which
 * are the only entry points an HTTP adapter may use.
 *
 * The reasoning below is kept because the conclusion it reaches about ALIASES is still
 * the right one; only its premise about decode counts was unsound.
 *
 * ---------------------------------------------------------------------------
 * A key reference arrives here ALREADY DECODED by the transport layer — Next.js decodes
 * a dynamic path segment, `URLSearchParams` decodes a query value, and find-my-way
 * decodes a Fastify path parameter. `parseKeyReference` in `@agenid/core` also calls
 * `decodeURIComponent`, because its contract is to accept a raw reference from a library
 * caller. Handing it an already-decoded value therefore decoded it a SECOND time, and a
 * second decode accepts spellings the specification never defined:
 *
 *     /v1/keys/agenid%253Akey%253A<ULID>   ->  %25 -> % -> ':'  ->  resolved 200
 *
 * §0.A defines exactly two representations, and neither is "whatever survives being
 * decoded twice". So a reference that still contains a percent sign AFTER the transport
 * layer has decoded it was encoded twice by its sender, and is refused here before
 * `parseKeyReference` ever sees it. That also makes the core call's own decode provably
 * a no-op (`decodeURIComponent` of a string containing no '%' returns it unchanged),
 * which is why this module can still delegate the actual translation to core rather than
 * hand-rolling it. Nothing in `@agenid/core` changed; its contract for raw input is
 * still correct for the callers it was written for.
 *
 * This is NOT "reject every percent sign". Legitimate percent-encoding is exactly what
 * the transport layer removes: `?key_id=agenid%3Akey%3A<ULID>` — the normative query
 * form — arrives here as `agenid:key:<ULID>` and resolves, and a client that
 * percent-encodes unreserved ULID characters on the path is likewise decoded before we
 * see it.
 *
 * ---------------------------------------------------------------------------
 * POSITION IS PART OF THE FORM
 * ---------------------------------------------------------------------------
 * §0.A assigns each representation a position: the WIRE form (a bare key-ULID) is what
 * appears in an HTTP path, and the LOGICAL form (`agenid:key:<ULID>`) is what appears in
 * the `key_id` query parameter. A reference is validated against the form its position
 * defines, so one key has one spelling per position rather than a family of aliases.
 */
import { KeyDocument, isValidUlid, isValidKeyId, parseKeyReference } from "@agenid/core";
import type { RegistryStore } from "./store.js";
import { rawKeyPathSegment, rawKeyQueryValues } from "./raw-key-target.js";

/** Where the reference was read from. §0.A gives each position exactly one form. */
export type KeyReferencePosition = "path" | "query";

/**
 * Fixed public error text. Nothing the caller sends is ever interpolated into any of
 * these: `InvalidKeyIdError` quotes the reference into its message, which is right for a
 * library caller and wrong on an unauthenticated public HTTP surface.
 */
export const KEY_ERROR_MESSAGES = {
  missing_key_id:
    "key_id query parameter required (percent-encoded logical form agenid:key:<key-ULID>), or use /v1/keys/<key-ULID>",
  duplicate_key_id:
    "key_id must appear exactly once: a repeated parameter is ambiguous, and this registry refuses it rather than guessing which one was meant",
  fragment:
    "key reference must not contain a URI fragment ('#'): fragments are not sent to servers and cannot be resolved (spec §0.A)",
  double_encoded:
    "key reference is percent-encoded more than once: the transport layer decodes it exactly once, and spec §0.A defines only the bare key-ULID and the logical form agenid:key:<key-ULID>",
  path_not_literal:
    "the path segment must be the literal wire form of a key identifier: a bare key-ULID, carrying no percent-encoding (spec §0.A, §9.2). A percent-escape in this position is not a second spelling of a key — it is a different request target whose decoded form only resembles one",
  malformed_escape:
    "key reference contains a malformed percent-escape and is not a key identifier in any spelling defined by spec §0.A",
  target_disagreement:
    "this registry could not establish one unambiguous request target for the key reference and refused rather than guess which reading was meant",
  bad_wire_form:
    "the path segment must be the wire form of a key identifier: a bare key-ULID (spec §0.A, §9.2)",
  bad_logical_form:
    "key_id must be the logical form agenid:key:<key-ULID> (spec §0.A, §9.2)",
  key_not_found: "no key document is published under this identifier",
  registry_unavailable: "the key registry could not be reached; this key's status is unknown, not disproven",
  key_document_invalid: "the stored key document did not validate and was not served",
} as const;

/** Transport conventions shared by every key response. A cached key document is a cached
 *  copy of a revocation that has not happened yet, so this surface is never cached. */
export const KEY_RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "cache-control": "no-store",
});

/** The only methods this surface supports. Used for the preflight AND for `Allow`. */
export const KEY_ALLOWED_METHODS = "GET, OPTIONS";

export type KeyReferenceResult =
  | { ok: true; key_id: string }
  | { ok: false; error: "invalid_key_id"; message: string };

/**
 * Validate an already-transport-decoded key reference and translate it to the logical
 * form. Order matters: a fragment is reported as a fragment even when it arrived
 * percent-encoded once, because that is the failure §0.A names explicitly.
 */
export function canonicalKeyReference(
  ref: string | null | undefined,
  position: KeyReferencePosition,
): KeyReferenceResult {
  const invalid = (message: string): KeyReferenceResult => ({ ok: false, error: "invalid_key_id", message });

  if (typeof ref !== "string" || ref.length === 0) {
    return invalid(position === "query" ? KEY_ERROR_MESSAGES.missing_key_id : KEY_ERROR_MESSAGES.bad_wire_form);
  }
  // §0.A: a '#' is never transmitted, so a reference carrying one is unresolvable by
  // construction. MUST 400, never truncate.
  if (ref.includes("#")) return invalid(KEY_ERROR_MESSAGES.fragment);
  // A '%' surviving the transport decode means the sender encoded twice. See the header.
  if (ref.includes("%")) return invalid(KEY_ERROR_MESSAGES.double_encoded);

  if (position === "path") {
    if (!isValidUlid(ref)) return invalid(KEY_ERROR_MESSAGES.bad_wire_form);
  } else if (!isValidKeyId(ref)) {
    return invalid(KEY_ERROR_MESSAGES.bad_logical_form);
  }

  // Delegate the translation itself to core. Its decodeURIComponent is provably a no-op
  // here (no '%' remains), so this cannot decode a second time; it stays the single
  // sanctioned translator, and no prefix is stripped or added by hand anywhere.
  try {
    return { ok: true, key_id: parseKeyReference(ref) };
  } catch {
    return invalid(position === "path" ? KEY_ERROR_MESSAGES.bad_wire_form : KEY_ERROR_MESSAGES.bad_logical_form);
  }
}

export type KeyResolution =
  | { status: 200; document: KeyDocument; error?: undefined; message?: undefined; key_id?: undefined }
  | { status: 400 | 404 | 503; document: null; error: string; message: string; key_id?: string };

/** The minimum a registry must expose to answer a key-discovery request. */
export type KeyReader = Pick<RegistryStore, "getKey">;

/**
 * Resolve a key reference to the document that should be served, or to the error that
 * should be returned. Read-only: it verifies nothing, reports no verification level,
 * writes nothing, and never reads an agent record. A key existing says nothing about
 * whether any agent is verified.
 */
export async function resolveKeyDocument(
  reader: KeyReader,
  ref: string | null | undefined,
  position: KeyReferencePosition,
): Promise<KeyResolution> {
  const parsedRef = canonicalKeyReference(ref, position);
  if (!parsedRef.ok) {
    return { status: 400, document: null, error: parsedRef.error, message: parsedRef.message };
  }
  const keyId = parsedRef.key_id;

  let raw: unknown;
  try {
    raw = await reader.getKey(keyId);
  } catch (e) {
    // The registry itself failed. 503, not 500: this key's status is unknown, not
    // disproven, and an uncaught throw in a route handler is an opaque crash for every
    // caller, registered or not.
    console.error("key lookup failed", { keyId, error: e instanceof Error ? e.message : e });
    return {
      status: 503,
      document: null,
      error: "registry_unavailable",
      message: KEY_ERROR_MESSAGES.registry_unavailable,
    };
  }

  // A missing KEY is not a missing AGENT. Neither absence implies the other.
  if (raw === null || raw === undefined) {
    return {
      status: 404,
      document: null,
      error: "key_not_found",
      message: KEY_ERROR_MESSAGES.key_not_found,
      key_id: keyId,
    };
  }

  // Re-validate before serving. KeyDocument is .strict(), so this is the mechanism that
  // makes it impossible for a column, an internal field, or any future addition to the
  // stored row to reach a public response: an unknown member fails the parse rather than
  // being quietly passed through or stripped.
  const parsed = KeyDocument.safeParse(raw);
  if (!parsed.success) {
    console.error("stored key document failed schema validation", { keyId });
    return {
      status: 503,
      document: null,
      error: "key_document_invalid",
      message: KEY_ERROR_MESSAGES.key_document_invalid,
    };
  }
  // A document indexed under an identifier it does not itself claim is what a key
  // substitution looks like. Refuse rather than serve it under the wrong URL.
  if (parsed.data.key_id !== keyId) {
    console.error("stored key document key_id disagrees with its index", { keyId, documentKeyId: parsed.data.key_id });
    return {
      status: 503,
      document: null,
      error: "key_document_invalid",
      message: KEY_ERROR_MESSAGES.key_document_invalid,
    };
  }

  return { status: 200, document: parsed.data };
}

/**
 * Resolve the collection form, `GET /v1/keys?key_id=…`, from every value the request
 * supplied for that parameter — under the one-occurrence rule.
 *
 * Duplicate parameters are ambiguous: intermediaries disagree about whether the first,
 * the last, or a joined value wins, and §9.2 requires this form to return *the identical
 * document*, which an ambiguous request cannot guarantee. Picking one silently is how a
 * verifier and a proxy end up disagreeing about which key was asked for. Identical
 * duplicates are refused too — nothing in the specification makes a repeated parameter
 * meaningful, and accepting them would make the rule depend on comparing caller input.
 */
export async function resolveKeyFromQuery(
  reader: KeyReader,
  values: readonly string[],
): Promise<KeyResolution> {
  if (values.length > 1) {
    return {
      status: 400,
      document: null,
      error: "invalid_key_id",
      message: KEY_ERROR_MESSAGES.duplicate_key_id,
    };
  }
  return resolveKeyDocument(reader, values[0], "query");
}

// ---------------------------------------------------------------------------
// RAW-REQUEST-TARGET ENTRY POINTS — what every HTTP adapter must call.
// ---------------------------------------------------------------------------
// The two functions above take an already-extracted reference and are kept for direct
// library callers and for tests that want to drive the decision layer alone. No HTTP
// adapter should use them: a framework-supplied path parameter has been decoded an
// unknown number of times, and building the security decision on it is what let a
// twice-encoded identifier resolve in production. See raw-key-target.ts.

const invalidTarget = (message: string): KeyResolution => ({
  status: 400,
  document: null,
  error: "invalid_key_id",
  message,
});

/**
 * `GET /v1/keys/<key-ULID>`, decided from the raw request target.
 *
 * `frameworkSegment` is the path parameter the framework derived from that same target.
 * It is not trusted — it is a TRIPWIRE. Once the raw segment is known to carry no
 * percent-escape, any framework's decode of it is the identity function, so the two MUST
 * be the same string. If they ever differ, something between the wire and this handler
 * has rewritten the request in a way this validator does not model, and the correct
 * answer is to refuse rather than to pick one of two readings. Pass `undefined` where no
 * framework parameter exists.
 */
export async function resolveKeyFromRawPath(
  reader: KeyReader,
  rawUrl: string,
  frameworkSegment?: string,
): Promise<KeyResolution> {
  const raw = rawKeyPathSegment(rawUrl);
  if (!raw.ok) return invalidTarget(raw.message);
  if (frameworkSegment !== undefined && frameworkSegment !== raw.value) {
    console.error("raw path segment and framework parameter disagree", {
      rawLength: raw.value.length,
      frameworkLength: frameworkSegment.length,
    });
    return invalidTarget(KEY_ERROR_MESSAGES.target_disagreement);
  }
  return resolveKeyDocument(reader, raw.value, "path");
}

/** `GET /v1/keys?key_id=<percent-encoded logical id>`, decided from the raw request
 *  target — including the one-occurrence rule, which needs every value the query carried. */
export async function resolveKeyFromRawQuery(reader: KeyReader, rawUrl: string): Promise<KeyResolution> {
  const raw = rawKeyQueryValues(rawUrl);
  if (!raw.ok) return invalidTarget(raw.message);
  return resolveKeyFromQuery(reader, raw.value);
}
