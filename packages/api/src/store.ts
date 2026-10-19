/**
 * Storage-independent registry store (spec: storage independence — §16 of the
 * governing prompt). The protocol never depends on PostgreSQL, Prisma, or any
 * particular backend; this interface is the seam. `MemoryStore` is the
 * reference/in-process implementation used by tests and local development.
 * A durable implementation (Postgres/Supabase) plugs in behind the same
 * interface without touching routes.
 */
import type { KeyDocument, Manifest, ManifestProof, Revocation, VerificationAssertion } from "@agenid/core";

/**
 * Agent-level status (spec §12). `REVOKED` is written by an operator-signed revocation
 * (see `revokeAgent` below) and is permanent: a revoked identity stays publicly resolvable
 * and is never reissued. CHANGED/STALE/SUSPENDED transitions are not written yet; the
 * values exist so the envelope shape is stable.
 */
export type AgentStatus = "ACTIVE" | "CHANGED" | "STALE" | "SUSPENDED" | "REVOKED";

export interface AgentRecord {
  agent_id: string;
  manifest: Manifest;
  manifest_digest: string;
  proof: ManifestProof;
  status: AgentStatus;
  registered_at: string;
  updated_at: string;
}

export interface LedgerEvent {
  event_id: string;
  agent_id: string;
  type:
    | "agent.registered"
    | "assertion.issued"
    | "manifest.changed"
    | "agent.status_changed"
    | "key.published"
    | "agent.revoked";
  occurred_at: string;
  /** Hashes/references only — never raw evidence (spec §13 privacy rule). */
  detail_ref: Record<string, string>;
}

export interface RegistryStore {
  getAgent(agentId: string): Promise<AgentRecord | null>;
  putAgent(record: AgentRecord): Promise<void>;
  /** Atomic create: resolves false if the agent_id already exists (spec §2 uniqueness check). */
  createAgent(record: AgentRecord): Promise<boolean>;

  getKey(keyId: string): Promise<KeyDocument | null>;
  putKey(doc: KeyDocument): Promise<void>;

  getAssertion(assertionId: string): Promise<VerificationAssertion | null>;
  putAssertion(a: VerificationAssertion): Promise<void>;
  listAssertionsForSubject(subject: string): Promise<VerificationAssertion[]>;

  appendEvent(e: LedgerEvent): Promise<void>;
  listEvents(agentId: string): Promise<LedgerEvent[]>;

  /**
   * Revoke an agent, atomically: store the operator-signed `Revocation`, set the agent's
   * status to `REVOKED`, and append an `agent.revoked` ledger event — all three or none.
   * A revocation that was stored without the status change (or the reverse) would leave
   * the public record disagreeing with the signed object it depends on.
   *
   * The caller has already verified the revocation; the store only records it.
   * Resolves `already_revoked` without writing anything if the agent is already REVOKED,
   * so a retried request cannot append a second event or replace the first revocation.
   */
  revokeAgent(input: RevokeAgentInput): Promise<"revoked" | "already_revoked" | "not_found">;
  /** The agent-targeted revocation recorded for this agent, if any. */
  getAgentRevocation(agentId: string): Promise<Revocation | null>;
}

export interface RevokeAgentInput {
  agent_id: string;
  revocation: Revocation;
  /** The registry's own clock at the time of recording — `updated_at` and the event time. */
  recorded_at: string;
  event_id: string;
  /** Hashes/references only (spec §13). */
  detail_ref: Record<string, string>;
}

export class MemoryStore implements RegistryStore {
  private agents = new Map<string, AgentRecord>();
  private keys = new Map<string, KeyDocument>();
  private assertions = new Map<string, VerificationAssertion>();
  private events: LedgerEvent[] = [];
  private revocations = new Map<string, Revocation>();

  async getAgent(agentId: string) {
    return this.agents.get(agentId) ?? null;
  }
  async putAgent(record: AgentRecord) {
    this.agents.set(record.agent_id, record);
  }
  async createAgent(record: AgentRecord) {
    if (this.agents.has(record.agent_id)) return false;
    this.agents.set(record.agent_id, record);
    return true;
  }
  async getKey(keyId: string) {
    return this.keys.get(keyId) ?? null;
  }
  async putKey(doc: KeyDocument) {
    this.keys.set(doc.key_id, doc);
  }
  async getAssertion(assertionId: string) {
    return this.assertions.get(assertionId) ?? null;
  }
  async putAssertion(a: VerificationAssertion) {
    this.assertions.set(a.assertion_id, a);
  }
  async listAssertionsForSubject(subject: string) {
    return [...this.assertions.values()].filter((a) => a.subject === subject).sort((a, b) => a.verified_at.localeCompare(b.verified_at));
  }
  async appendEvent(e: LedgerEvent) {
    this.events.push(e); // append-only by construction: no delete/update API exists
  }
  async listEvents(agentId: string) {
    return this.events.filter((e) => e.agent_id === agentId);
  }
  async revokeAgent(input: RevokeAgentInput) {
    const rec = this.agents.get(input.agent_id);
    if (!rec) return "not_found" as const;
    if (rec.status === "REVOKED") return "already_revoked" as const;
    // Single-threaded, so these three writes cannot interleave with another request.
    this.revocations.set(input.agent_id, input.revocation);
    this.agents.set(input.agent_id, { ...rec, status: "REVOKED", updated_at: input.recorded_at });
    this.events.push({
      event_id: input.event_id,
      agent_id: input.agent_id,
      type: "agent.revoked",
      occurred_at: input.recorded_at,
      detail_ref: input.detail_ref,
    });
    return "revoked" as const;
  }
  async getAgentRevocation(agentId: string) {
    return this.revocations.get(agentId) ?? null;
  }
}
