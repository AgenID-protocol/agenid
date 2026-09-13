import { describe, expect, it } from "vitest";
import {
  generateUlid,
  generateAgentId,
  generateKeyId,
  isValidUlid,
  isValidAgentId,
  isValidKeyId,
  assertValidKeyId,
  keyIdToWire,
  keyIdFromWire,
  keyResolverPath,
  keyResolverQuery,
  parseKeyReference,
  wellKnownKeysUrl,
  InvalidKeyIdError,
  Manifest,
  VerificationLevel,
  VerificationAssertionPayload,
  KeyDocument,
  KeysDocument,
  KEYS_SCHEMA_ID,
  RESERVED_MANIFEST_KEYS,
  keyPairFromLabel,
  makeKeyDocument,
  signManifestProof,
  KeyRoleError,
  type SigningKey,
} from "../src/index.js";

const AGENT = "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y";
const KEY = "agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE";

const validManifest = {
  manifest_version: "1.0",
  agent_id: AGENT,
  identity: { name: "Sarah" },
  ownership: { operator: "Acme Medical LLC", operator_domain: "acmemedical.com" },
  purpose: { summary: "Scheduling", channels: ["voice"] },
  disclosure: { is_ai: true, discloses_to_user: true, human_escalation: true },
};

describe("§2 identifiers / ULID", () => {
  it("generates 26-char Crockford ULIDs with a valid time prefix", () => {
    for (let i = 0; i < 200; i++) {
      const u = generateUlid();
      expect(u).toHaveLength(26);
      expect(isValidUlid(u)).toBe(true);
      expect(/[ILOU]/.test(u)).toBe(false);
    }
  });
  it("time prefix is monotonic with time", () => {
    const a = generateUlid(1_000_000_000_000).slice(0, 10);
    const b = generateUlid(1_000_000_000_001).slice(0, 10);
    expect(a < b).toBe(true);
  });
  it("rejects identifiers with excluded letters or wrong length", () => {
    expect(isValidAgentId("agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5I")).toBe(false); // I
    expect(isValidAgentId("agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5")).toBe(false); // 25 chars
    expect(isValidAgentId("retell:abc")).toBe(false);
    expect(isValidAgentId(AGENT)).toBe(true);
    expect(isValidAgentId(generateAgentId())).toBe(true);
  });
});

describe("§0.A / §9.2 key identifiers — fragment bug is structurally impossible", () => {
  it("logical form has no fragment and validates", () => {
    expect(isValidKeyId(KEY)).toBe(true);
    expect(isValidKeyId(generateKeyId())).toBe(true);
  });
  it("any '#' is rejected with invalid_key_id", () => {
    expect(() => assertValidKeyId("agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE#z1")).toThrow(InvalidKeyIdError);
    expect(() => parseKeyReference("01J8Z3M9Q4XK2P7VBN6TDR8HWE#z1")).toThrow(InvalidKeyIdError);
    expect(() => parseKeyReference("agenid%3Akey%3A01J8Z3M9Q4XK2P7VBN6TDR8HWE%23z1")).toThrow(InvalidKeyIdError);
    expect(isValidKeyId("agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE#z1")).toBe(false);
  });
  it("wire path and query forms round-trip to the same logical id", () => {
    expect(keyIdToWire(KEY)).toBe("01J8Z3M9Q4XK2P7VBN6TDR8HWE");
    expect(keyIdFromWire("01J8Z3M9Q4XK2P7VBN6TDR8HWE")).toBe(KEY);
    expect(keyResolverPath(KEY)).toBe("/v1/keys/01J8Z3M9Q4XK2P7VBN6TDR8HWE");
    expect(keyResolverQuery(KEY)).toBe("/v1/keys?key_id=agenid%3Akey%3A01J8Z3M9Q4XK2P7VBN6TDR8HWE");
    expect(parseKeyReference("01J8Z3M9Q4XK2P7VBN6TDR8HWE")).toBe(KEY);
    expect(parseKeyReference("agenid%3Akey%3A01J8Z3M9Q4XK2P7VBN6TDR8HWE")).toBe(KEY);
    expect(parseKeyReference(KEY)).toBe(KEY);
  });
  it("single /v1 prefix only", () => {
    expect(keyResolverPath(KEY)).not.toContain("/v1/v1");
  });
  it("well-known discovery URI is normative", () => {
    expect(wellKnownKeysUrl("acmemedical.com")).toBe("https://acmemedical.com/.well-known/agenid/keys.json");
  });
});

describe("§6.1 Manifest schema", () => {
  it("accepts a valid manifest", () => {
    expect(Manifest.safeParse(validManifest).success).toBe(true);
  });
  it("has no $schema member (it would change the normative digest)", () => {
    expect(Manifest.safeParse({ ...validManifest, $schema: "x" }).success).toBe(false);
  });
  it("rejects every reserved/unshipped key (additionalProperties:false)", () => {
    for (const k of RESERVED_MANIFEST_KEYS) {
      expect(Manifest.safeParse({ ...validManifest, [k]: "anything" }).success).toBe(false);
    }
  });
  it("rejects obvious secrets in free text", () => {
    expect(Manifest.safeParse({ ...validManifest, identity: { name: "Sarah", description: "key sk_live_abcdefghijklmnop" } }).success).toBe(false);
    expect(Manifest.safeParse({ ...validManifest, identity: { name: "AKIAABCDEFGHIJKLMNOP" } }).success).toBe(false);
  });
  it("rejects an invalid channel and an empty channel list", () => {
    expect(Manifest.safeParse({ ...validManifest, purpose: { summary: "x", channels: ["fax"] } }).success).toBe(false);
    expect(Manifest.safeParse({ ...validManifest, purpose: { summary: "x", channels: [] } }).success).toBe(false);
  });
});

describe("§11 verification levels", () => {
  it("L5_CONTINUOUSLY_MONITORED is not issuable in v1.1.1", () => {
    expect(VerificationLevel.safeParse("L5_CONTINUOUSLY_MONITORED").success).toBe(false);
    expect(VerificationLevel.options).toEqual(["L1_REGISTERED", "L2_DOMAIN_VERIFIED", "L3_ORGANIZATION_VERIFIED", "L4_DEPLOYMENT_VERIFIED"]);
  });
  it("level ↔ claim.type and subject_type ↔ L4 rules are enforced", () => {
    const base = {
      $schema: "https://agenid.org/schemas/v1.1.1/assertion.json",
      assertion_id: "assertion:01J8Z3P2K8VW4RN7XTQ6MYD5HC",
      subject: AGENT,
      subject_type: "agent",
      level: "L2_DOMAIN_VERIFIED",
      claim: { type: "domain_control", domain: "acmemedical.com" },
      authority: "agenid:authority:node-01",
      evidence: { type: "dns_txt_challenge", reference: "_agenid-challenge.acmemedical.com" },
      verified_at: "2026-09-13T06:00:00Z",
      expires_at: "2026-10-13T06:00:00Z",
      scope: "domain_control_only",
      manifest_digest: { alg: "sha-256", value: "81ba268016595373a12091598403eb1d099b214faed04fdabb5bdb47b473ab5d" },
      key_id: "agenid:key:01J8Z3NC5R7YT3W9KM2XQ4VJHB",
    };
    expect(VerificationAssertionPayload.safeParse(base).success).toBe(true);
    expect(VerificationAssertionPayload.safeParse({ ...base, level: "L3_ORGANIZATION_VERIFIED" }).success).toBe(false); // claim mismatch
    expect(VerificationAssertionPayload.safeParse({ ...base, subject_type: "deployment" }).success).toBe(false); // needs dep_ + L4
    expect(VerificationAssertionPayload.safeParse({ ...base, key_id: base.key_id + "#z1" }).success).toBe(false); // fragment
    expect(VerificationAssertionPayload.safeParse({ ...base, expires_at: "2026-09-13T05:00:00Z" }).success).toBe(false); // window
    expect(VerificationAssertionPayload.safeParse({ ...base, extra: 1 }).success).toBe(false); // strict
  });
});

describe("§9 key documents and role enforcement at signing time", () => {
  const op = keyPairFromLabel("AgenID v1.1.1 operator test key seed");
  it("KeyDocument enforces controller shape per role and status/timestamp consistency", () => {
    const doc = makeKeyDocument({ keyId: KEY, publicKey: op.publicKey, role: "operator", controller: AGENT, createdAt: "2026-09-01T00:00:00Z" });
    expect(KeyDocument.safeParse(doc).success).toBe(true);
    expect(KeyDocument.safeParse({ ...doc, role: "authority" }).success).toBe(false); // controller must be agenid:authority:*
    expect(KeyDocument.safeParse({ ...doc, status: "revoked" }).success).toBe(false); // revoked_at required
    expect(KeyDocument.safeParse({ ...doc, key_id: KEY + "#z1" }).success).toBe(false);
    expect(KeysDocument.safeParse({ $schema: KEYS_SCHEMA_ID, controller_domain: "acmemedical.com", keys: [doc] }).success).toBe(true);
  });
  it("an authority key cannot sign a ManifestProof; a foreign operator key cannot sign for another agent", () => {
    const authorityDoc = makeKeyDocument({ keyId: KEY, publicKey: op.publicKey, role: "authority", controller: "agenid:authority:node-01", createdAt: "2026-09-01T00:00:00Z" });
    const wrongRole: SigningKey = { privateKey: op.privateKey, document: authorityDoc };
    expect(() => signManifestProof(validManifest, wrongRole, { createdAt: "2026-09-13T00:00:00Z", expiresAt: "2026-12-12T00:00:00Z" })).toThrow(KeyRoleError);

    const foreignDoc = makeKeyDocument({ keyId: KEY, publicKey: op.publicKey, role: "operator", controller: "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Z", createdAt: "2026-09-01T00:00:00Z" });
    const foreign: SigningKey = { privateKey: op.privateKey, document: foreignDoc };
    expect(() => signManifestProof(validManifest, foreign, { createdAt: "2026-09-13T00:00:00Z", expiresAt: "2026-12-12T00:00:00Z" })).toThrow(KeyRoleError);
  });
});
