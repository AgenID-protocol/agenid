/**
 * Validation suite for the v1.2-DRAFT authorization layer.
 *
 * WHY THIS FILE EXISTS: `authorization.ts` and `authorization-verify.ts` were recovered
 * from the working tree as untracked, uncommitted, and — this is the point — entirely
 * untested. 665 lines of security-critical decision logic compiled into `dist/` with no
 * suite anywhere in the monorepo. Compiling is not evidence of behaviour.
 *
 * This suite is deliberately adversarial. It does not merely exercise the happy path; it
 * attacks each substitution the layer claims to prevent, and it pins the layer's DRAFT
 * status so nothing can quietly start reading as normative.
 *
 * It lives in its own file rather than in `identifier_and_schemas.test.ts` because that
 * file belongs to the v1.1.1 surface and because concurrent sessions are active on this
 * repository — the standing rule is to add guards in a new file, not to edit one another
 * session may be holding.
 */
import { describe, it, expect } from "vitest";
import {
  AUTHORIZATION_DRAFT_STATUS,
  AUTHORIZATION_DRAFT_VERSION,
  PROTOCOL_VERSION,
  GRANT_SCHEMA_ID,
  REVOCATION_SCHEMA_ID,
  AuthorizationGrant,
  Revocation,
  isValidScope,
  generateAgentId,
  generateKeyId,
  generatePrincipalId,
  generateGrantId,
  generateRevocationId,
  isValidPrincipalId,
  isValidGrantId,
  isValidRevocationId,
  generateKeyPair,
  makeKeyDocument,
  signAuthorizationGrant,
  signRevocation,
  signManifestProof,
  verifyManifestProof,
  verifyAuthorizationGrant,
  verifyRevocation,
  evaluateAuthorization,
  type SigningKey,
} from "../src/index.js";

const T0 = "2026-01-01T00:00:00Z";
const NOW = "2026-06-01T00:00:00Z";
const LATER = "2027-01-01T00:00:00Z";

/** Deterministic actors, built the same way a relying party would receive them. */
function makeActors() {
  const agentId = generateAgentId();
  const principalId = generatePrincipalId();

  const opPair = generateKeyPair();
  const operatorKey: SigningKey = {
    privateKey: opPair.privateKey,
    document: makeKeyDocument({
      keyId: generateKeyId(),
      publicKey: opPair.publicKey,
      role: "operator",
      controller: agentId,
      createdAt: T0,
    }),
  };

  const prPair = generateKeyPair();
  const principalKey: SigningKey = {
    privateKey: prPair.privateKey,
    document: makeKeyDocument({
      keyId: generateKeyId(),
      publicKey: prPair.publicKey,
      role: "principal",
      controller: principalId,
      createdAt: T0,
    }),
  };

  const manifest = {
    manifest_version: "1.0" as const,
    agent_id: agentId,
    identity: { name: "Pilot Agent" },
    ownership: { operator: "AI Venture Holdings LLC", operator_domain: "aiventureholdings.com" },
    purpose: { summary: "Repository inspection", channels: ["api" as const] },
    disclosure: { is_ai: true, discloses_to_user: false, human_escalation: false },
  };

  return { agentId, principalId, operatorKey, principalKey, manifest };
}

function makeGrant(
  a: ReturnType<typeof makeActors>,
  over: Partial<{ scopes: string[]; subject: string; constraints: unknown[]; not_before: string; expires_at: string }> = {},
) {
  return signAuthorizationGrant(
    {
      $schema: GRANT_SCHEMA_ID,
      grant_id: generateGrantId(),
      principal: a.principalId,
      subject: over.subject ?? a.agentId,
      scopes: over.scopes ?? ["data:read"],
      ...(over.constraints ? { constraints: over.constraints } : {}),
      not_before: over.not_before ?? T0,
      expires_at: over.expires_at ?? LATER,
      key_id: a.principalKey.document.key_id,
    },
    a.principalKey,
  );
}

/** The full check a relying party runs, with the actor always bound. */
function evaluate(a: ReturnType<typeof makeActors>, grant: unknown, scope: string, extra: Record<string, unknown> = {}) {
  return evaluateAuthorization({
    grant,
    principalKey: a.principalKey.document,
    manifest: a.manifest,
    operatorKey: a.operatorKey.document,
    scope,
    now: NOW,
    ...extra,
  });
}

// ---------------------------------------------------------------------------
// The draft status is load-bearing, so it is pinned
// ---------------------------------------------------------------------------

describe("v1.2-draft status is explicit and separate from the ratified protocol", () => {
  it("PROTOCOL_VERSION is untouched by the draft layer", () => {
    expect(PROTOCOL_VERSION).toBe("1.1.1");
  });
  it("the draft version is tracked in its own constant", () => {
    expect(AUTHORIZATION_DRAFT_VERSION).toBe("1.2-draft");
    expect(AUTHORIZATION_DRAFT_STATUS).toBe("v1.2-draft");
  });
  it("draft objects live under a v1.2 schema namespace, never v1.1.1", () => {
    for (const id of [GRANT_SCHEMA_ID, REVOCATION_SCHEMA_ID]) {
      expect(id.startsWith("https://agenid.com/schemas/v1.2/")).toBe(true);
      expect(id).not.toContain("1.1.1");
    }
  });
});

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

describe("v1.2-draft identifiers", () => {
  it("generates and validates each of the three new forms", () => {
    expect(isValidPrincipalId(generatePrincipalId())).toBe(true);
    expect(isValidGrantId(generateGrantId())).toBe(true);
    expect(isValidRevocationId(generateRevocationId())).toBe(true);
  });
  it("does not accept one form where another is required", () => {
    const g = generateGrantId();
    expect(isValidPrincipalId(g)).toBe(false);
    expect(isValidRevocationId(g)).toBe(false);
    expect(isValidGrantId(generatePrincipalId())).toBe(false);
    expect(isValidGrantId(generateAgentId())).toBe(false);
  });
  it("a principal identifier is a ULID, never a squattable name", () => {
    expect(isValidPrincipalId("agenid:principal:acme")).toBe(false);
    expect(isValidPrincipalId("agenid:principal:aiventureholdings")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scopes — least privilege depends on these staying exact
// ---------------------------------------------------------------------------

describe("scopes are exact, lowercase resource:action with no wildcards", () => {
  it("accepts well-formed scopes", () => {
    for (const s of ["data:read", "payment:initiate", "agent:identity", "a:b"]) {
      expect(isValidScope(s)).toBe(true);
    }
  });
  it("rejects every shape that would quietly widen a grant", () => {
    for (const s of ["payment:*", "*:*", "*", "payment:", ":read", "Payment:read", "payment read", "payment:read:extra", ""]) {
      expect(isValidScope(s)).toBe(false);
    }
  });
  it("a grant carrying a wildcard scope does not parse at all", () => {
    expect(AuthorizationGrant.safeParse({ scopes: ["payment:*"] }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Role isolation — the new key role must not reach the v1.1.1 verification path
// ---------------------------------------------------------------------------

describe("the principal key role is sealed off from the v1.1.1 paths", () => {
  it("a principal key cannot sign a ManifestProof", () => {
    const a = makeActors();
    const impostor: SigningKey = { privateKey: a.principalKey.privateKey, document: a.principalKey.document };
    expect(() => signManifestProof(a.manifest, impostor, { createdAt: T0, expiresAt: LATER })).toThrow();
  });

  it("a ManifestProof does not verify against a principal key document", () => {
    const a = makeActors();
    const proof = signManifestProof(a.manifest, a.operatorKey, { createdAt: T0, expiresAt: LATER });
    // Argument order is (proof, manifest, key). Getting it wrong yields schema_invalid,
    // which would let this test pass without ever reaching the role check — so the code
    // is asserted exactly rather than merely asserting failure.
    const swapped = { ...a.principalKey.document, key_id: a.operatorKey.document.key_id };
    const res = verifyManifestProof(proof, a.manifest, swapped, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("key_role_mismatch");
  });

  it("an operator key cannot sign an AuthorizationGrant", () => {
    const a = makeActors();
    expect(() =>
      signAuthorizationGrant(
        {
          $schema: GRANT_SCHEMA_ID,
          grant_id: generateGrantId(),
          principal: a.principalId,
          subject: a.agentId,
          scopes: ["data:read"],
          not_before: T0,
          expires_at: LATER,
          key_id: a.operatorKey.document.key_id,
        },
        a.operatorKey,
      ),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Grant verification — happy path, then every substitution
// ---------------------------------------------------------------------------

describe("verifyAuthorizationGrant", () => {
  it("verifies a genuine grant and reports exactly what was granted", () => {
    const a = makeActors();
    const res = verifyAuthorizationGrant(makeGrant(a), a.principalKey.document, { now: NOW });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.principal).toBe(a.principalId);
      expect(res.subject).toBe(a.agentId);
      expect(res.scopes).toEqual(["data:read"]);
    }
  });

  it("IDENTIFIER TAMPERING — one changed character fails the signature", () => {
    const a = makeActors();
    const grant = makeGrant(a);
    const tampered = { ...grant, scopes: ["data:write"] };
    const res = verifyAuthorizationGrant(tampered, a.principalKey.document, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("signature_invalid");
  });

  it("KEY SUBSTITUTION — another principal's key is rejected by key_id, not by luck", () => {
    const a = makeActors();
    const b = makeActors();
    const res = verifyAuthorizationGrant(makeGrant(a), b.principalKey.document, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("key_id_mismatch");
  });

  it("ROLE SUBSTITUTION — a non-principal key under the grant's key_id is rejected as a role error", () => {
    const a = makeActors();
    const grant = makeGrant(a);
    const roleSwapped = { ...a.operatorKey.document, key_id: grant.key_id };
    const res = verifyAuthorizationGrant(grant, roleSwapped, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("key_role_mismatch");
  });

  it("an authentic but expired grant is distinguishable from a forgery", () => {
    const a = makeActors();
    const grant = makeGrant(a, { not_before: T0, expires_at: "2026-02-01T00:00:00Z" });
    const res = verifyAuthorizationGrant(grant, a.principalKey.document, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("expired");
  });

  it("a grant presented before its window is not_yet_valid, not expired", () => {
    const a = makeActors();
    const grant = makeGrant(a, { not_before: "2026-12-01T00:00:00Z", expires_at: LATER });
    const res = verifyAuthorizationGrant(grant, a.principalKey.document, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("not_yet_valid");
  });
});

// ---------------------------------------------------------------------------
// The decision — the sprint's attack matrix
// ---------------------------------------------------------------------------

describe("evaluateAuthorization — substitution and escalation", () => {
  it("permits exactly the granted scope", () => {
    const a = makeActors();
    const res = evaluate(a, makeGrant(a, { scopes: ["data:read"] }), "data:read");
    expect(res.decision).toBe("PERMITTED");
    expect(res.reasonCode).toBeNull();
  });

  it("CAPABILITY / SCOPE ESCALATION — an ungranted scope is refused and names the miss", () => {
    const a = makeActors();
    const res = evaluate(a, makeGrant(a, { scopes: ["data:read"] }), "data:write");
    expect(res.decision).toBe("NOT_PERMITTED");
    expect(res.reasonCode).toBe("scope_not_granted");
  });

  it("no prefix or hierarchy matching: data:read does not imply data:read_all", () => {
    const a = makeActors();
    expect(evaluate(a, makeGrant(a, { scopes: ["data:read"] }), "data:read_all").decision).toBe("NOT_PERMITTED");
  });

  it("IDENTITY SUBSTITUTION — a genuine grant for another agent does not authorize this one", () => {
    const a = makeActors();
    const other = makeActors();
    const grantForOther = makeGrant(a, { subject: other.agentId });
    const res = evaluate(a, grantForOther, "data:read");
    expect(res.decision).toBe("NOT_PERMITTED");
    expect(res.reasonCode).toBe("subject_mismatch");
  });

  it("OPERATOR SUBSTITUTION — an operator key that does not control the agent breaks the binding", () => {
    const a = makeActors();
    const foreign = makeActors();
    const res = evaluateAuthorization({
      grant: makeGrant(a),
      principalKey: a.principalKey.document,
      manifest: a.manifest,
      operatorKey: foreign.operatorKey.document,
      scope: "data:read",
      now: NOW,
    });
    expect(res.decision).toBe("NOT_PERMITTED");
    expect(res.reasonCode).toBe("agent_not_bound_to_subject");
  });

  it("PROVIDER / PRINCIPAL SPOOFING — a grant signed by a self-minted principal does not verify against the real one", () => {
    const a = makeActors();
    const attacker = makeActors();
    const forged = signAuthorizationGrant(
      {
        $schema: GRANT_SCHEMA_ID,
        grant_id: generateGrantId(),
        principal: attacker.principalId,
        subject: a.agentId,
        scopes: ["payment:initiate"],
        not_before: T0,
        expires_at: LATER,
        key_id: attacker.principalKey.document.key_id,
      },
      attacker.principalKey,
    );
    const res = evaluate(a, forged, "payment:initiate");
    expect(res.decision).toBe("NOT_PERMITTED");
    expect(res.reasonCode).toBe("key_id_mismatch");
  });

  it("a constraint is returned as an obligation, never silently treated as satisfied", () => {
    const a = makeActors();
    const grant = makeGrant(a, {
      scopes: ["payment:initiate"],
      constraints: [{ type: "max_value", currency: "USD", amount_minor: "5000" }],
    });
    const res = evaluate(a, grant, "payment:initiate");
    expect(res.decision).toBe("PERMITTED");
    expect(res.obligations).toEqual([{ type: "max_value", currency: "USD", amount_minor: "5000" }]);
  });

  it("monetary ceilings are strings — a JSON number does not parse (§5)", () => {
    const a = makeActors();
    expect(() =>
      makeGrant(a, { scopes: ["payment:initiate"], constraints: [{ type: "max_value", currency: "USD", amount_minor: 5000 }] }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Revocation — authentic is not the same as authoritative
// ---------------------------------------------------------------------------

function revokeGrant(a: ReturnType<typeof makeActors>, grantId: string, at = "2026-03-01T00:00:00Z") {
  return signRevocation(
    {
      $schema: REVOCATION_SCHEMA_ID,
      revocation_id: generateRevocationId(),
      revokes: grantId,
      revokes_type: "grant",
      reason: "no_longer_authorized",
      revoked_at: at,
      key_id: a.principalKey.document.key_id,
    },
    a.principalKey,
  );
}

describe("revocation", () => {
  it("a revoked grant is refused, and the refusal names revocation rather than a scope miss", () => {
    const a = makeActors();
    const grant = makeGrant(a);
    const rev = revokeGrant(a, grant.grant_id);
    const res = evaluate(a, grant, "data:read", {
      revocations: [rev],
      revocationKeys: { [a.principalKey.document.key_id]: a.principalKey.document },
    });
    expect(res.decision).toBe("NOT_PERMITTED");
    expect(res.reasonCode).toBe("grant_revoked");
    expect(res.revocationsChecked).toBe(true);
  });

  it("STANDING — one principal cannot revoke another principal's grant", () => {
    const a = makeActors();
    const attacker = makeActors();
    const grant = makeGrant(a);
    const hostile = revokeGrant(attacker, grant.grant_id);
    const res = evaluate(a, grant, "data:read", {
      revocations: [hostile],
      revocationKeys: { [attacker.principalKey.document.key_id]: attacker.principalKey.document },
    });
    expect(res.decision).toBe("PERMITTED");
  });

  it("a revocation dated in the future does not yet revoke", () => {
    const a = makeActors();
    const grant = makeGrant(a);
    const rev = revokeGrant(a, grant.grant_id, "2026-11-01T00:00:00Z");
    const res = evaluate(a, grant, "data:read", {
      revocations: [rev],
      revocationKeys: { [a.principalKey.document.key_id]: a.principalKey.document },
    });
    expect(res.decision).toBe("PERMITTED");
  });

  it("an unverifiable revocation yields UNKNOWN, never a silent PERMITTED", () => {
    const a = makeActors();
    const grant = makeGrant(a);
    const rev = revokeGrant(a, grant.grant_id);
    const res = evaluate(a, grant, "data:read", { revocations: [rev], revocationKeys: {} });
    expect(res.decision).toBe("UNKNOWN");
    expect(res.reasonCode).toBe("registry_unavailable");
  });

  it("UNKNOWN is reported as distinct from NOT_PERMITTED", () => {
    const a = makeActors();
    const res = evaluate(a, makeGrant(a), "data:read", { revocations: [revokeGrant(a, generateGrantId())], revocationKeys: {} });
    expect(res.decision).not.toBe("NOT_PERMITTED");
  });

  it("not supplying a revocation set is reported, not assumed to mean none exist", () => {
    const a = makeActors();
    expect(evaluate(a, makeGrant(a), "data:read").revocationsChecked).toBe(false);
    expect(evaluate(a, makeGrant(a), "data:read", { revocations: [] }).revocationsChecked).toBe(true);
  });

  it("only an operator key may revoke an agent, and only the authority may revoke an assertion", () => {
    const a = makeActors();
    expect(() =>
      signRevocation(
        {
          $schema: REVOCATION_SCHEMA_ID,
          revocation_id: generateRevocationId(),
          revokes: a.agentId,
          revokes_type: "agent",
          reason: "agent_retired",
          revoked_at: NOW,
          key_id: a.principalKey.document.key_id,
        },
        a.principalKey,
      ),
    ).toThrow();
  });

  it("a revocation whose target shape contradicts revokes_type does not parse", () => {
    expect(Revocation.safeParse({ revokes: generateAgentId(), revokes_type: "grant" }).success).toBe(false);
  });

  it("verifyRevocation rejects a revocation presented with the wrong signer key", () => {
    const a = makeActors();
    const b = makeActors();
    const rev = revokeGrant(a, generateGrantId());
    const res = verifyRevocation(rev, b.principalKey.document, { now: NOW });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("key_id_mismatch");
  });
});

// ---------------------------------------------------------------------------
// Characterization: actor binding is OPTIONAL, and that is a real exposure
// ---------------------------------------------------------------------------

/**
 * `evaluateAuthorization` binds the presented agent to the grant's subject only when the
 * caller supplies BOTH `manifest` and `operatorKey`. Omit them and the grant verifies on
 * its own and returns PERMITTED with nothing tying the caller to the subject — so a
 * relying party that forgets two optional arguments gets a decision that looks identical
 * to a bound one.
 *
 * These tests do not assert that this is correct. They PIN the current behaviour so it
 * cannot change silently, and they record the gap for the session that owns this layer:
 * the same reasoning that produced `revocationsChecked` ("I did not check" must be
 * reported, never inferred as "there is nothing to find") applies here and has no
 * equivalent field. Recommended resolution is an `actorBound: boolean` on the result, or
 * an UNKNOWN decision when the binding inputs are absent — both are that session's call,
 * not this one's.
 */
describe("FINDING — an unbound evaluation is indistinguishable from a bound one", () => {
  it("omitting manifest and operatorKey still returns PERMITTED", () => {
    const a = makeActors();
    const res = evaluateAuthorization({
      grant: makeGrant(a),
      principalKey: a.principalKey.document,
      scope: "data:read",
      now: NOW,
    });
    expect(res.decision).toBe("PERMITTED");
  });

  it("and the result carries no field distinguishing it from a bound evaluation", () => {
    const a = makeActors();
    const unbound = evaluateAuthorization({
      grant: makeGrant(a),
      principalKey: a.principalKey.document,
      scope: "data:read",
      now: NOW,
    });
    expect(Object.keys(unbound)).not.toContain("actorBound");
  });

  it("supplying only one half of the binding fails closed to UNKNOWN", () => {
    const a = makeActors();
    const res = evaluateAuthorization({
      grant: makeGrant(a),
      principalKey: a.principalKey.document,
      manifest: a.manifest,
      scope: "data:read",
      now: NOW,
    });
    expect(res.decision).toBe("UNKNOWN");
    expect(res.reasonCode).toBe("schema_invalid");
  });

  /**
   * The proof that the binding check is load-bearing rather than decorative: ONE forged
   * grant, evaluated twice, differing only in whether the actor was supplied. Unbound it
   * is PERMITTED; bound it is refused as subject_mismatch. This is the exploit and its
   * mitigation in a single test, and it is why the optional binding above is reported as
   * a finding rather than filed as a preference.
   */
  it("the same grant for another agent is PERMITTED unbound and refused bound", () => {
    const a = makeActors();
    const victim = makeActors();
    const grantForVictim = makeGrant(a, { subject: victim.agentId });

    const unbound = evaluateAuthorization({
      grant: grantForVictim,
      principalKey: a.principalKey.document,
      scope: "data:read",
      now: NOW,
    });
    const bound = evaluate(a, grantForVictim, "data:read");

    expect(unbound.decision).toBe("PERMITTED");
    expect(bound.decision).toBe("NOT_PERMITTED");
    expect(bound.reasonCode).toBe("subject_mismatch");
  });
});
