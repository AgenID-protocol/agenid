/**
 * The public agent directory: opt-in, operator-signed, and nothing more.
 *
 * WHAT IT IS. A list of registered agents whose operators asked to be listed. Registration
 * alone never lists an agent — resolution by identifier stays the default, and an operator
 * who registers and does nothing else is never enumerated anywhere.
 *
 * WHY THE CONSENT IS SIGNED. "List this agent" is a statement about the agent, so it must
 * come from whoever controls the agent's operator key — the same key that signed its
 * ManifestProof. A consent is therefore a small signed object, verified here exactly the
 * way the registry verifies everything else: RFC 8785 canonical bytes of the payload
 * without its `signature`, pure Ed25519, against the operator KeyDocument this registry
 * already holds for that agent. Anyone could otherwise list, or delist, someone else's
 * agent by POSTing its identifier.
 *
 * WHAT IT IS NOT. A registry-level feature of this reference deployment, not a protocol
 * object: spec v1.1.1 defines no directory, and a listing asserts nothing about the agent.
 * The directory displays each agent's level through lib/trust-presentation.ts, reading it
 * from the resolution envelope; being listed never changes a level and is not an
 * endorsement, a ranking or a verification.
 *
 * REPLAY. A consent is accepted only within CONSENT_WINDOW_MS of the registry's clock, and
 * only if it is strictly newer than the last consent stored for that agent. So a captured
 * "listed: true" cannot be replayed after the operator delists, and a stale one cannot
 * be replayed at all.
 */
import { b64uDecode, isValidAgentId, KEY_ID_REGEX, signingInputOf, verifyBytes } from "@agenid/core";
import type { RegistryStore } from "@agenid/api";
import { getStore } from "@/lib/api";

export const DIRECTORY_CONSENT_TYPE = "agenid.directory.consent.v1";
export const CONSENT_WINDOW_MS = 5 * 60 * 1000;
/** A page of the directory. Bounded so the page and the API cannot be made to do unbounded work. */
export const DIRECTORY_PAGE_MAX = 200;

export interface DirectoryConsentPayload {
  type: typeof DIRECTORY_CONSENT_TYPE;
  agent_id: string;
  key_id: string;
  listed: boolean;
  created_at: string;
}
export type DirectoryConsent = DirectoryConsentPayload & { signature: string };

export interface DirectoryRecord {
  agent_id: string;
  listed: boolean;
  consent: DirectoryConsent;
  consent_created_at: string;
  updated_at: string;
}

export interface DirectoryStore {
  get(agentId: string): Promise<DirectoryRecord | null>;
  put(record: DirectoryRecord): Promise<void>;
  /** Listed agents, most recently listed first. */
  listListed(limit: number): Promise<DirectoryRecord[]>;
}

export class MemoryDirectoryStore implements DirectoryStore {
  private rows = new Map<string, DirectoryRecord>();
  async get(agentId: string) {
    return this.rows.get(agentId) ?? null;
  }
  async put(record: DirectoryRecord) {
    this.rows.set(record.agent_id, structuredClone(record));
  }
  async listListed(limit: number) {
    return [...this.rows.values()]
      .filter((r) => r.listed)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, limit);
  }
}

/** Postgres renders timestamptz with an offset; the protocol spells UTC with `Z`. */
const toZ = (t: string) => new Date(t).toISOString();

export function supabaseDirectoryStoreFromEnv(): DirectoryStore | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  // Imported lazily so the memory path (tests, local dev) never constructs a client.
  let clientPromise: Promise<import("@supabase/supabase-js").SupabaseClient> | null = null;
  const client = () => (clientPromise ??= import("@/lib/supabase").then((m) => m.getSupabaseServiceClient()));
  const COLS = "agent_id, listed, consent, consent_created_at, updated_at";
  const row = (r: Record<string, unknown>): DirectoryRecord => ({
    agent_id: r.agent_id as string,
    listed: r.listed as boolean,
    consent: r.consent as DirectoryConsent,
    consent_created_at: toZ(r.consent_created_at as string),
    updated_at: toZ(r.updated_at as string),
  });
  return {
    async get(agentId) {
      const { data, error } = await (await client()).from("directory_listings").select(COLS).eq("agent_id", agentId).maybeSingle();
      if (error) throw new Error(`directory read failed: ${error.message}`);
      return data ? row(data) : null;
    },
    async put(record) {
      const { error } = await (await client()).from("directory_listings").upsert({
        agent_id: record.agent_id,
        listed: record.listed,
        consent: record.consent,
        consent_created_at: record.consent_created_at,
        updated_at: record.updated_at,
      });
      if (error) throw new Error(`directory write failed: ${error.message}`);
    },
    async listListed(limit) {
      const { data, error } = await (await client())
        .from("directory_listings")
        .select(COLS)
        .eq("listed", true)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`directory read failed: ${error.message}`);
      return (data ?? []).map(row);
    },
  };
}

let cached: DirectoryStore | null = null;
export function getDirectoryStore(): DirectoryStore {
  if (!cached) cached = supabaseDirectoryStoreFromEnv() ?? new MemoryDirectoryStore();
  return cached;
}
/** Test seam. */
export function __setDirectoryStore(s: DirectoryStore | null): void {
  cached = s;
}

export type ConsentResult =
  | { ok: true; record: DirectoryRecord }
  | { ok: false; status: number; error: string; message: string };

const fail = (status: number, error: string, message: string): ConsentResult => ({ ok: false, status, error, message });

const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;
const B64U = /^[A-Za-z0-9_-]+$/;
const MEMBERS = ["type", "agent_id", "key_id", "listed", "created_at", "signature"] as const;

/** Strict shape check. Unknown members are refused, like every other signed object here. */
export function parseConsent(body: unknown): DirectoryConsent | string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return "body must be a JSON object";
  const o = body as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!(MEMBERS as readonly string[]).includes(k)) return `unknown member: ${k.slice(0, 40)}`;
  if (o.type !== DIRECTORY_CONSENT_TYPE) return `type must be "${DIRECTORY_CONSENT_TYPE}"`;
  if (typeof o.agent_id !== "string" || !isValidAgentId(o.agent_id)) return "agent_id must be agenid:<ULID>";
  if (typeof o.key_id !== "string" || !KEY_ID_REGEX.test(o.key_id)) return "key_id must be agenid:key:<ULID>";
  if (typeof o.listed !== "boolean") return "listed must be a boolean";
  if (typeof o.created_at !== "string" || !RFC3339_UTC.test(o.created_at) || Number.isNaN(Date.parse(o.created_at)))
    return "created_at must be an RFC 3339 UTC timestamp";
  if (typeof o.signature !== "string" || !B64U.test(o.signature) || o.signature.length > 200) return "signature must be base64url";
  return o as unknown as DirectoryConsent;
}

/**
 * Verify an operator's directory consent and record it. The single implementation: the
 * route shapes the request and response, this decides what a consent means.
 */
export async function applyDirectoryConsent(
  body: unknown,
  opts: { now?: Date; store?: RegistryStore; directory?: DirectoryStore } = {},
): Promise<ConsentResult> {
  const consent = parseConsent(body);
  if (typeof consent === "string") return fail(400, "invalid_consent", consent);

  const now = opts.now ?? new Date();
  const store = opts.store ?? getStore();
  const directory = opts.directory ?? getDirectoryStore();

  const skew = Math.abs(now.getTime() - Date.parse(consent.created_at));
  if (skew > CONSENT_WINDOW_MS) {
    return fail(400, "consent_expired", "created_at must be within five minutes of the registry clock; sign a fresh consent");
  }

  let agent;
  let key;
  try {
    agent = await store.getAgent(consent.agent_id);
    key = agent ? await store.getKey(consent.key_id) : null;
  } catch {
    return fail(503, "registry_unavailable", "the registry could not be read; nothing was changed");
  }
  if (!agent) return fail(404, "agent_not_found", "no agent is registered under this identifier");
  if (agent.status !== "ACTIVE") return fail(409, "agent_not_active", "only an ACTIVE agent can be listed");

  // The consent must be signed by THIS agent's operator key: the key its ManifestProof names.
  if (agent.proof.key_id !== consent.key_id) {
    return fail(403, "key_not_operator", "key_id is not the operator key that signed this agent's manifest proof");
  }
  if (!key || key.role !== "operator" || key.controller !== consent.agent_id) {
    return fail(403, "key_not_operator", "key_id does not resolve to this agent's operator key");
  }
  if (key.status !== "active") return fail(403, "key_not_active", "the operator key is not active");

  let valid = false;
  try {
    valid = verifyBytes(
      b64uDecode(key.public_key_b64u),
      signingInputOf(consent as unknown as Record<string, unknown>),
      b64uDecode(consent.signature),
    );
  } catch {
    valid = false;
  }
  if (!valid) return fail(403, "signature_invalid", "the signature does not verify against the operator key");

  let previous: DirectoryRecord | null;
  try {
    previous = await directory.get(consent.agent_id);
  } catch {
    return fail(503, "registry_unavailable", "the directory could not be read; nothing was changed");
  }
  if (previous && Date.parse(consent.created_at) <= Date.parse(previous.consent_created_at)) {
    return fail(409, "consent_superseded", "a newer consent is already recorded for this agent");
  }

  const record: DirectoryRecord = {
    agent_id: consent.agent_id,
    listed: consent.listed,
    consent,
    consent_created_at: new Date(consent.created_at).toISOString(),
    updated_at: now.toISOString(),
  };
  try {
    await directory.put(record);
  } catch {
    return fail(503, "registry_unavailable", "the directory could not be written; nothing was changed");
  }
  return { ok: true, record };
}

export const DIRECTORY_DISCLOSURES = [
  "A listing is the operator's own request, signed with the agent's operator key. It is not an endorsement, a ranking or a verification.",
  "Being listed changes no verification level. Each agent's level is read from its resolution envelope.",
  "An operator can remove the listing at any time by signing a consent with listed: false.",
] as const;
