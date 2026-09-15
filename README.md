# AgenID

**Cryptographic identity infrastructure for AI agents.**

[![CI](https://github.com/AgenID-protocol/agenid/actions/workflows/ci.yml/badge.svg)](https://github.com/AgenID-protocol/agenid/actions/workflows/ci.yml)
[![Protocol v1.1.1](https://img.shields.io/badge/protocol-v1.1.1-0B0F17)](https://github.com/AgenID-protocol/spec)
[![License: MIT](https://img.shields.io/badge/license-MIT-0B0F17)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-0B0F17)](https://www.typescriptlang.org/)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0.3-0B0F17)](https://www.agenid.com/api/v1/openapi.json)

An AI agent that calls a customer, files a claim, or signs a transaction has no portable identity. It cannot prove who operates it, what it is authorized to do, or that its identity survived the move from one platform to another. AgenID is an open protocol that gives an agent an identifier, a signed manifest, and a resolution envelope that **any third party can re-verify offline without trusting the AgenID registry**.

This repository is the reference implementation. The [specification](https://github.com/AgenID-protocol/spec) is the source of truth; code follows it.

**Production site:** [www.agenid.com](https://www.agenid.com) · **Issue an identity:** [/issue](https://www.agenid.com/issue) · **Ecosystem:** [/ecosystem](https://www.agenid.com/ecosystem)

---

## Current status

Read [PROJECT_STATE.md](PROJECT_STATE.md) for the authoritative, dated breakdown. Summary:

| Capability | Status |
|---|---|
| Identifier, canonicalization, schemas, Ed25519 proof engine (`@agenid/core`) | **Production** — conformance vectors passing |
| Browser issuance → `L1_REGISTERED`, durable registry, resolution, badges | **Production** — verified live on `www.agenid.com` against Supabase |
| Operator CLI (`@agenid/cli`), MCP server (`@agenid/mcp-server`) | **Implemented**, not published to npm |
| Assertion issuance (`L2`–`L4`) | **Not deployed** — blocked on the root authority key ceremony |
| `GET /v1/keys/<key-ulid>` (second key-discovery path) | **Not deployed** |
| `L5` | **Reserved by the spec. Not issuable.** |
| `AUTHORIZED` claim state | **No signed object until protocol v1.2** |
| Platform adapter packages (Retell, Vapi, Bland, ElevenLabs, LangChain, …) | **Planned** — the `docs/partners/` briefs are integration patterns, not shipped packages |

**The honest ceiling today: the reference deployment can issue `L1_REGISTERED` and nothing above it.** L1 is a self-declaration — the operator signed it, and no third party has checked it. Every surface in this product renders L1 amber, never emerald, for exactly that reason. Third-party verification levels require a trust root that does not yet exist; see [docs/trust-model.md](docs/trust-model.md).

## How it works

An operator generates an Ed25519 keypair locally and signs a **manifest** describing the agent. The signature is computed over [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) canonical bytes, so any implementation in any language derives the same signing input. The registry stores only public material — it never holds an operator private key, because a registry that can sign on your behalf issues assertions that mean nothing.

A verifier resolving `agenid:<ULID>` gets a **resolution envelope**: the manifest, the proof, the operator key, any assertions, per-assertion checks, and the highest currently-valid level. The envelope is re-verifiable offline with `@agenid/core` alone. That property — the registry is a convenience, not an authority — is the whole design.

```
operator machine          registry (agenid.com)        any third party
───────────────────       ─────────────────────        ─────────────────
generate keypair
build manifest
sign ManifestProof  ──►   verify signature
  (public only)           verify digest binding
                          verify key role/controller
                          store public material  ──►   GET /a/<agenid>
                                                       re-verify offline
                                                       with @agenid/core
```

Full component and data-flow detail: [docs/architecture.md](docs/architecture.md).

## Packages

| Package | Purpose | State |
|---|---|---|
| [`packages/core`](packages/core) — `@agenid/core` | Identifiers, RFC 8785 canonicalization, normative zod schemas, Ed25519 proof engine, §8 conformance vectors. No storage, no server, no UI. | Implemented, unpublished |
| [`packages/api`](packages/api) — `@agenid/api` | Fastify registry REST API over a storage-independent `RegistryStore` (`MemoryStore` for dev/test, `SupabaseStore` for production). | Implemented, unpublished |
| [`packages/cli`](packages/cli) — `@agenid/cli` | Operator CLI: generate keys, build a manifest, sign a `ManifestProof` locally. Private keys never leave the machine. | Implemented, unpublished |
| [`packages/mcp-server`](packages/mcp-server) — `@agenid/mcp-server` | MCP server: resolve identities and verify manifests from any MCP client. | Implemented, unpublished |
| [`packages/web`](packages/web) — `@agenid/web` | `agenid.com`: site, `/issue`, resolver `/a/<agenid>` (HTML + JSON), `badge.js`, SVG shield, and the deployed API routes. | **Production** |

Nothing is published to npm yet. `@agenid/core`, `@agenid/cli`, and `@agenid/mcp-server` all still return 404 on the registry.

## Quick start

Requires **Node 20+** and **pnpm 10** (pinned by `packageManager`; `corepack enable` is enough).

```bash
git clone https://github.com/AgenID-protocol/agenid.git
cd agenid
pnpm install
pnpm -r build
pnpm -r test
```

Run the site locally:

```bash
pnpm --filter @agenid/web dev        # http://localhost:3000
```

Run the registry API standalone:

```bash
pnpm --filter @agenid/api build && pnpm --filter @agenid/api start
```

With no Supabase credentials configured, the registry falls back to `MemoryStore`, which is **dev/test only and non-durable**. See [CONTRIBUTING.md](CONTRIBUTING.md) for environment variables and database setup.

## Tests

```bash
pnpm -r test                          # all five packages
pnpm --filter @agenid/core test       # protocol conformance vectors
pnpm --filter @agenid/web e2e         # builds the site, boots the registry, exercises register → resolve → card → badge
```

CI runs the full matrix on Node 20, 22, and 24. Tests live in `packages/*/test/` and `packages/*/tests/`.

The suites worth knowing about, because they protect invariants rather than behavior:

- `packages/core/tests/v1_1_1_vectors.test.ts` — normative §8 vectors, including adversarial canonicalization and the explicit negative test that signing a SHA-256 pre-hash does **not** reproduce a spec signature.
- `packages/web/test/public-surface.test.ts` — forbids dead hosts in public copy, forbids any hardcoded `true` disclosure attestation, and requires self-declared states to render amber rather than emerald.
- `packages/web/test/issuance.test.ts` and `packages/cli/test/cli.test.ts` — no surface may assert a verification level the code did not compute.
- `packages/api/tests/store-timestamp-shape.test.ts` — `MemoryStore` and `SupabaseStore` must serialize protocol fields identically.

Those tests exist because each one guards a defect that actually shipped. See [SECURITY.md](SECURITY.md).

## APIs

Machine-readable: **[`/api/v1/openapi.json`](https://www.agenid.com/api/v1/openapi.json)** (OpenAPI 3.0.3). Endpoint reference and error codes: [docs/api.md](docs/api.md).

Live in production today:

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/agents` | Register a signed manifest. Returns `L1_REGISTERED`. |
| `GET /api/resolve/<agenid>` | Resolution envelope (JSON). |
| `GET /a/<agenid>` | Verification Card (HTML) or envelope (`Accept: application/json`). |
| `POST /api/v1/verify` | Verify a manifest + proof without registering. |
| `GET /badge/<agenid>/shield.svg` | Static SVG badge for Markdown surfaces. |
| `/badge.js` | Embeddable live badge. |

Not deployed, and labelled as such everywhere they are referenced: `GET /v1/keys/<key-ulid>`, `POST /v1/agents/:id/assertions`, `/.well-known/agenid/authorities.json`.

## Integrations

`docs/partners/` holds integration briefs for Retell, Vapi, Bland, ElevenLabs, Grok Bot, LangChain, MCP Server, and OpenClaw. **Every one of them is a documented pattern, not a shipped package**, and each carries that disclaimer in its own text. `@agenid/adapter-*` packages are planned and not started.

Platform compatibility claims live in `packages/web/data/ecosystem/*.json` — one reviewable file per platform, validated in CI by `lib/ecosystem.ts`. Raising any entry above `compatible` requires evidence in the same commit.

## Limitations

Stated plainly, because a trust product that hides these is not a trust product:

1. **No trust root exists.** No root authority key has been generated, so no third-party assertion can be signed. `L2`–`L4` are unreachable on the reference deployment.
2. **The protocol has no delegation object in v1.1.1.** The pinned root must sign every assertion, so the offline-root / online-intermediate CA pattern is unavailable, and a root compromise would invalidate historical assertions too. A v1.2 delegation object is under design.
3. **Two-path key discovery is half-deployed.** The registry path works; `GET /v1/keys/<key-ulid>` does not. A verifier can compare the envelope's operator key against the operator's `.well-known` copy, but cannot yet complete the full two-path check against `agenid.com`.
4. **The trust root's real security ceiling is control of the `agenid.com` DNS zone and the `AgenID-protocol` GitHub org**, not key storage — those are where a verifier learns the pin.
5. **Public write endpoints are unauthenticated and unrated.** Every write is signature-verified and self-attributed, but nothing currently bounds registration volume.
6. **`@agenid/web` carries a second registry implementation** mirroring `@agenid/api`'s validation, because `zod` is not resolvable inside `packages/web`. The two are kept equivalent by test, not by shared code.

## Documentation

| Document | Contents |
|---|---|
| [PROJECT_STATE.md](PROJECT_STATE.md) | What is verified in production, implemented, in development, planned, and blocked |
| [docs/architecture.md](docs/architecture.md) | Components, data flow, trust and storage boundaries, deployment, failure behavior |
| [docs/trust-model.md](docs/trust-model.md) | What a verifier must trust, what they can check themselves, and the verification levels |
| [docs/threat-model.md](docs/threat-model.md) | Adversaries, assumptions, what the protocol defends against, and what it does not |
| [docs/api.md](docs/api.md) | Endpoint reference, request and response shapes, error codes, deployment status |
| [docs/OPERATOR_ONBOARDING.md](docs/OPERATOR_ONBOARDING.md) | End-to-end operator walkthrough |
| [SECURITY.md](SECURITY.md) | Reporting process, security model, and the standing rules this project enforces by test |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Environment, workflow, review bar, commit conventions |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [Specification](https://github.com/AgenID-protocol/spec) | The normative protocol document — the source of truth |
| [Conformance suite](https://github.com/AgenID-protocol/conformance) | Independent conformance checks, deliberately not built on `@agenid/core` |

## Contributing and evaluating

Read [CONTRIBUTING.md](CONTRIBUTING.md). If you are evaluating rather than contributing, the fastest honest path is:

1. Issue an identity at [www.agenid.com/issue](https://www.agenid.com/issue) — takes about a minute, private key never leaves your browser.
2. Resolve it: `curl -H 'Accept: application/json' https://www.agenid.com/a/<your-agenid>`.
3. Re-verify that envelope offline with `@agenid/core` and confirm the registry told you the truth. Then tamper one character of the manifest and confirm it is rejected with `manifest_digest_mismatch`.

Step 3 is the product. Everything else is convenience.

## License

MIT — see [LICENSE](LICENSE). Copyright © 2026 AI Venture Holdings LLC.
