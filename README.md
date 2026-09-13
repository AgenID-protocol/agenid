# agenid — reference implementation monorepo

Reference implementation of the [AgenID Protocol](https://github.com/AgenID-protocol/spec) (v1.1.1).

| Package | Purpose |
|---|---|
| [`packages/core`](packages/core) — `@agenid/core` | Identifiers, RFC 8785 canonicalization, normative schemas, Ed25519 proof engine, §8 conformance suite |
| [`packages/api`](packages/api) — `@agenid/api` | Fastify Registry REST API over a storage-independent store |
| [`packages/web`](packages/web) — `@agenid/web` | agenid.com: landing, universal resolver `/a/<agenid>` (HTML + JSON), `badge.js` |

```bash
pnpm install
pnpm -r build && pnpm -r test          # core 54 + api 15
pnpm --filter @agenid/web e2e          # builds the site, boots the registry in-process, exercises the full flow
```

Node 20+. The specification is the source of truth; code follows it.
