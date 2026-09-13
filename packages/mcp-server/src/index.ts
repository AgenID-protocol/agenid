#!/usr/bin/env node
/**
 * @agenid/mcp-server — Model Context Protocol server for AgenID.
 *
 * Exposes three stdio tools so any MCP-compatible client (Claude Desktop, Cursor,
 * Windsurf, or a custom agent) can resolve an agent identity against the public
 * registry, independently verify a signed manifest payload, or scaffold a fresh
 * operator keypair + skeleton manifest — all against `@agenid/core`, the same
 * canonicalization/crypto engine the registry and conformance suite use.
 *
 * No storage, no registry writes. `resolve_agent_identity` is the one tool that
 * makes a network call (to the public read-only resolver); the other two are
 * pure, local, and never touch the network.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  canonicalizeToBytes,
  b64uEncode,
  hex,
  sha256,
  verifyBytes,
  generateKeyPair,
  generateAgentId,
  generateKeyId,
  makeKeyDocument,
  PROTOCOL_VERSION,
} from "@agenid/core";
import { decodeSignature, decodePublicKey } from "./codec.js";

/** Base URL of the AgenID public resolver. Override for local dev against `pnpm --filter @agenid/web dev`. */
const AGENID_API_BASE_URL = (process.env.AGENID_API_BASE_URL ?? "https://www.agenid.com").replace(/\/$/, "");

const server = new McpServer({
  name: "agenid-mcp",
  version: "0.1.0",
  title: "AgenID",
});

// ---------------------------------------------------------------------------
// resolve_agent_identity
// ---------------------------------------------------------------------------
server.registerTool(
  "resolve_agent_identity",
  {
    title: "Resolve AgenID Identity",
    description:
      "Look up an AI agent's identity record in the public AgenID registry by its `agenid:<ULID>` identifier. " +
      "Calls the read-only resolver at `{AGENID_API_BASE_URL}/api/resolve/{agenid}` (default https://www.agenid.com) " +
      "and returns the current verification level (L1_REGISTERED through L4_DEPLOYMENT_VERIFIED), the operator's " +
      "public key document, and the full resolution envelope so the result can be independently re-verified without " +
      "trusting this call.",
    inputSchema: {
      agenid: z.string().describe("Agent identifier in the form agenid:<ULID>, e.g. agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"),
    },
  },
  async ({ agenid }) => {
    const url = `${AGENID_API_BASE_URL}/api/resolve/${encodeURIComponent(agenid)}`;
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      const body = (await res.json().catch(() => null)) as Record<string, any> | null;
      if (!res.ok) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: false, status: res.status, error: body?.error ?? "resolve_failed", agent_id: agenid, source: url }, null, 2),
            },
          ],
        };
      }
      const level = body?.verification?.level ?? "L1_REGISTERED";
      const publicKey = body?.operator_key?.document ?? null;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                agent_id: body?.agent_id ?? agenid,
                status: body?.status ?? null,
                level,
                public_key: publicKey,
                envelope: body,
                source: url,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: "network_error", message: e instanceof Error ? e.message : String(e), source: url }, null, 2) }],
      };
    }
  },
);

// ---------------------------------------------------------------------------
// verify_agent_manifest
// ---------------------------------------------------------------------------
server.registerTool(
  "verify_agent_manifest",
  {
    title: "Verify AgenID Manifest Signature",
    description:
      "Stateless, offline Ed25519 (RFC 8032) signature verification over an RFC 8785 JCS canonicalized payload. " +
      "Give it the manifest (or any AgenID JSON payload), its base64url-encoded signature, and the signer's " +
      "hex-encoded Ed25519 public key — no network call, no registry lookup, no trust in AgenID's own servers. " +
      "This is the same canonicalization + verification primitive the AgenID-protocol/conformance suite uses.",
    inputSchema: {
      manifest: z.record(z.string(), z.unknown()).describe("The manifest (or other signed payload) as a JSON object, without its `signature` field."),
      signature: z.string().describe("Base64url-encoded (unpadded) 64-byte Ed25519 signature, e.g. from a ManifestProof's `signature` field."),
      publicKey: z.string().describe("Hex-encoded 32-byte Ed25519 public key of the signer."),
    },
  },
  async ({ manifest, signature, publicKey }) => {
    try {
      const canonicalBytes = canonicalizeToBytes(manifest);
      const sigBytes = decodeSignature(signature);
      const pubKeyBytes = decodePublicKey(publicKey);
      const valid = verifyBytes(pubKeyBytes, canonicalBytes, sigBytes);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: valid,
                valid,
                algorithm: "Ed25519",
                canonicalization: "RFC 8785 JCS",
                canonical_sha256_hex: hex(sha256(canonicalBytes)),
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ ok: false, valid: false, error: e instanceof Error ? e.message : String(e) }, null, 2) }],
      };
    }
  },
);


// ---------------------------------------------------------------------------
// generate_keypair
// ---------------------------------------------------------------------------
server.registerTool(
  "generate_keypair",
  {
    title: "Generate AgenID Operator Keypair",
    description:
      "Generate a fresh Ed25519 keypair for a new AgenID operator, plus a skeleton `agenid.json` manifest and operator " +
      "key document pre-filled for the given domain. Purely local — the private key never leaves this call's response " +
      "and is never transmitted to AgenID or anyone else. The caller is responsible for storing the private key securely " +
      "and completing the manifest (identity, purpose, disclosure) before signing and registering.",
    inputSchema: {
      domain: z.string().describe("The operator's domain, e.g. example.com — used as ownership.operator_domain and the key controller."),
    },
  },
  async ({ domain }) => {
    const keyPair = generateKeyPair();
    const agentId = generateAgentId();
    const keyId = generateKeyId();
    const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const keyDocument = makeKeyDocument({
      keyId,
      publicKey: keyPair.publicKey,
      role: "operator",
      controller: agentId,
      createdAt,
    });
    const manifestSkeleton = {
      manifest_version: "1.0" as const,
      agent_id: agentId,
      identity: { name: "REPLACE_WITH_AGENT_NAME", description: "REPLACE_WITH_A_SHORT_DESCRIPTION" },
      ownership: { operator: "REPLACE_WITH_OPERATOR_LEGAL_NAME", operator_domain: domain },
      purpose: { summary: "REPLACE_WITH_WHAT_THIS_AGENT_DOES", channels: ["api"] },
      disclosure: { is_ai: true, discloses_to_user: true, human_escalation: true },
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: true,
              protocol_version: PROTOCOL_VERSION,
              agent_id: agentId,
              key_id: keyId,
              private_key_b64u: b64uEncode(keyPair.privateKey),
              private_key_warning: "Keep this secret. It is never sent to AgenID and cannot be recovered if lost.",
              public_key_b64u: b64uEncode(keyPair.publicKey),
              public_key_hex: hex(keyPair.publicKey),
              key_document: keyDocument,
              manifest_skeleton: manifestSkeleton,
              next_steps: [
                "Fill in identity.name, identity.description, ownership.operator, purpose.summary, and purpose.channels.",
                "Sign the completed manifest with signManifestProof() from @agenid/core using this private key.",
                "POST { manifest, proof, key_document } to https://www.agenid.com/v1/agents to register (see docs/OPERATOR_ONBOARDING.md).",
              ],
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
