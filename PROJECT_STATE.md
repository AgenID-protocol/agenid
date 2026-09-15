# Project State

**Authoritative status of the AgenID reference implementation.** Updated as implementation status changes — if this document and the product disagree, this document is the defect.

**Last updated:** 2026-09-15 · **Protocol:** v1.1.1 + errata E1, E2 · **Production:** [www.agenid.com](https://www.agenid.com)

**Suite at this revision:** 187 tests green — core 54, api 32, cli 8, mcp-server 4, web 89. `pnpm install --frozen-lockfile` and `pnpm -r build` both clean on Node 22.

---

## Verified in production

Demonstrably operational, checked against the live deployment rather than inferred from the code.

| Capability | Evidence |
|---|---|
| **Browser issuance** — `/issue` generates an Ed25519 key in the tab, signs a manifest locally, and registers it | Registered live; private key never in a request body or browser storage (test-enforced) |
| **`POST /api/v1/agents`** — signature, digest binding, key role, and controller all verified before storage; returns `L1_REGISTERED` | Tamper, wrong-key, authority-role, unknown-member, and replay all rejected against production |
| **Durable registry** — Supabase Postgres via `SupabaseStore`, RLS enabled | Cross-invocation persistence proven with real data: the Verification Card is a different serverless function from the POST route and resolved the record through Supabase; direct SQL confirmed the agent row, the operator key row (`role=operator`, no private-key field), and the ledger events |
| **Resolution** — `GET /api/resolve/<agenid>`, `GET /a/<agenid>` (HTML card and JSON envelope) | Envelope independently re-verified **offline** with `@agenid/core` alone; a one-character manifest tamper is rejected with `manifest_digest_mismatch` |
| **`POST /api/v1/verify`** — verify a manifest and proof without registering | Live; 400 on malformed input, correct algorithm and canonicalization reported |
| **Badges** — `/badge.js` and `GET /badge/<agenid>/shield.svg` | Level→colour mapping pinned across both badges by a test that reads both files; unknown identifiers render neutral grey, never red |
| **`/ecosystem`** — 25 platform entries, all three status definitions, and the no-endorsement notice | Build-breaking e2e assertion plus a live fetch |
| **OpenAPI 3.0.3** at `/api/v1/openapi.json` | Documents all four live API paths |
| **Public site** — apex → www redirect, full IA, SEO metadata, schema endpoint | Verified by direct `curl`, not claimed |

**The honest ceiling: `L1_REGISTERED` is the highest level this deployment can issue.** L1 is a self-declaration. Every surface renders it amber, never emerald.

## Implemented, not production-verified

| Component | Note |
|---|---|
| `@agenid/core` | Full protocol library. Conformance vectors pass. Not published to npm. |
| `@agenid/api` | Standalone Fastify registry. Production serves the equivalent routes from `packages/web` instead; this package is not separately deployed. |
| `@agenid/cli` | Real key generation and local signing. Not published to npm. |
| `@agenid/mcp-server` | Needs a line-by-line read before it is vouched for publicly. Not published to npm. |
| `/api/dns/verify`, `/api/verify-dns` | Real `_agenid.<domain>` TXT lookup, chunked records joined. Reports domain control as *evidence*, never as a level. Two routes perform the same check — one must go. |
| `/api/dns/auto-add` | Cloudflare and GoDaddy TXT writes. **Unconfigured in production** — neither credential is set, and `/api/dns/detect` gates on their presence, so it is unreachable from the UI. Dead code in production until a decision is made. |
| `0002_onboarding_tables.sql` | Written, deliberately unapplied. Wizard-specific state only. |

## In development

| Item | State |
|---|---|
| Root authority key ceremony | Custody **decided**: Google Cloud KMS, `EC_SIGN_ED25519`, HSM protection level. Policy and ceremony runbook drafted and awaiting approval. **No key has been generated.** |
| Protocol v1.2 delegation object | Design drafted. Would restore the offline-root / online-intermediate pattern and sharply reduce root-compromise blast radius. |

## Planned

- `GET /v1/keys/<key-ulid>` — the second key-discovery path. Read-only over data already in the store, so it is small, and it should ship before any external party is invited to verify anything.
- `POST /v1/agents/:id/assertions` — the assertion write path. Blocked on the root key.
- `L2_DOMAIN_VERIFIED` issuance. **L2 first and only**: its evidence is a DNS record any third party can re-derive, so a bad L2 is externally detectable. L3's evidence is offline documentation nobody outside can re-check.
- `@agenid/adapter-*` packages for the eight documented platforms. Not started.
- npm publication of `@agenid/core`, `@agenid/cli`, `@agenid/mcp-server`. Scope confirmed unclaimed; the `@agenid` org does not yet exist.
- Rate limiting on the public write endpoints.
- Flip this repository public at launch.
- Conformance suite roadmap: Go and Rust reference implementations, CI matrix, automated vector re-sync from the spec.
- Rendered-browser visual QA and Lighthouse pass; reduced-motion and keyboard navigation confirmed in a real browser.

## Deprecated

Nothing is currently deprecated. `_quarantine/` holds removed fabricated stubs for the incident record and is gitignored; nothing in it should ever be restored without a line-by-line read.

## Known limitations

1. **No trust root exists.** Nothing above `L1_REGISTERED` can be signed. `/.well-known/agenid/authorities.json` correctly returns 404.
2. **No delegation object in v1.1.1.** The pinned root must sign every assertion, so the offline-root CA pattern is unavailable and a root compromise would invalidate historical assertions — a verifier cannot distinguish a legitimate historical signature from a backdated forgery.
3. **Two-path key discovery is half-deployed.** The registry path works; the key path 404s. A verifier can compare the envelope's operator key against the operator's `.well-known` copy, but cannot complete the full check against `agenid.com`.
4. **The trust root's security ceiling is control of the `agenid.com` zone and the `AgenID-protocol` GitHub org**, not key storage. Domain and repository hardening are prerequisites of the ceremony, not adjacent chores.
5. **Public write endpoints are unauthenticated and unrated.** Every write is signature-verified and self-attributed, but registration volume is unbounded. `/api/retell/agents` is additionally an unauthenticated relay to a third-party API from AgenID's domain.
6. **`packages/web` carries a second registry implementation** mirroring `@agenid/api`'s validation, because `zod` is not resolvable inside `packages/web`. Equivalence is held by test, not by shared code.
7. **`/onboarding/retell` is publicly reachable, crawlable, and linked from nothing** — neither a real public entry point nor an internal one. It is also where the most recent fabricated claims were found.
8. **Some content is manually mirrored.** `packages/web/public/schemas/`, `content/partners/`, and `content/onboarding.md` are byte-identical twins of their sources, kept in sync by hand. A `diff` in CI would cost nothing.

## Current blocker

**The root authority key ceremony.** It is no longer only a protocol-completeness item — it is the blocker on the product's main conversion path. `/issue` gets an operator to L1 in a minute, L1 is honestly labelled a self-declaration, and the next question every new operator asks is how to get the verified one. There is currently no answer that ships.

The ceremony is gated on a hardening checklist that must complete first — registrar lock, DNSSEC, hardware-key 2FA on the DNS account, enforced 2FA on the GitHub org, branch protection and required signed commits on the spec repository, and an audit-log export before key creation. HSM custody before that hardening is theater, because an attacker controlling the domain or the org can publish a different pin using none of AgenID's key material.

Three open items must close before Section 8 of the ceremony runbook begins: empirical confirmation that `EC_SIGN_ED25519` is available at HSM protection level; the final permanent `authority_id` string; and the v1.2 delegation decision.
