# Changelog

Notable changes to the AgenID reference implementation. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**Nothing in this repository has been released to npm or tagged.** Protocol version **v1.1.1** (plus errata E1 and E2) is the specification this implementation tracks; package versions are independent of it. Entries below are grouped by date and reference the commit that carried the change.

---

## [Unreleased]

### Added
- **`scripts/check-docs.mjs`** — documentation consistency check, wired into CI. Resolves every relative link, asserts the README's package list against the workspace, forbids dead hosts and overclaim vocabulary, asserts `L5` stays out of the issuable enum, and with `--live` verifies twelve documented endpoint claims plus the OpenAPI version and path coverage against production.
- Regression test asserting `SupabaseStore` constructs on a runtime with no global `WebSocket`.
- Repository front door: `README.md` rewritten as a technical landing page, plus `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `PROJECT_STATE.md`, and `docs/architecture.md`, `docs/trust-model.md`, `docs/threat-model.md`, `docs/api.md`.

### Fixed
- **Trust presentation failed open.** Both badges and the Verification Card mapped levels as `if (level === "L1_REGISTERED") -> amber; else -> emerald VERIFIED`, so an unrecognized, absent, empty or malformed level rendered as the strongest claim the product can make — produced by the absence of information rather than by any evidence. Nothing forged a signature; the presentation layer upgraded on ignorance. Now one canonical module (`packages/web/lib/trust-presentation.ts`) enumerates the four issuable levels and resolves everything else to a neutral, non-verified state. `public/badge.js` became a route generated from that module, so no consumer carries its own table.
- **`SECURITY.md` named a reporting channel that does not exist on this repository.** GitHub offers private vulnerability reporting only on public repositories, and `AgenID-protocol/agenid` is private — `PUT .../private-vulnerability-reporting` returns 404 for it. Enabled and API-verified on `AgenID-protocol/spec` and `AgenID-protocol/conformance` instead, and `SECURITY.md` now points there and explains why. It also records that `agenid.com` publishes no MX records, so no `security@` address on that domain can receive mail — a reporting address that does not receive is worse than none.
- **`/api/retell/bind` answered CORS preflight but sent no CORS header on its responses**, so a cross-origin browser POST cleared preflight and was then rejected at the response stage. Its sibling public write path sent the header on responses, so the two disagreed about whether they were browser-callable. Found by verifying a documentation claim against live responses rather than against a grep of the source. A test now requires the preflight and the response to agree.
- **Six fabricated claims in the API reference**, found by verifying it against the live deployment rather than re-reading it. The registration response shape was wrong (the level is nested under `verification`, and `status`, `manifest_digest` and `links` were missing); a `422` status was documented that the API never returns; `POST /api/v1/verify` was described as `ManifestProof` verification when it is a raw Ed25519 signature check taking `{manifest, signature, public_key_hex}`; the error-code table conflated three separate namespaces; the `503`/`registry_unavailable` path was undocumented; and `/a/<agenid>`'s deliberate representation split — `200` HTML card, `404` JSON — was documented as a flat `404`.
- **CI was red on the Node 20 leg of the matrix, and had been for several commits.** `createClient` builds a RealtimeClient eagerly, which probes for a global `WebSocket` — absent before Node 22 — so merely *constructing* a `SupabaseStore` threw on a runtime the package's `engines` field claims to support. The other two matrix legs stayed green and hid it. Both call sites now supply a transport that short-circuits the probe and throws loudly if a realtime channel is ever opened, since AgenID never uses one.

---

## 2026-09-14

### Added
- **Browser issuance flow (`/issue`)** — name an agent, generate an Ed25519 key in the browser, sign the manifest locally, and POST only public material. The private key never leaves the tab and is never written to `localStorage` or `sessionStorage` (test-enforced). `de83f5b`
- **`POST /api/v1/agents`** — the registration write path, deployed in `packages/web`, mirroring `@agenid/api`'s validation exactly. `de83f5b`
- **`GET /badge/<agenid>/shield.svg`** — static SVG badge for Markdown surfaces that strip scripts. Always returns 200, because a non-200 renders as a broken image rather than a badge. Unknown or malformed identifiers render neutral grey and read `NOT REGISTERED` — never red. `de83f5b`
- **`@agenid/cli`** — real key generation, manifest construction from explicit operator attestations, and `ManifestProof` signing over RFC 8785 canonical bytes. Private key written `0600` and never printed. `80672ca`
- **Client-side key custody** (`packages/web/lib/client-crypto.ts`) — browser Ed25519 via `@noble/curves` with its own JCS implementation, plus cross-implementation tests proving `@agenid/core` accepts a browser-produced proof. Two independent canonicalizers must agree byte-for-byte or the protocol quietly forks. `798c75d`
- **Bounded registration clock skew policy** (`packages/api/src/registration-time.ts`) — a proof created up to 120s ahead of the registry is evaluated at its own `created_at`; beyond that, `clock_skew_too_large`. `registered_at` is always the registry's clock. `verifyManifestProof` is untouched and remains strict. `be41a0a`
- Dedicated Supabase project provisioned, migration applied, production environment configured; cross-invocation persistence proven with real data. `3c97435`

### Fixed
- **Registry clock truncation would have failed essentially every registration.** Both write and read paths stripped fractional seconds, which only ever moves an instant *backward* — so a browser signing and POSTing within the same second produced `created_at > now` and the registry rejected its own fresh proof as `not_yet_valid`. The same truncation on the read path would have rendered a brand-new agent's badge as `PROOF INVALID`. `de83f5b`
- **`0001_registry_store.sql` could never have applied to any Postgres.** A `timestamptz` generated column cast from jsonb is not immutable (`42P17`). Rewritten as a plain column written explicitly — deliberately not as `text`, because lexicographic order disagrees with chronological order across mixed fractional-second precision. `3c97435`
- **Storage backend changed a protocol field's serialization.** Postgres renders `timestamptz` with a numeric offset while `MemoryStore` round-trips `Z`, so the same agent's `registered_at` differed between the POST response and the resolution envelope. Normalized at the store boundary. `be41a0a`, `f9c68d7`

### Security
- **Fabricated-verification stubs removed.** A generated CLI and three generated API routes asserted verification outcomes without computing any — including a route that returned `ORGANIZATION_VERIFIED` for any domain submitted to it, and a hardcoded DNS token identical for every user and every domain. Replaced with real Ed25519 paths that report `DECLARED` and nothing above it. `80672ca`
- **Server-side operator key generation deleted outright** rather than hardened. `key-encryption.ts` silently wrote `plain:<hex>` whenever its secret was unset. The registry now never holds an operator private key, by construction. `798c75d`
- **Forged operator identity and disclosure attestations removed from `/onboarding/retell`.** Every operator using that public page had been signing a fixed operator name, contact, purpose, and `discloses_to_user: true` / `human_escalation: true` — under their own key. `1a52a2c`, `ea3ff9b`
- `DECLARED` had been rendering in Verified Emerald with confetti despite sitting *below* L1. Now amber, and the panel states plainly that no third party has checked the claims. `1a52a2c`
- Dead and out-of-namespace hosts removed from public copy (`app.agenid.ai`, `api.agenid.com`), and undeployed endpoints — the second key-discovery path and the assertion write path — explicitly labelled as not deployed in the docs, the homepage diagram, and every Verification Card's `verify_instructions`. `1a52a2c`
- A "Privacy Escrow Guarantee" describing an escrow that does not exist was removed. `1a52a2c`
- Root `package.json` `"private": true` guard restored after being deleted — it is the only thing preventing a root `npm publish` from publishing the entire monorepo. `80672ca`
- New `packages/web/test/public-surface.test.ts` makes each of the above a build-breaking assertion rather than a review convention. `1a52a2c`

---

## 2026-09-13

### Added
- **`@agenid/core`** — identifiers, RFC 8785 canonicalization, normative schemas, Ed25519 proof engine, and the §8 conformance suite. `8c62c9f`
- **`@agenid/api`** — Fastify registry over a storage-independent `RegistryStore`; **`@agenid/web`** — landing page and universal resolver `/a/<agenid>` (HTML + JSON) with `badge.js`. `2ad751b`
- **`@agenid/mcp-server`** — resolve identities and verify manifests from any MCP client; OpenAPI specification. `4bee571`
- **Ecosystem & compatibility engine** — a file-backed registry of 25 platforms, one reviewable JSON file each, with a dependency-free validator enforcing the honesty contract mechanically: `verified` must equal `status !== "compatible"`, and raising any entry requires evidence in the same commit. No third-party logo is redrawn, scraped, or shipped. `26b948e`
- **Human-first information architecture** — `/verify`, `/trust`, `/why-agent-identity`, and the first real test suite for `packages/web`. Every existing technical disclosure was reordered, never deleted or softened. `26b948e`
- Normative schemas served at `agenid.com/schemas/v1.1.1`; sitemap, robots, canonical tags, JSON-LD; partner integration briefs for eight platforms, each disclaiming that no adapter package exists. `07276f7`, `39f4a44`, `92ff5a8`
- Supabase-backed resolver and the operator onboarding guide. `c688ca0`

### Fixed
- Production deploy pipeline built `packages/web` without first building its workspace dependencies. `117b367`
- MCP `verify_agent_manifest` parameter and docstring semantics; it failed safe either way. `b6bfc22`

### Changed
- Namespace unified on `agenid.com` (Erratum E2); `packages/web` reskinned to Brand & Interface Guide v1.0, in which Verified Emerald is reserved strictly for verified state. `77a9a3d`
- CI matrix corrected to run every package's suite — `@agenid/mcp-server`, then `@agenid/web`, then `@agenid/cli` had each been silently excluded. `b6bfc22`, `02377fc`
- e2e checks reasserted on structure rather than exact marketing copy, and `/ecosystem`'s status definitions and no-endorsement notice made build-breaking assertions. `02377fc`
