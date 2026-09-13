/**
 * The resolution envelope (spec §14/§15): everything a verifier needs to check
 * an identity WITHOUT trusting this registry — manifest, operator proof,
 * assertions, and the key-discovery pointers for both required paths.
 * The same envelope is what `agenid.org/a/<id>` returns for
 * `Accept: application/json`.
 */
import {
  verifyManifestProof,
  verifyVerificationAssertion,
  keyResolverPath,
  wellKnownKeysUrl,
  type KeyDocument,
  type VerificationAssertion,
  type VerificationLevel,
} from "@agenid/core";
import type { AgentRecord, RegistryStore } from "./store.js";

const LEVEL_RANK: Record<VerificationLevel, number> = {
  L1_REGISTERED: 1,
  L2_DOMAIN_VERIFIED: 2,
  L3_ORGANIZATION_VERIFIED: 3,
  L4_DEPLOYMENT_VERIFIED: 4,
};

export interface AssertionView {
  assertion: VerificationAssertion;
  /** Result of the §7.2 procedure against the stored authority key, at `now`, against the CURRENT manifest. */
  check: { ok: boolean; code?: string };
}

export interface ResolutionEnvelope {
  agenid_envelope_version: "1.0";
  agent_id: string;
  status: AgentRecord["status"];
  registered_at: string;
  manifest: AgentRecord["manifest"];
  manifest_digest: { alg: "sha-256"; value: string };
  proof: AgentRecord["proof"];
  proof_check: { ok: boolean; code?: string };
  operator_key: {
    key_id: string;
    document: KeyDocument | null;
    discovery: { registry_path: string; well_known_url: string };
  };
  verification: {
    /** Highest level with a currently-valid assertion bound to the current manifest; L1 if none. */
    level: VerificationLevel;
    valid_assertions: number;
    total_assertions: number;
  };
  assertions: AssertionView[];
  /** How a third party re-verifies this envelope without trusting the registry. */
  verify_instructions: string;
}

export async function buildEnvelope(store: RegistryStore, rec: AgentRecord, now: string): Promise<ResolutionEnvelope> {
  const opKey = await store.getKey(rec.proof.key_id);
  const proofCheck = opKey ? verifyManifestProof(rec.proof, rec.manifest, opKey, { now }) : ({ ok: false, code: "key_unavailable" } as const);

  const stored = await store.listAssertionsForSubject(rec.agent_id);
  const views: AssertionView[] = [];
  let level: VerificationLevel = "L1_REGISTERED";
  let valid = 0;
  for (const a of stored) {
    const auKey = await store.getKey(a.key_id);
    const r = auKey ? verifyVerificationAssertion(a, auKey, { now, currentManifest: rec.manifest }) : ({ ok: false, code: "key_unavailable" } as const);
    const check = r.ok ? { ok: true } : { ok: false, code: r.code };
    views.push({ assertion: a, check });
    if (r.ok) {
      valid++;
      if (LEVEL_RANK[a.level] > LEVEL_RANK[level]) level = a.level;
    }
  }

  return {
    agenid_envelope_version: "1.0",
    agent_id: rec.agent_id,
    status: rec.status,
    registered_at: rec.registered_at,
    manifest: rec.manifest,
    manifest_digest: { alg: "sha-256", value: rec.manifest_digest },
    proof: rec.proof,
    proof_check: proofCheck.ok ? { ok: true } : { ok: false, code: proofCheck.code },
    operator_key: {
      key_id: rec.proof.key_id,
      document: opKey,
      discovery: {
        registry_path: keyResolverPath(rec.proof.key_id),
        well_known_url: wellKnownKeysUrl(rec.manifest.ownership.operator_domain),
      },
    },
    verification: { level, valid_assertions: valid, total_assertions: stored.length },
    assertions: views,
    verify_instructions:
      "Recompute sha256(RFC8785(manifest)) and compare to manifest_digest; fetch the operator key from BOTH discovery paths and require they agree; " +
      "verify Ed25519 over RFC8785(proof minus signature); for each assertion, fetch the authority key, check role=authority, verify Ed25519 over " +
      "RFC8785(assertion minus signature), check the validity window and that assertion.manifest_digest matches. Spec: https://github.com/AgenID-protocol/spec",
  };
}
