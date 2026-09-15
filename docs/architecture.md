# Architecture

**Audience:** engineers evaluating or extending the AgenID reference implementation.
**Status of this document:** current as of 2026-09-15, protocol v1.1.1 + errata E1/E2.

This document explains *why* the system is shaped the way it is. For what is deployed and what is not, see [PROJECT_STATE.md](../PROJECT_STATE.md).

## The one architectural commitment

**The registry is not an authority.** Every other decision here follows from that.

A verifier who resolves an identity receives an envelope containing the manifest, the proof, the operator's key document, every assertion, and the key-discovery pointers. They can re-run the entire verification locally with `@agenid/core` and reach the same conclusion without ever trusting `agenid.com`. If the registry lied, a verifier following the documented procedure detects it.

This is why the registry never holds an operator private key, why verification is a pure function with no I/O, and why the conformance suite is forbidden from depending on `@agenid/core`. A system that grades its own homework proves nothing.

## Components

```
┌─────────────────────────────────────────────────────────────────┐
│  @agenid/core          pure protocol. no storage, no network.   │
│    identifier.ts   agenid:<ULID> parsing and construction        │
│    jcs.ts          RFC 8785 canonicalization                     │
│    schemas.ts      normative zod schemas (strict)                │
│    crypto.ts       Ed25519 sign / verify, digest binding         │
│    errors.ts       verification outcomes as values, never throws │
└───────────────┬─────────────────────────────────────────────────┘
                │ depended on by everything below
   ┌────────────┼────────────┬──────────────┬────────────────┐
   │            │            │              │                │
┌──▼──────┐ ┌───▼───────┐ ┌──▼──────────┐ ┌─▼─────────────┐  │
│ @agenid │ │ @agenid   │ │ @agenid     │ │ @agenid/web   │  │
│ /api    │ │ /cli      │ │ /mcp-server │ │  (production) │  │
│ Fastify │ │ operator  │ │ MCP tools   │ │  Next 16      │  │
│ registry│ │ signing   │ │ for agents  │ │  site + API   │  │
└──┬──────┘ └───────────┘ └─────────────┘ └─┬─────────────┘  │
   │                                        │                │
   │      RegistryStore (interface)         │                │
   └────────────┬───────────────────────────┘                │
     ┌──────────┴───────────┐                                │
┌────▼──────┐        ┌──────▼────────┐                       │
│ MemoryStore│       │ SupabaseStore │  ◄────── production    │
│ dev/test   │       │ Postgres, RLS │                        │
└────────────┘       └───────────────┘                        │
                                                              │
   packages/web/lib/client-crypto.ts ─────────────────────────┘
   browser Ed25519 + its own JCS — the operator's signer
```

### `@agenid/core`

The protocol, and nothing else. No storage, no server, no UI, no clock of its own — `now` is always passed in explicitly, because a verification function that reads the wall clock cannot be tested deterministically and cannot be reasoned about by a third party.

Verification outcomes are **values with stable codes, never exceptions**. `verifyManifestProof` returns `{ ok: false, code: "manifest_digest_mismatch" }`. A thrown exception invites a `catch` that swallows it, and a swallowed verification failure is indistinguishable from success.

Number-domain rule (Erratum E1): non-finite values are rejected, and integer-literal canonical tokens with magnitude greater than 2^53−1 are rejected — outside that range, JSON round-tripping is not lossless and two implementations can disagree about what was signed.

### `@agenid/api` and the web registry routes

`@agenid/api` is a Fastify registry over the `RegistryStore` interface. **Production does not deploy it.** The registration and resolution routes ship inside `packages/web` instead, because the write path belongs where the read path already is and Vercel already hosts that.

That leaves two implementations of the same validation. This is a real cost, taken deliberately: `zod` is a dependency of `@agenid/core`, and pnpm's strict `node_modules` makes it a phantom dependency inside `packages/web` that fails `next build`. Adding it would also risk a second zod instance disagreeing with core's at an `instanceof` boundary. The web route therefore composes validation from the core schemas' own `.safeParse`. Equivalence between the two is held by test, not by shared code. If the packages ever merge, this is the seam to remove.

### `@agenid/web`

Next 16 + Tailwind 4. Serves the public site, the resolver, the badges, and the deployed API. Hosted on Vercel; the production store is Supabase.

`lib/client-crypto.ts` is the operator's signer: browser Ed25519 via `@noble/curves`, with **its own independent RFC 8785 implementation**. That duplication is the point. Two independently-written canonicalizers must agree byte-for-byte or the protocol has quietly forked, and there is a test asserting `@agenid/core` accepts a proof the browser produced.

## Data flow: registration

```
browser                          registry                      storage
───────                          ────────                      ───────
generate Ed25519 keypair
build Manifest
compute manifest digest
sign ManifestProof over
  JCS(proof payload minus
      "signature")
   │
   │  POST /api/v1/agents
   │  { manifest, proof, key_document }      ← public material only
   ├────────────────────────────►
                                 strict schema validation
                                 reject unknown top-level members
                                 registrationTime(): bound
                                   forward client skew at 120s
                                 verifyManifestProof()
                                   ├ signature
                                   ├ digest binding
                                   ├ key_id match
                                   ├ role === "operator"
                                   ├ controller === agent_id
                                   └ key active at created_at
                                 assign registered_at
                                   from the registry's clock
                                          │
                                          ├──────────────────► agents
                                          ├──────────────────► keys
                                          └──────────────────► events
   ◄─────────────────────────────
   201 { agent_id, level: "L1_REGISTERED", disclosures }
```

The private key never enters this diagram's right-hand side. It is generated in the tab, used in the tab, and offered once as a download. It is never written to `localStorage` or `sessionStorage` — a test enforces this, because "we would not do that" is not a guarantee.

## Data flow: resolution and independent verification

`GET /a/<agenid>` serves two representations of one resource: HTML for browsers, the canonical envelope for `Accept: application/json`.

`buildEnvelope` assembles: the manifest and its digest; the proof and `proof_check`; the operator key document plus **both** discovery pointers (the registry path and the operator's `.well-known` URL); every assertion with its own per-assertion `check`; and `verification.level` — the highest level among currently-valid assertions bound to the *current* manifest, defaulting to `L1_REGISTERED`.

Two properties of that computation matter more than they look:

**Assertions are re-checked at resolution time, against the current manifest.** They are not trusted because they were valid when issued. An operator who edits their manifest invalidates every assertion bound to the old one, automatically.

**Only L1–L4 have ranks.** `L5` is spec-reserved and has no rank, so it cannot be reached by any code path — the type system, not a policy document, is what makes L5 unissuable.

The envelope carries `verify_instructions` in free text describing how a third party re-verifies it without the registry. Because the second discovery path is not deployed, those instructions currently say so and name the check that *can* be completed today: compare the envelope's `operator_key.document` against the operator's own `.well-known` copy.

## Boundaries

**Trust boundary.** Everything the registry receives from an operator is untrusted input, validated strictly and rejected on any unknown member. Everything the registry emits is re-checkable by the recipient. The registry's own honesty is *not* a security assumption of the protocol — which is exactly why it is safe to run one.

**Cryptographic boundary.** All signing and verification lives in `@agenid/core` and `client-crypto.ts`. No other module constructs signing input, and no route may report a verification result it did not obtain from one of them. This is enforced by test: no file under `packages/web/app` may assert a level or status above what the code computes.

**Storage boundary.** `RegistryStore` is the seam. Its implementations must be observationally identical: same records, same ordering, and — a defect that actually shipped — the same *serialization* of protocol fields. Postgres renders `timestamptz` with a numeric offset while an in-memory store round-trips `Z`, so a protocol field's shape came to depend on the backend. Normalization at the store boundary is what makes the interface's storage independence true rather than merely structural.

**Clock boundary.** Two deliberately separate decisions. *Registration* tolerates up to 120 seconds of forward client skew, because the signer and the registry are different machines in one request; beyond that it refuses with `clock_skew_too_large`. *Verification* tolerates none and `verifyManifestProof` is untouched — a third party checking a proof has no business assuming the signer's clock was honest. Never normalize a protocol timestamp's precision, only its spelling: truncating fractional seconds moves an instant backward, which once caused the registry to reject its own freshly-issued proofs.

## External dependencies

| Dependency | Role | Failure behavior |
|---|---|---|
| Supabase Postgres | Production registry store | Reads and writes fail. Resolution of already-distributed envelopes is unaffected — they re-verify offline. |
| Vercel | Hosting for `packages/web` | Site and API unavailable. Same note as above: availability, not trust. |
| DNS (`_agenid.<domain>` TXT) | Domain-control evidence for a future L2 | Reported as evidence, never as a level |
| Cloudflare / GoDaddy APIs | Optional DNS auto-add | **Unconfigured in production.** `/api/dns/detect` gates on credential presence, so the feature is never advertised where it cannot run. |
| Retell API | One read-only upstream call in the Retell flow, using a caller-supplied key | Caller-supplied key is used once and never stored |

No external dependency can raise a verification level. That is the point of listing them.

## Authentication and authorization

There is essentially none, deliberately. The public write endpoints are unauthenticated: **the Ed25519 signature is the authentication.** A registration is self-attributed — you can only register an agent you hold the key for, and registering says nothing about you that anyone should believe. This is why L1 is honestly labelled a self-declaration.

The consequence is that nothing bounds registration *volume*. That is a real, documented gap; see [PROJECT_STATE.md](../PROJECT_STATE.md).

The assertion write path — the one that would let a third party say something about an agent — is authorization-gated by `AGENID_AUTHORITY_TOKEN` and is **not deployed**, because there is no root key to sign with.

## Deployment

`packages/web` deploys to Vercel from `main`, with `packages/web` as the root directory. Its build script builds `@agenid/core` and `@agenid/api` first — Vercel does not do this on its own, and omitting it once broke production.

CI (`.github/workflows/ci.yml`) runs on Node 20, 22, and 24: `pnpm install --frozen-lockfile`, a full recursive build, all five packages' test suites, and the end-to-end suite that boots the site and exercises register → resolve → card → badge. Every package's suite must be listed explicitly; three of the five were silently excluded at different points, so the matrix's completeness is itself something to re-check when a package is added.

**"Pushed to main" does not mean "live."** Cross-check the deployment for the pushed SHA and confirm it reached a ready state.

## Failure behavior

- **Unknown identifier** → clean `404 agent_not_found`, never a 500. The read path fails safe.
- **Unknown or malformed identifier on a badge** → HTTP **200** with a neutral grey `NOT REGISTERED` badge. A non-200 renders as a broken image rather than a badge, and absence of verification is never a negative finding.
- **Verification failure** → a value with a stable code, surfaced in the envelope's `proof_check` or per-assertion `check`. The envelope is still served; the verifier is told what failed.
- **Store unavailable** → the API errors. Already-distributed envelopes remain verifiable offline, which is the design working as intended.
