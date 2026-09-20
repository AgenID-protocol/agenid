# @agenid/mcp-server

A Model Context Protocol (MCP) stdio server for the **AgenID v1.1.1** protocol. It exposes three tools built on [`@agenid/core`](../core) — the same canonicalization and crypto engine the registry uses.

## Status

**Not published to npm.** `@agenid/mcp-server` returns 404 on the npm registry today. Run it from a clone of this monorepo:

```bash
pnpm install
pnpm --filter @agenid/mcp-server build
node packages/mcp-server/dist/index.js      # speaks MCP over stdio
```

It is a standard MCP stdio server, so any MCP-compatible client can launch it by pointing at that command. This repository ships no client-specific integration package, and no MCP client vendor is affiliated with or endorses AgenID.

## Tools

| Tool | Network | What it does |
|---|---|---|
| `resolve_agent_identity` | **Yes** — read-only GET | Resolves `agenid:<ULID>` against the public resolver (`AGENID_API_BASE_URL`, default `https://www.agenid.com`) and returns the full resolution envelope, so the answer can be re-verified without trusting this call |
| `verify_agent_manifest` | No | Stateless, offline Ed25519 verification over RFC 8785 JCS canonical bytes |
| `generate_keypair` | No | Generates an Ed25519 operator keypair and a skeleton manifest locally |

`generate_keypair` returns the private key **once, in the tool result**, and transmits it nowhere.

### Verifying a real proof

The protocol never signs a bare manifest. A `ManifestProof` signs the *proof* payload — `agent_id`, `manifest_version`, `manifest_digest`, `key_id`, `created_at`, `expires_at`. Pass that object (every field except `signature`) as `payload`. Passing the bare manifest correctly reports `valid: false`, because it is a different set of bytes.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `AGENID_API_BASE_URL` | `https://www.agenid.com` | Resolver used by `resolve_agent_identity`. Point it at a local `@agenid/web` for development. |

No credential is required, and none is accepted.

## What this server does not do

- It performs **no registry writes**. It cannot register, mutate, or revoke an identity.
- It issues no verification level. `L1_REGISTERED` is the only level the reference deployment issues today; `L2`–`L4` are defined by the specification but **not issued**, and `L5` is reserved and structurally absent from the enum. A level reported by `resolve_agent_identity` is whatever the resolver returned — this server neither computes nor endorses it.
- It implements no authorization. The v1.2 authorization layer in `@agenid/core` is **draft and non-normative**; nothing here stores, serves, evaluates, or revokes a grant.
- There is **no root authority key**. The ceremony has not been performed, so no authority-signed assertion exists for any tool here to check.

## Tests

```bash
pnpm --filter @agenid/mcp-server test
```

## See also

- [Specification](https://github.com/AgenID-protocol/spec) — normative, and the source of truth
- [`docs/partners/mcp-server-integration.md`](../../docs/partners/mcp-server-integration.md) — integration pattern, not a shipped adapter package

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 AI Venture Holdings LLC.
