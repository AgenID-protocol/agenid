/**
 * Server-side registry access for the resolver (`/a/<agenid>` and `/api/resolve/<agenid>`).
 * Never imported by client components.
 *
 * Three resolution modes, checked in this order:
 *   1. AGENID_API_URL set        -> fetch the registry over HTTP (a separately-run
 *      @agenid/api instance — this is how `pnpm --filter @agenid/web dev` and the
 *      e2e harness work, and remains available for anyone who deploys the API as its
 *      own service).
 *   2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set -> resolve in-process against a
 *      durable SupabaseStore. This is what production (Vercel) uses: there is no
 *      separate always-on registry server there, so the read path (a pure function
 *      of (store, now), unchanged from packages/api/src/app.ts) is called directly
 *      instead of over a network hop to a server that doesn't exist in that deployment.
 *   3. Neither set                -> an empty in-process MemoryStore. Every lookup
 *      resolves as "not registered" — safe for local builds/tests, not durable.
 *
 * Whichever mode is active, this module NEVER lets a failure escape as an uncaught
 * exception. That used to be the actual production bug: a bare `fetch()` to a
 * registry URL that doesn't exist in this deployment throws, and an uncaught throw
 * inside a Next.js route handler surfaces to the caller as an opaque HTTP 500 — for
 * *any* agenid, registered or not. The only responses this module can produce now are
 * 400 (malformed id), 404 (not registered), 200 (resolved), or 503 (store/network
 * itself failed) — all clean JSON-shaped, never a crash.
 */
import {
  buildEnvelope,
  MemoryStore,
  supabaseStoreFromEnv,
  resolveKeyDocument,
  resolveKeyFromQuery,
  resolveKeyFromRawPath,
  resolveKeyFromRawQuery,
  type KeyReader,
  type KeyReferencePosition,
  type KeyResolution,
  type RegistryStore,
  type ResolutionEnvelope,
} from "@agenid/api";
import { isValidAgentId, keyResolverPath, type KeyDocument } from "@agenid/core";

export const API_URL = process.env.AGENID_API_URL?.replace(/\/$/, "");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.agenid.com").replace(/\/$/, "");

export type Envelope = ResolutionEnvelope;

let cachedStore: RegistryStore | null = null;
/** Lazily constructed once per warm serverless instance / process. Only used when AGENID_API_URL is unset. */
export function getStore(): RegistryStore {
  if (!cachedStore) cachedStore = supabaseStoreFromEnv() ?? new MemoryStore();
  return cachedStore;
}

/**
 * Full precision, deliberately. buildEnvelope re-verifies the operator proof against this
 * instant, and truncating to whole seconds moves it BACKWARD by up to 999ms — so an agent
 * resolved in the same second it was registered would have its own fresh proof judged
 * "not yet valid", and the envelope would report proof_check.ok === false. badge.js and
 * the SVG badge both render that as a red PROOF INVALID, so a brand-new agent's badge
 * would briefly accuse its owner of a broken signature. Rfc3339Utc permits fractional
 * seconds; there was never a reason to strip them.
 */
function nowIso(): string {
  return new Date().toISOString();
}

async function fetchEnvelopeOverHttp(agentId: string): Promise<{ status: number; envelope: Envelope | null; error?: string }> {
  try {
    const r = await fetch(`${API_URL}/v1/agents/${agentId}`, { cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) {
      let error = "registry_error";
      try { error = (await r.json()).error ?? error; } catch { /* ignore */ }
      return { status: r.status, envelope: null, error };
    }
    return { status: 200, envelope: (await r.json()) as Envelope };
  } catch (e) {
    console.error("registry fetch failed", { agentId, apiUrl: API_URL, error: e instanceof Error ? e.message : e });
    return { status: 503, envelope: null, error: "registry_unavailable" };
  }
}

async function fetchEnvelopeInProcess(agentId: string): Promise<{ status: number; envelope: Envelope | null; error?: string }> {
  try {
    const store = getStore();
    const rec = await store.getAgent(agentId);
    if (!rec) return { status: 404, envelope: null, error: "agent_not_found" };
    const envelope = await buildEnvelope(store, rec, nowIso());
    return { status: 200, envelope };
  } catch (e) {
    // Registry itself failed (e.g. Supabase unreachable) — 503, not 500: the resolver
    // is temporarily unavailable and this identity's status is unknown, which is
    // exactly what the caller should see instead of an opaque crash.
    console.error("registry lookup failed", { agentId, error: e instanceof Error ? e.message : e });
    return { status: 503, envelope: null, error: "registry_unavailable" };
  }
}

export async function fetchEnvelope(agentId: string): Promise<{ status: number; envelope: Envelope | null; error?: string }> {
  if (!isValidAgentId(agentId)) return { status: 400, envelope: null, error: "invalid_agent_id" };
  return API_URL ? fetchEnvelopeOverHttp(agentId) : fetchEnvelopeInProcess(agentId);
}

// ---------------------------------------------------------------------------
// Key discovery — the registry half of two-path key discovery (spec §9.2).
// ---------------------------------------------------------------------------
/**
 * There is exactly ONE implementation of key discovery in this repository, and it is
 * `resolveKeyDocument` in `@agenid/api` (serve-key.ts): reference canonicalization, the
 * store lookup, the strict `KeyDocument` re-parse, the index/document consistency check,
 * and every public error string live there and nowhere else. The Fastify registry in
 * that same package calls it too.
 *
 * This module supplies the *reader* and decides nothing. That split is what makes the
 * two registries answer identically by construction rather than by review — they used to
 * diverge, and only this one re-validated what it served.
 *
 * Logical vs wire form remains a protocol distinction, not a bug to normalize away
 * (§0.A, §9.2): `agenid:key:<ULID>` is what `KeyDocument.key_id` carries and what
 * `store.getKey()` is keyed on; the bare `<ULID>` is the path segment the resolution
 * envelope's `operator_key.discovery.registry_path` points at. `keyResolverPath` and
 * `parseKeyReference` from `@agenid/core` are the only translations used; nothing here
 * strips or adds a prefix by hand.
 */
export type KeyLookup = KeyResolution;

/**
 * HTTP-registry mode: wrap a separately-deployed `@agenid/api` instance in a `KeyReader`
 * so the SAME resolution code runs against it. A remote 404 is an absent key; any other
 * non-OK status or a network failure is a registry failure, which must surface as 503
 * ("status unknown") rather than being mistaken for "no such key". The body is returned
 * unvalidated on purpose — `resolveKeyDocument` re-parses it strictly, so a remote
 * registry cannot talk this one into serving a document it would have refused.
 */
function httpKeyReader(): KeyReader {
  return {
    async getKey(keyId: string): Promise<KeyDocument | null> {
      const r = await fetch(`${API_URL}${keyResolverPath(keyId)}`, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`registry responded ${r.status}`);
      return (await r.json()) as KeyDocument;
    },
  };
}

/** Same three resolution modes as `fetchEnvelope`: HTTP registry when `AGENID_API_URL`
 *  is set, otherwise the in-process store (Supabase in production, MemoryStore locally). */
function keyReader(): KeyReader {
  return API_URL ? httpKeyReader() : getStore();
}

/**
 * `GET /v1/keys/{key-ULID}`, decided from the RAW request target.
 *
 * `frameworkSegment` is Next's own dynamic path parameter, passed only as a tripwire —
 * it is never what the decision is built on. Building it on that parameter is precisely
 * what let `/v1/keys/<ULID encoded twice>` resolve 200 in production while the identical
 * code returned 400 under `next start`.
 */
export async function fetchKeyDocumentByRawPath(rawUrl: string, frameworkSegment?: string): Promise<KeyLookup> {
  return resolveKeyFromRawPath(keyReader(), rawUrl, frameworkSegment);
}

/** `GET /v1/keys?key_id=…`, decided from the raw request target — which is also what
 *  carries every value supplied for that parameter, so a repeated one can be refused as
 *  ambiguous instead of silently resolving whichever the parser happened to keep. */
export async function fetchKeyDocumentByRawQuery(rawUrl: string): Promise<KeyLookup> {
  return resolveKeyFromRawQuery(keyReader(), rawUrl);
}

/** Direct access to the decision layer, for callers that already hold an extracted
 *  reference (the DNS/.well-known comparison path). NOT for HTTP adapters. */
export async function fetchKeyDocument(ref: string | null, position: KeyReferencePosition): Promise<KeyLookup> {
  return resolveKeyDocument(keyReader(), ref, position);
}

/** As above, for an already-extracted list of query values. NOT for HTTP adapters. */
export async function fetchKeyDocumentByQuery(values: readonly string[]): Promise<KeyLookup> {
  return resolveKeyFromQuery(keyReader(), values);
}
