/**
 * GET /api/v1/openapi.json — OpenAPI 3.0 spec for the AgenID resolver, registration
 * endpoint, badge, and stateless verifier, built for OpenAI Custom GPT Actions and
 * Assistants API tool use. Only describes routes that actually exist and are handled
 * elsewhere in this app (`app/api/resolve/[agenid]/route.ts`, `app/api/v1/verify/route.ts`,
 * `app/api/v1/agents/route.ts`, `app/badge/[agenid]/shield.svg/route.ts`) — never a
 * fabricated surface, per this repo's standing "docs never outrun shipped code" rule.
 */
import { SITE_URL } from "@/lib/api";

export const dynamic = "force-dynamic";

function buildSpec(origin: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "AgenID Registry, Resolver & Verification API",
      description:
        "Public endpoints for registering an AI agent, resolving its AgenID identity record, and performing stateless " +
        "offline verification of Ed25519-signed AgenID payloads. Part of the open AgenID protocol " +
        "(https://github.com/AgenID-protocol/spec). No API key required for any endpoint.\n\n" +
        "Registration accepts PUBLIC material only — a manifest, an operator-signed proof, and a public key. No endpoint " +
        "here accepts a private key, and the registry cannot sign on an operator's behalf.\n\n" +
        "Registration issues L1_REGISTERED: the agent is registered here and its operator self-declaration verifies. It " +
        "is not a third-party check of the operator, domain, or organization. No higher level is currently issuable by " +
        "anyone, because AgenID's root authority key ceremony has not been performed.",
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
      "/api/v1/agents": {
        post: {
          operationId: "registerAgent",
          summary: "Register an agent (issues L1_REGISTERED)",
          description:
            "Registers an agent from PUBLIC material only: its manifest, an operator-signed ManifestProof over that " +
            "manifest's digest, and the operator's Ed25519 KeyDocument. A private key is not a field of this request and " +
            "must never be sent — operators generate and hold their own keys. The registry re-verifies the signature, the " +
            "digest binding, the key's role and controller, and the proof's validity window before storing anything.\n\n" +
            "A successful registration is L1_REGISTERED and nothing above it: this agent is registered in this registry and " +
            "its operator self-declaration verifies. That is NOT a third-party check of the operator, the domain, or the " +
            "organization. Levels above L1 come only from authority-signed VerificationAssertions, and AgenID's root " +
            "authority key ceremony has not been performed, so none can be issued yet.",
          tags: ["Register"],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
          },
          responses: {
            "201": {
              description: "Agent registered at L1_REGISTERED.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterResponse" } } },
            },
            "400": {
              description:
                "Schema validation failed, the proof did not verify, the key's role/controller was wrong, or the signing " +
                "machine's clock is more than 120s ahead of the registry (`clock_skew_too_large`).",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "409": {
              description: "This agent_id is already registered, or a different key document is published under this key_id.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "503": {
              description: "The registry could not be written to. Nothing was stored.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/badge/{agenid}/shield.svg": {
        get: {
          operationId: "getAgentBadge",
          summary: "Live status badge as an SVG image",
          description:
            "Renders the agent's current registry status as an SVG, for READMEs and other Markdown surfaces that strip " +
            "scripts (use /badge.js where scripts run). Always responds 200 — a non-200 would render as a broken image " +
            "rather than a badge — so the badge's own text and color carry the outcome. An unregistered or malformed " +
            "identifier renders neutral grey and reads \"NOT REGISTERED\", never red and never \"invalid\": absence of a " +
            "record is not a negative finding.",
          tags: ["Resolve"],
          parameters: [
            {
              name: "agenid",
              in: "path",
              required: true,
              description: "Agent identifier, e.g. agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y",
              schema: { type: "string", example: "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" },
            },
          ],
          responses: {
            "200": {
              description: "An SVG badge. Cached for at most 60s so a revocation propagates quickly.",
              content: { "image/svg+xml": { schema: { type: "string" } } },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        RegisterRequest: {
          type: "object",
          required: ["manifest", "proof", "key_document"],
          additionalProperties: false,
          description:
            "Exactly three members. Unknown top-level members are rejected rather than ignored, so a client cannot " +
            "smuggle in a field the registry silently drops — notably a verification level it is not entitled to claim.",
          properties: {
            manifest: {
              type: "object",
              description: "The §6.1 agent manifest. Strict: reserved keys from future protocol versions are rejected.",
              additionalProperties: true,
            },
            proof: {
              type: "object",
              description:
                "The §6.2 ManifestProof: the operator's Ed25519 signature over the RFC 8785 canonical bytes of the proof " +
                "payload (the payload WITHOUT its `signature` member), binding agent_id, manifest digest, key_id, and a " +
                "created_at/expires_at window.",
              additionalProperties: true,
            },
            key_document: {
              type: "object",
              description:
                "The §9.1 operator KeyDocument. PUBLIC KEY ONLY. `role` must be `operator` and `controller` must equal " +
                "`manifest.agent_id`.",
              additionalProperties: true,
            },
          },
        },
        RegisterResponse: {
          type: "object",
          properties: {
            agent_id: { type: "string", example: "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" },
            status: { type: "string", example: "ACTIVE" },
            verification: {
              type: "object",
              properties: {
                level: {
                  type: "string",
                  enum: ["L1_REGISTERED"],
                  description: "Always L1_REGISTERED. Registration cannot produce any higher level.",
                },
              },
            },
            manifest_digest: {
              type: "object",
              properties: { alg: { type: "string", example: "sha-256" }, value: { type: "string" } },
            },
            registered_at: {
              type: "string",
              format: "date-time",
              description: "The registry's own clock, never the client's.",
            },
            links: {
              type: "object",
              properties: {
                card: { type: "string", description: "Public Verification Card path." },
                envelope: { type: "string", description: "Canonical resolution envelope path." },
              },
            },
            disclosures: {
              type: "array",
              items: { type: "string" },
              description: "Plain-language statements of what this level does and does not assert. Surface them verbatim.",
            },
          },
        },
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
