# Autonomous week — log

Appended at the end of each working cycle. Every "shipped" line names its proof.

## Cycle 1 · 2026-10-19

**Shipped**
- Autonomy control files: `PLAN.md` (ranked A–J), `DECISIONS.md` (D-1…D-4), `BLOCKERS.md`, `NEEDS_MIKE.md` (7 items, each with a ready recommendation).
- **Retell relay is same-origin only** (plan C, queue #39) — cross-site and non-JSON requests refused before the body is read. Proof: `test/retell-relay.test.ts` 16/16, and 10 of them fail with the gate removed; new live claim in `check:docs --live`.
- **Mirrored-docs drift guard** (plan B, queue #9) — `check:docs` compares 12 mirrored copies byte-for-byte and the partner pairing both ways. Proof: fails on an appended byte and on an orphan brief; green when restored.
- **Control documents current** (plan A, queue #13/#32) — PROJECT_STATE re-verified: all 98 sitemap URLs 200, domain-status flow live, four migrations applied, RLS on all six tables, 7 agents / 14 ledger events / 0 assertions, every agent `ACTIVE`.
- Suite: 1,471 green (core 99, api 89, cli 8, mcp-server 4, web 1,271); `pnpm -r build` clean; e2e passed; `check:docs` clean.

**Found**
- Schema/CI sync (a Definition-of-Done item) was already closed by the `spec-sync` job — recorded as D-4 rather than rebuilt.
- `docs/api.md` and the threat model had described the relay as "same-origin only" before it was; a `text/plain` simple request bypassed the preflight that the missing CORS headers relied on.

**Next** — plan D: operator-signed agent revocation.

**Risks / blockers** — none new.

## Cycle 2 · 2026-10-19

**Shipped to production**
- Cycle 1 (`24e7df4`): CI success on Node 20/22/24 (run `39258102406`). Live: headerless and cross-site relay requests → `403 cross_origin_refused`; `text/plain` → `415`; same-origin JSON still reaches validation (the wizard path works); OpenAPI lists the new 403/415; onboarding guide serves the new L2 section; `check:docs --live` consistent with production.

**Built, parked on a PR** — https://github.com/AgenID-protocol/agenid/pull/3
- Operator-signed agent revocation (plan D) plus the propagation proposal (plan E). 42 files. web 1294 · api 93 green; build clean; e2e 3s–3v; guards proven to fail; migration validated on embedded Postgres.
- **Not merged:** migration `0006` needs approval (NEEDS_MIKE #8). Merging first would publish "revocation is deployed" while the endpoint 503s (D-6).

**Found**
- Thirteen public passages stated "no revocation flow", and two tests required that sentence. Both are updated in the PR so the claim changes in the same commit as the capability.
- Production cache headers: resolution is `no-store`; badges are `max-age=0` but third-party image proxies may cache longer — recorded in the propagation proposal.

**Next** — plan F (registration atomicity, reusing the transactional-function pattern; it also needs a migration, so it will be built to the same PR-first standard), then G (operator key-discovery nudge) and H (axe in CI).

**Risks / blockers** — revocation waits on one approval. Nothing else is blocked.

## Cycle 3 · 2026-10-19

**Shipped to production**
- **Operator key-discovery nudge** (plan G, `7f8773a`): after issuing, the wizard builds the `keys.json` the operator publishes at their own domain, with copy and download. Proof: `test/keys-document.test.ts` 8/8; CI success.
- **Accessibility fix** (`bcc60e0`): the third-party feedback launcher failed WCAG 2.2 AA contrast on 96 of 98 pages, and the glossary definition list held children a `<dl>` may not contain. Replaced it with a site-styled launcher that opens the same widget, and wrapped each glossary term and definition in a `<div>` whose link covers the card. Proof: axe on production now reports **0 serious or critical violations across 98 pages**. Before the fix it was 96 of 98. The visible launcher is the site's. CI success.
- `scripts/a11y.mjs`: the axe gate across every sitemap URL, run with reduced motion.

**Blocked** — wiring the gate into CI (plan H). GitHub refuses workflow-file changes from the available credential. Three approaches failed; logged in BLOCKERS. The fix is NEEDS_MIKE #10, and the job is ready to push.

**Found** — the open feedback panel still uses the widget's dashboard accent (2.53:1). It is outside the repo, so it went to NEEDS_MIKE #11.

**Next** — plan I (external-contributor guide) and J (#46 example-agent label, #20 durable rate-limit layer). Plan F is being prepared PR-first because it needs a migration.

**Risks** — PR #3 (revocation) still waits on migration approval. It is rebased and green.

