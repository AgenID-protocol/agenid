/**
 * AgenID v1.1.1 §6, §9, §11 — normative object schemas (runtime, via zod).
 *
 * Every object schema is `.strict()` (== JSON Schema `additionalProperties:false`).
 * Reserved-but-unshipped keys are therefore rejected by construction.
 *
 * NOTE on `$schema` and the Manifest: the specification's Manifest object (§6.1)
 * carries NO `$schema` member — the schema URI identifies the *schema document*,
 * not a member of the manifest. This is load-bearing: adding a `$schema` member
 * to the manifest would change its canonical bytes and break the normative
 * digest 81ba2680…ab5d (§8.2). The schema identifier is therefore exported as
 * MANIFEST_SCHEMA_ID rather than being a required member. ManifestProof and
 * VerificationAssertion DO carry `$schema` as a member, and it IS part of the
 * signing input (§7).
 *
 * No v1.1.1 schema field is a JSON number (§5 design rule): timestamps are
 * RFC 3339 strings, digests are hex strings, identifiers are strings.
 */

import { z } from "zod";
import {
  AGENT_ID_REGEX,
  ASSERTION_ID_REGEX,
  AUTHORITY_ID_REGEX,
  DEPLOYMENT_ID_REGEX,
  KEY_ID_REGEX,
  isValidHostname,
} from "./identifier.js";
import { SchemaValidationError } from "./errors.js";

export const SCHEMA_BASE = "https://agenid.com/schemas/v1.1.1" as const;
export const MANIFEST_SCHEMA_ID = `${SCHEMA_BASE}/manifest.json` as const;
export const MANIFEST_PROOF_SCHEMA_ID = `${SCHEMA_BASE}/manifest-proof.json` as const;
export const ASSERTION_SCHEMA_ID = `${SCHEMA_BASE}/assertion.json` as const;
export const KEYS_SCHEMA_ID = `${SCHEMA_BASE}/keys.json` as const;
export const AUTHORITIES_SCHEMA_ID = `${SCHEMA_BASE}/authorities.json` as const;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** RFC 3339 UTC timestamp with 'Z' suffix, second precision or fractional. */
export const Rfc3339Utc = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/, "must be RFC 3339 UTC with 'Z'")
  .refine((s) => !Number.isNaN(Date.parse(s)), "must be a real timestamp");

export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "must be 64 lowercase hex chars");

/** base64url, no padding, 64-byte Ed25519 signature → 86 chars. */
export const Ed25519SignatureB64u = z.string().regex(/^[A-Za-z0-9_-]{86}$/, "must be 86-char base64url (64 bytes)");

/** base64url, no padding, 32-byte Ed25519 public key → 43 chars. */
export const Ed25519PublicKeyB64u = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "must be 43-char base64url (32 bytes)");

export const AgentId = z.string().regex(AGENT_ID_REGEX, "must match agenid:<ULID>");
export const KeyId = z
  .string()
  .refine((s) => !s.includes("#"), "key_id must not contain a URI fragment (#)")
  .refine((s) => KEY_ID_REGEX.test(s), "must match agenid:key:<ULID>");
export const AssertionId = z.string().regex(ASSERTION_ID_REGEX, "must match assertion:<ULID>");
export const AuthorityId = z.string().regex(AUTHORITY_ID_REGEX, "must match agenid:authority:<name>");
export const DeploymentId = z.string().regex(DEPLOYMENT_ID_REGEX, "must match dep_<opaque>");
export const Hostname = z.string().refine(isValidHostname, "must be a valid hostname");

export const Digest = z
  .object({
    alg: z.literal("sha-256"),
    value: Sha256Hex,
  })
  .strict();

// ---------------------------------------------------------------------------
// §6.1 Manifest — DECLARED content only. Never signed directly.
// ---------------------------------------------------------------------------

export const Channel = z.enum(["voice", "sms", "chat", "email", "api"]);

/**
 * Prohibited-content rule (§9 of hardening draft, carried forward): free-text
 * fields must not carry secrets/credentials. This is a cheap structural check
 * for the most obvious patterns; it is NOT a substitute for review.
 */
const SECRET_PATTERNS = [
  /\bsk[-_](live|test)[-_][A-Za-z0-9]{8,}/i, // Stripe-style
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}/,
];
const noSecrets = (s: string) => !SECRET_PATTERNS.some((re) => re.test(s));
const FreeText = (max: number) =>
  z.string().min(1).max(max).refine(noSecrets, "field appears to contain a credential or secret");

export const Manifest = z
  .object({
    manifest_version: z.literal("1.0"),
    agent_id: AgentId,
    identity: z
      .object({
        name: FreeText(200),
        description: FreeText(1000).optional(),
      })
      .strict(),
    ownership: z
      .object({
        operator: FreeText(300),
        operator_domain: Hostname,
        contact: z.string().email().optional(),
      })
      .strict(),
    purpose: z
      .object({
        summary: FreeText(500),
        channels: z.array(Channel).min(1),
      })
      .strict(),
    disclosure: z
      .object({
        is_ai: z.boolean(),
        discloses_to_user: z.boolean(),
        human_escalation: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type Manifest = z.infer<typeof Manifest>;

/** Keys reserved for future versions; a v1.1.1 validator must reject them (strict() already does). */
export const RESERVED_MANIFEST_KEYS = [
  "platform",
  "permissions",
  "jurisdictions",
  "status",
  "change_history",
  "authorizations",
  "configuration_fingerprint",
] as const;

// ---------------------------------------------------------------------------
// §6.2 ManifestProof — Operator-signed (DECLARED only)
// ---------------------------------------------------------------------------

export const ManifestProofPayload = z
  .object({
    $schema: z.literal(MANIFEST_PROOF_SCHEMA_ID),
    proof_type: z.literal("manifest_self_declaration"),
    agent_id: AgentId,
    manifest_version: z.literal("1.0"),
    manifest_digest: Digest,
    key_id: KeyId,
    created_at: Rfc3339Utc,
    expires_at: Rfc3339Utc,
  })
  .strict()
  .refine((p) => Date.parse(p.expires_at) > Date.parse(p.created_at), {
    message: "expires_at must be after created_at",
    path: ["expires_at"],
  });
export type ManifestProofPayload = z.infer<typeof ManifestProofPayload>;

export const ManifestProof = ManifestProofPayload.innerType()
  .extend({ signature: Ed25519SignatureB64u })
  .strict()
  .refine((p) => Date.parse(p.expires_at) > Date.parse(p.created_at), {
    message: "expires_at must be after created_at",
    path: ["expires_at"],
  });
export type ManifestProof = z.infer<typeof ManifestProof>;

// ---------------------------------------------------------------------------
// §6.3 VerificationAssertion — Authority-signed (VERIFIED only)
// ---------------------------------------------------------------------------

export const VerificationLevel = z.enum([
  "L1_REGISTERED",
  "L2_DOMAIN_VERIFIED",
  "L3_ORGANIZATION_VERIFIED",
  "L4_DEPLOYMENT_VERIFIED",
  // L5_CONTINUOUSLY_MONITORED is a reserved NAME (§11). It is intentionally
  // absent from this enum so that it cannot be issued in v1.1.1.
]);
export type VerificationLevel = z.infer<typeof VerificationLevel>;

export const SubjectType = z.enum(["agent", "deployment"]);

export const Claim = z.discriminatedUnion("type", [
  z.object({ type: z.literal("registration") }).strict(),
  z.object({ type: z.literal("domain_control"), domain: Hostname }).strict(),
  z
    .object({
      type: z.literal("organization_identity"),
      legal_name: FreeText(300),
      jurisdiction: z.string().min(2).max(64).optional(),
    })
    .strict(),
  z.object({ type: z.literal("deployment_conformance"), deployment_id: DeploymentId }).strict(),
]);
export type Claim = z.infer<typeof Claim>;

export const EvidenceType = z.enum([
  "schema_validation",
  "dns_txt_challenge",
  "http_wellknown_challenge",
  "business_registry_match",
  "document_review",
  "deployment_sample_review",
]);

/** `reference` is a POINTER, never content (§17 privacy rule). Length-capped to discourage embedding evidence. */
export const Evidence = z
  .object({
    type: EvidenceType,
    reference: z.string().min(1).max(512),
  })
  .strict();

const assertionShape = {
  $schema: z.literal(ASSERTION_SCHEMA_ID),
  assertion_id: AssertionId,
  subject: z.string().min(1),
  subject_type: SubjectType,
  level: VerificationLevel,
  claim: Claim,
  authority: AuthorityId,
  evidence: Evidence,
  verified_at: Rfc3339Utc,
  expires_at: Rfc3339Utc,
  scope: z.string().min(1).max(128),
  manifest_digest: Digest,
  key_id: KeyId,
};

const LEVEL_CLAIM: Record<VerificationLevel, Claim["type"]> = {
  L1_REGISTERED: "registration",
  L2_DOMAIN_VERIFIED: "domain_control",
  L3_ORGANIZATION_VERIFIED: "organization_identity",
  L4_DEPLOYMENT_VERIFIED: "deployment_conformance",
};

const VerificationAssertionPayloadBase = z.object(assertionShape).strict();
export type VerificationAssertionPayload = z.infer<typeof VerificationAssertionPayloadBase>;

/** Cross-field rules from §6.3 / §11 that a flat schema cannot express. */
function assertionRules(a: VerificationAssertionPayload, ctx: z.RefinementCtx): void {
  const subjectOk = a.subject_type === "agent" ? AGENT_ID_REGEX.test(a.subject) : DEPLOYMENT_ID_REGEX.test(a.subject);
  if (!subjectOk) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["subject"],
      message: "subject must match subject_type (agenid:<ULID> for agent, dep_* for deployment)",
    });
  }
  if ((a.subject_type === "deployment") !== (a.level === "L4_DEPLOYMENT_VERIFIED")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["level"],
      message: "L4_DEPLOYMENT_VERIFIED is the only level for subject_type=deployment, and vice versa",
    });
  }
  if (!(Date.parse(a.expires_at) > Date.parse(a.verified_at))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expires_at"], message: "expires_at must be after verified_at" });
  }
  if (LEVEL_CLAIM[a.level] !== a.claim.type) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["claim"], message: "claim.type does not correspond to level (§11)" });
  }
}

export const VerificationAssertionPayload = VerificationAssertionPayloadBase.superRefine(assertionRules);

const VerificationAssertionBase = z.object({ ...assertionShape, signature: Ed25519SignatureB64u }).strict();
export type VerificationAssertion = z.infer<typeof VerificationAssertionBase>;
export const VerificationAssertion = VerificationAssertionBase.superRefine(assertionRules);

// ---------------------------------------------------------------------------
// §9.1 Key document, §9.3/9.4 keys.json, §9.5 authorities.json
// ---------------------------------------------------------------------------

export const KeyRole = z.enum(["operator", "authority"]);
export type KeyRole = z.infer<typeof KeyRole>;
export const KeyStatus = z.enum(["active", "retired", "revoked"]);
export type KeyStatus = z.infer<typeof KeyStatus>;

export const KeyDocument = z
  .object({
    key_id: KeyId,
    key_type: z.literal("Ed25519"),
    public_key_b64u: Ed25519PublicKeyB64u,
    role: KeyRole,
    controller: z.string().min(1),
    created_at: Rfc3339Utc,
    status: KeyStatus,
    retired_at: Rfc3339Utc.nullable(),
    revoked_at: Rfc3339Utc.nullable(),
  })
  .strict()
  .refine(
    (k) => (k.role === "operator" ? AGENT_ID_REGEX.test(k.controller) : AUTHORITY_ID_REGEX.test(k.controller)),
    { message: "controller must be agenid:<ULID> for role=operator or agenid:authority:<name> for role=authority", path: ["controller"] },
  )
  .refine((k) => (k.status === "retired") === (k.retired_at !== null) || k.status === "revoked", {
    message: "status=retired iff retired_at is set",
    path: ["retired_at"],
  })
  .refine((k) => (k.status === "revoked") === (k.revoked_at !== null), {
    message: "status=revoked iff revoked_at is set",
    path: ["revoked_at"],
  });
export type KeyDocument = z.infer<typeof KeyDocument>;

export const KeysDocument = z
  .object({
    $schema: z.literal(KEYS_SCHEMA_ID),
    controller_domain: Hostname,
    keys: z.array(KeyDocument).min(1),
  })
  .strict();
export type KeysDocument = z.infer<typeof KeysDocument>;

export const AuthorityEntry = z
  .object({
    authority_id: AuthorityId,
    authority_domain: Hostname,
    root_key_id: KeyId,
    root_public_key_b64u: Ed25519PublicKeyB64u,
  })
  .strict();

export const AuthoritiesDocument = z
  .object({
    $schema: z.literal(AUTHORITIES_SCHEMA_ID),
    authorities: z.array(AuthorityEntry).min(1),
  })
  .strict();
export type AuthoritiesDocument = z.infer<typeof AuthoritiesDocument>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse-or-throw with a protocol error type instead of a bare ZodError. */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, input: unknown, what: string): z.infer<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new SchemaValidationError(`${what} failed schema validation`, r.error.issues);
  }
  return r.data;
}
