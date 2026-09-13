/**
 * AgenID v1.1.1 Final Protocol Specification — §8 deterministic test vectors.
 *
 * The fixture file was produced by an INDEPENDENT implementation (Python
 * `rfc8785` + pyca `cryptography`). Every assertion here is therefore a
 * cross-implementation conformance check, not a self-consistency check.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  canonicalize,
  canonicalizeToBytes,
  canonicalizeJsonText,
  hex,
  keyPairFromLabel,
  b64uEncode,
  b64uDecode,
  manifestDigestHex,
  makeKeyDocument,
  signManifestProof,
  signVerificationAssertion,
  verifyManifestProof,
  verifyVerificationAssertion,
  signingInputOf,
  signBytes,
  verifyBytes,
  sha256,
  InvalidNumberDomainError,
  type SigningKey,
} from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
const V = JSON.parse(readFileSync(join(here, "fixtures/v1_1_1_vectors.json"), "utf8"));

const NOW = "2026-09-20T00:00:00Z"; // inside every validity window in §8

// ---- Keys (§8.1) ------------------------------------------------------------
const op = keyPairFromLabel(V.operator_key.seed_label);
const au = keyPairFromLabel(V.authority_key.seed_label);

const opDoc = makeKeyDocument({
  keyId: V.operator_key.key_id,
  publicKey: op.publicKey,
  role: "operator",
  controller: V.manifest.input.agent_id,
  createdAt: "2026-09-01T00:00:00Z",
});
const auDoc = makeKeyDocument({
  keyId: V.authority_key.key_id,
  publicKey: au.publicKey,
  role: "authority",
  controller: V.verification_assertion.payload_input.authority,
  createdAt: "2026-09-01T00:00:00Z",
});
const opKey: SigningKey = { privateKey: op.privateKey, document: opDoc };
const auKey: SigningKey = { privateKey: au.privateKey, document: auDoc };

describe("§8.1 seed key derivation", () => {
  it("operator key matches spec", () => {
    expect(hex(op.privateKey)).toBe(V.operator_key.private_hex);
    expect(hex(op.publicKey)).toBe(V.operator_key.public_hex);
    expect(b64uEncode(op.publicKey)).toBe(V.operator_key.public_b64u);
  });
  it("authority key matches spec", () => {
    expect(hex(au.privateKey)).toBe(V.authority_key.private_hex);
    expect(hex(au.publicKey)).toBe(V.authority_key.public_hex);
    expect(b64uEncode(au.publicKey)).toBe(V.authority_key.public_b64u);
  });
  it("key lengths are 32 bytes", () => {
    expect(op.publicKey.length).toBe(32);
    expect(au.publicKey.length).toBe(32);
  });
});

describe("§8.2 manifest canonicalization and digest", () => {
  it("canonical UTF-8 matches the independent implementation byte-for-byte", () => {
    expect(canonicalize(V.manifest.input)).toBe(V.manifest.canonical_utf8);
    expect(hex(canonicalizeToBytes(V.manifest.input))).toBe(V.manifest.canonical_hex);
  });
  it("SHA-256 digest is 81ba2680…ab5d", () => {
    expect(manifestDigestHex(V.manifest.input)).toBe("81ba268016595373a12091598403eb1d099b214faed04fdabb5bdb47b473ab5d");
    expect(manifestDigestHex(V.manifest.input)).toBe(V.manifest.sha256);
  });
});

describe("§8.3 ManifestProof (operator-signed)", () => {
  const proof = signManifestProof(V.manifest.input, opKey, {
    createdAt: V.manifest_proof.payload_input.created_at,
    expiresAt: V.manifest_proof.payload_input.expires_at,
  });
  it("signing input is the exact canonical bytes from the spec", () => {
    expect(new TextDecoder().decode(signingInputOf(proof))).toBe(V.manifest_proof.signing_input_utf8);
    expect(hex(signingInputOf(proof))).toBe(V.manifest_proof.signing_input_hex);
  });
  it("Ed25519 signature matches f1b9a811…260c exactly", () => {
    expect(hex(b64uDecode(proof.signature))).toBe(V.manifest_proof.signature_hex);
    expect(proof.signature).toBe(V.manifest_proof.signature_b64u);
    expect(proof.signature.startsWith("8bmoEQHb")).toBe(true);
  });
  it("signed object equals the spec's signed object", () => {
    expect(proof).toEqual(V.manifest_proof.signed_object);
  });
  it("verifies → DECLARED", () => {
    const r = verifyManifestProof(proof, V.manifest.input, opDoc, { now: NOW });
    expect(r).toMatchObject({ ok: true, claimState: "DECLARED" });
  });
  it("the spec's signed object (not ours) verifies with our verifier", () => {
    const r = verifyManifestProof(V.manifest_proof.signed_object, V.manifest.input, opDoc, { now: NOW });
    expect(r.ok).toBe(true);
  });
});

describe("§8.4 VerificationAssertion (authority-signed)", () => {
  const assertion = signVerificationAssertion(V.verification_assertion.payload_input, auKey);
  it("signing input is the exact canonical bytes from the spec", () => {
    expect(new TextDecoder().decode(signingInputOf(assertion))).toBe(V.verification_assertion.signing_input_utf8);
    expect(hex(signingInputOf(assertion))).toBe(V.verification_assertion.signing_input_hex);
  });
  it("Ed25519 signature matches 80a0e77a…230e exactly", () => {
    expect(hex(b64uDecode(assertion.signature))).toBe(V.verification_assertion.signature_hex);
    expect(assertion.signature).toBe(V.verification_assertion.signature_b64u);
    expect(assertion.signature.startsWith("gKDnej0d")).toBe(true);
  });
  it("signed object equals the spec's signed object", () => {
    expect(assertion).toEqual(V.verification_assertion.signed_object);
  });
  it("verifies → VERIFIED for exactly the claim/level/scope", () => {
    const r = verifyVerificationAssertion(assertion, auDoc, { now: NOW, currentManifest: V.manifest.input });
    expect(r).toMatchObject({
      ok: true,
      claimState: "VERIFIED",
      details: { level: "L2_DOMAIN_VERIFIED", scope: "domain_control_only", claim: { type: "domain_control", domain: "acmemedical.com" } },
    });
  });
});

describe("§8.5 verifier-side reconstruction", () => {
  it("stripping `signature` from the signed object re-derives the signing input byte-for-byte", () => {
    expect(hex(signingInputOf(V.manifest_proof.signed_object))).toBe(V.manifest_proof.signing_input_hex);
    expect(hex(signingInputOf(V.verification_assertion.signed_object))).toBe(V.verification_assertion.signing_input_hex);
  });
});

describe("§8.6 negative vectors", () => {
  const assertion = V.verification_assertion.signed_object;
  const proof = V.manifest_proof.signed_object;

  it("a) tampered claim level (L2→L3) is rejected", () => {
    // Raw-bytes check, exactly as the spec vector was executed:
    const tampered = { ...V.verification_assertion.payload_input, level: "L3_ORGANIZATION_VERIFIED" };
    expect(verifyBytes(au.publicKey, canonicalizeToBytes(tampered), b64uDecode(assertion.signature))).toBe(false);
    // Full-procedure check: the schema also rejects L3 with a domain_control claim, and the signature fails.
    const r = verifyVerificationAssertion({ ...assertion, level: "L3_ORGANIZATION_VERIFIED" }, auDoc, { now: NOW });
    expect(r.ok).toBe(false);
  });

  it("b) assertion verified under the OPERATOR key is rejected (role substitution)", () => {
    expect(verifyBytes(op.publicKey, signingInputOf(assertion), b64uDecode(assertion.signature))).toBe(false);
    // Procedure-level: a schema-valid OPERATOR key document presented under the assertion's key_id
    // is refused on ROLE, before any signature math (§7.3).
    const operatorKeyUnderAssertionId = { ...opDoc, key_id: assertion.key_id };
    const r = verifyVerificationAssertion(assertion, operatorKeyUnderAssertionId, { now: NOW });
    expect(r).toMatchObject({ ok: false, code: "key_role_mismatch" });
    // And a document that lies about its role/controller shape is not even schema-valid.
    const malformed = { ...opDoc, key_id: assertion.key_id, controller: assertion.authority };
    expect(verifyVerificationAssertion(assertion, malformed, { now: NOW })).toMatchObject({ ok: false, code: "schema_invalid" });
  });

  it("c) manifest proof verified under the AUTHORITY key is rejected (role substitution)", () => {
    expect(verifyBytes(au.publicKey, signingInputOf(proof), b64uDecode(proof.signature))).toBe(false);
    const authorityKeyUnderProofId = { ...auDoc, key_id: proof.key_id };
    const r = verifyManifestProof(proof, V.manifest.input, authorityKeyUnderProofId, { now: NOW });
    expect(r).toMatchObject({ ok: false, code: "key_role_mismatch" });
  });

  it("d) manifest digest mismatch is detected before any signature math", () => {
    const m2 = structuredClone(V.manifest.input);
    m2.disclosure.human_escalation = false;
    expect(manifestDigestHex(m2)).not.toBe(V.manifest.sha256);
    const r = verifyManifestProof(proof, m2, opDoc, { now: NOW });
    expect(r).toMatchObject({ ok: false, code: "manifest_digest_mismatch" });
    const r2 = verifyVerificationAssertion(assertion, auDoc, { now: NOW, currentManifest: m2 });
    expect(r2).toMatchObject({ ok: false, code: "assertion_not_applicable_to_current_manifest" });
  });

  it("e) including the `signature` member in the signing input fails verification", () => {
    const wrongInput = canonicalizeToBytes(assertion); // signature NOT stripped
    expect(verifyBytes(au.publicKey, wrongInput, b64uDecode(assertion.signature))).toBe(false);
  });

  it("f) member order does not affect canonical bytes", () => {
    const m = V.manifest.input;
    const shuffled = { disclosure: m.disclosure, purpose: m.purpose, agent_id: m.agent_id, ownership: m.ownership, identity: m.identity, manifest_version: m.manifest_version };
    expect(canonicalize(shuffled)).toBe(V.manifest.canonical_utf8);
  });

  it("g) expired / not-yet-valid windows are enforced independently of the signature", () => {
    expect(verifyManifestProof(proof, V.manifest.input, opDoc, { now: "2027-01-01T00:00:00Z" })).toMatchObject({ ok: false, code: "expired" });
    expect(verifyManifestProof(proof, V.manifest.input, opDoc, { now: "2026-01-01T00:00:00Z" })).toMatchObject({ ok: false, code: "not_yet_valid" });
  });

  it("h) a key revoked before signing time is rejected even though the signature is valid", () => {
    const revoked = { ...opDoc, status: "revoked", revoked_at: "2026-09-01T12:00:00Z" };
    expect(verifyManifestProof(proof, V.manifest.input, revoked, { now: NOW })).toMatchObject({ ok: false, code: "key_not_active_at_signing_time" });
  });
});

describe("§8.7 adversarial canonicalization vectors", () => {
  const A = V.adversarial_canonicalization;
  for (const name of ["numbers", "unicode", "sort_order", "empty_and_null"] as const) {
    it(`${name}: canonical bytes and SHA-256 match the independent implementation`, () => {
      const bytes = canonicalizeToBytes(A[name].input);
      expect(new TextDecoder().decode(bytes)).toBe(A[name].canonical_utf8);
      if (A[name].canonical_hex) expect(hex(bytes)).toBe(A[name].canonical_hex);
      expect(hex(sha256(bytes))).toBe(A[name].sha256);
    });
  }
  it("numbers: 1.0→1, -0.0→0, 1e21→1e+21, 1e-7→1e-7", () => {
    expect(canonicalize({ b: 1.0, f: -0.0, c: 1e21, e: 1e-7, d: 0.000001 })).toBe('{"b":1,"c":1e+21,"d":0.000001,"e":1e-7,"f":0}');
  });
  it("sort order is by UTF-16 code units: 10 < 9 < B < a < aa < ab < b < é", () => {
    // Inspect the canonical TEXT directly — JS own-property order would reorder "9"/"10" after a re-parse.
    const keysInOrder = [...canonicalize(A.sort_order.input).matchAll(/"([^"]+)":/g)].map((m) => m[1]);
    expect(keysInOrder).toEqual(["10", "9", "B", "a", "aa", "ab", "b", "é"]);
  });
  it("number-domain rule is defined on the canonical token (spec §5 erratum): 1e20 rejected, 1e21 accepted", () => {
    expect(() => canonicalize({ x: 1e20 })).toThrow(InvalidNumberDomainError); // token "100000000000000000000"
    expect(canonicalize({ x: 1e21 })).toBe('{"x":1e+21}'); // exponent form is unambiguous
    expect(canonicalize({ x: 1e100 })).toBe('{"x":1e+100}');
  });
  it("text layer: integer literals above 2^53-1 are rejected before JSON.parse can round them", () => {
    expect(() => canonicalizeJsonText('{"x": 9007199254740993}')).toThrow(InvalidNumberDomainError);
    expect(() => canonicalizeJsonText('{"x": 100000000000000000000}')).toThrow(InvalidNumberDomainError);
    expect(new TextDecoder().decode(canonicalizeJsonText('{"x": 9007199254740991, "y": 1e21}'))).toBe('{"x":9007199254740991,"y":1e+21}');
  });
  it("unicode: DEL and NBSP are emitted raw, control chars escaped, non-ASCII unescaped", () => {
    const out = canonicalize(A.unicode.input);
    expect(out).toContain('"del":""');
    expect(out).toContain('"nbsp":" "');
    expect(out).toContain('"control":"line\\nbreak\\ttab"');
    expect(out).toContain('"emoji":"🔐"');
    expect(out).not.toContain("\\u");
  });
  it("rejects integers ≥ 2^53 (InvalidNumberDomainError)", () => {
    expect(() => canonicalize({ x: 9007199254740992 })).toThrow(InvalidNumberDomainError);
    expect(() => canonicalize({ x: 100000000000000000000 })).toThrow(InvalidNumberDomainError);
    expect(() => canonicalize({ x: -9007199254740992 })).toThrow(InvalidNumberDomainError);
    expect(() => canonicalize({ x: 9007199254740991 })).not.toThrow();
  });
  it("rejects NaN and ±Infinity (InvalidNumberDomainError)", () => {
    expect(() => canonicalize({ x: NaN })).toThrow(InvalidNumberDomainError);
    expect(() => canonicalize({ x: Infinity })).toThrow(InvalidNumberDomainError);
    expect(() => canonicalize({ x: -Infinity })).toThrow(InvalidNumberDomainError);
  });
  it("rejects BigInt", () => {
    expect(() => canonicalize({ x: 10n ** 20n })).toThrow(InvalidNumberDomainError);
  });
});

describe("§7 signing construction is pure Ed25519 over the canonical bytes (no pre-hash)", () => {
  it("signBytes over the spec signing input reproduces the spec signature", () => {
    const sig = signBytes(op.privateKey, new TextEncoder().encode(V.manifest_proof.signing_input_utf8));
    expect(hex(sig)).toBe(V.manifest_proof.signature_hex);
  });
  it("signing a SHA-256 of the input (Ed25519ph-style mistake) does NOT reproduce the spec signature", () => {
    const wrong = signBytes(op.privateKey, sha256(new TextEncoder().encode(V.manifest_proof.signing_input_utf8)));
    expect(hex(wrong)).not.toBe(V.manifest_proof.signature_hex);
  });
});
