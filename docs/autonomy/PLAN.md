# Autonomous week — plan

**Window:** 2026-10-19 → 2026-10-26 · **Owner:** Claude (autonomous), reporting to Mike Morgan · **Mandate:** move the AgenID reference implementation toward the Definition of Done in the project specification without interrupting Mike, queueing anything inside the hard limits in [NEEDS_MIKE.md](NEEDS_MIKE.md).

**Definition of done (from the project specification):** registry backed by a confirmed durable store · root authority key ceremony complete · push path fixed without credential handling · L4 sampling methodology and schema/CI sync resolved and documented · every partner doc's disclaimer accurate.

## Starting state (verified 2026-10-19, not carried forward)

| Item | State | Evidence |
|---|---|---|
| `main` | `b2dff44`, CI green on 20/22/24 | `gh run list` — run `36455036812` |
| Test suite | 1,455 green — core 99, api 89, cli 8, mcp-server 4, web 1,255 | local `pnpm -r test` |
| Live documentation claims | consistent with production | `check:docs --live` |
| Durable store | Supabase, proven 2026-09-15 | PROJECT_STATE "Production verified" |
| Push path | Mac shell via Desktop Commander, no credential handling | `git fetch` succeeded on the Mac |
| Schema/vector sync | **already resolved** — `spec-sync` CI job compares all six normative copies | `scripts/check-vectors.mjs` |
| Root key / authorities pin | not created; `authorities.json` 404 | live request |
| npm | nothing published | `npm view` |
| IETF draft | not submitted | Datatracker API: 0 documents |

## Ranked work (impact × dependency)

Items 1–3 are blocked on Mike and live in [NEEDS_MIKE.md](NEEDS_MIKE.md). Everything below is executable without him.

| # | Work | Why it ranks here | Done when |
|---|---|---|---|
| A | **Control documents current** — `PROJECT_STATE.md`, onboarding twins, queue | A reviewer reads these first; PROJECT_STATE says "last verified 2026-09-15" and still lists done work as planned | Every claim re-checked against production; `check:docs --live` green |
| B | **Mirrored-docs drift guard** | Onboarding guide and 8 partner briefs exist as hand-maintained byte-identical twins with no check | `check:docs` fails on any divergence; proven to fail |
| C | **Retell relay hardening** (#39) | Only route that forwards a caller's credential to a third party from agenid.com | Cross-site and non-JSON requests refused before the body is read; test proven to fail; threat model states the residual risk |
| D | **Operator-signed agent revocation** (#40a) | The largest functional gap in an identity protocol; every agent in production is `ACTIVE` forever | Signed request → `REVOKED` (permanent, per spec §12), ledger events, envelope + every badge/card reflect it, the signed request is publicly retrievable; production negative paths verified |
| E | **Revocation propagation semantics proposal** (#40b) | The half no code can supply: cache lifetime, re-check obligation, registry-unreachable behaviour | Non-normative proposal doc in `docs/`, cross-linked; queued for spec erratum/minor version |
| F | **Registration atomicity** (#34) | Four un-transacted writes can leave an agent without ledger events; revocation adds more writes of the same shape | Writes go through one Postgres function, or the trade is re-justified with revocation in view |
| G | **Operator key-discovery nudge** (#26 follow-on) | `/api/domain/status` already knows when an operator publishes no `.well-known` key copy; nobody tells the operator | `/verify/domain` states the single-source consequence, neutral styling |
| H | **axe-core accessibility check in CI** (#43) | WCAG fixes from the design pass have no regression guard | e2e fails on serious/critical violations; lockfile regenerated on the Mac |
| I | **External-contributor section** (#50) | Repo is public and invites ecosystem PRs | CONTRIBUTING has an outside-contributor path |
| J | Housekeeping — `EXAMPLE_AGENID` label (#46), rate-limit durable-layer confirmation (#20) | Small correctness items | Fixed or logged with evidence |

## Cadence

Each cycle: pick the top unblocked item → build in the cloud sandbox → full suite + build + `check:docs` → transfer as a patch to the Mac clone → `git pull --rebase` → push from the Mac → CI green on all three legs → production verified by direct request → append [LOG.md](LOG.md), update the project queue.

## Out of scope this week, deliberately

- Anything that issues a level above L1, publishes a trust pin, or names money/rails in protocol objects.
- Hero/IA changes beyond what correctness requires — the editorial homepage (`b2dff44`) is three weeks old and was Mike's call.
