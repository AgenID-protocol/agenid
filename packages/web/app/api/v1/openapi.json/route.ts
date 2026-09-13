/**
 * GET /api/v1/openapi.json — OpenAPI 3.0 spec for the AgenID resolver and stateless
 * verifier, built for OpenAI Custom GPT Actions and Assistants API tool use. Only
 * describes routes that actually exist and are handled elsewhere in this app
 * (`app/api/resolve/[agenid]/route.ts`, `app/api/v1/verify/route.ts`) — never a
 * fabricated surface, per this repo's standing "docs never outrun shipped code" rule.
 */
import { SITE_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

function buildSpec(origin: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "AgenID Resolver & Verification API",
      description:
        "Public, read-only endpoints for resolving an AI agent's AgenID identity record and for stateless, offline " +
        "verification of Ed25519-signed AgenID payloads. Part of the open AgenID protocol (https://github.com/AgenID-protocol/spec). " +
        "No API key required for either endpoint.",
      version: "1.1.1",
      contact: { name: "AgenID", url: "https://www.agenid.com" },
      license: { name: "MIT", url: "https://github.com/AgenID-protocol/spec/blob/main/LICENSE" },
    },
    servers: [{ url: origin, description: "AgenID production" }],
    paths: {
      "/api/resolve/{agenid}": {
        get: {
          operationId: "resolveAgentIdentity",
          summary: "Resolve an AI agent's identity record",
          description:
            "Looks up an agent by its `agenid:<ULID>` identifier in the public AgenID registry and returns the resolution " +
            "envelope: current verification level, manifest, operator proof, key documents, and assertions — everything " +
            "needed to independently re-verify the identity without trusting this registry.",
          tags: ["Resolve"],
          parameters: [
            {
              name: "agenid",
              in: "path",
              required: true,
              description: "Agent identifier, e.g. agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y",
              schema: { type: "string", pattern: "^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$", example: "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" },
            },
          ],
          responses: {
            "200": {
              description: "Agent found. Returns the full resolution envelope.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/ResolutionEnvelope" } } },
            },
            "400": {
              description: "Malformed agent identifier.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "404": {
              description: "No agent is registered under this identifier. Not evidence of anything beyond \"not registered\".",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "503": {
              description: "Registry temporarily unavailable. The identity's status is unknown, not disproven.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/api/v1/verify": {
        post: {
          operationId: "verifyAgentPayload",
          summary: "Stateless Ed25519 signature verification",
          description:
            "Verifies an Ed25519 (RFC 8032) signature over an RFC 8785 JCS canonicalized JSON payload — a manifest, a " +
            "ManifestProof, or any other AgenID-shaped object minus its `signature` field. Pure function of the request " +
            "body: no registry lookup, no database, no AgenID account required. Safe for another AI agent to call directly.",
          tags: ["Verify"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyRequest" } } },
          },
          responses: {
            "200": {
              description: "Verification completed (check `valid` for the result; the request itself was well-formed).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/VerifyResponse" } } },
            },
            "400": {
              description: "Malformed request body (invalid JSON, missing fields, or a public key that is not 64 hex characters).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        VerifyRequest: {
          type: "object",
          required: ["manifest", "signature", "public_key_hex"],
          properties: {
            manifest: { type: "object", description: "The signed JSON payload, without its `signature` field.", additionalProperties: true },
            signature: {
              type: "string",
              description: "The Ed25519 signature, base64url-encoded (86 chars, unpadded) or hex-encoded (128 chars).",
              example: "MEUCIQDx...",
            },
            public_key_hex: {
              type: "string",
              description: "The signer's Ed25519 public key, hex-encoded, exactly 64 lowercase or uppercase hex characters (32 bytes).",
              pattern: "^[0-9a-fA-F]{64}$",
              example: "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9",
            },
          },
        },
        VerifyResponse: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            valid: { type: "boolean", description: "Whether the signature is valid for the given payload and public key." },
            algorithm: { type: "string", enum: ["Ed25519"] },
            canonicalization: { type: "string", enum: ["RFC 8785 JCS"] },
            canonical_sha256_hex: { type: "string", pattern: "^[0-9a-f]{64}$", description: "SHA-256 digest of the canonicalized payload, hex-encoded." },
          },
        },
        ResolutionEnvelope: {
          type: "object",
          description: "See AgenID-protocol/spec §14/§15 for the normative envelope shape.",
          properties: {
            agenid_envelope_version: { type: "string", enum: ["1.0"] },
            agent_id: { type: "string", pattern: "^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$" },
            status: { type: "string" },
            registered_at: { type: "string", format: "date-time" },
            manifest: { type: "object", additionalProperties: true },
            manifest_digest: {
              type: "object",
              properties: { alg: { type: "string", enum: ["sha-256"] }, value: { type: "string", pattern: "^[0-9a-f]{64}$" } },
            },
            proof: { type: "object", additionalProperties: true },
            proof_check: { type: "object", properties: { ok: { type: "boolean" }, code: { type: "string" } } },
            operator_key: {
              type: "object",
              properties: {
                key_id: { type: "string", pattern: "^agenid:key:[0-7][0-9A-HJKMNP-TV-Z]{25}$" },
                document: { type: "object", nullable: true, additionalProperties: true },
                discovery: {
                  type: "object",
                  properties: { registry_path: { type: "string" }, well_known_url: { type: "string", format: "uri" } },
                },
              },
            },
            verification: {
              type: "object",
              properties: {
                level: { type: "string", enum: ["L1_REGISTERED", "L2_DOMAIN_VERIFIED", "L3_ORGANIZATION_VERIFIED", "L4_DEPLOYMENT_VERIFIED"] },
                valid_assertions: { type: "integer" },
                total_assertions: { type: "integer" },
              },
            },
            assertions: { type: "array", items: { type: "object", additionalProperties: true } },
            verify_instructions: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            message: { type: "string" },
            agent_id: { type: "string" },
          },
        },
      },
    },
  } as const;
}

export async function GET(req: Request) {
  const origin = SITE_URL || new URL(req.url).origin;
  const spec = buildSpec(origin);
  return new Response(JSON.stringify(spec, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
