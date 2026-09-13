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
import { isValidAgentId } from "@agenid/core";

export const API_URL = process.env.AGENID_API_URL?.replace(/\/$/, "");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.agenid.com").replace(/\/$/, "");

export type Envelope = ResolutionEnvelope;

let cachedStore: RegistryStore | null = null;
/** Lazily constructed once per warm serverless instance / process. Only used when AGENID_API_URL is unset. */
function getStore(): RegistryStore {
  if (!cachedStore) cachedStore = supabaseStoreFromEnv() ?? new MemoryStore();
  return cachedStore;
}

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
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
