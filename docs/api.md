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

`AGENID_AUTHORITY_TOKEN` gates the assertion write path in `@agenid/api`. That path is not deployed.

**What the signature does NOT do** is authenticate the *request*. It authenticates the *object* — so an object, once seen, can be resubmitted by anyone holding a copy for as long as its validity window lasts. Nothing binds a live HTTP request to a registered agent. See `GAP-C1`/`GAP-C2` in [SECURITY-GAP-ANALYSIS.md](SECURITY-GAP-ANALYSIS.md).

## Rate limiting

**Every `POST` endpoint is bounded.** Unauthenticated does not mean unmetered.

| Surface | Limit | Window |
|---|---|---|
| `POST /api/v1/agents`, `POST /api/retell/declare` | 30 | 60s |
| `POST /api/retell/bind` | 10 | 60s |
| `POST /api/retell/agents` | 12 | 60s |
| `POST /api/domain/status`, `POST /api/verify-dns` | 40 | 60s |
| `POST /api/v1/verify` | 240 | 60s |

Limits are per client, per window, and are **abuse bounds rather than quotas** — they are set well clear of legitimate use, including the 10/min that `/verify/domain` itself polls at.

Over the limit returns **`429 rate_limited`** with `retry-after` in seconds. Responses on the four highest-traffic surfaces also carry advisory `ratelimit-limit`, `ratelimit-remaining` and `ratelimit-reset` headers on success, so a client can pace itself rather than discovering the limit by hitting it.

`POST /api/retell/bind` additionally caps its `agents` array at **25** and returns `400 batch_too_large` beyond it. The rate limit bounds how many requests a caller may make; this bounds the work inside one.

Three properties worth stating because they are the ones that usually go wrong:

- **The client is identified from a platform-set header**, not from `x-forwarded-for`. `x-forwarded-for` is caller-supplied, so keying on it would let a caller mint a fresh bucket per request — a limiter that looks like one and bounds nothing.
- **Failure degrades, it does not disappear.** An in-process window is applied first and cannot fail; the durable counter in Postgres is consulted second. If the database is unreachable the limiter falls back to per-instance limiting, never to unbounded.
- **A refused caller costs nothing.** The limit is checked before the request body is read, and a caller refused by the in-process floor never reaches the database — otherwise the limiter would itself be the amplifier.

**Known residual:** the bound is per client IP prefix (IPv6 is collapsed to its /64), so a distributed source is limited in proportion to the address ranges it controls.

## CORS

**Verified by live request.** These nine send `access-control-allow-origin: *` on their responses and are intended to be callable cross-origin from a browser, a CI job, or an agent runtime:

`POST /api/v1/agents` · `POST /api/v1/verify` · `POST /api/retell/declare` · `POST /api/retell/bind` · `GET /api/v1/openapi.json` · `GET /api/resolve/{agenid}` · `GET /badge/{agenid}/shield.svg` · `GET /badge.js` · `GET /v1/keys/{key_ulid}`

The DNS routes and `/api/retell/agents` do **not** send it, and are same-origin only.

`/api/retell/bind` is on this list as of the commit that added it: it had been answering `OPTIONS` preflight with the header while its actual responses carried none, so a cross-origin browser POST cleared preflight and was then rejected at the response stage. Its sibling write path sent the header on responses, so the two public write endpoints disagreed about whether they were browser-callable. A test now requires the preflight and the response to agree.

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
| POST | `/api/verify-dns` | **Production** — the one standalone TXT check |
| POST | `/api/domain/status` | **Production** — provider detection, record state and key-discovery state in one read |
| POST | `/api/retell/declare` | **Production** |
| POST | `/api/retell/bind` | **Production** |
| POST | `/api/retell/agents` | **Production** |
| GET | `/v1/keys/{key_ulid}` | **Production** |
| GET | `/v1/keys?key_id={percent-encoded logical id}` | **Production** — returns the identical document |
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

`operator_key.discovery` names both required key-discovery paths, and both resolve. `registry_path` is the wire form of the key identifier — a bare ULID, not the logical `agenid:key:<ULID>` — and is relative to this registry's origin.

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

`DECLARED` and `L1_REGISTERED` render **amber**. Emerald is reserved for genuinely verified state.

Both badges, the Verification Card and the issuance wizard read one module — `packages/web/lib/trust-presentation.ts` — so they cannot disagree by construction rather than by a test comparing two copies. **Presentation fails closed:** a level this build does not recognize (absent, empty, malformed, or newer than this deployment) renders neutral slate and reads `UNVERIFIED`. It never renders emerald.

## GET /badge.js — live embed

Generated at request time from the canonical trust-presentation module, so the browser badge is a projection of that one table rather than a second opinion. Same URL as before.

```html
<script src="https://www.agenid.com/badge.js" data-agenid="agenid:01J…"></script>
```

---

## DNS endpoints

`POST /api/verify-dns` performs a real `_agenid.<domain>` TXT lookup against a caller-supplied per-domain token, joining chunked TXT records. On a match it reports `proves: "domain_control"`.

It is the **only** standalone TXT check. `POST /api/dns/verify` was a byte-for-byte copy of it and is deleted; both now share one probe in `packages/web/lib/dns-probe.ts`. The two copies had already drifted — only `/api/verify-dns` carried the domain-control disclosure — which is why the disclosure is now a shared constant rather than per-route prose.

**Domain control is evidence, never a level.** These endpoints cannot return a verification level: issuing `L2_DOMAIN_VERIFIED` requires a signed assertion from a root authority key that does not exist.

`POST /api/domain/status` returns provider detection, one-click availability, TXT record state and the operator's `.well-known` key-document state from a **single** read, so the surface cannot display a combination of states that never coexisted. It replaced `POST /api/dns/detect`, which did its own spec-literal Domain Connect discovery with no GoDaddy fallback and therefore disagreed with this route about whether the same domain supported one-click.

**`key_discovery.status` is one of `absent`, `invalid`, `published` or `unreachable` — never `verified`.** `published` requires a 2xx `application/json` body that parses as a strict `KeysDocument` from `@agenid/core` and names the probed domain as its `controller_domain`. The probe knows a domain, not an agent, so it never compares keys against the registry; that comparison is the verifier's job. `invalid` carries a `reason`: `not_json`, `malformed_json`, `schema_invalid`, `controller_domain_mismatch`, `too_large` or `http_<status>`. Bodies are read to at most 64 KiB. *(Until Sept 20 this field reported `verified` for any 2xx — including the `200 text/html` homepage most single-page-app hosts serve for every unknown path. That was a trust surface asserting an outcome it never computed, and it was live against `aiventureholdings.com`.)*

**`POST /api/dns/auto-add` is deleted, deliberately and permanently.** It held a Cloudflare or GoDaddy API credential and wrote to the operator's zone. AgenID does not hold write access to customers' DNS zones — that is the credential this product's whole argument is against — and the architecture decision was made in favour of Domain Connect, where the operator authorizes the record at their own provider. A test forbids any source file in `packages/web` from reading a DNS provider credential or calling a provider's write API.

Errors: `invalid_domain`, `invalid_token`, `invalid_json`, `dns_error`.

---

## Retell endpoints

`POST /api/retell/declare` re-verifies an operator-signed `ManifestProof` and **never returns a level above `DECLARED`** — test-enforced. It receives no private key.

`POST /api/retell/bind` is a batch registration. It delegates every agent to the same `registerAgent` implementation `/api/v1/agents` uses — a test forbids it from verifying, storing, or applying a clock policy of its own — writes both ledger events per agent, and fails the whole batch rather than reporting partial success. It returns byte-identical validation errors to `/api/v1/agents`, plus batch context.

`POST /api/retell/agents` proxies one read-only call to Retell using a caller-supplied API key. The key is used once and never stored. **It is unauthenticated and unrated.** Errors: `missing_api_key`, `retell_unauthorized`, `retell_error`, `retell_bad_response`.

---

## GET /v1/keys/{key_ulid} — key discovery

The registry half of two-path key discovery (spec §9.2). Read-only, unauthenticated, no body, no side effects. It resolves a key document already held by the registry; it verifies nothing, reports no verification level, and says nothing about any agent.

**Identifier forms.** A key has a *logical* identifier, `agenid:key:<ULID>`, and a *wire* form, the bare `<ULID>`. §0.A gives each of them a position: the wire form is what appears in the path — exactly what a resolution envelope's `operator_key.discovery.registry_path` contains — and the logical form is what appears in `?key_id=`. Each position accepts only the form §0.A assigns it, so one key has one spelling per position. These two resolve, and return a byte-identical document:

```
GET https://www.agenid.com/v1/keys/01J8Z3M9Q4XK2P7VBN6TDR8HWE
GET https://www.agenid.com/v1/keys?key_id=agenid%3Akey%3A01J8Z3M9Q4XK2P7VBN6TDR8HWE
```

**Encoding.** The decision is taken on the **raw request target**, before any framework has normalized it — not on the path parameter a framework hands the handler. The rule is therefore stated without decoding anything: *the path segment, as it appears in the raw request target, must be the literal wire form*, and a bare key-ULID contains no percent sign, so any percent-escape in that position is refused with `400 invalid_key_id`. The `?key_id=` value is percent-decoded here exactly once, by this registry, so the query form's decode count does not depend on a parser either.

This replaced a rule built on the framework's parameter, which assumed that parameter had been decoded exactly once. That assumption was a property of the platform, not of the protocol, and it was false: measured against `www.agenid.com` on 2026-09-15, `/v1/keys/<ULID encoded twice>` returned **200** while the identical code returned **400** under a local `next start`. Vercel applies RFC 3986 path normalization ahead of the router — decoding percent-escapes and re-encoding the characters that are structurally significant in a path — and Next then decoded the dynamic segment again. An alias resolved, on the one surface whose whole purpose is that a key has exactly one spelling.

What holds identically on every platform now: **nothing beyond one layer of percent-encoding resolves anywhere**, so no alias of a key exists. The honest residual, stated rather than glossed: on Vercel a *single* layer of unreserved-character encoding is removed by the platform before any application code runs, so this registry cannot observe whether a client wrote `01J8…` or `%30%31…`. That is RFC 3986 §2.3 equivalence performed upstream, not an alias this code accepts — and where the wire target is visible (a self-hosted `next start`, or `@agenid/api`), that spelling is refused too. `pnpm run check:docs:live` asserts the multiply-encoded targets against production, and asserts the **reason** and not merely the status, because two different rules can produce the same code for the same target.

**Response `200`** — the key document exactly as §9.1 defines it, nine members, no more:

```json
{
  "key_id": "agenid:key:01J8Z3M9Q4XK2P7VBN6TDR8HWE",
  "key_type": "Ed25519",
  "public_key_b64u": "C2XCaQ41IZoFum-4PbNJ1aUCevSZwClSzjyZ-x85T3g",
  "role": "operator",
  "controller": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y",
  "created_at": "2026-09-13T00:00:00Z",
  "status": "active",
  "retired_at": null,
  "revoked_at": null
}
```

The document is re-validated against the strict `KeyDocument` schema before it is served, so a stored row carrying any member the schema does not define is refused rather than passed through. There is no representation of private key material in that schema, and the registry never holds any.

`status` may be `active`, `retired` or `revoked`. **Retired and revoked keys remain resolvable forever**, deliberately: a signature made before a key was retired stays verifiable, and a verifier needs the document to decide that. A `200` here is not a statement that the key is currently usable — read `status`, `retired_at` and `revoked_at`.

Sent with `access-control-allow-origin: *` and `cache-control: no-store`. Not cached, because a cached key document is a cached copy of a revocation that has not happened yet.

| Status | `error` | When |
|---|---|---|
| `400` | `invalid_key_id` | The reference is not the form its position takes (a bare key-ULID on the path, `agenid:key:<ULID>` in `?key_id=`); or the raw path segment carries any percent-escape at all, so it is not the literal wire form; or it carries a URI fragment, raw or percent-encoded as `%23` (§9.2 requires a `400`, never truncation); or the `?key_id=` value is still percent-encoded after this registry's single decode; or `?key_id=` is absent, or supplied more than once, on the collection form; or the raw target and the framework's own path parameter disagree, which means something rewrote the request between the wire and the handler and there are two readings of it rather than one. The `message` names which of these it was, in fixed text |
| `404` | `key_not_found` | No key document is published under that identifier. **Distinct from `agent_not_found`** — a key is not an agent, and neither absence implies the other |
| `405` | `method_not_allowed` | Anything but `GET` or `OPTIONS`. Sent with `Allow: GET, OPTIONS`, the CORS header and `no-store`, so a browser verifier can read the reason. Key discovery is read-only; no method reaches business logic |
| `503` | `registry_unavailable` | The store could not be reached. This key's status is unknown, not disproven |
| `503` | `key_document_invalid` | The stored document failed schema validation, or its `key_id` disagreed with the identifier it was indexed under. Nothing is served |

Error bodies never quote the caller's input back — including the ones the HTTP framework itself produces. `@agenid/api` installs a framework-error handler for exactly this: Fastify raises `FST_ERR_BAD_URL` while still parsing the target, before routing, and its default body is `Invalid URL: <the caller's complete request target>`. A request for `/v1/keys/<script>CANARY…%ZZ` came back carrying that string, from a surface whose own error text was written not to do that. Framework errors now return the same fixed AgenID sentences the handler would have produced, with no message, no stack, and no target echoed.

**Two further platform behaviours, measured against production after this shipped rather than assumed.** An invalid percent-escape in the *query* string (`?key_id=%ZZ`) is normalized away by Vercel's edge before the application sees it, so production reports that reference as not being the logical form while a self-hosted deployment reports it as a malformed escape — both `400 invalid_key_id`, differing only in the reason. And `TRACE` is answered by the edge with a bare `405` carrying neither `Allow` nor the CORS header; Next cannot export a `TRACE` handler, so that response is the platform's and not this application's. Neither is claimed as repository behaviour.

**Known limitation.** A malformed percent-escape (`/v1/keys/%ZZ`, `/v1/keys/%`) makes Next's own parameter decoding throw *before* the route handler runs, so a self-hosted `next start` answers it with an opaque `500`. It cannot be fixed inside a route handler. It does not reach production: Vercel's edge refuses those targets with its own plain `400 Bad Request` before Next sees them — verified by sending the raw target directly, since curl will not transmit it.

## Not deployed

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

[`/api/v1/openapi.json`](https://www.agenid.com/api/v1/openapi.json) — **OpenAPI 3.0.3** (not 3.1). Verified live: it documents **all 15 deployed paths** — `/api/v1/agents`, `/api/resolve/{agenid}`, `/a/{agenid}`, `/api/v1/verify`, `/api/v1/openapi.json`, `/badge/{agenid}/shield.svg`, `/badge.js`, `/blog/feed.xml`, `/v1/keys/{key_ulid}`, `/v1/keys`, `/api/verify-dns`, `/api/domain/status`, `/api/retell/declare`, `/api/retell/bind`, `/api/retell/agents` — eight component schemas (`RegisterRequest`, `RegisterResponse`, `VerifyRequest`, `VerifyResponse`, `ResolutionEnvelope`, `DomainControlResult`, `DomainStatus`, `Error`), and one server (`https://www.agenid.com`). Its request and response shapes match the implementation and this document.

Coverage is enforced in both directions by `packages/web/test/dns-surface.test.ts` — a route handler with no documented path fails the suite, and so does a documented path with no handler — and `scripts/check-docs.mjs` re-asserts it against the live document.

### Known documentation gaps

Stated rather than papered over:

Both gaps previously listed here are closed.

**The OpenAPI document now covers every deployed route**, and the correspondence is enforced in both directions by `packages/web/test/dns-surface.test.ts`: a route handler with no documented path fails the suite, and so does a documented path with no handler. The older half of that rule — never document a route that does not exist — was always enforced by review; the newer half exists because omission is a claim too. A contract describing 4 of 13 routes told a security reviewer that two unauthenticated write paths, a credential-forwarding proxy and two outbound DNS amplifiers did not exist.

**The duplicate TXT-check route is removed.** `/api/verify-dns` is the survivor.

---

## Verifying an envelope yourself

This is the product. Everything above is convenience.

1. Fetch the envelope: `curl -H 'Accept: application/json' https://www.agenid.com/a/<agenid>`
2. Re-verify it offline with `@agenid/core` alone — no network, no registry.
3. Confirm the recomputed manifest digest matches.
4. Change one character of the manifest and confirm it is rejected with `manifest_digest_mismatch`.
5. Compare `operator_key.document` against the operator's own `.well-known` copy.

If step 2 disagrees with what the registry told you, the registry is wrong, and you should say so loudly. That is what it is there for.
