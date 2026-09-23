# Project State

**Authoritative current-state control document for the AgenID reference implementation.** If this document and the implementation disagree, the implementation wins and this document is the defect.

## Project

| | |
|---|---|
| **Name** | AgenID — cryptographic identity infrastructure for AI agents |
| **Purpose** | An open protocol giving an AI agent a portable identifier, a signed manifest, and a resolution envelope **any third party can re-verify offline without trusting the AgenID registry** |
| **Repository** | [`AgenID-protocol/agenid`](https://github.com/AgenID-protocol/agenid) (private), [`AgenID-protocol/spec`](https://github.com/AgenID-protocol/spec) (public, normative), [`AgenID-protocol/conformance`](https://github.com/AgenID-protocol/conformance) (public) |
| **Production URL** | [www.agenid.com](https://www.agenid.com) — apex redirects to www |

## Current status

| | |
|---|---|
| **Protocol version** | v1.1.1 + errata E1, E2 |
| **Phase** | Reference implementation live at L1; trust root not yet established |
| **Production status** | **PRODUCTION** for registration, resolution, verification cards and badges |
| **Deployment status** | Vercel, deployed from `main`, root directory `packages/web` |
| **Last verified** | 2026-09-15, commit `a95928b`, by calling every live endpoint and diffing the served OpenAPI document against the routes |
| **Test suite** | **678 passing** — core 99 (93 + the six §8 rejection vectors now driven from the spec fixture), api 84, cli 8, mcp-server 4, web 483. Concurrent sessions are actively adding to `web` and `api`; re-count rather than assuming a delta is yours. CI reports the authoritative count for the committed tree. |
| **CI** | **Green on Node 20, 22 and 24.** Previously red on the Node 20 leg for several commits; root-caused and fixed in `a95928b`. A second job, `spec-sync`, fails the build if the §8 vector fixture or any of the five JSON Schemas drifts from `AgenID-protocol/spec`. |
| **npm** | Nothing published. `@agenid/core`, `@agenid/cli`, `@agenid/mcp-server` all 404 on the registry. |

**The honest ceiling: `L1_REGISTERED` is the highest level this deployment can issue, and L1 is a self-declaration.** Every surface renders it amber, never emerald.

## Implemented

Capabilities that exist in code. Implemented is not the same as deployed, and neither is the same as production verified.

| Capability | Where |
|---|---|
| Identifiers, RFC 8785 JCS, normative strict schemas, Ed25519 proof engine, §8 conformance vectors | `@agenid/core` |
| Fastify registry over `RegistryStore`, resolution envelope construction, registration clock policy | `@agenid/api` |
| Operator CLI — key generation, manifest construction from explicit attestations, local signing | `@agenid/cli` |
| MCP server — resolve identities, verify manifests, generate keypairs from any MCP client | `@agenid/mcp-server` |
| Site, `/issue`, resolver, badges, and the deployed API routes | `@agenid/web` |
| Browser Ed25519 signer with an independent JCS implementation | `packages/web/lib/client-crypto.ts` |
| Assertion write path (`POST /v1/agents/:id/assertions`) | `@agenid/api` — **not deployed** |
| Domain-control evidence — `POST /api/verify-dns` (real `_agenid.<domain>` TXT lookup) and `POST /api/domain/status` (provider detection, Domain Connect, and the operator's `.well-known` key document — reported `published` only when it strictly parses as a `KeysDocument` for that domain, never merely because the server answered 200) | `packages/web`. **No DNS write path exists:** `/api/dns/auto-add` is deleted, not unconfigured, and AgenID holds no provider credential |
| Ecosystem registry and validator — 25 platforms, one reviewable JSON file each | `packages/web/data/ecosystem/`, `lib/ecosystem.ts` |
| Long-form content library — 34-term glossary, 4 pillar guides, 6 sourced comparisons, voice-agent use-case hub, `/why-agent-identity` hub, research report, release-notes blog + RSS, `/badge` embed docs, and 17 `/how-it-works` scenarios (up from 9). One renderer that states the L1 issuance ceiling on every page; guarded by `test/content.test.ts` | `packages/web/lib/content/`, `components/content/`, `app/{glossary,learn,compare,use-cases,blog,state-of-agent-identity,badge}` |

## Production verified

Independently checked against the deployed system on 2026-09-15 — not inferred from the code, and not the same list as *Implemented*.

| Capability | How it was verified |
|---|---|
| **Browser issuance** (`/issue`) | Registered a real agent live; private key never in a request body or browser storage (test-enforced) |
| **`POST /api/v1/agents`** | `201 L1_REGISTERED` against production; tamper, wrong-key, authority-role, unknown-member and replay all rejected |
| **Durable Supabase-backed registry** | **Cross-invocation persistence proven with real data** — the Verification Card is a different serverless function from the POST route and resolved the record through Supabase; direct SQL confirmed the agent row, the operator key row (`role=operator`, no private-key field) and the ledger events |
| **Resolution** (`/api/resolve/`, `/a/`) | Envelope re-verified **offline** with `@agenid/core` alone; a one-character manifest tamper rejected with `manifest_digest_mismatch` |
| **Representation split on `/a/`** | HTML returns `200` with a neutral *Not registered* card for an unknown identifier; `Accept: application/json` returns `404 agent_not_found`. Both confirmed by live request. |
| **`POST /api/v1/verify`** | Live; raw Ed25519 check over JCS bytes; `400` with `invalid_manifest` on empty body |
| **Badges** | `/badge/<id>/shield.svg` returns 200 for an unknown identifier and renders neutral grey; `/badge.js` live, generated from the canonical trust-presentation module |
| **OpenAPI 3.0.3** | Fetched live; four paths and six component schemas, matching the implementation |
| **`GET /v1/keys/{key-ulid}`** | Live; resolves a published operator key by its wire form, and `?key_id=` returns a byte-identical document; unknown key is `404 key_not_found`; malformed reference and URI fragment are `400 invalid_key_id` |
| **Every "not deployed" claim** | `/v1/agents/…/assertions` and `/.well-known/agenid/authorities.json` each confirmed `404` |
| **Public site** | All 11 pages return 200; `/sitemap.xml` and `/robots.txt` live; `/onboarding/retell` serves `noindex, nofollow` |
| **First real pilot agent** | `agenid:01M30753M8KR2AMB86WKR4DDFB` — a live AIVH-operated agent registered through the public write path, `201 L1_REGISTERED`; card, envelope, amber badge and both key-discovery wire forms confirmed live; envelope re-verified **offline** with `@agenid/core` alone. See [docs/grok-bot-pilot.md](docs/grok-bot-pilot.md) |

## In development

| Item | State |
|---|---|
| Root authority key ceremony | Custody **decided** — Google Cloud KMS, `EC_SIGN_ED25519`, HSM protection level. Policy and runbook drafted, awaiting approval. **No key has been generated.** |
| Protocol v1.2 delegation object | Design drafted. Would restore the offline-root pattern and sharply cut root-compromise blast radius. |
| Protocol v1.2 authorization layer | **Implemented in `@agenid/core`, DRAFT and NOT NORMATIVE.** `AuthorizationGrant`, `Revocation`, a `principal` key role, and an offline `evaluateAuthorization`. Labelled `v1.2-draft` on every surface; `PROTOCOL_VERSION` stays `1.1.1`. Nothing in the deployed registry stores, serves or revokes a grant. Not issuable. |

## Planned

- `POST /v1/agents/{id}/assertions` — blocked on the root key.
- `L2_DOMAIN_VERIFIED` issuance. **L2 first and only**: its evidence is a DNS record any third party can re-derive, so a bad L2 is externally detectable. L3's evidence is offline documentation nobody outside can re-check.
- Request-level authentication (nothing binds a live HTTP request to a registered agent).
- An authorization layer: scopes, delegation from a principal, and revocation. See [docs/SECURITY-GAP-ANALYSIS.md](docs/SECURITY-GAP-ANALYSIS.md).
- OpenAPI coverage for the nine deployed routes it currently omits.
- `@agenid/adapter-*` packages for the eight documented platforms. Not started.
- npm publication of `@agenid/core`, `@agenid/cli`, `@agenid/mcp-server`. Scope confirmed unclaimed; the `@agenid` org does not yet exist. All three are now *packaged* for it — LICENSE, README and `publishConfig.access` in place, asserted by `check:docs` — and `.github/workflows/release.yml` is a manual, dry-run-by-default publish path. **Nothing is published, and provenance does not exist until a real release produces one:** npm attaches a provenance attestation only from a public repository.
- Flip this repository public at launch.
- Go and Rust reference implementations.
- Rendered-browser visual QA and Lighthouse pass; reduced-motion and keyboard navigation confirmed in a real browser.

## Not deployed

Exists in code, unavailable in production.

| Item | Why |
|---|---|
| `POST /v1/agents/{id}/assertions` | No root authority key exists to sign an assertion with |
| `/.well-known/agenid/authorities.json` | Correctly absent — publishing a pin for a nonexistent key would be the worst possible false claim |
| `@agenid/api` as a running service | Production serves the equivalent routes from `packages/web`; the Fastify server is not deployed anywhere |
| `0002_onboarding_tables.sql` | Written, deliberately unapplied. Wizard-specific state only; the wizard persists to the canonical tables today. |
| Agent statuses `CHANGED`, `STALE`, `SUSPENDED`, `REVOKED` | The column and enum exist so the envelope shape is stable, but no transition writes them. Every registered agent is `ACTIVE`. |

## Deprecated

Nothing is currently deprecated. `_quarantine/` holds removed fabricated stubs for the incident record and is gitignored; nothing in it should be restored without a line-by-line read.

## Current user flows

**Issue an identity (browser, ~60 seconds).** `/issue` → name the agent and supply operator fields and two attestations that start `false` → the browser generates an Ed25519 keypair and signs the manifest locally → `POST /api/v1/agents` with public material only → `201 L1_REGISTERED` → post-issuance panel offers the card link, the JSON envelope, an HTML embed, README markdown and a curl one-liner. The private key never leaves the tab and a one-time download is the only persistence offered.

**Issue an identity (CLI).** `@agenid/cli` generates a keypair, writes the private key `0600` without printing it, builds a manifest from *explicit* operator attestations, signs a `ManifestProof`, and re-verifies before reporting. It reports `DECLARED` and nothing above it.

**Verify an agent (third party).** Resolve `/a/<agenid>` in a browser for the Verification Card, or with `Accept: application/json` for the envelope → re-run verification offline with `@agenid/core` → compare the envelope's operator key against the operator's `.well-known` copy. The full two-path check cannot be completed against `agenid.com` yet.

**Retell fleet onboarding.** `/onboarding/retell` (`noindex`, linked from nothing) collects operator identity and attestations, signs client-side, and batch-registers through `POST /api/retell/bind`, which delegates to the same registration implementation as the public write path.

**Prove domain control.** Publish a `_agenid.<domain>` TXT record, then `POST /api/verify-dns` (or use `/verify/domain`, which polls `POST /api/domain/status`). This reports evidence of domain control. **It does not and cannot issue L2** — that needs the root key.

## Current API surfaces

Full reference, verified live: [docs/api.md](docs/api.md).

| Route | Status |
|---|---|
| `POST /api/v1/agents` · `GET /api/resolve/{agenid}` · `GET /a/{agenid}` · `POST /api/v1/verify` · `GET /api/v1/openapi.json` · `GET /badge/{agenid}/shield.svg` · `GET /badge.js` | **Production** |
| `POST /api/verify-dns` | Production — the one standalone TXT check |
| `POST /api/domain/status` | Production — provider, record and key-discovery state in one read |
| `POST /api/retell/declare` · `/bind` · `/agents` | Production |
| `GET /v1/keys/{key-ulid}` | Production |
| `POST /v1/agents/{id}/assertions` · `/.well-known/agenid/authorities.json` | **Not deployed** (404) |

## Current data model

Supabase Postgres, one migration applied (`0001_registry_store.sql`). RLS is enabled on all four tables with public-read policies; all writes go through the service role.

| Table | Key | Contents |
|---|---|---|
| `agents` | `agent_id` (`agenid:<ULID>`) | `manifest` jsonb, `manifest_digest`, `proof` jsonb, `status` (checked against the five-value enum), `registered_at`, `updated_at` |
| `keys` | `key_id` (ULID) | `document` jsonb; `role` and `controller` are **generated columns** extracted from the jsonb (immutable, so they are legal generated expressions), indexed on `role` |
| `assertions` | `assertion_id` | `subject`, `level`, `key_id`, `document` jsonb, `manifest_digest` generated from the jsonb, `verified_at` as a **plain** timestamptz column, indexed on `subject` |
| `events` | `event_id` | Append-only ledger: `agent_id`, `type`, `occurred_at`, `detail_ref` jsonb — **pointers and hashes only, never raw evidence** |

Relationships are by identifier rather than by foreign key: an assertion's `subject` names an agent, and both a proof and an assertion name a `key_id`. Verification never relies on referential integrity — it re-derives everything from signatures.

`verified_at` is deliberately **not** stored as `text`: `Rfc3339Utc` permits optional fractional seconds, and lexicographic order disagrees with chronological order across mixed precision. It is equally deliberately not a generated column cast from jsonb, which Postgres rejects as non-immutable (`42P17`).

Ledger event types: `agent.registered`, `key.published`, `assertion.issued`, `manifest.changed`, `agent.status_changed`, `agent.revoked`. Only the first two are written today.

## Current integrations

| Integration | State |
|---|---|
| Supabase Postgres | **Active** — production registry store, project `prljrmgickpkkunrrkxq` |
| Vercel | **Active** — hosting and deployment for `packages/web` |
| GitHub Actions | **Active** — CI on Node 20/22/24, all five packages plus e2e |
| DNS TXT lookup | **Active** — read-only, for domain-control evidence |
| Cloudflare / GoDaddy DNS write APIs | **Implemented, not configured** — no credential in production; gated so nothing is advertised that cannot run |
| Retell API | **Active** — one read-only call with a caller-supplied key, never stored |
| npm registry | **Unavailable** — the `@agenid` org does not exist; nothing published |
| Retell, Vapi, Bland, ElevenLabs, Grok Bot, LangChain, MCP Server, OpenClaw adapter packages | **Planned** — `docs/partners/` holds integration *patterns*; each carries its own "no adapter package exists" disclaimer |

## Security status

Full treatment: [docs/trust-model.md](docs/trust-model.md) and [docs/threat-model.md](docs/threat-model.md).

**Controls in place.** Strict schema validation rejecting unknown members · Ed25519 signature and digest-binding verification on every write · key role and controller enforcement · bounded forward clock skew at registration with none at verification · operator keys generated and held client-side only, never transmitted or stored · RLS enabled on every table with public-read policies and service-role writes · append-only event ledger storing pointers, never evidence · a public-surface test suite that makes each honesty rule a build-breaking assertion.

**Known gaps.** No request-level authentication on public write endpoints (they are rate limited as of 2026-09-18, and every write is signature-verified, but nothing ties a live request to a registered agent) · no authorization model at all: verification levels say how carefully an identity was checked, never what an agent may do · no revocation path for an agent or a key · `/api/retell/agents` is an unauthenticated relay to a third-party API from AgenID's domain · no trust root, so nothing above L1 can be signed · an operator who publishes no `.well-known` key copy leaves two-path discovery with a single source · no `security@` mailbox, because the `agenid.com` zone publishes no MX records.

## Known limitations

1. **No trust root exists.** Nothing above `L1_REGISTERED` can be signed.
2. **No delegation object in v1.1.1.** The pinned root must sign every assertion, so the offline-root CA pattern is unavailable and a root compromise would invalidate historical assertions — a verifier cannot distinguish a legitimate historical signature from a backdated forgery.
3. **Two-path key discovery depends on the operator's half.** Both routes resolve, but the `.well-known` copy is published by the operator; where there is none, a verifier has one source instead of two and the key-substitution defense is not actually in force.
4. **The trust root's real ceiling is control of the `agenid.com` zone and the `AgenID-protocol` GitHub org**, not key storage. An attacker controlling either publishes a different pin using none of AgenID's key material.
5. **Public write endpoints are unauthenticated and unrated.** Every write is signature-verified and self-attributed, but volume is unbounded, and `/api/retell/bind` accepts an unbounded array.
6. **`packages/web` carries a second registry implementation** mirroring `@agenid/api`'s validation, because `zod` is not resolvable inside `packages/web`. Equivalence is held by test, not by shared code.
7. **`/onboarding/retell` cannot complete a one-click DNS setup.** Its `apply_url` is null until AgenID's Domain Connect service template is registered with providers, so the operator adds the TXT record by hand. This is the correct failure mode — the alternative was a link that 404s on someone else's dashboard — but it is a real gap in that flow.
8. **Agent lifecycle statuses are stored but never written.** Every agent is `ACTIVE`; there is no revocation or status-change path in production.
9. **Some content is manually mirrored** — `packages/web/public/schemas/`, `content/partners/` and `content/onboarding.md` are byte-identical twins of their sources, kept in sync by hand.
10. **`/onboarding/retell` has never been rendered in a browser.** It has been exercised over HTTP and by grepping the shipped JS bundle only.
12. **A malformed percent-escape is a `500` on a self-hosted `next start`.** `/v1/keys/%ZZ` and `/v1/keys/%` make Next's own parameter decoding throw before the route handler runs, so the raw-target rule never gets to answer them. It cannot be fixed inside a route handler. Production is unaffected: Vercel's edge refuses those targets with its own plain `400 Bad Request` first — verified by sending the raw target directly, since curl will not transmit it.
13. **A single layer of unreserved-character percent-encoding in a path is invisible on Vercel.** The platform normalizes it away before any application code runs, so this registry cannot tell `/v1/keys/01J8…` from `/v1/keys/%30%31…`. That is RFC 3986 §2.3 equivalence, not an alias — and nothing beyond one layer resolves on any platform — but it does mean a local test cannot prove production's answer for that one spelling.
14. **No deployment binding exists.** v1.1.1 has no object tying an identity to the runtime it executes on, so presenting a valid identity from an unauthorized deployment is not detectable by the protocol. Found by the first pilot; see [docs/grok-bot-pilot.md](docs/grok-bot-pilot.md).
15. **No capability or provider object exists.** `platform`, `permissions` and `configuration_fingerprint` are reserved manifest keys that `.strict()` rejects, so what an agent can do — and which vendor actually ships it — cannot be expressed in signed protocol material. The pilot records both as repository evidence, explicitly outside the protocol.
16. **`evaluateAuthorization` binds the actor only when asked to.** The v1.2-draft evaluator ties the presented agent to the grant's subject only if both `manifest` and `operatorKey` are supplied; omit them and a grant issued for a *different* agent evaluates `PERMITTED`. Pinned by a core test that runs one forged grant both bound and unbound. It needs the treatment `revocationsChecked` already gets — report the gap rather than let it read as a bound decision.

## Known risks

- **Root compromise would be unbounded and retroactive** (limitation 2). This is the single largest unresolved architectural risk, and it is why custody is a callable audit-logged KMS key rather than air-gapped hardware.
- **Domain or GitHub org compromise defeats the trust root entirely** (limitation 4), independent of key storage. The hardening checklist is a prerequisite of the ceremony, not an adjacent chore.
- **Unbounded registration volume** (limitation 5) is a cost and availability risk today, and a spam risk the moment a public directory exists.
- **Two implementations of registration validation** (limitation 6) can drift. They are tested for equivalence; the test is the only thing preventing divergence.
- **Fabricated verification claims have reached this repository repeatedly** — seven instances, one of which shipped to production for a day inside a commit whose headline change was a genuine security improvement. The controls are now tests rather than review conventions, but the class is live.

## Recent changes

| Date | Change |
|---|---|
| 2026-09-23 | **Content library (SEO strategic investments S1–S8)** — glossary, guides, comparisons (every third-party claim cited), research report (every figure cited), blog, use-case hubs, badge docs, eight new scenarios; an IETF-style Internet-Draft of v1.1.1 at `docs/draft-morgan-agenid-agent-identity-00.md` (not submitted) |
| 2026-09-15 | **Key discovery decided from the raw request target** — a twice-encoded key ULID resolved `200` in production while the identical code returned `400` locally, because the guard was built on a framework-decoded path parameter and Vercel decodes the path once before Next decodes the segment again. Also: Fastify framework errors stopped reflecting the caller's request target; `/v1/keys` became read-only on both frameworks and authority key publication moved to `POST /v1/authority/keys`; the cross-registry parity test was rebuilt on raw-target fixtures after it was found comparing two different requests |
| 2026-09-15 | **Trust-state presentation centralized and made fail-closed** — both badges and the Verification Card had an `else -> emerald VERIFIED` default, so an unrecognized level rendered as verified |
| 2026-09-15 | Documentation architecture audit — five core documents brought to standard; six fabricated claims in the previous API reference found and corrected by live verification |
| 2026-09-15 | `a95928b` — `SupabaseStore` required a global `WebSocket` it never uses; CI had been red on Node 20 for several commits. Fixed at both call sites with a proven regression test. |
| 2026-09-15 | `6390934` — repository front door: README, LICENSE, SECURITY, CONTRIBUTING, CHANGELOG, PROJECT_STATE, four architecture docs |
| 2026-09-15 | `ea3ff9b` — public-surface integrity sweep: two more defaulted attestations, registration implemented twice, presentation layer deciding trust state |
| 2026-09-15 | `1a52a2c` — product ↔ website sync: fabricated attestations, dead hosts, verified-state colour drift |
| 2026-09-15 | `de83f5b`, `be41a0a`, `f9c68d7` — browser issuance flow, registry clock truncation fixed, store timestamp shape normalized |
| 2026-09-14 | `3c97435` — Supabase provisioned; the migration could never have applied (non-immutable generated column) |
| 2026-09-14 | `80672ca`, `798c75d` — fabricated verification stubs replaced with real Ed25519; server-side key generation deleted outright |

## Next priority

**The authorization layer.** Rate limiting shipped on 2026-09-18 and closed the last item that was exploitable today by anyone with an HTTP client. The next priority is the largest *functional* gap, documented in [docs/SECURITY-GAP-ANALYSIS.md](docs/SECURITY-GAP-ANALYSIS.md): AgenID can say who an agent is and that its self-declaration verifies, but it cannot say who authorized the agent, what the agent may do, or whether that authority is still in force. Closing it needs a `principal` key role, a signed `AuthorizationGrant`, and a signed `Revocation` — additive v1.2 objects landing in the `permissions`/`authorizations` namespace the spec already reserved.

## Next blocker

**The root authority key ceremony.** It is no longer only a protocol-completeness item — it is the blocker on the product's main conversion path. `/issue` gets an operator to L1 in a minute, L1 is honestly labelled a self-declaration, and the next question every operator asks is how to get the verified one. There is no answer that ships.

The ceremony is gated on hardening that must complete first: registrar lock, DNSSEC, hardware-key 2FA on the DNS account, enforced 2FA on the GitHub org, branch protection and required signed commits on the spec repository, and an audit-log export before key creation. HSM custody before that hardening is theater, because an attacker controlling the domain or the org publishes a different pin using none of AgenID's key material.

Three open items must close before the ceremony begins: empirical confirmation that `EC_SIGN_ED25519` is available at HSM protection level; the final permanent `authority_id` string; and the v1.2 delegation decision.
