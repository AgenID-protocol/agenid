/**
 * The single agent-revocation implementation, shared by the Fastify registry
 * (`POST /v1/agents/:agent_id/revocation`) and the deployed web routes
 * (`packages/web/lib/revoke.ts` is a thin wrapper that supplies the store).
 *
 * WHAT A REVOCATION IS. The operator's signed statement that an agent identity is
 * retired, for good. Spec v1.1.1 §12: `REVOKED` identities are permanent and publicly
 * resolvable — the identifier is never reissued, the record never disappears, and every
 * badge and card renders the revocation instead of a level.
 *
 * WHO MAY REVOKE. Only the key that controls the agent: the operator key its
 * ManifestProof names, with role=operator and controller=agent_id. A registry that could
 * revoke an agent on its own say-so would be the same trust failure as one that could
 * verify an agent on its own say-so, pointed the other way — so the request is a signed
 * object and the registry only checks and records it. AgenID holds no key that can do
 * this, and this file contains no path that revokes without a valid operator signature.
 *
 * THE OBJECT. The v1.2-draft `Revocation` from `@agenid/core` (schema
 * https://agenid.com/schemas/v1.2/revocation.json), with `revokes_type: "agent"`. The
 * v1.2 layer is draft and not normative; this path uses its revocation object because
 * v1.1.1 defines the REVOKED status but no signed object for reaching it, and inventing a
 * second, registry-local shape for the same statement would give verifiers two things to
 * check. The draft label is carried in every response.
 *
 * WHAT IT PROVES. That the holder of the operator key asked for this. It does not prove
 * why, and `reason` is the operator's own claim. It does not prove the key was not
 * stolen — which is exactly the case revocation exists for: a compromised operator key
 * can be used by its rightful owner to kill the identity before the thief uses it.
 *
 * REPLAY. `revoked_at` must be within REVOCATION_WINDOW_MS of the registry clock, so a
 * revocation cannot be pre-signed and held, or back-dated. Replaying a captured one is
 * harmless: the agent is already REVOKED, and the store refuses to record a second.
 */
import {
  Revocation,
  verifyRevocation,
  canonicalize,
  sha256,
  hex,
  generateUlid,
  type Revocation as RevocationType,
} from "@agenid/core";
import type { RegistryStore } from "./store.js";

export const REVOCATION_WINDOW_MS = 5 * 60 * 1000;

export type RevokeResult =
  | { ok: true; agent_id: string; revocation: RevocationType; recorded_at: string }
  | { ok: false; status: number; error: string; message: string; issues?: unknown[] };

const fail = (status: number, error: string, message: string, issues?: unknown[]): RevokeResult => ({
  ok: false,
  status,
  error,
  message,
  ...(issues ? { issues } : {}),
});

/** sha256 over the RFC 8785 bytes of the full signed object — what the ledger points at. */
export function revocationDigestHex(rev: RevocationType): string {
  return hex(sha256(new TextEncoder().encode(canonicalize(rev))));
}

export async function revokeAgentRequest(
  body: unknown,
  store: RegistryStore,
  opts: { now?: Date; agentIdFromPath?: string } = {},
): Promise<RevokeResult> {
  const parsed = Revocation.safeParse(body);
  if (!parsed.success) {
    // Issue paths and messages only — never the submitted values.
    const issues = parsed.error.issues.map((i) => ({ path: i.path, message: i.message }));
    return fail(400, "invalid_revocation", "revocation failed schema validation", issues);
  }
  const rev = parsed.data;

  if (rev.revokes_type !== "agent") {
    return fail(400, "unsupported_revocation_target", "this registry records agent revocations only (revokes_type must be \"agent\")");
  }
  if (opts.agentIdFromPath !== undefined && opts.agentIdFromPath !== rev.revokes) {
    return fail(400, "agent_id_mismatch", "revocation.revokes must equal the agent identifier in the request path");
  }

  const now = opts.now ?? new Date();
  const skew = Math.abs(now.getTime() - Date.parse(rev.revoked_at));
  if (skew > REVOCATION_WINDOW_MS) {
    return fail(400, "revocation_expired", "revoked_at must be within five minutes of the registry clock; sign a fresh revocation");
  }

  let agent;
  let key;
  try {
    agent = await store.getAgent(rev.revokes);
    key = agent ? await store.getKey(rev.key_id) : null;
  } catch {
    return fail(503, "registry_unavailable", "the registry could not be read; nothing was changed");
  }
  if (!agent) return fail(404, "agent_not_found", "no agent is registered under this identifier");
  if (agent.status === "REVOKED") {
    return fail(409, "already_revoked", "this agent is already revoked; revocation is permanent");
  }

  // Standing, before the signature: the key must be THIS agent's operator key.
  if (agent.proof.key_id !== rev.key_id) {
    return fail(403, "key_not_operator", "key_id is not the operator key that signed this agent's manifest proof");
  }
  if (!key || key.role !== "operator" || key.controller !== rev.revokes) {
    return fail(403, "key_not_operator", "key_id does not resolve to this agent's operator key");
  }

  const check = verifyRevocation(rev, key, { now: now.toISOString() });
  if (!check.ok) {
    if (check.code === "signature_invalid") return fail(403, "signature_invalid", "the signature does not verify against the operator key");
    if (check.code === "key_not_active_at_signing_time") return fail(403, "key_not_active", "the operator key was not active at revoked_at");
    return fail(403, check.code, "the revocation does not verify against the operator key");
  }

  const recorded_at = now.toISOString();
  let outcome;
  try {
    outcome = await store.revokeAgent({
      agent_id: rev.revokes,
      revocation: rev,
      recorded_at,
      event_id: `evt_${generateUlid()}`,
      detail_ref: {
        revocation_id: rev.revocation_id,
        revocation_digest: revocationDigestHex(rev),
        reason: rev.reason,
      },
    });
  } catch (e) {
    console.error("revocation failed", { error: e instanceof Error ? e.message : e });
    return fail(503, "registry_unavailable", "the registry could not be written to; nothing was changed");
  }
  if (outcome === "not_found") return fail(404, "agent_not_found", "no agent is registered under this identifier");
  if (outcome === "already_revoked") return fail(409, "already_revoked", "this agent is already revoked; revocation is permanent");

  return { ok: true, agent_id: rev.revokes, revocation: rev, recorded_at };
}

/** Every revocation response carries these, so the surfaces cannot drift apart. */
export const REVOCATION_DISCLOSURES = [
  "Revocation is permanent. The identifier stays resolvable, renders REVOKED everywhere, and is never reissued.",
  "The revocation was signed by this agent's operator key. Its reason is the operator's own statement; the registry checks who signed it, not why.",
  "The signed object is the v1.2-draft Revocation (not normative). The REVOKED status itself is defined by protocol v1.1.1 §12.",
] as const;

/**
 * The success body, built in one place so the Fastify registry and the deployed web
 * route return byte-identical responses for the same revocation.
 */
export function revocationResponseBody(r: Extract<RevokeResult, { ok: true }>) {
  return {
    agent_id: r.agent_id,
    status: "REVOKED" as const,
    revocation_id: r.revocation.revocation_id,
    reason: r.revocation.reason,
    revoked_at: r.revocation.revoked_at,
    recorded_at: r.recorded_at,
    revocation_digest: { alg: "sha-256" as const, value: revocationDigestHex(r.revocation) },
    links: { card: `/a/${r.agent_id}`, envelope: `/api/resolve/${r.agent_id}` },
    disclosures: REVOCATION_DISCLOSURES,
  };
}
