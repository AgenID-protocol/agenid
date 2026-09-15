# API Reference

**Base URL:** `https://www.agenid.com` · **Machine-readable:** [`/api/v1/openapi.json`](https://www.agenid.com/api/v1/openapi.json) (OpenAPI 3.0.3)

No API key is required for any public endpoint. **No endpoint accepts a private key**, and the registry cannot sign on an operator's behalf.

Current as of 2026-09-15, protocol v1.1.1 + errata E1/E2. Every endpoint below carries an explicit deployment status; anything marked **Not deployed** is documented because it exists in the specification or the codebase and you will encounter references to it — not because it can be called.

---

## Deployment status at a glance

| Endpoint | Method | Status |
|---|---|---|
| `/api/v1/agents` | POST | **Production** |
| `/api/resolve/{agenid}` | GET | **Production** |
| `/a/{agenid}` | GET | **Production** |
| `/api/v1/verify` | POST | **Production** |
| `/badge/{agenid}/shield.svg` | GET | **Production** |
| `/badge.js` | GET | **Production** |
| `/api/v1/openapi.json` | GET | **Production** |
| `/api/verify-dns`, `/api/dns/verify` | POST | Production — two routes, one behavior; one will be removed |
| `/api/dns/detect` | POST | Production, returns `manual` (no provider credentials configured) |
| `/api/dns/auto-add` | POST | Implemented, **unconfigured in production** |
| `/api/retell/declare`, `/api/retell/bind`, `/api/retell/agents` | POST | Production, Retell-specific |
| `/v1/keys/{key-ulid}` | GET | **Not deployed** |
| `/v1/agents/{id}/assertions` | POST | **Not deployed** — no root key exists to sign with |
| `/.well-known/agenid/authorities.json` | GET | **Not published** (correctly — no root key exists) |

---

## POST /api/v1/agents — register

Registers an operator-signed manifest. Returns `L1_REGISTERED`, which is **the highest level this deployment can issue**.

**Request** — public material only:

```json
{
  "manifest":     { "...": "the agent manifest" },
  "proof":        { "...": "operator-signed ManifestProof" },
  "key_document": { "...": "the operator's public KeyDocument" }
}
```

Unknown top-level members are **rejected**, not ignored. All three objects are validated against the normative strict schemas.

**Checks performed before anything is stored:**

1. Strict schema validation of all three objects
2. Digest binding — the proof's manifest digest must match the manifest supplied
3. Ed25519 signature over the RFC 8785 canonical proof payload minus `signature`
4. `key_id` in the proof matches the key document
5. `role === "operator"` — an authority-role key is refused
6. `controller` matches the agent being registered
7. Key active at the proof's `created_at`
8. Clock policy — see below

**Response `201`:**

```json
{
  "agent_id": "agenid:01J...",
  "level": "L1_REGISTERED",
  "registered_at": "2026-09-15T04:12:33.488Z",
  "disclosures": ["L1 is a self-declaration, not a third-party check"]
}
```

`registered_at` is always the **registry's** clock, never the client's.

**Clock policy.** A proof created up to **120 seconds** ahead of the registry is evaluated at its own `created_at`, because the signer and the registry are different machines within one request. Beyond that, the registration is refused with `clock_skew_too_large`. `verifyManifestProof` itself is untouched and applies no leeway — resolution keeps the registry's clock with no tolerance at all.

**Errors:** `400` schema or validation failure · `409` replay (an already-registered agent is never silently overwritten) · `422` verification failure with a stable code.

---

## GET /api/resolve/{agenid} — resolve

Returns the canonical **resolution envelope**: everything a verifier needs to check the identity without trusting this registry.

```jsonc
{
  "agenid_envelope_version": "1.0",
  "agent_id": "agenid:01J...",
  "status": "active",
  "registered_at": "2026-09-15T04:12:33.488Z",
  "manifest": { },
  "manifest_digest": { "alg": "sha-256", "value": "..." },
  "proof": { },
  "proof_check": { "ok": true },
  "operator_key": {
    "key_id": "01J...",
    "document": { },
    "discovery": {
      "registry_path": "/v1/keys/01J...",
      "well_known_url": "https://operator.example/.well-known/agenid/keys/01J..."
    }
  },
  "verification": {
    "level": "L1_REGISTERED",
    "valid_assertions": 0,
    "total_assertions": 0
  },
  "assertions": [],
  "verify_instructions": "how to re-verify this envelope without the registry"
}
```

Two properties worth understanding:

- **Assertions are re-checked at resolution time against the *current* manifest.** They are not trusted because they were valid when issued — editing a manifest invalidates every assertion bound to the old one.
- **`verification.level` is a convenience.** Every assertion is present with its own signature; recompute the level yourself.

`operator_key.discovery` names **both** required key-discovery paths. The registry path (`/v1/keys/...`) is **not deployed**, so `verify_instructions` currently says so and names the check that can be completed today: compare `operator_key.document` against the operator's own `.well-known` copy.

**Errors:** `404 agent_not_found` — clean, never a 500.

---

## GET /a/{agenid} — verification card

Two representations of one resource:

```bash
curl https://www.agenid.com/a/agenid:01J...                            # HTML card
curl -H 'Accept: application/json' https://www.agenid.com/a/agenid:01J...   # the envelope above
```

---

## POST /api/v1/verify — stateless verification

Verifies a manifest and proof **without registering anything**. Nothing is stored. Useful for checking an envelope you were handed.

```json
{ "manifest": { }, "proof": { }, "key_document": { } }
```

Returns the verification outcome, the algorithm, and the canonicalization used. `400` on malformed input.

---

## GET /badge/{agenid}/shield.svg — static badge

For Markdown surfaces that strip scripts.

```markdown
[![AgenID](https://www.agenid.com/badge/agenid:01J.../shield.svg)](https://www.agenid.com/a/agenid:01J...)
```

**Always returns HTTP 200**, including for unknown or malformed identifiers — a non-200 renders as a broken image rather than a badge. An unknown identifier renders **neutral grey** and reads `NOT REGISTERED`. Never red. Absence of verification is not a negative finding.

`DECLARED` and `L1_REGISTERED` render **amber**. Emerald is reserved for genuinely verified state, and the colour mapping is pinned against `/badge.js` by a test that reads both files, so the two badges cannot disagree.

## GET /badge.js — live embed

```html
<script src="https://www.agenid.com/badge.js" data-agenid="agenid:01J..."></script>
```

---

## DNS endpoints

`POST /api/verify-dns` and `POST /api/dns/verify` perform a real `_agenid.<domain>` TXT lookup against a caller-supplied per-domain token, joining chunked TXT records. On a match they report `proves: "domain_control"`.

**Domain control is evidence, not a level.** These endpoints never return a verification level, and cannot — issuing `L2_DOMAIN_VERIFIED` requires a signed assertion from a root authority key that does not exist.

Two routes perform the same check. One will be removed; do not build against both.

`POST /api/dns/detect` recommends a DNS provider only when that provider's credential is present in the environment. In production neither is, so it returns `recommended: "manual"`. `POST /api/dns/auto-add` writes the TXT record via Cloudflare or GoDaddy and is **unconfigured in production**; it is unreachable from the UI because `detect` gates it.

---

## Retell endpoints

`POST /api/retell/declare` re-verifies an operator-signed `ManifestProof`. It never receives a private key and **never returns a level above `DECLARED`** — test-enforced.

`POST /api/retell/bind` verifies every `ManifestProof` through `@agenid/core` before persisting to the canonical `agents` and `keys` tables. Returns `DECLARED` only.

`POST /api/retell/agents` proxies one read-only call to Retell using a caller-supplied API key. The key is used once and never stored. **It is unauthenticated and unrated** — see [PROJECT_STATE.md](../PROJECT_STATE.md).

---

## Not deployed

**`GET /v1/keys/{key-ulid}`** — the registry half of two-path key discovery. Its absence is why the full two-path check cannot be completed against `agenid.com` today. It is a read-only route over data already in the store, and it should ship before any external party is invited to verify anything.

**`POST /v1/agents/{id}/assertions`** — the assertion write path. It exists in `@agenid/api`, is authorization-gated by `AGENID_AUTHORITY_TOKEN`, and has no deployed route, because there is no root authority key to sign an assertion with.

**`/.well-known/agenid/authorities.json`** — returns 404, correctly. Publishing a pin for a key that does not exist would be the most consequential possible false claim.

---

## Error codes

Verification outcomes are **values with stable codes, never exceptions** — a thrown error invites a `catch` that swallows it, and a swallowed verification failure is indistinguishable from success.

| Code | Meaning |
|---|---|
| `agent_not_found` | No such identifier in the registry |
| `assertion_not_found` | No such assertion |
| `key_not_found` | The referenced key document is not resolvable |
| `schema_invalid` | Failed strict schema validation |
| `manifest_digest_mismatch` | The manifest does not match the digest the proof binds — it was modified after signing |
| `signature_invalid` / `invalid_signature` | Ed25519 verification failed |
| `key_id_mismatch` | The proof names a different key than the one supplied |
| `key_role_mismatch` | Wrong role for the operation (e.g. an authority key at registration) |
| `key_controller_mismatch` | The key does not control this agent |
| `subject_mismatch` | The assertion's subject is not this agent |
| `not_yet_valid` | Evaluated before the payload's validity window |
| `clock_skew_too_large` | Registration only — the proof's clock is more than 120s ahead |
| `dns_error` | DNS lookup failed |
| `registry_error`, `provider_error`, `retell_error` | Upstream failure |

## Verifying an envelope yourself

This is the product; everything else is convenience.

1. Fetch the envelope: `curl -H 'Accept: application/json' https://www.agenid.com/a/<agenid>`
2. Re-verify it offline with `@agenid/core` alone — no network, no registry.
3. Confirm the recomputed manifest digest matches.
4. Change one character of the manifest and confirm it is rejected with `manifest_digest_mismatch`.
5. Compare `operator_key.document` against the operator's own `.well-known` copy.

If step 2 disagrees with what the registry told you, the registry is wrong and you should say so loudly. That is what it is there for.
