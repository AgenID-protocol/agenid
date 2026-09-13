/**
 * AgenID v1.1.1 §7 — the ONE signing construction, and §7.1–7.3 verification.
 *
 *   Signed object S  →  strip "signature"  →  P
 *   signing_input = RFC 8785 JCS(P) as UTF-8 bytes
 *   sig = Ed25519.Sign(sk, signing_input)              (PureEdDSA, RFC 8032; NO pre-hash)
 *   S   = P + { signature: base64url_nopad(sig) }
 *
 * Node's `crypto.sign(null, data, key)` with an Ed25519 key is PureEdDSA
 * (the algorithm argument MUST be null/undefined for Ed25519 — passing a hash
 * name is an error, which is exactly the property we want: there is no way to
 * accidentally produce Ed25519ph here).
 *
 * Verification outcomes are VALUES (`VerifyResult`), never exceptions, so a
 * caller's decision is deterministic and every failure has a stable code that
 * maps 1:1 to the procedure steps in §7.1 / §7.2.
 */

import { createHash, createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify, randomBytes } from "node:crypto";
import type { KeyObject } from "node:crypto";
import { canonicalizeToBytes } from "./jcs.js";
import {
  KeyDocument,
  Manifest,
  ManifestProof,
  ManifestProofPayload,
  VerificationAssertion,
  VerificationAssertionPayload,
  MANIFEST_PROOF_SCHEMA_ID,
  parseOrThrow,
} from "./schemas.js";
import { KeyRoleError, AgenIdError } from "./errors.js";

// ---------------------------------------------------------------------------
// Raw <-> DER helpers (RFC 8410 OIDs for Ed25519)
// ---------------------------------------------------------------------------

const PKCS8_ED25519_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
const SPKI_ED25519_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function b64uEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
export function b64uDecode(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}
export function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
export function fromHex(h: string): Uint8Array {
  return new Uint8Array(Buffer.from(h, "hex"));
}

export function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

function privateKeyFromSeed(seed: Uint8Array): KeyObject {
  if (seed.length !== 32) throw new AgenIdError("invalid_seed", "Ed25519 seed must be exactly 32 bytes");
  return createPrivateKey({ key: Buffer.concat([PKCS8_ED25519_PREFIX, Buffer.from(seed)]), format: "der", type: "pkcs8" });
}
function publicKeyFromRaw(pub: Uint8Array): KeyObject {
  if (pub.length !== 32) throw new AgenIdError("invalid_public_key", "Ed25519 public key must be exactly 32 bytes");
  return createPublicKey({ key: Buffer.concat([SPKI_ED25519_PREFIX, Buffer.from(pub)]), format: "der", type: "spki" });
}
function rawPublicFromPrivate(sk: KeyObject): Uint8Array {
  const spki = createPublicKey(sk).export({ format: "der", type: "spki" }) as Buffer;
  return new Uint8Array(spki.subarray(spki.length - 32));
}

// ---------------------------------------------------------------------------
// Key material
// ---------------------------------------------------------------------------

export interface Ed25519KeyPair {
  /** 32-byte seed (the RFC 8032 private key). Keep secret. */
  privateKey: Uint8Array;
  /** 32-byte public key. */
  publicKey: Uint8Array;
}

/** Deterministic key pair from a 32-byte seed. Used for the §8 vectors; production keys use generateKeyPair(). */
export function keyPairFromSeed(seed: Uint8Array): Ed25519KeyPair {
  const sk = privateKeyFromSeed(seed);
  return { privateKey: new Uint8Array(seed), publicKey: rawPublicFromPrivate(sk) };
}

/** §8: seed = SHA-256(label). Test-vector convenience; never for production keys. */
export function keyPairFromLabel(label: string): Ed25519KeyPair {
  return keyPairFromSeed(sha256(new TextEncoder().encode(label)));
}

export function generateKeyPair(): Ed25519KeyPair {
  return keyPairFromSeed(new Uint8Array(randomBytes(32)));
}

/** A private key bound to its published key document (§9.1). Signing requires both. */
export interface SigningKey {
  privateKey: Uint8Array;
  document: KeyDocument;
}

/** Build a key document for a key pair. `created_at` must be supplied explicitly (no hidden clock reads in protocol code). */
export function makeKeyDocument(args: {
  keyId: string;
  publicKey: Uint8Array;
  role: KeyDocument["role"];
  controller: string;
  createdAt: string;
}): KeyDocument {
  return parseOrThrow(
    KeyDocument,
    {
      key_id: args.keyId,
      key_type: "Ed25519",
      public_key_b64u: b64uEncode(args.publicKey),
      role: args.role,
      controller: args.controller,
      created_at: args.createdAt,
      status: "active",
      retired_at: null,
      revoked_at: null,
    },
    "KeyDocument",
  );
}

// ---------------------------------------------------------------------------
// Low-level: sign / verify canonical bytes
// ---------------------------------------------------------------------------

/** Pure Ed25519 over already-canonical bytes. Exposed for tests and for callers that have pre-canonicalized input. */
export function signBytes(privateKey: Uint8Array, signingInput: Uint8Array): Uint8Array {
  const sk = privateKeyFromSeed(privateKey);
  return new Uint8Array(nodeSign(null, Buffer.from(signingInput), sk));
}

export function verifyBytes(publicKey: Uint8Array, signingInput: Uint8Array, signature: Uint8Array): boolean {
  if (signature.length !== 64) return false;
  try {
    return nodeVerify(null, Buffer.from(signingInput), publicKeyFromRaw(publicKey), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** §7 step 1–2: strip `signature`, canonicalize. The ONLY way signing input is produced in this package. */
export function signingInputOf(signedOrPayload: Record<string, unknown>): Uint8Array {
  const { signature: _omit, ...payload } = signedOrPayload;
  void _omit;
  return canonicalizeToBytes(payload);
}

/** SHA-256 over RFC 8785 canonical Manifest bytes, hex (§6.1 / §8.2). */
export function manifestDigestHex(manifest: Manifest): string {
  return hex(sha256(canonicalizeToBytes(manifest)));
}

// ---------------------------------------------------------------------------
// Verification result type
// ---------------------------------------------------------------------------

export type VerifyFailureCode =
  | "schema_invalid"
  | "manifest_digest_mismatch"
  | "assertion_not_applicable_to_current_manifest"
  | "key_id_mismatch"
  | "key_role_mismatch"
  | "key_controller_mismatch"
  | "key_not_active_at_signing_time"
  | "not_yet_valid"
  | "expired"
  | "signature_invalid";

export type VerifyResult =
  | { ok: true; claimState: "DECLARED" | "VERIFIED"; details?: Record<string, unknown> }
  | { ok: false; code: VerifyFailureCode; message: string };

function fail(code: VerifyFailureCode, message: string): VerifyResult {
  return { ok: false, code, message };
}

/** Key status check at a given instant (§7 step 4, §9.6). */
function keyActiveAt(doc: KeyDocument, atIso: string): boolean {
  const at = Date.parse(atIso);
  if (doc.revoked_at !== null && at >= Date.parse(doc.revoked_at)) return false;
  if (doc.retired_at !== null && at >= Date.parse(doc.retired_at)) return false;
  if (doc.status === "revoked" && doc.revoked_at === null) return false;
  return true;
}

// ---------------------------------------------------------------------------
// §6.2 ManifestProof — sign / verify
// ---------------------------------------------------------------------------

export interface SignManifestProofOptions {
  createdAt: string;
  expiresAt: string;
}

/**
 * Operator signs a self-declaration over `manifest`. Throws KeyRoleError if the
 * key is not an operator key controlled by `manifest.agent_id` — a signing-time
 * guard; verification independently re-checks (§7.3).
 */
export function signManifestProof(manifestInput: unknown, operatorKey: SigningKey, opts: SignManifestProofOptions): ManifestProof {
  const manifest = parseOrThrow(Manifest, manifestInput, "Manifest");
  const doc = parseOrThrow(KeyDocument, operatorKey.document, "operator KeyDocument");
  if (doc.role !== "operator") throw new KeyRoleError(`ManifestProof must be signed by an operator key (got role=${doc.role})`);
  if (doc.controller !== manifest.agent_id) {
    throw new KeyRoleError(`operator key controller ${doc.controller} does not control ${manifest.agent_id}`);
  }
  const payload = parseOrThrow(
    ManifestProofPayload,
    {
      $schema: MANIFEST_PROOF_SCHEMA_ID,
      proof_type: "manifest_self_declaration",
      agent_id: manifest.agent_id,
      manifest_version: manifest.manifest_version,
      manifest_digest: { alg: "sha-256", value: manifestDigestHex(manifest) },
      key_id: doc.key_id,
      created_at: opts.createdAt,
      expires_at: opts.expiresAt,
    },
    "ManifestProofPayload",
  );
  const sig = signBytes(operatorKey.privateKey, signingInputOf(payload));
  return parseOrThrow(ManifestProof, { ...payload, signature: b64uEncode(sig) }, "ManifestProof");
}

export interface VerifyOptions {
  /** RFC 3339 instant to evaluate validity windows against. Required — protocol code never reads a hidden clock. */
  now: string;
}

/** §7.1 — Verify a ManifestProof against a manifest and the operator's key document. Result is DECLARED at most. */
export function verifyManifestProof(
  proofInput: unknown,
  manifestInput: unknown,
  operatorKeyDoc: unknown,
  opts: VerifyOptions,
): VerifyResult {
  const p = ManifestProof.safeParse(proofInput);
  if (!p.success) return fail("schema_invalid", `ManifestProof: ${p.error.issues.map((i) => i.message).join("; ")}`);
  const m = Manifest.safeParse(manifestInput);
  if (!m.success) return fail("schema_invalid", `Manifest: ${m.error.issues.map((i) => i.message).join("; ")}`);
  const k = KeyDocument.safeParse(operatorKeyDoc);
  if (!k.success) return fail("schema_invalid", `KeyDocument: ${k.error.issues.map((i) => i.message).join("; ")}`);
  const proof = p.data;
  const manifest = m.data;
  const key = k.data;

  // Step 2 — digest binding, before any signature math.
  const digest = manifestDigestHex(manifest);
  if (digest !== proof.manifest_digest.value || manifest.agent_id !== proof.agent_id || manifest.manifest_version !== proof.manifest_version) {
    return fail("manifest_digest_mismatch", "manifest does not match the digest/agent/version bound by this proof");
  }
  // Step 3 — key identity, role, controller.
  if (key.key_id !== proof.key_id) return fail("key_id_mismatch", `proof.key_id ${proof.key_id} != supplied key ${key.key_id}`);
  if (key.role !== "operator") return fail("key_role_mismatch", `ManifestProof requires role=operator, key has role=${key.role}`);
  if (key.controller !== proof.agent_id) return fail("key_controller_mismatch", `key controller ${key.controller} != ${proof.agent_id}`);
  // Step 4 — key active when the proof was created.
  if (!keyActiveAt(key, proof.created_at)) return fail("key_not_active_at_signing_time", "key was retired/revoked before proof.created_at");
  // Step 5 — validity window.
  const now = Date.parse(opts.now);
  if (now < Date.parse(proof.created_at)) return fail("not_yet_valid", "now < created_at");
  if (now > Date.parse(proof.expires_at)) return fail("expired", "now > expires_at");
  // Step 6 — signature.
  const ok = verifyBytes(b64uDecode(key.public_key_b64u), signingInputOf(proof), b64uDecode(proof.signature));
  if (!ok) return fail("signature_invalid", "Ed25519 signature does not verify over canonical payload");
  // Step 7.
  return { ok: true, claimState: "DECLARED", details: { agent_id: proof.agent_id, manifest_digest: digest } };
}

// ---------------------------------------------------------------------------
// §6.3 VerificationAssertion — sign / verify
// ---------------------------------------------------------------------------

/**
 * Authority signs an assertion. `payloadInput` is the full unsigned assertion
 * (all §6.3 members except `signature`). Throws KeyRoleError if the key is not
 * an authority key controlled by `payload.authority`, or if payload.key_id does
 * not name this key.
 */
export function signVerificationAssertion(payloadInput: unknown, authorityKey: SigningKey): VerificationAssertion {
  const payload = parseOrThrow(VerificationAssertionPayload, payloadInput, "VerificationAssertionPayload");
  const doc = parseOrThrow(KeyDocument, authorityKey.document, "authority KeyDocument");
  if (doc.role !== "authority") throw new KeyRoleError(`VerificationAssertion must be signed by an authority key (got role=${doc.role})`);
  if (doc.controller !== payload.authority) {
    throw new KeyRoleError(`authority key controller ${doc.controller} != assertion.authority ${payload.authority}`);
  }
  if (doc.key_id !== payload.key_id) throw new KeyRoleError(`assertion.key_id ${payload.key_id} does not name the signing key ${doc.key_id}`);
  const sig = signBytes(authorityKey.privateKey, signingInputOf(payload));
  return parseOrThrow(VerificationAssertion, { ...payload, signature: b64uEncode(sig) }, "VerificationAssertion");
}

export interface VerifyAssertionOptions extends VerifyOptions {
  /**
   * The manifest the verifier is currently evaluating. If supplied and its
   * digest differs from the assertion's bound digest, the result is
   * `assertion_not_applicable_to_current_manifest` (the assertion may still be
   * cryptographically valid for an older version — §7.2 step 2').
   */
  currentManifest?: unknown;
}

/** §7.2 — Verify a VerificationAssertion against the authority's key document. Result is VERIFIED for exactly claim/level/scope. */
export function verifyVerificationAssertion(assertionInput: unknown, authorityKeyDoc: unknown, opts: VerifyAssertionOptions): VerifyResult {
  const a = VerificationAssertion.safeParse(assertionInput);
  if (!a.success) return fail("schema_invalid", `VerificationAssertion: ${a.error.issues.map((i) => i.message).join("; ")}`);
  const k = KeyDocument.safeParse(authorityKeyDoc);
  if (!k.success) return fail("schema_invalid", `KeyDocument: ${k.error.issues.map((i) => i.message).join("; ")}`);
  const assertion = a.data;
  const key = k.data;

  // Step 3' — key identity, role, controller. (Checked before the signature so a
  // role-substituted key is rejected for the *right* reason even if its math would fail anyway.)
  if (key.key_id !== assertion.key_id) return fail("key_id_mismatch", `assertion.key_id ${assertion.key_id} != supplied key ${key.key_id}`);
  if (key.role !== "authority") return fail("key_role_mismatch", `VerificationAssertion requires role=authority, key has role=${key.role}`);
  if (key.controller !== assertion.authority) return fail("key_controller_mismatch", `key controller ${key.controller} != ${assertion.authority}`);
  // Step 4 — key active at verified_at (the assertion's creation instant).
  if (!keyActiveAt(key, assertion.verified_at)) return fail("key_not_active_at_signing_time", "key was retired/revoked before verified_at");
  // Step 5' — window.
  const now = Date.parse(opts.now);
  if (now < Date.parse(assertion.verified_at)) return fail("not_yet_valid", "now < verified_at");
  if (now > Date.parse(assertion.expires_at)) return fail("expired", "now > expires_at");
  // Step 6 — signature over canonical payload (signature member stripped).
  const ok = verifyBytes(b64uDecode(key.public_key_b64u), signingInputOf(assertion), b64uDecode(assertion.signature));
  if (!ok) return fail("signature_invalid", "Ed25519 signature does not verify over canonical payload");
  // Step 2' — applicability to the manifest under evaluation (after signature so we can distinguish "forged" from "stale").
  if (opts.currentManifest !== undefined) {
    const m = Manifest.safeParse(opts.currentManifest);
    if (!m.success) return fail("schema_invalid", `currentManifest: ${m.error.issues.map((i) => i.message).join("; ")}`);
    if (manifestDigestHex(m.data) !== assertion.manifest_digest.value) {
      return fail("assertion_not_applicable_to_current_manifest", "assertion is bound to a different manifest version");
    }
  }
  return {
    ok: true,
    claimState: "VERIFIED",
    details: { subject: assertion.subject, level: assertion.level, claim: assertion.claim, scope: assertion.scope, authority: assertion.authority },
  };
}
