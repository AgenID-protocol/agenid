# Autonomous week — blockers

A blocker is logged here only after at least three distinct approaches have failed. Work moves to the next item; nothing sits idle.

| Date | Item | Approaches tried | State |
|---|---|---|---|
| 2026-10-19 | Run the accessibility gate in CI (plan H) — the `a11y` job in `.github/workflows/ci.yml` | (1) push from the Mac with git's stored credential; (2) push with the `gh` CLI token (scopes `repo`, `read:org`, `gist`); (3) push from the cloud sandbox (the Claude GitHub App is not installed on the org). GitHub refuses any change to a workflow file without the `workflow` scope. | The gate itself shipped (`scripts/a11y.mjs`, 0 of 98 live). The job diff is ready to apply. Needs the scope grant — NEEDS_MIKE #10. |
