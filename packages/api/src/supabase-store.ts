/**
 * Durable RegistryStore backed by Supabase Postgres (packages/api/supabase/migrations/0001_registry_store.sql).
 * Implements the exact same storage-independent interface as MemoryStore (store.ts) —
 * the spec never assumes a particular backend; this is one pluggable implementation of it.
 *
 * Writes use the Supabase service role key server-side only. This client must never be
 * constructed with an anon/publishable key, and must never run in a browser context.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KeyDocument, Manifest, ManifestProof, VerificationAssertion } from "@agenid/core";
import type { AgentRecord, LedgerEvent, RegistryStore } from "./store.js";

interface AgentRow {
  agent_id: string;
  manifest: Manifest;
  manifest_digest: string;
  proof: ManifestProof;
  status: AgentRecord["status"];
  registered_at: string;
  updated_at: string;
}
interface KeyRow {
  key_id: string;
  document: KeyDocument;
}
interface AssertionRow {
  assertion_id: string;
  subject: string;
  document: VerificationAssertion;
}
interface EventRow {
  event_id: string;
  agent_id: string;
  type: LedgerEvent["type"];
  occurred_at: string;
  detail_ref: Record<string, string>;
}

function toAgentRecord(row: AgentRow): AgentRecord {
  return {
    agent_id: row.agent_id,
    manifest: row.manifest,
    manifest_digest: row.manifest_digest,
    proof: row.proof,
    status: row.status,
    registered_at: row.registered_at,
    updated_at: row.updated_at,
  };
}

/** Postgres error code for a unique-violation (used by createAgent's atomic-insert check, spec §2). */
const PG_UNIQUE_VIOLATION = "23505";

export class SupabaseStore implements RegistryStore {
  private client: SupabaseClient;

  constructor(opts: { url: string; serviceRoleKey: string }) {
    this.client = createClient(opts.url, opts.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async getAgent(agentId: string): Promise<AgentRecord | null> {
    const { data, error } = await this.client.from("agents").select("*").eq("agent_id", agentId).maybeSingle();
    if (error) throw new Error(`SupabaseStore.getAgent: ${error.message}`);
    return data ? toAgentRecord(data as AgentRow) : null;
  }

  async putAgent(record: AgentRecord): Promise<void> {
    const { error } = await this.client.from("agents").upsert(this.agentRow(record));
    if (error) throw new Error(`SupabaseStore.putAgent: ${error.message}`);
  }

  async createAgent(record: AgentRecord): Promise<boolean> {
    const { error } = await this.client.from("agents").insert(this.agentRow(record));
    if (!error) return true;
    if (error.code === PG_UNIQUE_VIOLATION) return false; // agent_id already exists — spec §2 uniqueness
    throw new Error(`SupabaseStore.createAgent: ${error.message}`);
  }

  private agentRow(record: AgentRecord): AgentRow {
    return {
      agent_id: record.agent_id,
      manifest: record.manifest,
      manifest_digest: record.manifest_digest,
      proof: record.proof,
      status: record.status,
      registered_at: record.registered_at,
      updated_at: record.updated_at,
    };
  }

  async getKey(keyId: string): Promise<KeyDocument | null> {
    const { data, error } = await this.client.from("keys").select("document").eq("key_id", keyId).maybeSingle();
    if (error) throw new Error(`SupabaseStore.getKey: ${error.message}`);
    return data ? (data as KeyRow).document : null;
  }

  async putKey(doc: KeyDocument): Promise<void> {
    const { error } = await this.client.from("keys").upsert({ key_id: doc.key_id, document: doc } satisfies KeyRow);
    if (error) throw new Error(`SupabaseStore.putKey: ${error.message}`);
  }

  async getAssertion(assertionId: string): Promise<VerificationAssertion | null> {
    const { data, error } = await this.client.from("assertions").select("document").eq("assertion_id", assertionId).maybeSingle();
    if (error) throw new Error(`SupabaseStore.getAssertion: ${error.message}`);
    return data ? (data as AssertionRow).document : null;
  }

  async putAssertion(a: VerificationAssertion): Promise<void> {
    const { error } = await this.client
      .from("assertions")
      .upsert({ assertion_id: a.assertion_id, subject: a.subject, level: a.level, key_id: a.key_id, document: a, verified_at: a.verified_at });
    if (error) throw new Error(`SupabaseStore.putAssertion: ${error.message}`);
  }

  async listAssertionsForSubject(subject: string): Promise<VerificationAssertion[]> {
    const { data, error } = await this.client
      .from("assertions")
      .select("document")
      .eq("subject", subject)
      .order("verified_at", { ascending: true });
    if (error) throw new Error(`SupabaseStore.listAssertionsForSubject: ${error.message}`);
    return (data as AssertionRow[] | null)?.map((r) => r.document) ?? [];
  }

  async appendEvent(e: LedgerEvent): Promise<void> {
    const { error } = await this.client.from("events").insert({
      event_id: e.event_id,
      agent_id: e.agent_id,
      type: e.type,
      occurred_at: e.occurred_at,
      detail_ref: e.detail_ref,
    } satisfies EventRow);
    if (error) throw new Error(`SupabaseStore.appendEvent: ${error.message}`);
  }

  async listEvents(agentId: string): Promise<LedgerEvent[]> {
    const { data, error } = await this.client
      .from("events")
      .select("*")
      .eq("agent_id", agentId)
      .order("occurred_at", { ascending: true });
    if (error) throw new Error(`SupabaseStore.listEvents: ${error.message}`);
    return (data as EventRow[] | null) ?? [];
  }
}

/** Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Returns null (not a thrown error) when either is unset,
 * so callers can fall back to MemoryStore for local dev/tests without Supabase configured. */
export function supabaseStoreFromEnv(env: NodeJS.ProcessEnv = process.env): SupabaseStore | null {
  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return new SupabaseStore({ url, serviceRoleKey });
}
