/**
 * Deterministic Manifest construction from a Retell agent record.
 *
 * DESIGN RULE (the reason this file exists): a Manifest asserts things about an
 * agent's real-world behavior. Three of those things — whether it is AI, whether
 * it discloses that to the user, and whether it offers human escalation — are NOT
 * discoverable from the Retell API. They are operator attestations.
 *
 * We therefore REQUIRE them as explicit inputs rather than defaulting them. A
 * default here would be a fabricated claim carried under an Ed25519 signature,
 * which is precisely the failure mode AgenID exists to prevent (spec §3, §10).
 */
import { Manifest, generateAgentId } from "@agenid/core";

/** The subset of a Retell `list-agents` record this module relies on. */
export interface RetellAgentRecord {
  agent_id?: unknown;
  agent_name?: unknown;
  response_engine?: unknown;
}

/** Operator attestations that cannot be derived from any API and must be stated. */
export interface OperatorAttestations {
  /** Operator legal/display name, e.g. "AI Venture Holdings LLC". */
  operator: string;
  /** Hostname the operator controls, e.g. "aiventureholdings.com". */
  operatorDomain: string;
  /** Does this agent disclose to the user that it is AI? (EU AI Act Art. 50) */
  disclosesToUser: boolean;
  /** Can a user reach a human from this agent? */
  humanEscalation: boolean;
  /** What the agent is for, in the operator's words. */
  purposeSummary: string;
  contact?: string;
  description?: string;
}

export interface BuildManifestResult {
  agentId: string;
  manifest: Manifest;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

/**
 * Build a protocol-valid Manifest for one Retell agent.
 * `agentId` may be supplied to re-declare an existing identity; otherwise a new
 * `agenid:<ULID>` is minted. Throws (via zod) if the result is not spec-valid.
 */
export function buildRetellManifest(
  record: RetellAgentRecord,
  att: OperatorAttestations,
  agentId: string = generateAgentId(),
): BuildManifestResult {
  const name = str(record.agent_name, "Unnamed Retell Agent");

  const candidate = {
    manifest_version: "1.0" as const,
    agent_id: agentId,
    identity: {
      name,
      ...(att.description ? { description: att.description } : {}),
    },
    ownership: {
      operator: att.operator,
      operator_domain: att.operatorDomain,
      ...(att.contact ? { contact: att.contact } : {}),
    },
    purpose: {
      summary: att.purposeSummary,
      // Retell is a voice platform; an agent may also be reachable by SMS, but we
      // do not assert a channel we have not been told about.
      channels: ["voice" as const],
    },
    disclosure: {
      is_ai: true, // definitionally true: it is a Retell AI agent
      discloses_to_user: att.disclosesToUser,
      human_escalation: att.humanEscalation,
    },
  };

  // Parse rather than cast — an invalid manifest must fail here, not at signing.
  const manifest = Manifest.parse(candidate);
  return { agentId, manifest };
}

/** Normalize Retell's list-agents response, which has shipped as both shapes. */
export function normalizeRetellList(payload: unknown): RetellAgentRecord[] {
  if (Array.isArray(payload)) return payload as RetellAgentRecord[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["agents", "data", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as RetellAgentRecord[];
    }
  }
  return [];
}
