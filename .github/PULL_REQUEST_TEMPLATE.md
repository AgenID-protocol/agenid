## What changed

<!-- One paragraph. What this does and why. Not a file list. -->

## Type

- [ ] `feat` — new capability
- [ ] `fix` — defect
- [ ] `docs` — documentation only
- [ ] `test` — coverage only
- [ ] `chore` / `ci` / `refactor`

## Protocol impact

- [ ] **No protocol impact** — identity, cryptography, serialization, verification, and schemas are unchanged
- [ ] **Protocol change** — the erratum or version bump in `AgenID-protocol/spec` has landed first, and is linked here:

## Verification

<!-- What you actually ran, and what it said. Not what you expect it to say. -->

- [ ] `pnpm -r test` passes for all five packages
- [ ] `pnpm --filter @agenid/web e2e` passes (required for anything touching registration or resolution)
- [ ] `next build` is clean (required for anything touching `packages/web`)
- [ ] Negative cases are covered — the bad input is still rejected, not only the good input still accepted

## Honesty checks

- [ ] **No surface asserts a verification level the code did not compute**
- [ ] No disclosure attestation is defaulted to `true`
- [ ] No private key appears in a request body, in browser storage, or in any stored record
- [ ] No credential, token, or secret is committed
- [ ] No dead or out-of-namespace host in public copy
- [ ] Any capability that is not deployed is labelled *planned*, *in development*, or *not deployed*
- [ ] Any new grep-able rule this change introduces is a test **in this commit**

## Documentation

- [ ] README, `docs/`, `PROJECT_STATE.md`, the OpenAPI spec, and any public copy referencing the changed behavior are updated in this cycle
- [ ] `CHANGELOG.md` updated if this is a notable change

## Notes for the reviewer

<!-- Anything that would be easy to miss. A real fix and a fabricated claim have arrived in the same diff here before: reviewing the thing the commit says it does is not the same as reviewing the commit. -->
