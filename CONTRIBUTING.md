# Contributing to AgenID

AgenID is a protocol implementation, so the review bar is different from an ordinary application: **the specification is the source of truth, and code follows it.** A change to identity, cryptography, serialization, verification, or schemas is a protocol change and requires an erratum or a new protocol version in [`AgenID-protocol/spec`](https://github.com/AgenID-protocol/spec) — it is never made silently here.

## Environment

| Requirement | Version |
|---|---|
| Node | 20+ (CI runs 20, 22, 24) |
| Package manager | pnpm 10, pinned by `packageManager` — `corepack enable` is sufficient |
| TypeScript | 5.9 |
| Test runner | vitest |

```bash
git clone https://github.com/AgenID-protocol/agenid.git
cd agenid
corepack enable
pnpm install
pnpm -r build
pnpm -r test
```

This is a pnpm workspace with a **root lockfile only**. `pnpm install --frozen-lockfile` must keep working — if you regenerate the lockfile, do it on a machine whose platform binaries you need, then confirm the frozen install still succeeds.

`pnpm`'s strict `node_modules` means a package can only import its own declared dependencies. In particular **`zod` is a dependency of `@agenid/core`, not of `@agenid/web`** — `import { z } from "zod"` inside `packages/web` is a phantom dependency that fails `next build`. Compose validation from the core schemas' own `.safeParse` instead. Adding zod to `web` would also risk a second zod instance disagreeing with core's at an `instanceof` boundary.

## Configuration

Never commit a secret. `.env*` is gitignored; `packages/api/.env.example` and `packages/web/.env.example` are the safe templates.

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | api, web | Durable registry store. **Absent ⇒ the registry falls back to `MemoryStore`, which is dev/test only and non-durable.** |
| `AGENID_API_URL`, `AGENID_API_BASE_URL` | web | Registry the web resolver reads from |
| `NEXT_PUBLIC_SITE_URL` | web | Canonical site origin |
| `AGENID_AUTHORITY_TOKEN` | api | Authorization for the assertion write path (not deployed) |
| `PORT`, `HOST` | api | Standalone registry server |

AgenID holds **no DNS provider write credential**, by decision rather than by omission. `POST /api/dns/auto-add` held one and is deleted, not left unconfigured — see [docs/api.md](docs/api.md). Domain control is proved by a TXT record the operator publishes at their own provider (`POST /api/verify-dns`) or authorizes through Domain Connect (`POST /api/domain/status`). `packages/web/test/dns-surface.test.ts` fails the build if any source file under `packages/web` reads a provider credential or calls a provider's write API, the whole `/api/dns` namespace must stay empty, and `scripts/check-docs.mjs` fails if any document or environment template presents such a credential as configurable.

## Database

Migrations live in `packages/api/supabase/migrations/`. `0001_registry_store.sql` is applied in production. `0002_onboarding_tables.sql` is written but **deliberately unapplied** — it covers Retell-wizard-specific state only, and the wizard persists to the canonical `agents`/`keys` tables today.

Every new table ships with RLS enabled and its policies in the same migration. No exceptions.

Two hard-won constraints, both from defects that reached the repository:

- **A `timestamptz` generated column cast from jsonb is not immutable** and Postgres will reject the migration (`42P17`). jsonb extraction is immutable; a text→timestamptz cast depends on the `DateStyle`/`TimeZone` GUCs. Write such columns explicitly from application code.
- **Never store a protocol timestamp as `text`.** `Rfc3339Utc` permits optional fractional seconds, and lexicographic order disagrees with chronological order across mixed precision — `...00.500Z` sorts before `...00Z` as text but is later in time.

## Working on this repository

**Concurrent sessions are routine here.** More than one agent or person frequently works in the same clone at the same time. Accordingly:

- Re-run `git status --short` and re-read a file **immediately before every write**. Never edit from a read taken earlier in a session.
- **Never `git add -A`.** Stage explicit paths, or you will sweep someone else's in-flight work into your commit.
- `git pull --rebase --autostash` before pushing.
- Expect `node_modules` to be reinstalled underneath you mid-build, and expect a test count written down anywhere to be slightly behind.

**Never assume "pushed to main" means "live in production."** Cross-check the deployment for the pushed SHA and confirm it reached a ready state.

## Commit conventions

Conventional commits, scoped by package. A commit is a coherent unit of work and its message says what changed.

```
feat(web): 60-second browser issuance flow
fix(api): normalize Supabase timestamptz to RFC 3339 Z
test(core): add adversarial canonicalization vectors
docs: document the second key-discovery path as not deployed
```

`updates`, `fixes`, `changes`, `stuff`, `final`, and `new version` are not commit messages.

## Review bar

Before a change is considered done:

1. **The specification still governs.** If the change alters protocol behavior, the erratum or version bump lands first.
2. **No surface asserts an outcome the code did not compute.** This is the one rule that gets a change rejected outright regardless of anything else in the diff.
3. **Tests pass for all five packages.** `pnpm -r test`, plus `pnpm --filter @agenid/web e2e` for anything touching the registration or resolution path.
4. **Negative cases are covered.** A change to verification adds the test that proves the bad input is still rejected, not only that the good input still passes.
5. **Any grep-able rule the change introduces becomes a test in the same commit.** See [SECURITY.md](SECURITY.md).
6. **`pnpm run check:docs` passes**, and `pnpm run check:docs:live` before anything that changes a public endpoint or a status claim.
7. **Documentation moves with the implementation.** README, `docs/`, `PROJECT_STATE.md`, the OpenAPI spec, and any public copy that referenced the changed behavior — in the same cycle.
8. **`next build` is clean** for anything touching `packages/web`.
9. **The root `package.json` still has `"private": true`.** It is the only guard preventing a root `npm publish` from publishing the entire monorepo source.

## Documentation is part of the change

The repository is the canonical technical source of truth. A documented endpoint that 404s, a CTA pointing at a host that does not resolve, and an overclaiming headline are the same class of defect. Anything planned but unbuilt is labelled *planned*, *in development*, or *not deployed* — or omitted.

If a claim is about the product's capability, it must trace back to an implementation and a verification. Implementation → verified capability → documentation → website, never the reverse.

## Publishing

**Nothing is published to npm.** `@agenid/core`, `@agenid/cli` and `@agenid/mcp-server` all return 404 on the registry today. Publishing is a deliberate, separately-authorized action; before any npm work, confirm the root `"private": true` guard is intact.

The three packages are *packaged* for publication — each ships its own `LICENSE` (npm never picks one up from the repository root) and `README.md`, and declares `publishConfig.access: public`, without which a scoped `npm publish` fails or publishes privately. `pnpm run check:docs` asserts all three, so a package cannot quietly stop being publishable.

`.github/workflows/release.yml` is the release path: `workflow_dispatch` only, one package per run, `dry_run: true` by default, and it refuses to ship a tarball that carries no LICENSE or README. It requests `id-token: write` so `npm publish --provenance` can attach an attestation — but **npm only attaches provenance from a public repository**, so no document may claim provenance exists until an actual release has produced one. A first publish needs a granular token in `secrets.NPM_TOKEN`; once each package exists on npm, link it to the workflow there and drop the token in favour of trusted publishing.

## Conformance

The independent conformance suite lives at [`AgenID-protocol/conformance`](https://github.com/AgenID-protocol/conformance). It must never depend on `@agenid/core` or on the AgenID registry to determine correctness — an implementation that grades its own homework proves nothing.
