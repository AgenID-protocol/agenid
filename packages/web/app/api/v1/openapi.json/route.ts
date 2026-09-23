/**
 * GET /api/v1/openapi.json — the machine-readable contract for EVERY deployed public
 * endpoint, built for OpenAI Custom GPT Actions and Assistants API tool use.
 *
 * TWO RULES GOVERN THIS FILE, AND THEY PULL IN OPPOSITE DIRECTIONS.
 *
 * The first is the one it has always followed: never document a route that does not
 * exist. A documented endpoint that 404s is the same defect as an overclaiming headline.
 *
 * The second was being broken. This document described four routes while thirteen were
 * deployed, and a contract that UNDERSTATES the public surface is a security-review
 * problem, not merely a documentation gap: a reviewer reading it would have concluded
 * that two unauthenticated write paths, a credential-forwarding proxy and two outbound
 * DNS amplifiers did not exist. Omission is a claim too.
 *
 * So the test for this file is now bidirectional and enforced in
 * `packages/web/test/dns-surface.test.ts`: every route handler in `app/` and every
 * documented path must correspond, in both directions.
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
      "/badge.js": {
        get: {
          operationId: "getAgentBadgeScript",
          summary: "Embeddable badge script",
          description:
            "JavaScript embed that renders the live verification level and links back to the Verification Card. Use " +
            "/badge/{agenid}/shield.svg on Markdown surfaces that strip scripts. Like the SVG badge, an unknown agent " +
            "renders neutral, never red.",
          tags: ["Resolve"],
          responses: { "200": { description: "The badge script.", content: { "application/javascript": { schema: { type: "string" } } } } },
        },
      },
      "/api/v1/directory": {
        get: {
          operationId: "listDirectory",
          summary: "List opted-in agents",
          description:
            "The public agent directory: registered agents whose operators signed a listing consent, most recent " +
            "first, at most 200. Registration alone lists nothing. A listing is not an endorsement and carries no " +
            "verification level; read each agent's level from /a/{agenid}.",
          tags: ["Directory"],
          responses: {
            "200": { description: "Listed agents and the directory disclosures.", content: { "application/json": { schema: { type: "object" } } } },
            "503": { description: "The directory could not be read. Status unknown, not empty.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          operationId: "setDirectoryConsent",
          summary: "List or delist an agent (operator-signed consent)",
          description:
            "Body: `{type: \"agenid.directory.consent.v1\", agent_id, key_id, listed, created_at, signature}`. " +
            "`signature` is pure Ed25519 over the RFC 8785 canonical bytes of the object without `signature`, made with " +
            "the operator key named by the agent's ManifestProof. `created_at` must be within five minutes of the " +
            "registry clock and newer than the last consent recorded for the agent. Unknown members are refused. " +
            "Rate limited like registration.",
          tags: ["Directory"],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
          responses: {
            "200": { description: "Consent recorded.", content: { "application/json": { schema: { type: "object" } } } },
            "400": { description: "Malformed consent, or created_at outside the window.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "403": { description: "Not signed by this agent's active operator key.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "No agent is registered under this identifier.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "409": { description: "Agent not ACTIVE, or a newer consent is already recorded.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "Rate limited." },
            "503": { description: "Registry unavailable; nothing was changed.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/blog/feed.xml": {
        get: {
          operationId: "getBlogFeed",
          summary: "Blog RSS feed",
          description:
            "RSS 2.0 feed of the release-notes blog at /blog, generated at build time from the same data as the pages. " +
            "Read-only, static, no parameters.",
          tags: ["Site"],
          responses: { "200": { description: "The feed.", content: { "application/rss+xml": { schema: { type: "string" } } } } },
        },
      },
      "/a/{agenid}": {
        get: {
          operationId: "getVerificationCard",
          summary: "Public Verification Card (HTML) or resolution envelope (JSON)",
          description:
            "Two representations of one resource, selected by `Accept`. A browser gets the human-readable Verification " +
            "Card; `Accept: application/json` gets the canonical resolution envelope.\n\n" +
            "The two disagree on status for an unregistered identifier, deliberately: HTML returns **200** with a neutral " +
            "\"Not registered\" card, because an unregistered identifier is not evidence of anything and a 404 error page " +
            "would frame absence of registration as a failure. JSON returns 404, because a machine caller asked a direct " +
            "question and deserves the direct answer.",
          tags: ["Resolve"],
          parameters: [
            {
              name: "agenid",
              in: "path",
              required: true,
              schema: { type: "string", example: "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" },
            },
            {
              name: "Accept",
              in: "header",
              required: false,
              description: "`application/json` selects the envelope; anything else selects the HTML card.",
              schema: { type: "string", example: "application/json" },
            },
          ],
          responses: {
            "200": {
              description: "The Verification Card (HTML), or the resolution envelope (JSON). HTML is 200 even when the agent is not registered.",
              content: {
                "text/html": { schema: { type: "string" } },
                "application/json": { schema: { $ref: "#/components/schemas/ResolutionEnvelope" } },
              },
            },
            "404": {
              description: "JSON representation only: no agent is registered under this identifier.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/v1/keys/{key_ulid}": {
        get: {
          operationId: "resolveOperatorKeyByPath",
          summary: "Resolve a key document (registry half of two-path key discovery)",
          description:
            "Returns the published KeyDocument for a key. This is the REGISTRY half of two-path key discovery; the other " +
            "half is the operator's own `https://<operator_domain>/.well-known/agenid/keys.json`. A verifier fetches both " +
            "and requires they agree — that requirement is what makes this registry non-authoritative.\n\n" +
            "The path segment is the WIRE form: the bare ULID, without the `agenid:key:` prefix that the logical form " +
            "carries. Public keys only; the KeyDocument schema has no representation of private material, and a stored " +
            "document is re-parsed against that strict schema before it is served.\n\n" +
            "A key existing says nothing about whether any agent is verified. This endpoint returns no verification level.",
          tags: ["Keys"],
          parameters: [
            {
              name: "key_ulid",
              in: "path",
              required: true,
              description: "The bare ULID wire form, e.g. 01M2HYWJ1NW959K7HT187PNXDE",
              schema: { type: "string", pattern: "^[0-7][0-9A-HJKMNP-TV-Z]{25}$" },
            },
          ],
          responses: {
            "200": { description: "The key document.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
            "400": {
              description: "`invalid_key_id` — malformed reference, or a URI fragment. No caller input is echoed back.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "404": {
              description: "`key_not_found`. Deliberately distinct from `agent_not_found`: neither absence implies the other.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
            "503": {
              description: "`key_document_invalid` — the stored row failed the strict schema and was refused rather than served.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
            },
          },
        },
      },
      "/v1/keys": {
        get: {
          operationId: "resolveOperatorKeyByQuery",
          summary: "Resolve a key document by logical key_id",
          description:
            "The second spec-required wire form (§9.2). Takes the percent-encoded LOGICAL form " +
            "(`agenid:key:<ULID>`) and returns a body byte-identical to the path form — both delegate to one response " +
            "builder, and a test asserts the two bodies match. This is not a convenience alias; both spellings are " +
            "normative.",
          tags: ["Keys"],
          parameters: [
            {
              name: "key_id",
              in: "query",
              required: true,
              description: "Percent-encoded logical key id, e.g. agenid%3Akey%3A01M2HYWJ1NW959K7HT187PNXDE",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "The key document.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
            "400": { description: "`invalid_key_id`, or `key_id` was absent.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "404": { description: "`key_not_found`.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/v1/openapi.json": {
        get: {
          operationId: "getOpenApiDocument",
          summary: "This document",
          description: "The machine-readable description of every deployed public endpoint. Listed because a contract that omits itself is incomplete.",
          tags: ["Meta"],
          responses: { "200": { description: "This OpenAPI document.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } } },
        },
      },
      "/api/verify-dns": {
        post: {
          operationId: "checkDomainControl",
          summary: "Check the _agenid TXT record for a domain",
          description:
            "Resolves `_agenid.<domain>` and compares it against a token the CALLER supplies and generated. There is no " +
            "shared or server-side token: a verification token that is not per-domain and per-request verifies nothing " +
            "for anyone.\n\n" +
            "Proves DOMAIN CONTROL and nothing else. Domain control is evidence an authority would weigh when issuing a " +
            "VerificationAssertion; it is not itself a verification level, and this endpoint never returns one. " +
            "L2_DOMAIN_VERIFIED requires an assertion signed by the root authority key, which does not exist yet.\n\n" +
            "Same-origin only — this route does not send `access-control-allow-origin`.",
          tags: ["Domain"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["domain", "token"],
                  properties: {
                    domain: { type: "string", example: "example.com" },
                    token: { type: "string", minLength: 16, description: "The per-domain value you generated and published." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "The check completed. `matched` carries the outcome; a missing record is `found: false`, never an error.",
              content: { "application/json": { schema: { $ref: "#/components/schemas/DomainControlResult" } } },
            },
            "400": { description: "`invalid_json`, `invalid_domain`, or `invalid_token`.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "Rate limited. This route makes outbound DNS queries against a caller-supplied hostname.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "502": { description: "`dns_error` — the resolver failed for a reason other than the record being absent. The answer is unknown, not negative.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/domain/status": {
        post: {
          operationId: "getDomainVerificationStatus",
          summary: "Full domain-verification status in one read",
          description:
            "Everything the domain flow needs from a single request: DNS provider detection, whether a one-click Domain " +
            "Connect URL is available, the `_agenid` TXT record's current state, and whether the operator publishes their " +
            "own key document. One read rather than several, because a status surface assembled from independently-timed " +
            "reads can display a combination of states that never coexisted.\n\n" +
            "`provider.apply_url` is non-null ONLY when the operator can actually complete a one-click flow at their own " +
            "provider — AgenID holds no DNS credential and writes no record itself. An unpublished record is reported as " +
            "`pending`, never as a failure.\n\n" +
            "Returns no verification level under any outcome.",
          tags: ["Domain"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["domain", "token"],
                  properties: { domain: { type: "string" }, token: { type: "string", minLength: 16 } },
                },
              },
            },
          },
          responses: {
            "200": { description: "Current status.", content: { "application/json": { schema: { $ref: "#/components/schemas/DomainStatus" } } } },
            "400": { description: "`invalid_json`, `invalid_domain`, or `invalid_token`.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "Rate limited. One call makes up to four outbound probes against a caller-supplied hostname.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/retell/declare": {
        post: {
          operationId: "declareRetellAgent",
          summary: "Re-verify an operator-signed ManifestProof (DECLARED)",
          description:
            "Re-verifies a ManifestProof the operator signed locally. Never receives a private key, never persists, and " +
            "never returns a level above DECLARED — a self-declaration, which sits BELOW L1_REGISTERED and renders amber " +
            "everywhere in this product, never emerald.",
          tags: ["Retell"],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } } },
          responses: {
            "200": { description: "The proof verified. `level` is DECLARED.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
            "400": { description: "Malformed body, or the proof did not verify (e.g. `manifest_digest_mismatch`).", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "Rate limited.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/retell/bind": {
        post: {
          operationId: "registerRetellAgentFleet",
          summary: "Batch registration (same semantics as /api/v1/agents, per agent)",
          description:
            "Registers several agents in one request. Every agent goes through the SAME registration implementation as " +
            "`POST /api/v1/agents` — identical validation, identical bounded clock-skew policy, identical ledger writes, " +
            "identical key-conflict behavior. It was once a second implementation with different security semantics; it " +
            "is now a thin wrapper, and a test forbids it from verifying, storing, or applying a clock policy of its own.\n\n" +
            "The batch fails rather than reporting partial success. Cross-origin callable.",
          tags: ["Retell"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["agents"],
                  properties: {
                    agents: {
                      type: "array",
                      description: "Each member carries the same three public objects as a single registration.",
                      items: { $ref: "#/components/schemas/RegisterRequest" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Every agent registered.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
            "400": { description: "Validation or proof failure on any agent. Byte-identical to /api/v1/agents' error for the same bad payload, plus batch context.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "Rate limited.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "503": { description: "The registry could not be written to. Nothing was stored, and no success is reported for an unwritten record.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/retell/agents": {
        post: {
          operationId: "listRetellAgents",
          summary: "List a Retell workspace's agents (one read-only upstream call)",
          description:
            "Forwards a caller-supplied Retell API key to Retell for a single read-only `list-agents` call, so the " +
            "onboarding wizard can show an operator their own agents. The key is used for that one call and is never " +
            "stored. This endpoint does NOT validate the key beyond what Retell's own response reports, and it asserts " +
            "nothing about verification.\n\n" +
            "Same-origin only, and rate limited at the relay bound: the abuse case for a credential-forwarding proxy " +
            "lands on a third party's API with AgenID as the apparent source.",
          tags: ["Retell"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { type: "object", required: ["api_key"], properties: { api_key: { type: "string", description: "The caller's own Retell API key. Used once, never stored." } } },
              },
            },
          },
          responses: {
            "200": { description: "The workspace's agents.", content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
            "400": { description: "Missing or malformed `api_key`, or Retell rejected it.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "429": { description: "Rate limited.", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
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
        DomainControlResult: {
          type: "object",
          description: "Evidence of domain control. Never a verification level.",
          properties: {
            ok: { type: "boolean", description: "True only when the expected record value was observed." },
            domain: { type: "string" },
            host: { type: "string", description: "The host queried, always `_agenid.<domain>`." },
            found: { type: "boolean", description: "Any TXT record present at the host." },
            matched: { type: "boolean", description: "Our exact value present at the host." },
            record_count: { type: "integer" },
            reason: { type: "string", enum: ["no_txt_record"], description: "Present when no TXT record exists. Absence is \"not yet\", not a failure." },
            proves: { type: "string", nullable: true, enum: ["domain_control", null], description: "`domain_control` on a match, otherwise null. Never a level." },
            disclosures: { type: "array", items: { type: "string" }, description: "What this result does and does not assert. Surface them verbatim." },
          },
        },
        DomainStatus: {
          type: "object",
          properties: {
            ok: { type: "boolean" },
            domain: { type: "string" },
            checked_at: { type: "string", format: "date-time", description: "One instant for the whole response." },
            provider: {
              type: "object",
              properties: {
                name: { type: "string", nullable: true, description: "Recognised provider, or null when the NS set is not recognised." },
                nameservers: { type: "array", items: { type: "string" } },
                domain_connect: { type: "boolean" },
                domain_connect_host: { type: "string", nullable: true },
                provider_name: { type: "string", nullable: true },
                apply_url: { type: "string", nullable: true, description: "Non-null only when a one-click flow can actually be completed at the operator's own provider." },
                reason: {
                  type: "string",
                  nullable: true,
                  enum: ["no_domain_connect", "no_sync_ux", "template_unregistered", null],
                  description: "Why `apply_url` is null. `template_unregistered` means AgenID's service template is not yet registered with providers.",
                },
              },
            },
            records: {
              type: "array",
              description: "The records AgenID asks for, with observed state. `pending` until seen — never `failed`.",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["TXT"] },
                  name: { type: "string" },
                  value: { type: "string" },
                  ttl: { type: "integer" },
                  status: { type: "string", enum: ["pending", "verified"] },
                  observed_count: { type: "integer" },
                  other_records_present: { type: "boolean", description: "A record exists at this host but does not carry our value." },
                },
              },
            },
            key_discovery: {
              type: "object",
              description: "The OPERATOR half of two-path key discovery. Optional, and its absence leaves a verifier with one source instead of two.",
              properties: {
                url: { type: "string", format: "uri" },
                status: {
                  type: "string",
                  enum: ["absent", "invalid", "published", "unreachable"],
                  description:
                    "published: a 2xx application/json body that parses as a strict KeysDocument naming this domain as controller_domain. It is NOT compared against the registry's copy — a verifier does that — so no state here is 'verified'. invalid: reachable but not a usable key document (see reason). absent: 404/410. unreachable: network error, timeout or 5xx.",
                },
                reason: {
                  type: "string",
                  nullable: true,
                  description:
                    "Why the state is not 'published': not_json, malformed_json, schema_invalid, controller_domain_mismatch, too_large, or http_<status>.",
                },
                http_status: { type: "integer", nullable: true },
                key_count: { type: "integer", nullable: true },
                note: { type: "string" },
              },
            },
            domain_control: { type: "boolean" },
            proves: { type: "string", nullable: true, enum: ["domain_control", null] },
            disclosures: { type: "array", items: { type: "string" } },
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
