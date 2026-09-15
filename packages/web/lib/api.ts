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
import { buildEnvelope, MemoryStore, supabaseStoreFromEnv, type RegistryStore, type ResolutionEnvelope } from "@agenid/api";
import { isValidAgentId, parseKeyReference, keyIdToWire, KeyDocument } from "@agenid/core";

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
 * Logical vs wire form is a protocol distinction, not a bug to normalize away
 * (spec §0.A, §9.2). A key's logical identifier is `agenid:key:<ULID>` — that is
 * what `KeyDocument.key_id` carries, what `keys.key_id` stores, and what
 * `store.getKey()` is keyed on. Its wire form is the bare `<ULID>`, which is the
 * path segment in `GET /v1/keys/{key-ULID}` and therefore what the resolution
 * envelope's `operator_key.discovery.registry_path` points at. `parseKeyReference`
 * is the only sanctioned translation between them: it accepts either form, rejects
 * a URI fragment in both raw and percent-encoded spelling, and returns the logical
 * form. Nothing here strips or adds a prefix by hand.
 *
 * Same three resolution modes and the same never-throw discipline as fetchEnvelope
 * above: this is a public read path, and an uncaught throw in a Next route handler
 * surfaces as an opaque 500 for every caller, registered or not.
 */
export type KeyLookup =
  | { status: 200; document: KeyDocument; error?: undefined; message?: undefined; key_id?: undefined }
  | { status: 400 | 404 | 503; document: null; error: string; message: string; key_id?: string };

async function fetchKeyOverHttp(keyId: string): Promise<{ status: number; raw: unknown | null; error?: string }> {
  try {
    const r = await fetch(`${API_URL}/v1/keys/${keyIdToWire(keyId)}`, { cache: "no-store", headers: { accept: "application/json" } });
    if (!r.ok) {
      let error = "registry_error";
      try { error = (await r.json()).error ?? error; } catch { /* ignore */ }
      return { status: r.status, raw: null, error };
    }
    return { status: 200, raw: await r.json() };
  } catch (e) {
    console.error("key fetch failed", { keyId, apiUrl: API_URL, error: e instanceof Error ? e.message : e });
    return { status: 503, raw: null, error: "registry_unavailable" };
  }
}

async function fetchKeyInProcess(keyId: string): Promise<{ status: number; raw: unknown | null; error?: string }> {
  try {
    const doc = await getStore().getKey(keyId);
    if (!doc) return { status: 404, raw: null, error: "key_not_found" };
    return { status: 200, raw: doc };
  } catch (e) {
    console.error("key lookup failed", { keyId, error: e instanceof Error ? e.message : e });
    return { status: 503, raw: null, error: "registry_unavailable" };
  }
}

export async function fetchKeyDocument(ref: string): Promise<KeyLookup> {
  let keyId: string;
  try {
    keyId = parseKeyReference(ref);
  } catch {
    // Never reflect the caller's raw input back in a public response body. core's
    // InvalidKeyIdError interpolates the reference into its message, which is useful
    // to a library caller and wrong on an unauthenticated HTTP surface, so the two
    // failure reasons are re-derived here from fixed text.
    const fragment = ref.includes("#") || /%23/i.test(ref);
    return {
      status: 400,
      document: null,
      error: "invalid_key_id",
      message: fragment
        ? "key reference must not contain a URI fragment ('#'): fragments are not sent to servers and cannot be resolved (spec §0.A)"
        : "key reference must be a bare key-ULID (the wire form) or the logical form agenid:key:<ULID>",
    };
  }

  const found = API_URL ? await fetchKeyOverHttp(keyId) : await fetchKeyInProcess(keyId);
  if (found.raw === null) {
    const status = (found.status === 400 || found.status === 404 || found.status === 503 ? found.status : 503) as 400 | 404 | 503;
    const error = found.error ?? "registry_unavailable";
    const message =
      error === "key_not_found"
        ? "no key document is published under this identifier"
        : "the key registry could not be reached; this key's status is unknown, not disproven";
    // A missing KEY is not a missing AGENT. Callers distinguish them by code.
    return { status, document: null, error, message, ...(error === "key_not_found" ? { key_id: keyId } : {}) };
  }

  // Re-validate before serving. KeyDocument is .strict(), so this is also the
  // mechanism that makes it impossible for a column, an internal field, or any
  // future addition to the stored row to reach a public response: an unknown
  // member fails the parse rather than being quietly passed through or stripped.
  const parsed = KeyDocument.safeParse(found.raw);
  if (!parsed.success) {
    console.error("stored key document failed schema validation", { keyId });
    return { status: 503, document: null, error: "key_document_invalid", message: "the stored key document did not validate and was not served" };
  }
  if (parsed.data.key_id !== keyId) {
    console.error("stored key document key_id disagrees with its index", { keyId, documentKeyId: parsed.data.key_id });
    return { status: 503, document: null, error: "key_document_invalid", message: "the stored key document did not validate and was not served" };
  }
  return { status: 200, document: parsed.data };
}
