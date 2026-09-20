/**
 * AgenID v1.2-DRAFT — signing, verification and the authorization decision.
 *
 * NOT NORMATIVE. See authorization.ts.
 *
 * Verification outcomes are VALUES with stable codes, never exceptions — the same
 * convention §7 already uses, so a relying party's decision is deterministic and every
 * failure names exactly one cause. `now` is always passed explicitly; nothing here
 * reads a hidden clock.
 *
 * WHAT A RELYING PARTY RUNS
 *
 *   evaluateAuthorization({ grant, principalKey, agent, operatorKey, scope, revocations, now })
 *
 * It needs no network call to AgenID and no trust in AgenID. Everything it checks is a
 * signature over canonical bytes and a comparison of fields. That is the whole design:
 * the registry distributes these objects; it does not decide them.
 */

import {
  AuthorizationGrant,
  AuthorizationGrantPayload,
  REVOKER_ROLE,
  Revocation,
  RevocationPayload,
  UNDERSTOOD_CONSTRAINTS,
  type Constraint,
} from "./authorization.js";
import { KeyDocument, Manifest, parseOrThrow } from "./schemas.js";
import { b64uDecode, b64uEncode, signBytes, signingInputOf, verifyBytes, type SigningKey } from "./crypto.js";
import { KeyRoleError } from "./errors.js";

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * A principal signs a grant.
 *
 * Signing-time guards mirror the verification-time checks rather than replacing them —
 * the same belt-and-braces §7.3 uses. A caller who bypasses this function and signs by
 * hand still cannot produce a grant that verifies, because verification re-derives
 * every one of these independently.
 */
export function signAuthorizationGrant(payloadInput: unknown, principalKey: SigningKey): AuthorizationGrant {
  const payload = parseOrThrow(AuthorizationGrantPayload, payloadInput, "AuthorizationGrantPayload");
  const doc = parseOrThrow(KeyDocument, principalKey.document, "principal KeyDocument");
  if (doc.role !== "principal") {
    throw new KeyRoleError(`AuthorizationGrant must be signed by a principal key (got role=${doc.role})`);
  }
  if (doc.controller !== payload.principal) {
    throw new KeyRoleError(`principal key controller ${doc.controller} != grant.principal ${payload.principal}`);
  }
  if (doc.key_id !== payload.key_id) {
    throw new KeyRoleError(`grant.key_id ${payload.key_id} does not name the signing key ${doc.key_id}`);
  }
  const sig = signBytes(principalKey.privateKey, signingInputOf(payload));
  return parseOrThrow(AuthorizationGrant, { ...payload, signature: b64uEncode(sig) }, "AuthorizationGrant");
}

/** The key entitled to revoke the target signs the revocation. */
export function signRevocation(payloadInput: unknown, signingKey: SigningKey): Revocation {
  const payload = parseOrThrow(RevocationPayload, payloadInput, "RevocationPayload");
  const doc = parseOrThrow(KeyDocument, signingKey.document, "revoker KeyDocument");
  const required = REVOKER_ROLE[payload.revokes_type];
  if (doc.role !== required) {
    throw new KeyRoleError(`revoking a ${payload.revokes_type} requires a ${required} key (got role=${doc.role})`);
  }
  if (doc.key_id !== payload.key_id) {
    throw new KeyRoleError(`revocation.key_id ${payload.key_id} does not name the signing key ${doc.key_id}`);
  }
  const sig = signBytes(signingKey.privateKey, signingInputOf(payload));
  return parseOrThrow(Revocation, { ...payload, signature: b64uEncode(sig) }, "Revocation");
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type AuthorizationFailureCode =
  | "schema_invalid"
  | "key_id_mismatch"
  | "key_role_mismatch"
  | "key_controller_mismatch"
  | "key_not_active_at_signing_time"
  | "signature_invalid"
  | "not_yet_valid"
  | "expired"
  | "grant_revoked"
  | "subject_mismatch"
  | "scope_not_granted"
  | "constraint_not_understood"
  | "agent_not_bound_to_subject"
  | "agent_revoked";

export type GrantVerifyResult =
  | { ok: true; principal: string; subject: string; scopes: string[]; constraints: Constraint[] }
  | { ok: false; code: AuthorizationFailureCode; message: string };

function gfail(code: AuthorizationFailureCode, message: string): GrantVerifyResult {
  return { ok: false, code, message };
}

/** Key status at a given instant — identical semantics to §7 step 4 / §9.6. */
function keyActiveAt(doc: KeyDocument, atIso: string): boolean {
  const at = Date.parse(atIso);
  if (doc.revoked_at !== null && at >= Date.parse(doc.revoked_at)) return false;
  if (doc.retired_at !== null && at >= Date.parse(doc.retired_at)) return false;
  if (doc.status === "revoked" && doc.revoked_at === null) return false;
  return true;
}

export interface VerifyGrantOptions {
  /** RFC 3339 instant to evaluate validity windows against. Required. */
  now: string;
  /**
   * Revocations the relying party has collected. Supplying none means "I did not check",
   * which is NOT the same as "none exist" — see `evaluateAuthorization`'s
   * `revocationsChecked`, which reports that distinction rather than hiding it.
   */
  revocations?: unknown[];
}

// ---------------------------------------------------------------------------
// Revocation verification
// ---------------------------------------------------------------------------

export type RevocationVerifyResult =
  | { ok: true; revokes: string; revokesType: string; revokedAt: string }
  | { ok: false; code: AuthorizationFailureCode; message: string };

/**
 * Verify a revocation against the key that signed it.
 *
 * Note what is deliberately NOT checked here: whether the revoker is entitled to revoke
 * *this particular* target instance. The role correspondence is checked (only a
 * principal key may revoke a grant), but proving the key belongs to the grant's own
 * principal needs the grant, so that check lives in `evaluateAuthorization` where both
 * objects are in hand. A revocation that verifies here is authentic; whether it is
 * AUTHORITATIVE over a given grant is a separate question, and conflating the two is
 * how one principal ends up able to revoke another's grants.
 */
export function verifyRevocation(revocationInput: unknown, revokerKeyDoc: unknown, opts: { now: string }): RevocationVerifyResult {
  const r = Revocation.safeParse(revocationInput);
  if (!r.success) return { ok: false, code: "schema_invalid", message: `Revocation: ${r.error.issues.map((i) => i.message).join("; ")}` };
  const k = KeyDocument.safeParse(revokerKeyDoc);
  if (!k.success) return { ok: false, code: "schema_invalid", message: `KeyDocument: ${k.error.issues.map((i) => i.message).join("; ")}` };
  const rev = r.data;
  const key = k.data;

  if (key.key_id !== rev.key_id) {
    return { ok: false, code: "key_id_mismatch", message: `revocation.key_id ${rev.key_id} != supplied key ${key.key_id}` };
  }
  const required = REVOKER_ROLE[rev.revokes_type];
  if (key.role !== required) {
    return { ok: false, code: "key_role_mismatch", message: `revoking a ${rev.revokes_type} requires role=${required}, key has role=${key.role}` };
  }
  // A key revoked BEFORE it signed this cannot have signed it. A key revoked after
  // still signed validly at the time, which is why this is evaluated at revoked_at and
  // not at `now` — the same rule that keeps historical signatures checkable.
  if (!keyActiveAt(key, rev.revoked_at)) {
    return { ok: false, code: "key_not_active_at_signing_time", message: "key was retired/revoked before revoked_at" };
  }
  const ok = verifyBytes(b64uDecode(key.public_key_b64u), signingInputOf(rev), b64uDecode(rev.signature));
  if (!ok) return { ok: false, code: "signature_invalid", message: "Ed25519 signature does not verify over canonical payload" };

  return { ok: true, revokes: rev.revokes, revokesType: rev.revokes_type, revokedAt: rev.revoked_at };
}

// ---------------------------------------------------------------------------
// Grant verification
// ---------------------------------------------------------------------------

/**
 * Verify a grant against the principal's key document.
 *
 * This establishes only that the grant is authentic and in force. It does NOT establish
 * that the agent is who it claims, and it does not check a scope — see
 * `evaluateAuthorization`, which does both and is what a relying party should call.
 */
export function verifyAuthorizationGrant(grantInput: unknown, principalKeyDoc: unknown, opts: VerifyGrantOptions): GrantVerifyResult {
  const g = AuthorizationGrant.safeParse(grantInput);
  if (!g.success) return gfail("schema_invalid", `AuthorizationGrant: ${g.error.issues.map((i) => i.message).join("; ")}`);
  const k = KeyDocument.safeParse(principalKeyDoc);
  if (!k.success) return gfail("schema_invalid", `KeyDocument: ${k.error.issues.map((i) => i.message).join("; ")}`);
  const grant = g.data;
  const key = k.data;

  // Key identity, role, controller — before the signature, so a role-substituted key is
  // rejected for the RIGHT reason even where its math would fail anyway.
  if (key.key_id !== grant.key_id) return gfail("key_id_mismatch", `grant.key_id ${grant.key_id} != supplied key ${key.key_id}`);
  if (key.role !== "principal") return gfail("key_role_mismatch", `AuthorizationGrant requires role=principal, key has role=${key.role}`);
  if (key.controller !== grant.principal) {
    return gfail("key_controller_mismatch", `key controller ${key.controller} != grant.principal ${grant.principal}`);
  }
  if (!keyActiveAt(key, grant.not_before)) {
    return gfail("key_not_active_at_signing_time", "principal key was retired/revoked before not_before");
  }

  // Signature BEFORE the window, so an expired-but-authentic grant is distinguishable
  // from a forgery. "Expired" and "forged" are very different facts about a counterparty.
  const ok = verifyBytes(b64uDecode(key.public_key_b64u), signingInputOf(grant), b64uDecode(grant.signature));
  if (!ok) return gfail("signature_invalid", "Ed25519 signature does not verify over canonical payload");

  const now = Date.parse(opts.now);
  if (now < Date.parse(grant.not_before)) return gfail("not_yet_valid", "now < not_before");
  if (now > Date.parse(grant.expires_at)) return gfail("expired", "now > expires_at");

  return {
    ok: true,
    principal: grant.principal,
    subject: grant.subject,
    scopes: [...grant.scopes],
    constraints: grant.constraints ? [...grant.constraints] : [],
  };
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export type AuthorizationDecision = "PERMITTED" | "NOT_PERMITTED" | "UNKNOWN";

export interface EvaluateAuthorizationInput {
  grant: unknown;
  principalKey: unknown;
  /** The scope the action requires. Exactly one — a decision is about one action. */
  scope: string;
  /** The agent's manifest and operator key, to bind the actor to the grant's subject. */
  manifest?: unknown;
  operatorKey?: unknown;
  /** Verified or unverified revocations the relying party collected. */
  revocations?: unknown[];
  /** Key documents for the revocation signers, by key_id. */
  revocationKeys?: Record<string, unknown>;
  now: string;
}

export interface AuthorizationEvaluation {
  decision: AuthorizationDecision;
  /** Exactly one cause. `null` when PERMITTED. */
  reasonCode: AuthorizationFailureCode | "registry_unavailable" | null;
  message: string;
  /**
   * False when the caller supplied no revocation set. A relying party that treats
   * "I did not check for revocations" as "there are none" has disabled the defense,
   * so this is reported rather than assumed either way.
   */
  revocationsChecked: boolean;
  granted: { principal: string; subject: string; scopes: string[]; constraints: Constraint[] } | null;
  /**
   * Constraints the relying party must enforce ITSELF before acting. AgenID cannot know
   * the counterparty, the amount, or how many times a grant has been used — so these are
   * returned, explicitly, as obligations rather than silently treated as satisfied.
   */
  obligations: Constraint[];
}

/**
 * The full check a relying party runs.
 *
 * `UNKNOWN` is a first-class outcome and is NOT `NOT_PERMITTED`. "I could not determine
 * this" and "this agent is not authorized" are different facts; collapsing them either
 * fails open or slanders an agent. Same reasoning as the existing `503
 * registry_unavailable` on the read path.
 */
export function evaluateAuthorization(input: EvaluateAuthorizationInput): AuthorizationEvaluation {
  const base = {
    revocationsChecked: Array.isArray(input.revocations),
    granted: null,
    obligations: [] as Constraint[],
  };

  const verified = verifyAuthorizationGrant(input.grant, input.principalKey, { now: input.now });
  if (!verified.ok) {
    return { decision: "NOT_PERMITTED", reasonCode: verified.code, message: verified.message, ...base };
  }

  // The grant names an agent. Bind the ACTOR to that agent, or the grant is a statement
  // about someone else. Without this an attacker presents a real grant for a real agent
  // alongside their own unrelated identity.
  if (input.manifest !== undefined || input.operatorKey !== undefined) {
    const m = Manifest.safeParse(input.manifest);
    const ok = KeyDocument.safeParse(input.operatorKey);
    if (!m.success || !ok.success) {
      return {
        decision: "UNKNOWN",
        reasonCode: "schema_invalid",
        message: "manifest and operator key must both be supplied and valid to bind the actor to the grant",
        ...base,
      };
    }
    if (m.data.agent_id !== verified.subject) {
      return {
        decision: "NOT_PERMITTED",
        reasonCode: "subject_mismatch",
        message: `grant authorizes ${verified.subject}, but the presented agent is ${m.data.agent_id}`,
        ...base,
      };
    }
    if (ok.data.role !== "operator" || ok.data.controller !== m.data.agent_id) {
      return {
        decision: "NOT_PERMITTED",
        reasonCode: "agent_not_bound_to_subject",
        message: "operator key does not control the presented agent",
        ...base,
      };
    }
  }

  // Revocation, checked before the scope so a withdrawn grant reports as withdrawn
  // rather than as a scope miss.
  if (Array.isArray(input.revocations)) {
    for (const rInput of input.revocations) {
      const parsed = Revocation.safeParse(rInput);
      if (!parsed.success) continue;
      const rev = parsed.data;
      const keyDoc = input.revocationKeys?.[rev.key_id];
      if (keyDoc === undefined) {
        // An unverifiable revocation is not evidence, but it is also not nothing: the
        // relying party asked about revocations and cannot answer. Fail to UNKNOWN
        // rather than ignoring it and reporting PERMITTED.
        return {
          decision: "UNKNOWN",
          reasonCode: "registry_unavailable",
          message: `a revocation names key ${rev.key_id}, whose key document was not supplied; cannot determine revocation status`,
          ...base,
        };
      }
      const rv = verifyRevocation(rev, keyDoc, { now: input.now });
      if (!rv.ok) continue; // an invalid revocation revokes nothing
      const kd = KeyDocument.safeParse(keyDoc);
      if (!kd.success) continue;

      // Authoritative over THIS grant only if the revoking key is controlled by the same
      // principal that issued it. Without this check any principal could revoke any
      // other principal's grants — a signed object being authentic is not the same as
      // its signer having standing over the target.
      const parsedGrant = AuthorizationGrant.safeParse(input.grant);
      const grantId = parsedGrant.success ? parsedGrant.data.grant_id : null;

      if (rev.revokes_type === "grant" && grantId !== null && rev.revokes === grantId) {
        if (kd.data.controller !== verified.principal) {
          continue; // signed by a different principal — not authoritative here
        }
        if (Date.parse(input.now) >= Date.parse(rev.revoked_at)) {
          return {
            decision: "NOT_PERMITTED",
            reasonCode: "grant_revoked",
            message: `grant was revoked at ${rev.revoked_at} (${rev.reason})`,
            ...base,
            revocationsChecked: true,
          };
        }
      }
      if (rev.revokes_type === "agent" && rev.revokes === verified.subject) {
        if (kd.data.controller !== verified.subject) continue; // must be the agent's own operator key
        if (Date.parse(input.now) >= Date.parse(rev.revoked_at)) {
          return {
            decision: "NOT_PERMITTED",
            reasonCode: "agent_revoked",
            message: `agent was revoked at ${rev.revoked_at} (${rev.reason})`,
            ...base,
            revocationsChecked: true,
          };
        }
      }
    }
  }

  // A constraint this build cannot evaluate fails CLOSED. A relying party that ignores
  // a constraint it does not understand is acting outside the grant while believing it
  // is inside it.
  const unknownConstraint = verified.constraints.find((c) => !UNDERSTOOD_CONSTRAINTS.has(c.type));
  if (unknownConstraint) {
    return {
      decision: "NOT_PERMITTED",
      reasonCode: "constraint_not_understood",
      message: `grant carries a constraint this verifier does not understand: ${unknownConstraint.type}`,
      ...base,
      revocationsChecked: base.revocationsChecked,
    };
  }

  // Exact string equality. No prefix matching, no wildcards, no hierarchy.
  if (!verified.scopes.includes(input.scope)) {
    return {
      decision: "NOT_PERMITTED",
      reasonCode: "scope_not_granted",
      message: `grant does not include scope ${JSON.stringify(input.scope)}`,
      ...base,
      revocationsChecked: base.revocationsChecked,
      granted: {
        principal: verified.principal,
        subject: verified.subject,
        scopes: verified.scopes,
        constraints: verified.constraints,
      },
    };
  }

  return {
    decision: "PERMITTED",
    reasonCode: null,
    message: `scope ${input.scope} is granted to ${verified.subject} by ${verified.principal}`,
    revocationsChecked: base.revocationsChecked,
    granted: {
      principal: verified.principal,
      subject: verified.subject,
      scopes: verified.scopes,
      constraints: verified.constraints,
    },
    // Returned, not enforced. AgenID does not know the counterparty or the amount.
    obligations: verified.constraints,
  };
}
