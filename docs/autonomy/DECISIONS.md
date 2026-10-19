# Autonomous week — decisions

Each entry: what was chosen, why, and how to undo it. Ordered by date.

## D-1 · 2026-10-19 · Interpreting the mandate's placeholders

The mandate arrived with `[PROJECT NAME]`, `[GOAL / DEFINITION OF DONE]` and `[END DATE]` unfilled. **Chosen:** project = AgenID (this repository and its production deployment at www.agenid.com); goal = the Definition of Done in the project specification (durable store, root key ceremony, push path, L4 methodology, schema/CI sync, accurate partner disclaimers); end date = 2026-10-26, seven days from start. **Why:** the session is bound to the AgenID project and its specification states a definition of done verbatim. **Undo:** restate the goal; the plan re-ranks without losing completed work.

## D-2 · 2026-10-19 · The autonomy files live in a public repository

This repository has been public since 2026-09-23. **Chosen:** keep these files factual and technical, and keep commercially sensitive material (pricing, revenue model, partner negotiations) out — NEEDS_MIKE items that touch it point at the private project record instead of restating it. **Why:** the repository-integrity standard says the repo must read like a senior engineering organization published it; an internal decision queue is acceptable there, private business strategy is not. **Undo:** move `docs/autonomy/` to the private project notes and delete it here in one commit.

## D-3 · 2026-10-19 · Build in the cloud sandbox, push from the Mac

The sandbox clone can read the repository but GitHub refuses pushes from it. **Chosen:** develop and test in the sandbox, export each commit with `git format-patch`, apply it in Mike's Mac clone with `git am` after `git pull --rebase`, and push from the Mac shell through Desktop Commander — the path already proven since 2026-09-13. **Why:** no credential is requested, pasted or stored, and authorship and history are preserved exactly. **Undo:** none needed; it changes where commands run, not what is committed.

## D-4 · 2026-10-19 · Schema/CI sync is already resolved

The project specification and queue item #9 list schema/CI sync as open. **Finding:** the `spec-sync` CI job (`scripts/check-vectors.mjs`) already fails the build if the §8 vector fixture or any of the five v1.1.1 JSON Schemas differs from `AgenID-protocol/spec`. **Chosen:** treat the normative half as closed and cover only the remaining gap — the hand-mirrored onboarding guide and eight partner briefs, which no check compares (plan item B). **Undo:** n/a.

## D-5 · 2026-10-19 · Agent revocation uses the v1.2-draft `Revocation` object

v1.1.1 §12 defines a permanent `REVOKED` status but no signed object for reaching it. **Chosen:** the draft `Revocation` already in `@agenid/core` (`revokes_type: "agent"`, operator role), rather than a registry-local shape. **Why:** core already signs and verifies it, its schema is served at `/schemas/v1.2/revocation.json`, and a second shape for the same statement would give verifiers two things to check. The draft label is carried in every response and doc. **Undo:** the route and envelope member can be removed in one commit; agents already revoked stay `REVOKED`, which is the protocol's rule regardless.

## D-6 · 2026-10-19 · Revocation ships as a pull request, not to `main`

The production migration it depends on (`0006_revocations`) was not approved when submitted. **Chosen:** push the finished, tested change as PR #3 and leave `main` and production untouched, rather than merge code whose dependency is missing — merging would publish pages saying revocation is deployed while the endpoint returned 503. **Why:** a public claim must not precede the capability (Universal Rule §20). **Undo:** n/a — merging the PR after the migration is applied is the forward path.

## D-7 · 2026-10-19 · No folder-access or app-install prompts during the run

Two shortcuts would shorten the push path (connecting the Mac repo folder; installing the Claude GitHub App on the org) but each raises a prompt on Mike's devices. **Chosen:** keep the proven path (patch transfer + push from the Mac shell) and queue the GitHub App install as an optional item. **Why:** the mandate says not to interrupt.
