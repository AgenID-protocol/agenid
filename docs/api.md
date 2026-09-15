# API Reference

**Verified against the live deployment on 2026-09-15** by calling every endpoint listed here and by diffing this document against `packages/web/app/api/**` and the served OpenAPI document. Where this document and the implementation disagree, the implementation wins and this file is the defect.

Protocol v1.1.1 + errata E1/E2.

## Base URLs

| Environment | URL | Status |
|---|---|---|
| Production | `https://www.agenid.com` | **Live.** The apex redirects here. |
| Local development | `http://localhost:3000` | `pnpm --filter @agenid/web dev` |
| Standalone registry | `http://localhost:8080` (configurable via `PORT`/`HOST`) | `@agenid/api`, **not deployed anywhere.** Production serves equivalent routes from `packages/web`. |
| An `api.` subdomain of this project's namespace | — | **Does not exist and does not resolve.** It was once printed as the registration target in the operator docs and in the homepage key-discovery diagram; both were corrected. A repository test forbids that hostname from appearing anywhere in `docs/` or on any public page, which is why it is described here rather than written out. |

## Authentication

**There is none, on any public endpoint, deliberately.** The Ed25519 signature is the authentication: you can only register an agent whose operator key you hold, and doing so is a self-attestation that says nothing a third party should believe on its own.

**No endpoint accepts a private key.** The registry cannot sign on an operator's behalf.

The consequence is that nothing bounds request volume. That is a real, documented gap — see [PROJECT_STATE.md](../PROJECT_STATE.md).

`AGENID_AUTHORITY_TOKEN` gates the assertion write path in `@agenid/api`. That path is not deployed.

## CORS

`/api/v1/agents`, `/api/v1/verify`, `/api/v1/openapi.json`, `/api/resolve/{agenid}`, `/badge/{agenid}/shield.svg`, `/api/retell/declare` and `/api/retell/bind` send `access-control-allow-origin: *` and answer `OPTIONS` preflight. They are intended to be callable cross-origin from a browser, a CI job, or an agent runtime.

## Endpoint inventory

| Method | Path | Status |
|---|---|---|
| POST | `/api/v1/agents` | **Production** |
| GET | `/api/resolve/{agenid}` | **Production** |
| GET | `/a/{agenid}` | **Production** |
| POST | `/api/v1/verify` | **Production** |
| GET | `/api/v1/openapi.json` | **Production** |
| GET | `/badge/{agenid}/shield.svg` | **Production** |
| GET | `/badge.js` | **Production** |
| POST | `/api/verify-dns` | **Production** (duplicate of the next row) |
| POST | `/api/dns/verify` | **Production** (duplicate of the previous row) |
| POST | `/api/dns/detect` | **Production**, returns `manual` — no provider credential is configured |
| POST | `/api/dns/auto-add` | Implemented, **unconfigured in production**; unreachable from the UI because `detect` gates it |
| POST | `/api/retell/declare` | **Production** |
| POST | `/api/retell/bind` | **Production** |
| POST | `/api/retell/agents` | **Production** |
| GET | `/v1/keys/{key-ulid}` | **Not deployed** — 404 |
| POST | `/v1/agents/{id}/assertions` | **Not deployed** — 404. No root key exists to sign with. |
| GET | `/.well-known/agenid/authorities.json` | **Not published** — 404, correctly |

Only the first four, plus the SVG badge, appear in the OpenAPI document. The Retell and DNS routes are deployed but undocumented there — see *Known documentation gaps* at the end.

---

## POST /api/v1/agents — register

Registers an operator-signed manifest. Returns `L1_REGISTERED`, **the highest level this deployment can issue.**

**Request** — exactly three members, all required, all public material. Unknown top-level members are rejected rather than ignored.

```json
{
  "manifest":     { "...": "the agent manifest" },
  "proof":        { "...": "operator-signed ManifestProof" },
  "key_document": { "...": "the operator's public KeyDocument" }
}
```

**Checks performed before anything is stored**, in order:

1. Strict schema validation of all three objects (`schema_validation_failed`, with `issues`)
2. Identifier grammar (`invalid_agent_id`)
3. Registration clock policy — see below (`clock_skew_too_large`)
4. `verifyManifestProof`: digest binding, Ed25519 signature, `key_id` match, `role === "operator"`, controller match, key active at `created_at`
5. Uniqueness — an existing `agent_id` is a conflict, never a silent overwrite (`agent_exists`)
6. Key conflict — a *different* key document already published under this `key_id` is a conflict (`key_conflict`)

**Response `201`:**

```json
{
  "agent_id": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y",
  "status": "ACTIVE",
  "verification": { "level": "L1_REGISTERED" },
  "manifest_digest": { "alg": "sha-256", "value": "…" },
  "registered_at": "2026-09-15T04:12:33.488Z",
  "links": { "…": "card, envelope and badge URLs" },
  "disclosures": ["…"]
}
```

The level is nested under `verification`, not a top-level `level` member. `registered_at` is always the **registry's** clock, never the client's. `status` is `ACTIVE` on registration; the other values in the enum are stored-but-unused (see *Data model* in [architecture.md](architecture.md)).

**Clock policy.** A proof created up to **120 seconds** ahead of the registry is evaluated at its own `created_at`, because the signer and the registry are different machines in one request. Beyond that the registration is refused. `verifyManifestProof` itself is untouched and applies no leeway; resolution applies none either.

**Status codes.** `201` registered · `400` schema failure, bad identifier, failed proof verification, or excessive clock skew · `409` `agent_exists` or `key_conflict` · `503` `registry_unavailable` — **nothing was stored.** There is no `422`.

**Side effects on success:** one `agents` row, one `keys` row, and two ledger events (`agent.registered`, `key.published`).

---

## GET /api/resolve/{agenid} — resolve

Returns the canonical **resolution envelope** — everything a verifier needs to check the identity without trusting this registry.

```jsonc
{
  "agenid_envelope_version": "1.0",
  "agent_id": "agenid:01J…",
  "status": "ACTIVE",
  "registered_at": "2026-09-15T04:12:33.488Z",
  "manifest": { },
  "manifest_digest": { "alg": "sha-256", "value": "…" },
  "proof": { },
  "proof_check": { "ok": true },
  "operator_key": {
    "key_id": "01J…",
    "document": { },
    "discovery": {
      "registry_path": "/v1/keys/01J…",
      "well_known_url": "https://operator.example/.well-known/agenid/keys/01J…"
    }
  },
  "verification": { "level": "L1_REGISTERED", "valid_assertions": 0, "total_assertions": 0 },
  "assertions": [],
  "verify_instructions": "how to re-verify this envelope without the registry"
}
```

Two properties matter more than they look:

- **Assertions are re-checked at resolution time against the *current* manifest.** They are not trusted because they were valid when issued — editing a manifest invalidates every assertion bound to the old one, automatically.
- **`verification.level` is a convenience.** Every assertion is present with its own signature. Recompute the level yourself.

`operator_key.discovery` names both required key-discovery paths. The registry path is **not deployed**, so `verify_instructions` says so and names the check that can be completed today.

**Status codes.** `200` · `400` malformed identifier · `404` `agent_not_found` — clean, never a 500, and *not evidence of anything beyond "not registered"* · `503` registry unavailable — **the identity's status is unknown, not disproven.**

---

## GET /a/{agenid} — verification card

Two representations of one resource, and **they deliberately differ in status code**:

```bash
curl https://www.agenid.com/a/agenid:01J…                             # HTML card
curl -H 'Accept: application/json' https://www.agenid.com/a/agenid:01J…    # the envelope above
```

- **HTML: always `200`**, including for an unknown or malformed identifier, which renders a neutral *Not registered* card reading "An unregistered identifier is not evidence of anything — it simply has no record." A 404 error page would frame absence of registration as a failure, which this product does not do.
- **JSON: `404 agent_not_found`** for an unknown identifier, because a machine consumer needs the status code.

If you are writing a client, use the JSON representation or `/api/resolve/{agenid}`. Do not infer existence from the HTML status code.

---

## POST /api/v1/verify — stateless signature verification

**This is a raw Ed25519 signature check over RFC 8785 JCS-canonicalized bytes.** It is *not* `ManifestProof` verification, it performs no registry lookup, and it stores nothing. It is a pure function of its request body — safe to call from an agent runtime, a CI job, or a Custom GPT Action with no AgenID account and no trust in the registry's database. It is the same primitive `@agenid/mcp-server`'s `verify_agent_manifest` tool uses.

**Request:**

```json
{
  "manifest": { },
  "signature": "base64url or 128-char hex Ed25519 signature",
  "public_key_hex": "64-character hex Ed25519 public key"
}
```

**Response `200`** — note that a *failed* signature is still a `200` with `valid: false`; the call succeeded, the signature did not.

```json
{
  "ok": false,
  "valid": false,
  "algorithm": "Ed25519",
  "canonicalization": "RFC 8785 JCS",
  "canonical_sha256_hex": "…"
}
```

**Status codes.** `200` verification ran · `400` `invalid_json`, `invalid_body`, `invalid_manifest`, `invalid_signature`, `invalid_public_key`, or `verification_failed` (input could not be decoded or canonicalized).

To check a full `ManifestProof` — digest binding, key role, controller, validity window — use `verifyManifestProof` from `@agenid/core` locally. That is the check this endpoint does *not* perform.

---

## GET /badge/{agenid}/shield.svg — static badge

For Markdown surfaces that strip scripts.

```markdown
[![AgenID](https://www.agenid.com/badge/agenid:01J…/shield.svg)](https://www.agenid.com/a/agenid:01J…)
```

**Always returns `200`**, including for unknown or malformed identifiers — a non-200 renders as a broken image rather than a badge. An unknown identifier renders **neutral grey** and reads `NOT REGISTERED`. Never red.

`DECLARED` and `L1_REGISTERED` render **amber**. Emerald is reserved for genuinely verified state. The colour mapping is pinned against `/badge.js` by a test that reads both files, so the two badges cannot disagree.

## GET /badge.js — live embed

```html
<script src="https://www.agenid.com/badge.js" data-agenid="agenid:01J…"></script>
```

---

## DNS endpoints

`POST /api/verify-dns` and `POST /api/dns/verify` perform a real `_agenid.<domain>` TXT lookup against a caller-supplied per-domain token, joining chunked TXT records. On a match they report `proves: "domain_control"`.

**Domain control is evidence, never a level.** These endpoints cannot return a verification level: issuing `L2_DOMAIN_VERIFIED` requires a signed assertion from a root authority key that does not exist.

`POST /api/dns/detect` recommends a provider only when that provider's credential is present in the environment. In production neither is, so it returns `recommended: "manual"`. `POST /api/dns/auto-add` writes the TXT record via Cloudflare or GoDaddy and is **unconfigured in production**.

Errors: `invalid_domain`, `invalid_token`, `invalid_provider`, `dns_error`, `dns_write_failed`, `provider_error`, `upstream_unreachable`.

---

## Retell endpoints

`POST /api/retell/declare` re-verifies an operator-signed `ManifestProof` and **never returns a level above `DECLARED`** — test-enforced. It receives no private key.

`POST /api/retell/bind` is a batch registration. It delegates every agent to the same `registerAgent` implementation `/api/v1/agents` uses — a test forbids it from verifying, storing, or applying a clock policy of its own — writes both ledger events per agent, and fails the whole batch rather than reporting partial success. It returns byte-identical validation errors to `/api/v1/agents`, plus batch context.

`POST /api/retell/agents` proxies one read-only call to Retell using a caller-supplied API key. The key is used once and never stored. **It is unauthenticated and unrated.** Errors: `missing_api_key`, `retell_unauthorized`, `retell_error`, `retell_bad_response`.

---

## Not deployed

**`GET /v1/keys/{key-ulid}`** — the registry half of two-path key discovery. Its absence is why the full two-path check cannot be completed against `agenid.com` today. It is a read-only route over data already in the store.

**`POST /v1/agents/{id}/assertions`** — exists in `@agenid/api`, gated by `AGENID_AUTHORITY_TOKEN`, no deployed route, and no root authority key to sign an assertion with.

**`/.well-known/agenid/authorities.json`** — 404, correctly. Publishing a pin for a key that does not exist would be the most consequential possible false claim.

---

## Error codes

There are **three distinct error namespaces** in this system. Conflating them is a common mistake; they are listed separately on purpose.

### 1. HTTP route errors — what the API returns on the wire

Shape: `{ "error": "<code>", "message": "…" }`, sometimes with `issues` (zod) or `agent_id`.

`agent_not_found` · `agent_exists` · `key_conflict` · `invalid_agent_id` · `invalid_agents` · `invalid_body` · `invalid_json` · `invalid_manifest` · `invalid_proof` · `invalid_key_document` · `invalid_public_key` · `invalid_signature` · `invalid_domain` · `invalid_token` · `invalid_provider` · `incomplete_agent` · `missing_api_key` · `schema_validation_failed` · `unrecognized_keys` · `verification_failed` · `registry_unavailable` · `dns_error` · `dns_write_failed` · `provider_error` · `upstream_unreachable` · `retell_error` · `retell_unauthorized` · `retell_bad_response`

### 2. Verification outcome codes — `VerifyResult` from `@agenid/core`

These are **values, never exceptions** — a thrown error invites a `catch` that swallows it, and a swallowed verification failure is indistinguishable from success. They appear in the envelope's `proof_check.code` and each assertion's `check.code`.

`schema_invalid` · `manifest_digest_mismatch` · `assertion_not_applicable_to_current_manifest` · `key_id_mismatch` · `key_role_mismatch` · `key_controller_mismatch` · `key_not_active_at_signing_time` · `not_yet_valid` · `expired` · `signature_invalid`

A successful result is `{ ok: true, claimState: "DECLARED" | "VERIFIED" }`.

### 3. Thrown `AgenIdError` codes — programming and input errors only

Reserved for malformed input, illegal number domains, and signing-time misuse. Never used to report a verification outcome.

`invalid_number_domain` · `unserializable_value` · `invalid_identifier` · `invalid_key_id` · `key_role_mismatch` · `schema_validation_failed`

---

## Versioning

The **protocol** is versioned (v1.1.1, plus errata E1 and E2) and is the source of truth; changes to identity, cryptography, serialization, verification, or schemas require an erratum or a new protocol version. The **HTTP surface** carries a `/v1/` path prefix on the protocol endpoints. Package versions are independent of both. Nothing is published to npm and nothing is tagged.

The envelope carries its own `agenid_envelope_version: "1.0"`.

## OpenAPI

[`/api/v1/openapi.json`](https://www.agenid.com/api/v1/openapi.json) — **OpenAPI 3.0.3** (not 3.1). Verified live: it documents four paths (`/api/resolve/{agenid}`, `/api/v1/verify`, `/api/v1/agents`, `/badge/{agenid}/shield.svg`), six component schemas (`RegisterRequest`, `RegisterResponse`, `VerifyRequest`, `VerifyResponse`, `ResolutionEnvelope`, `Error`), and one server (`https://www.agenid.com`). Its request and response shapes match the implementation and this document.

### Known documentation gaps

Stated rather than papered over:

1. **The OpenAPI document covers 4 of the 13 deployed routes.** The Retell and DNS routes are absent, so the machine-readable contract understates both the real capability and the real public attack surface.
2. **`/api/verify-dns` and `/api/dns/verify` are two routes performing one check.** One will be removed; do not build against both.

Both are tracked as open queue items and will be fixed together, since the first determines what the second should say.

---

## Verifying an envelope yourself

This is the product. Everything above is convenience.

1. Fetch the envelope: `curl -H 'Accept: application/json' https://www.agenid.com/a/<agenid>`
2. Re-verify it offline with `@agenid/core` alone — no network, no registry.
3. Confirm the recomputed manifest digest matches.
4. Change one character of the manifest and confirm it is rejected with `manifest_digest_mismatch`.
5. Compare `operator_key.document` against the operator's own `.well-known` copy.

If step 2 disagrees with what the registry told you, the registry is wrong, and you should say so loudly. That is what it is there for.
