/**
 * Browser-side Ed25519 key generation, JCS canonicalization, and ManifestProof signing.
 *
 * SECURITY INVARIANT: private keys are generated HERE (in the browser) and NEVER
 * leave the client. Only the public key, manifest, and signed proof are sent to
 * the server. This module uses @noble/curves for Ed25519 (pure JS, no Node deps)
 * and implements the subset of AgenID v1.1.1 JCS (§5) and signing (§7) needed
 * for the onboarding wizard.
 */
import { ed25519 } from "@noble/curves/ed25519";

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

export function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function b64uEncode(bytes: Uint8Array): string {
  const binStr = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binStr).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// RFC 8785 JCS — minimal browser-side implementation
// ---------------------------------------------------------------------------

function jcsSerialize(value: unknown, out: string[]): void {
  if (value === null) { out.push("null"); return; }
  switch (typeof value) {
    case "boolean": out.push(value ? "true" : "false"); return;
    case "number": {
      if (!Number.isFinite(value)) throw new Error("Non-finite number in JCS");
      out.push(JSON.stringify(value));
      return;
    }
    case "string": out.push(JSON.stringify(value)); return;
    case "object": {
      if (Array.isArray(value)) {
        out.push("[");
        for (let i = 0; i < value.length; i++) {
          if (i > 0) out.push(",");
          jcsSerialize(value[i], out);
        }
        out.push("]");
        return;
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      out.push("{");
      let first = true;
      for (const k of keys) {
        const v = obj[k];
        if (v === undefined) continue;
        if (!first) out.push(",");
        first = false;
        out.push(JSON.stringify(k), ":");
        jcsSerialize(v, out);
      }
      out.push("}");
      return;
    }
    default: throw new Error(`Unserializable value: ${typeof value}`);
  }
}

function canonicalizeToBytes(value: unknown): Uint8Array {
  const out: string[] = [];
  jcsSerialize(value, out);
  return new TextEncoder().encode(out.join(""));
}

// ---------------------------------------------------------------------------
// SHA-256 (Web Crypto)
// ---------------------------------------------------------------------------

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as ArrayBufferView<ArrayBuffer>);
  return hexEncode(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// ULID generation (simple browser-compatible)
// ---------------------------------------------------------------------------

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeUlid(time: number, random: Uint8Array): string {
  // 10 chars timestamp (48-bit ms), 16 chars randomness (80 bits)
  let ts = "";
  let t = time;
  for (let i = 0; i < 10; i++) {
    ts = CROCKFORD[t & 0x1f] + ts;
    t = Math.floor(t / 32);
  }
  let rnd = "";
  // Use 10 random bytes for 16 base32 chars (80 bits)
  const bits = Array.from(random.slice(0, 10));
  let buffer = 0;
  let bitsInBuffer = 0;
  for (const byte of bits) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;
    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      rnd += CROCKFORD[(buffer >> bitsInBuffer) & 0x1f];
    }
  }
  return ts + rnd;
}

function generateUlid(): string {
  const random = new Uint8Array(10);
  crypto.getRandomValues(random);
  return encodeUlid(Date.now(), random);
}

// ---------------------------------------------------------------------------
// Key generation and signing
// ---------------------------------------------------------------------------

export interface ClientKeyPair {
  privateKey: Uint8Array; // 32-byte seed — NEVER leaves the browser
  publicKey: Uint8Array;  // 32-byte public key
  publicKeyHex: string;
  publicKeyB64u: string;
}

export function generateKeyPair(): ClientKeyPair {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    publicKeyHex: hexEncode(publicKey),
    publicKeyB64u: b64uEncode(publicKey),
  };
}

export interface ManifestInput {
  operator: string;
  operatorDomain: string;
  disclosesToUser: boolean;
  humanEscalation: boolean;
  purposeSummary: string;
  contact?: string;
  description?: string;
  /** §6.1 purpose.channels. Defaults to ["voice"] for the Retell path that predates this field. */
  channels?: Array<"voice" | "sms" | "chat" | "email" | "api">;
}

/** One signed agent: manifest + operator-signed ManifestProof + operator KeyDocument. */
export interface SignedAgent {
  agentId: string;
  keyId: string;
  manifest: Record<string, unknown>;
  proof: Record<string, unknown>;
  keyDocument: Record<string, unknown>;
  manifestDigest: string;
}

/**
 * Build, digest and sign ONE agent's manifest. This is the single signing path in the
 * browser — `signAgentFleet` is a loop over it, so the Retell flow and the generic
 * issuance flow can never drift into producing differently-shaped proofs.
 *
 * The private key is used here and never returned, serialized or transmitted.
 */
export async function signAgent(
  keyPair: ClientKeyPair,
  agentName: string,
  input: ManifestInput,
  clock: { now?: Date } = {},
): Promise<SignedAgent> {
  const nowDate = clock.now ?? new Date();
  const now = nowDate.toISOString();
  const expiresAt = new Date(nowDate.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  const agentId = `agenid:${generateUlid()}`;
  const keyId = `agenid:key:${generateUlid()}`;

  // §6.1 Manifest
  const manifest: Record<string, unknown> = {
    manifest_version: "1.0",
    agent_id: agentId,
    identity: {
      name: agentName,
      ...(input.description ? { description: input.description } : {}),
    },
    ownership: {
      operator: input.operator,
      operator_domain: input.operatorDomain,
      ...(input.contact ? { contact: input.contact } : {}),
    },
    purpose: {
      summary: input.purposeSummary,
      channels: input.channels && input.channels.length > 0 ? input.channels : ["voice"],
    },
    disclosure: {
      is_ai: true,
      discloses_to_user: input.disclosesToUser,
      human_escalation: input.humanEscalation,
    },
  };

  // §6.1 / §8.2 — digest over RFC 8785 canonical bytes.
  const manifestDigest = await sha256Hex(canonicalizeToBytes(manifest));

  // §9.1 KeyDocument — public material only.
  const keyDocument: Record<string, unknown> = {
    key_id: keyId,
    key_type: "Ed25519",
    public_key_b64u: keyPair.publicKeyB64u,
    role: "operator",
    controller: agentId,
    created_at: now,
    status: "active",
    retired_at: null,
    revoked_at: null,
  };

  // §6.2 ManifestProof payload.
  const proofPayload: Record<string, unknown> = {
    $schema: "https://agenid.com/schemas/v1.1.1/manifest-proof.json",
    proof_type: "manifest_self_declaration",
    agent_id: agentId,
    manifest_version: "1.0",
    manifest_digest: { alg: "sha-256", value: manifestDigest },
    key_id: keyId,
    created_at: now,
    expires_at: expiresAt,
  };

  // §7 — sign the canonical bytes of the payload WITHOUT a `signature` member.
  const signature = ed25519.sign(canonicalizeToBytes(proofPayload), keyPair.privateKey);

  return {
    agentId,
    keyId,
    manifest,
    proof: { ...proofPayload, signature: b64uEncode(signature) },
    keyDocument,
    manifestDigest,
  };
}

export interface AgentBinding {
  retellAgentId: string;
  agentName: string;
  agentId: string;
  manifest: Record<string, unknown>;
  proof: Record<string, unknown>;
  keyDocument: Record<string, unknown>;
  manifestDigest: string;
}

/**
 * Build manifests and sign ManifestProofs for a fleet of Retell agents.
 * A thin loop over `signAgent` — all crypto lives there. Returns only public material.
 */
export async function signAgentFleet(
  keyPair: ClientKeyPair,
  agents: Array<{ agent_id: string; agent_name: string }>,
  input: ManifestInput,
): Promise<AgentBinding[]> {
  const results: AgentBinding[] = [];
  for (const agent of agents) {
    const signed = await signAgent(keyPair, agent.agent_name || "Unnamed Retell Agent", input);
    results.push({
      retellAgentId: agent.agent_id,
      agentName: agent.agent_name,
      agentId: signed.agentId,
      manifest: signed.manifest,
      proof: signed.proof,
      keyDocument: signed.keyDocument,
      manifestDigest: signed.manifestDigest,
    });
  }
  return results;
}
