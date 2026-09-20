/**
 * Guards for the Grok Bot pilot — AgenID's first real dogfood agent.
 *
 * The decisive test here is the OFFLINE one: the committed record is re-verified with
 * `@agenid/core` alone, with no network call and no trust in the AgenID registry. That
 * is the protocol's entire claim, exercised against a real registered agent.
 *
 * The rest exist so a future author cannot quietly turn this pilot into a marketing
 * demo: no fabricated level, no fabricated partnership, no fabricated capability, no
 * silently widened authorization, and no secret in the record.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  verifyManifestProof,
  verifyAuthorizationGrant,
  evaluateAuthorization,
  manifestDigestHex,
  AUTHORIZATION_DRAFT_VERSION,
} from "@agenid/core";

const ROOT = join(__dirname, "..");
const RAW = readFileSync(join(ROOT, "data/pilot/grok-bot.json"), "utf8");
const P = JSON.parse(RAW);
const NOW = "2026-09-21T00:00:00Z";

describe("pilot identity re-verifies offline, with no registry involved", () => {
  it("the operator proof verifies against the committed key document and reaches DECLARED", () => {
    const res = verifyManifestProof(P.proof, P.manifest, P.key_document, { now: NOW });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.claimState).toBe("DECLARED");
  });

  it("the manifest digest recomputes from the manifest itself", () => {
    expect(manifestDigestHex(P.manifest)).toBe(P.manifest_digest);
    expect(P.proof.manifest_digest.value).toBe(P.manifest_digest);
  });

  it("IDENTIFIER TAMPERING — a one-character change to the manifest is rejected", () => {
    const tampered = { ...P.manifest, identity: { ...P.manifest.identity, name: "AIVH Grok Bot " } };
    const res = verifyManifestProof(P.proof, tampered, P.key_document, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("manifest_digest_mismatch");
  });

  it("IDENTITY SUBSTITUTION — the proof does not verify for a different agent", () => {
    const other = { ...P.manifest, agent_id: "agenid:01M30753M8KR2AMB86WKR4DDFC" };
    expect(verifyManifestProof(P.proof, other, P.key_document, { now: NOW }).ok).toBe(false);
  });

  it("the operator key controls exactly this agent and carries no private material", () => {
    expect(P.key_document.role).toBe("operator");
    expect(P.key_document.controller).toBe(P.manifest.agent_id);
    expect(RAW).not.toMatch(/private|secret|seed|passphrase/i);
  });
});

describe("authorization is v1.2-draft, and capability is not authorization", () => {
  it("the grant verifies against the principal key", () => {
    const res = verifyAuthorizationGrant(P.authorization_grant, P.principal_key_document, { now: NOW });
    expect(res.ok).toBe(true);
  });

  it("is labelled draft and lives in the v1.2 schema namespace, never v1.1.1", () => {
    expect(AUTHORIZATION_DRAFT_VERSION).toBe("1.2-draft");
    expect(P.authorization_grant.$schema).toContain("/schemas/v1.2/");
    expect(P.authorization_grant.$schema).not.toContain("1.1.1");
  });

  const evaluate = (scope: string) =>
    evaluateAuthorization({
      grant: P.authorization_grant,
      principalKey: P.principal_key_document,
      manifest: P.manifest,
      operatorKey: P.key_document,
      scope,
      revocations: [],
      now: NOW,
    });

  it("a granted scope is PERMITTED and returns the human-confirmation obligation", () => {
    const res = evaluate("host:execute");
    expect(res.decision).toBe("PERMITTED");
    expect(res.obligations).toContainEqual({ type: "requires_human_confirmation" });
  });

  it("AUTHORIZATION ESCALATION — a capability the agent HAS but is not authorized for is refused", () => {
    for (const scope of ["network:tunnel", "messages:send", "mcp:invoke"]) {
      const res = evaluate(scope);
      expect(res.decision).toBe("NOT_PERMITTED");
      expect(res.reasonCode).toBe("scope_not_granted");
    }
  });

  /**
   * The mechanical version of the sprint's central distinction. If someone later flips a
   * capability to `authorized: true` without adding the scope to the signed grant — or
   * widens the grant without recording the capability — this fails. The table and the
   * signed object cannot drift.
   */
  it("the observed capability table and the signed grant agree exactly", () => {
    const scopes: string[] = P.authorization_grant.scopes;
    for (const c of P.observed.capabilities) {
      expect(scopes.includes(c.capability)).toBe(c.authorized);
    }
    for (const s of scopes) {
      expect(P.observed.capabilities.some((c: { capability: string }) => c.capability === s)).toBe(true);
    }
  });

  it("at least one capability is present but NOT authorized — the distinction is real, not rhetorical", () => {
    const gap = P.observed.capabilities.filter((c: { present: boolean; authorized: boolean }) => c.present && !c.authorized);
    expect(gap.length).toBeGreaterThan(0);
  });
});

describe("nothing in the pilot record overclaims", () => {
  it("names no verification level above L1 and no emerald/verified trust state", () => {
    expect(RAW).not.toMatch(/L[2-5]_[A-Z_]+/);
    expect(RAW).not.toMatch(/"level"\s*:/);
  });

  it("claims no partnership or endorsement by the provider", () => {
    expect(RAW).not.toMatch(/partner|endorse|official|certified|approved by/i);
  });

  it("asserts no model identifier, because none is known from the running bot", () => {
    expect(P.observed.model_identifier.claim).toBeNull();
  });

  it("separates the cryptographically verified vendor from the branded provider", () => {
    expect(P.observed.vendor_of_running_binary.independently_reverifiable).toBe(true);
    expect(P.observed.brand_named_by_product.independently_reverifiable).toBe(false);
  });

  it("states plainly that the observed block is not signed protocol material", () => {
    expect(P.observed.disclaimer).toMatch(/not signed|nothing in this block is signed/i);
  });

  it("does not claim the identity is bound to the deployment, because v1.1.1 cannot bind it", () => {
    expect(P.observed.deployment.note).toMatch(/no deployment-binding object|NOT bound/i);
  });

  it("the ecosystem entry for the provider stays merely compatible", () => {
    const e = JSON.parse(readFileSync(join(ROOT, "data/ecosystem/xai-grok.json"), "utf8"));
    expect(e.status).toBe("compatible");
    expect(e.verified).toBe(false);
    expect(e.partner).toBe(false);
  });
});
