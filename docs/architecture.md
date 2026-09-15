# Architecture

**How the system is actually built.** Current as of 2026-09-15, commit `a95928b`, protocol v1.1.1 + errata E1/E2. Verified against the source tree and the live deployment, not inferred from filenames.

For what is deployed versus what is not, see [PROJECT_STATE.md](../PROJECT_STATE.md).

## System overview

AgenID gives an AI agent a portable cryptographic identity. An operator generates an Ed25519 keypair, signs a manifest describing the agent, and registers the public material. Anyone who later encounters that agent can resolve its identifier and **re-verify the whole claim offline, without trusting the AgenID registry.**

## The one architectural commitment

**The registry is not an authority.** Every other decision follows from it.

A resolution envelope contains the manifest, the proof, the operator's key document, every assertion and the key-discovery pointers. A verifier re-runs verification locally with `@agenid/core` and reaches their own conclusion. If the registry lied, a verifier following the documented procedure detects it.

This is why the registry never holds an operator private key, why verification is a pure function with no I/O and no clock of its own, and why the conformance suite is forbidden from depending on `@agenid/core`. A system that grades its own homework proves nothing.

## Architecture diagram

```
Operator's browser or machine            Registry (www.agenid.com)           Any third party
─────────────────────────────            ─────────────────────────           ───────────────
  generate Ed25519 keypair
  build Manifest
  sign ManifestProof
  (private key never leaves)
          │
          │ POST /api/v1/agents
          │ { manifest, proof, key_document }      public material only
          ▼
                                     ┌──────────────────────────┐
                                     │  Next 16 route handler   │
                                     │  packages/web/app/api    │
                                     └────────────┬─────────────┘
                                                  │
                                     ┌────────────▼─────────────┐
                                     │  lib/register.ts         │  ← the single
                                     │  schema · clock · proof  │    implementation
                                     └────────────┬─────────────┘
                                                  │
                                     ┌────────────▼─────────────┐
                                     │  @agenid/core            │  pure: no I/O,
                                     │  JCS · Ed25519 · schemas │  no clock, no throw
                                     └────────────┬─────────────┘
                                                  │
                                     ┌────────────▼─────────────┐
                                     │  RegistryStore (iface)   │
                                     │  MemoryStore │ Supabase  │
                                     └────────────┬─────────────┘
                                                  │
                                       Supabase Postgres (RLS)
                                       agents · keys · assertions · events
                                                  │
                                                  │ GET /a/<agenid>
                                                  ▼
                                                              re-verify offline
                                                              with @agenid/core
```

## Repository structure

pnpm workspace, root lockfile only, five packages.

| Path | Package | Responsibility |
|---|---|---|
| `packages/core` | `@agenid/core` | The protocol, and nothing else |
| `packages/api` | `@agenid/api` | Fastify registry over `RegistryStore` — **not deployed**; production serves equivalent routes from `packages/web` |
| `packages/cli` | `@agenid/cli` | Operator CLI: keygen, manifest, local signing |
| `packages/mcp-server` | `@agenid/mcp-server` | MCP tools: resolve, verify, generate keypair |
| `packages/web` | `@agenid/web` | `agenid.com` — site, resolver, badges, and the deployed API |
| `docs/` | — | This documentation plus eight partner integration briefs |
| `_quarantine/` | — | Removed fabricated stubs, gitignored, kept for the incident record |

## Component responsibilities

### `@agenid/core`

**Responsibility** — the protocol. **Inputs** — plain JavaScript values. **Outputs** — canonical bytes, signatures, and `VerifyResult` values. **Dependencies** — Node's native `crypto` and zod 3. **Boundaries** — no storage, no server, no UI, no network, and no clock of its own.

`identifier.ts` (`agenid:<ULID>` grammar) · `jcs.ts` (RFC 8785) · `schemas.ts` (normative strict zod schemas) · `crypto.ts` (sign, verify, digest binding) · `errors.ts`.

Two design rules carry real weight:

**`now` is always passed in explicitly.** A verification function that reads the wall clock cannot be tested deterministically and cannot be reasoned about by a third party.

**Verification outcomes are values, never exceptions.** `verifyManifestProof` returns `{ ok: false, code: "manifest_digest_mismatch", message }`. Thrown `AgenIdError`s are reserved for programming and input errors — malformed input, illegal number domains, signing-time key misuse. A thrown verification failure invites a `catch` that swallows it, and a swallowed verification failure is indistinguishable from success.

Erratum E1 rejects non-finite numbers and integer tokens beyond 2^53−1, outside which JSON round-tripping is not lossless and two implementations can disagree about what was signed.

### `@agenid/web` — the deployed system

Next 16 + Tailwind 4 on Vercel. Serves eleven pages, thirteen API routes, both badges and the OpenAPI document.

`lib/register.ts` is **the single implementation of registration.** Both `POST /api/v1/agents` and `POST /api/retell/bind` delegate to it, and a test forbids either route from calling `verifyManifestProof`, touching a Supabase table, or applying a clock policy of its own. A route shapes a request and a response; it does not decide what an operation means. This exists because registration was briefly implemented twice with different clock semantics, different audit trails and different key-conflict behavior — the same signed manifest got different security semantics depending on which door it entered.

`lib/client-crypto.ts` is the operator's signer: browser Ed25519 via `@noble/curves` with **its own independent RFC 8785 implementation**. That duplication is deliberate. Two independently written canonicalizers must agree byte-for-byte or the protocol has quietly forked, and a test asserts `@agenid/core` accepts a proof the browser produced.

### `@agenid/api`

Fastify registry over the same `RegistryStore` interface, including the assertion write path gated by `AGENID_AUTHORITY_TOKEN`. **It is not deployed anywhere.** Production ships registration and resolution as Next routes, because the write path belongs where the read path already is.

That leaves two implementations of the same validation — a real cost, taken deliberately. `zod` is a dependency of `@agenid/core`, and pnpm's strict `node_modules` makes it a phantom dependency inside `packages/web` that fails `next build`; adding it would also risk a second zod instance disagreeing with core's at an `instanceof` boundary. The web route therefore composes validation from the core schemas' own `.safeParse`. Equivalence is held by test, not by shared code. If the packages ever merge, this is the seam to remove.

## Data flow: registration

```
browser                          registry                        storage
───────                          ────────                        ───────
generate Ed25519 keypair
build Manifest
compute manifest digest
sign ManifestProof over
  JCS(payload minus "signature")
   │  POST { manifest, proof, key_document }
   ├────────────────────────────►
                                 strict schema validation
                                 reject unknown top-level members
                                 identifier grammar
                                 registrationTime(): bound forward
                                   client skew at 120s
                                 verifyManifestProof()
                                   ├ digest binding
                                   ├ Ed25519 signature
                                   ├ key_id match
                                   ├ role === "operator"
                                   ├ controller === agent_id
                                   └ key active at created_at
                                 uniqueness + key-conflict check
                                 registered_at ← registry's clock
                                          ├───────────────────────► agents
                                          ├───────────────────────► keys
                                          └───────────────────────► events ×2
   ◄─────────────────────────────
   201 { agent_id, status, verification:{level}, manifest_digest,
         registered_at, links, disclosures }
```

The private key never appears on the right-hand side. It is generated in the tab, used in the tab, and offered once as a download — never written to `localStorage` or `sessionStorage`, which a test enforces, because "we would not do that" is not a guarantee.

## Data flow: resolution and independent verification

`buildEnvelope` assembles the manifest and digest, the proof and `proof_check`, the operator key document with **both** discovery pointers, every assertion with its own `check`, and `verification.level` — the highest level among currently-valid assertions bound to the *current* manifest, defaulting to `L1_REGISTERED`.

**Assertions are re-checked at resolution time against the current manifest.** An operator who edits their manifest invalidates every assertion bound to the old one, automatically.

**Only L1–L4 have ranks.** `L5_CONTINUOUSLY_MONITORED` is a reserved *name* and is deliberately absent from the `VerificationLevel` enum, so it cannot be issued in v1.1.1 — the type system, not a policy document, is what makes L5 unreachable.

## Trust boundaries

| Boundary | What changes |
|---|---|
| Operator → registry | Everything received is untrusted input: strict validation, unknown members rejected, signature and role verified before anything is stored |
| Registry → verifier | Everything emitted is re-checkable by the recipient. **The registry's honesty is not a security assumption of the protocol** — which is exactly why it is safe to run one. |
| Application → cryptography | All signing and verification lives in `@agenid/core` and `client-crypto.ts`. No other module constructs signing input, and no route may report a verification result it did not obtain from one of them. Test-enforced. |
| Application → storage | `RegistryStore`. Implementations must be observationally identical — same records, same ordering, and the same *serialization* of protocol fields. |
| Presentation → trust state | A presentation layer **displays** trust state; it never decides it. Rendering a hardcoded level string while the route returns a different one is a defect that shipped here once. |
| Browser → network | Only public material crosses. The private key does not. |

## Authentication and authorization

There is essentially none, deliberately. **The Ed25519 signature is the authentication.** A registration is self-attributed — you can only register an agent whose key you hold, and registering says nothing about you that anyone should believe. This is why L1 is honestly labelled a self-declaration.

The consequence is that nothing bounds registration *volume*. That is a real, documented gap.

Authorization exists in exactly one place: the assertion write path, gated by `AGENID_AUTHORITY_TOKEN` in `@agenid/api`, and **not deployed**, because there is no root key to sign with.

Database access is authorized by RLS: public-read policies on all four tables, with every write going through the service role.

## Persistence

Supabase Postgres, reached through `RegistryStore`. `MemoryStore` is the dev/test implementation and is non-durable; with no Supabase credentials configured, the registry falls back to it.

| Table | Key | Notes |
|---|---|---|
| `agents` | `agent_id` | `manifest`/`proof` jsonb, `manifest_digest`, `status` (CHECK against five values), `registered_at`, `updated_at` |
| `keys` | `key_id` | `document` jsonb; `role` and `controller` are generated columns extracted from the jsonb, indexed on `role` |
| `assertions` | `assertion_id` | `document` jsonb; `manifest_digest` generated from jsonb; `verified_at` a **plain** timestamptz; indexed on `subject` |
| `events` | `event_id` | Append-only ledger: `type`, `occurred_at`, `detail_ref` jsonb — **pointers and hashes only, never raw evidence** |

Relationships are by identifier, not by foreign key. Verification never relies on referential integrity; it re-derives everything from signatures.

**Consistency.** `createAgent` is an atomic insert that reports `false` on a unique violation rather than overwriting — a replayed registration is a `409`. There are no multi-statement transactions: a registration writes the agent, the key and two events as separate statements, so a mid-sequence failure can leave an agent without its ledger events. That is an accepted trade today; it degrades the audit trail, not the verifiability of the identity, because the envelope is reconstructed from the agent and key rows alone.

Two constraints learned the hard way, both from defects that reached the repository:

- **A `timestamptz` generated column cast from jsonb is not immutable** and Postgres rejects the migration (`42P17`). jsonb extraction is immutable; a text→timestamptz cast depends on the `DateStyle`/`TimeZone` GUCs. `keys.role` and `assertions.manifest_digest` are legal generated columns precisely because they stay in the text domain.
- **Never store a protocol timestamp as `text`.** `Rfc3339Utc` permits optional fractional seconds, and lexicographic order disagrees with chronological order across mixed precision.

## External dependencies

| Dependency | Role | Failure behavior |
|---|---|---|
| Supabase Postgres | Production registry store | Writes return `503 registry_unavailable` and **nothing is stored**; reads return `503` meaning *status unknown, not disproven*. Already-distributed envelopes are unaffected — they re-verify offline. |
| Vercel | Hosting for `packages/web` | Site and API unavailable. Availability, not trust. |
| DNS (`_agenid.<domain>` TXT) | Domain-control evidence | `dns_error`; reported as evidence, never as a level |
| Cloudflare / GoDaddy DNS APIs | Optional TXT auto-add | **Unconfigured in production**; `/api/dns/detect` gates on credential presence so the feature is never advertised where it cannot run |
| Retell API | One read-only call with a caller-supplied key | `retell_unauthorized` / `retell_error`; key used once, never stored |

**No external dependency can raise a verification level.** That is the point of listing them.

## Deployment architecture

`packages/web` deploys to Vercel from `main`, root directory `packages/web`. Its build script builds `@agenid/core` and `@agenid/api` first — Vercel does not do this on its own, and omitting it once broke production.

`.github/workflows/ci.yml` runs on Node 20, 22 and 24: `pnpm install --frozen-lockfile`, a full recursive build, all five packages' test suites, and an e2e suite that boots the site and exercises register → resolve → card → badge. Every package's suite must be listed explicitly; three of the five were silently excluded at different points, so the matrix's completeness is itself something to re-check when a package is added.

Configuration is entirely by environment variable; `.env*` is gitignored and `.env.example` files are the templates. See [CONTRIBUTING.md](../CONTRIBUTING.md).

**"Pushed to main" does not mean "live."** Cross-check the deployment for the pushed SHA and confirm it reached a ready state.

## Failure behavior

| Condition | Behavior |
|---|---|
| Unknown identifier, JSON | `404 agent_not_found` — clean, never a 500. Documented as *not evidence of anything beyond "not registered"*. |
| Unknown identifier, HTML card | **`200`** with a neutral *Not registered* card. A 404 error page would frame absence of registration as a failure, which this product does not do. |
| Unknown identifier, SVG badge | **`200`**, neutral grey, `NOT REGISTERED`. A non-200 renders as a broken image rather than a badge. |
| Verification failure | A value with a stable code, surfaced in `proof_check` or a per-assertion `check`. The envelope is still served; the verifier is told what failed. |
| Store unavailable | `503`, and on a write **nothing is stored** — never a partial or optimistic success. |
| Malformed input | `400` with a stable error code and, for schema failures, the zod `issues`. |
| Realtime subsystem reached | Throws loudly. AgenID never opens a Supabase realtime channel; the transport is stubbed so nothing can quietly open one. |

## Architectural decisions

**The registry is not authoritative.** Everything above follows from this.

**Storage independence is enforced at the boundary, not just structurally.** Postgres renders `timestamptz` with a numeric offset while an in-memory store round-trips `Z`, so a protocol field's shape came to depend on the backend. Normalizing at the store boundary is what makes `RegistryStore`'s independence actually true.

**Registration tolerates bounded forward client skew; verification tolerates none.** `registrationTime()` exists because signer and registry are different machines in one request. `verifyManifestProof` stays strict — a third party checking a proof has no business assuming the signer's clock was honest. These two decisions are deliberately separate and must stay separate.

**One implementation per security-critical business rule.** See `lib/register.ts` above.

**The second registry implementation in `packages/web` is a known, bounded cost**, taken to avoid a phantom zod dependency and a duplicate zod instance.

**Never truncate a timestamp the protocol will compare.** Truncation only moves an instant backward, which once made the registry reject its own freshly-issued proofs. Normalize a timestamp's spelling, never its precision.

**Every honesty rule is a test.** If a rule can be grepped for, it belongs in `packages/web/test/public-surface.test.ts`. A rule that lives only in a document is one the next contributor re-breaks — one was written down and violated by deployed code for a full day afterwards.
