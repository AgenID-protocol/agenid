import { describe, it, expect } from "vitest";
import { canonicalizeToBytes, generateKeyPair, signBytes, verifyBytes, b64uEncode, hex, generateAgentId, generateKeyId, makeKeyDocument } from "@agenid/core";
import { decodeSignature, decodePublicKey } from "../src/codec.js";

describe("verify_agent_manifest codec", () => {
  it("round-trips a base64url signature and hex public key to a valid verification", () => {
    const { privateKey, publicKey } = generateKeyPair();
    const payload = { hello: "world", n: 42 };
    const canonicalBytes = canonicalizeToBytes(payload);
    const sig = signBytes(privateKey, canonicalBytes);

    const sigDecoded = decodeSignature(b64uEncode(sig));
    const pubDecoded = decodePublicKey(hex(publicKey));

    expect(verifyBytes(pubDecoded, canonicalBytes, sigDecoded)).toBe(true);
  });

  it("also accepts a hex-encoded signature and a base64url public key", () => {
    const { privateKey, publicKey } = generateKeyPair();
    const payload = { a: 1, b: [1, 2, 3] };
    const canonicalBytes = canonicalizeToBytes(payload);
    const sig = signBytes(privateKey, canonicalBytes);

    const sigDecoded = decodeSignature(hex(sig));
    const pubDecoded = decodePublicKey(b64uEncode(publicKey));

    expect(verifyBytes(pubDecoded, canonicalBytes, sigDecoded)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const { privateKey, publicKey } = generateKeyPair();
    const canonicalBytes = canonicalizeToBytes({ hello: "world" });
    const sig = signBytes(privateKey, canonicalBytes);
    const tamperedBytes = canonicalizeToBytes({ hello: "tampered" });

    const sigDecoded = decodeSignature(b64uEncode(sig));
    const pubDecoded = decodePublicKey(hex(publicKey));

    expect(verifyBytes(pubDecoded, tamperedBytes, sigDecoded)).toBe(false);
  });
});

describe("generate_keypair building blocks", () => {
  it("produces a key document that carries the operator role and matching public key", () => {
    const { publicKey } = generateKeyPair();
    const agentId = generateAgentId();
    const keyId = generateKeyId();
    const doc = makeKeyDocument({
      keyId,
      publicKey,
      role: "operator",
      controller: agentId,
      createdAt: "2026-01-01T00:00:00Z",
    });
    expect(doc.role).toBe("operator");
    expect(doc.controller).toBe(agentId);
    expect(doc.key_id).toBe(keyId);
    expect(doc.public_key_b64u).toBe(b64uEncode(publicKey));
  });
});
