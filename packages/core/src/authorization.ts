/**
 * AgenID v1.2-DRAFT — the authorization layer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * STATUS: DRAFT. NOT NORMATIVE. NOT ISSUABLE ON THE REFERENCE DEPLOYMENT.
 *
 * This is implemented and tested, and it is not part of the specification. It
 * becomes normative when it is ratified and the conformance suite carries vectors
 * for every failure code below — not when this file merges. Everything here is
 * labelled v1.2-draft on every public surface, the same way `L5` and `AUTHORIZED`
 * are handled.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS EXISTS
 *
 * v1.1.1 answers "who is this agent" and "does its self-declaration verify". It has
 * no vocabulary for "who authorized it", "what may it do", or "is that still true".
 * Verification levels L1–L4 describe how carefully an IDENTITY was checked; they say
 * nothing about PERMISSION. The two axes are orthogonal, and expressing permission as
 * a verification level ("L3 agents may book appointments") collapses them and is the
 * mistake this module exists to avoid.
 *
 * The specification anticipated this: `permissions` and `authorizations` are in
 * RESERVED_MANIFEST_KEYS, which v1.1.1 rejects by `.strict()`. This is that namespace
 * being filled.
 *
 * THE ONE RULE THAT SHAPES EVERYTHING HERE
 *
 * A grant is verified by the RELYING PARTY, offline, against the principal's own
 * public key — never by asking AgenID whether an agent is allowed to do something.
 * An authorization API that answers `{"allowed": true}` from a database the caller
 * must trust is precisely the architecture this product argues against. The registry
 * distributes grants. It does not decide them, and it cannot forge one, because it
 * never holds a principal's private key.
 *
 * Same signing construction as every other object in the protocol: strip `signature`,
 * RFC 8785 JCS canonical bytes, pure Ed25519. `$schema` is inside the signing input.
 */

import { z } from "zod";
import {
  AGENT_ID_REGEX,
  ASSERTION_ID_REGEX,
  GRANT_ID_REGEX,
  KEY_ID_REGEX,
  PRINCIPAL_ID_REGEX,
  REVOCATION_ID_REGEX,
} from "./identifier.js";
import { AgentId, Ed25519SignatureB64u, KeyDocument, PrincipalId, Rfc3339Utc, KeyId } from "./schemas.js";

export const SCHEMA_BASE_V12 = "https://agenid.com/schemas/v1.2" as const;
export const GRANT_SCHEMA_ID = `${SCHEMA_BASE_V12}/authorization-grant.json` as const;
export const REVOCATION_SCHEMA_ID = `${SCHEMA_BASE_V12}/revocation.json` as const;

/** Every object in this module carries this, so nothing can quietly read as normative. */
export const AUTHORIZATION_DRAFT_STATUS = "v1.2-draft" as const;

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

/**
 * `resource:action`, lowercase, matched by EXACT STRING EQUALITY.
 *
 * No wildcards. `payment:*` is how least privilege dies quietly, and a wildcard cannot
 * be removed later once anything depends on it — whereas it can be added later with a
 * vector suite behind it. Hierarchy (`appointment` implying `appointment:read`) is
 * deliberately deferred for the same reason, and because exact equality has no
 * ambiguous cases and no path-traversal analogue.
 *
 * A grant lists what it grants.
 */
export const SCOPE_REGEX = /^[a-z][a-z0-9_]{0,31}:[a-z][a-z0-9_]{0,31}$/;
export const Scope = z
  .string()
  .regex(SCOPE_REGEX, "scope must be resource:action, lowercase, no wildcards")
  .refine((s) => !s.includes("*"), "wildcards are not permitted in v1.2-draft");

export function isValidScope(value: string): boolean {
  return typeof value === "string" && SCOPE_REGEX.test(value) && !value.includes("*");
}

/**
 * A non-normative starter vocabulary. NOT an allow-list — the schema accepts any
 * well-formed scope, because the set of things agents do is not ours to enumerate.
 * This exists so documentation and examples use consistent spellings.
 */
export const COMMON_SCOPES = [
  "agent:identity",
  "agent:read",
  "agent:communicate",
  "appointment:read",
  "appointment:create",
  "appointment:modify",
  "appointment:cancel",
  "data:read",
  "data:write",
  "payment:initiate",
  "payment:approve",
] as const;

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

/**
 * Optional bounds a principal can put on a grant beyond the scope list.
 *
 * Deliberately a small closed set rather than free-form policy. A constraint a relying
 * party does not understand is a constraint it cannot enforce, and a grant carrying an
 * unrecognized constraint MUST be treated as not permitted (see `evaluateAuthorization`)
 * rather than as unconstrained — fail closed, not open. A closed set keeps that
 * tractable; an open policy language would make "did you understand all of it?"
 * undecidable in practice.
 */
export const Constraint = z.discriminatedUnion("type", [
  /** The agent may act only towards these hostnames. */
  z.object({ type: z.literal("counterparty_domain"), domains: z.array(z.string().min(1)).min(1).max(32) }).strict(),
  /** Monetary ceiling, minor units, as a STRING — §5: no JSON numbers in this protocol. */
  z
    .object({ type: z.literal("max_value"), currency: z.string().regex(/^[A-Z]{3}$/), amount_minor: z.string().regex(/^\d{1,18}$/) })
    .strict(),
  /** Maximum number of times the grant may be exercised, as a string for the same reason. */
  z.object({ type: z.literal("max_uses"), count: z.string().regex(/^\d{1,9}$/) }).strict(),
  /** Human confirmation required before the action completes. */
  z.object({ type: z.literal("requires_human_confirmation") }).strict(),
]);
export type Constraint = z.infer<typeof Constraint>;

/** Constraint types this build knows how to evaluate. Anything else fails closed. */
export const UNDERSTOOD_CONSTRAINTS = new Set([
  "counterparty_domain",
  "max_value",
  "max_uses",
  "requires_human_confirmation",
]);

// ---------------------------------------------------------------------------
// AuthorizationGrant
// ---------------------------------------------------------------------------

const grantShape = {
  $schema: z.literal(GRANT_SCHEMA_ID),
  grant_id: z.string().regex(GRANT_ID_REGEX, "must match grant:<ULID>"),
  /** Who authorizes. */
  principal: PrincipalId,
  /** Which agent. */
  subject: AgentId,
  /**
   * What it may do. Non-empty by schema: an unconstrained grant is just a second
   * principal, which is the same reasoning that makes `permitted_levels` mandatory in
   * the authority-delegation proposal.
   */
  scopes: z.array(Scope).min(1).max(64),
  constraints: z.array(Constraint).max(16).optional(),
  /** For what period. */
  not_before: Rfc3339Utc,
  expires_at: Rfc3339Utc,
  /** The principal key that signs this. */
  key_id: KeyId,
};

function grantRules(g: { not_before: string; expires_at: string; scopes: string[] }, ctx: z.RefinementCtx): void {
  if (!(Date.parse(g.expires_at) > Date.parse(g.not_before))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expires_at"], message: "expires_at must be after not_before" });
  }
  if (new Set(g.scopes).size !== g.scopes.length) {
    // A duplicated scope is never meaningful and is a cheap way to make two grants that
    // canonicalize differently while granting the same thing.
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scopes"], message: "scopes must not contain duplicates" });
  }
}

const AuthorizationGrantPayloadBase = z.object(grantShape).strict();
export const AuthorizationGrantPayload = AuthorizationGrantPayloadBase.superRefine(grantRules);
export type AuthorizationGrantPayload = z.infer<typeof AuthorizationGrantPayloadBase>;

const AuthorizationGrantBase = z.object({ ...grantShape, signature: Ed25519SignatureB64u }).strict();
export const AuthorizationGrant = AuthorizationGrantBase.superRefine(grantRules);
export type AuthorizationGrant = z.infer<typeof AuthorizationGrantBase>;

// ---------------------------------------------------------------------------
// Revocation
// ---------------------------------------------------------------------------

export const RevokesType = z.enum(["agent", "grant", "key", "assertion"]);
export type RevokesType = z.infer<typeof RevokesType>;

/** An enum, not free text: a reason is a machine-readable fact, and free text invites PII. */
export const RevocationReason = z.enum([
  "key_compromise",
  "superseded",
  "no_longer_authorized",
  "operator_request",
  "agent_retired",
  "issued_in_error",
  "unspecified",
]);
export type RevocationReason = z.infer<typeof RevocationReason>;

const revocationShape = {
  $schema: z.literal(REVOCATION_SCHEMA_ID),
  revocation_id: z.string().regex(REVOCATION_ID_REGEX, "must match revocation:<ULID>"),
  revokes: z.string().min(1),
  revokes_type: RevokesType,
  reason: RevocationReason,
  revoked_at: Rfc3339Utc,
  /** The key entitled to revoke this target. Correspondence is checked, not assumed. */
  key_id: KeyId,
};

const TARGET_PATTERN: Record<RevokesType, RegExp> = {
  agent: AGENT_ID_REGEX,
  grant: GRANT_ID_REGEX,
  key: KEY_ID_REGEX,
  assertion: ASSERTION_ID_REGEX,
};

function revocationRules(r: { revokes: string; revokes_type: RevokesType }, ctx: z.RefinementCtx): void {
  if (!TARGET_PATTERN[r.revokes_type].test(r.revokes)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["revokes"],
      message: `revokes does not match the identifier shape for revokes_type=${r.revokes_type}`,
    });
  }
}

const RevocationPayloadBase = z.object(revocationShape).strict();
export const RevocationPayload = RevocationPayloadBase.superRefine(revocationRules);
export type RevocationPayload = z.infer<typeof RevocationPayloadBase>;

const RevocationBase = z.object({ ...revocationShape, signature: Ed25519SignatureB64u }).strict();
export const Revocation = RevocationBase.superRefine(revocationRules);
export type Revocation = z.infer<typeof RevocationBase>;

/**
 * Which key role may revoke which kind of target.
 *
 * A registry that can revoke unilaterally is the same trust failure as one that can
 * grant unilaterally, pointed the other way — so revocation is SIGNED, and by the key
 * that actually controls the thing being revoked.
 */
export const REVOKER_ROLE: Record<RevokesType, KeyDocument["role"]> = {
  grant: "principal", // only the principal who granted it may withdraw it
  agent: "operator", // the agent's own operator key retires the agent
  key: "operator", // an operator retires their own key
  assertion: "authority", // only the authority that issued it may withdraw it
};
