# Attaching AgenID Identity to an MCP Server

**Status: integration pattern, not a shipped package.** There is no `@agenid/adapter-mcp` today. This document shows how an MCP (Model Context Protocol) server can declare `agenid:<ULID>` identity and let a client verify it with `@agenid/core`. It is written for engineers integrating the two protocols themselves; nothing described here implies AgenID has a first-party MCP package, and nothing described here is part of the MCP specification itself.

Field names below (`clientInfo`, `serverInfo`, `capabilities`, `instructions`) are MCP's own, as documented at [modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle). Verify against the current MCP spec before shipping — the spec is versioned and evolving.

## Why attach an identity at all

An MCP server acts as an agent's hands — it exposes tools, resources, and prompts that an AI model can call with real effects. Nothing in the base MCP handshake tells a client (or the human behind it) who operates a given server, or gives an auditor a way to check that independently. `agenid:<ULID>` fills that gap; an AgenID manifest and its Ed25519 proof let a client check that identity claim offline, without trusting the server operator's word or AgenID's database alone.

## Where identity fits in MCP's model

MCP's `initialize` handshake already carries identity-adjacent metadata: the client sends `clientInfo` (`name`, `title`, `version`); the server responds with `serverInfo` (`name`, `title`, `version`), negotiated `capabilities` (tools/resources/prompts/logging/completions), and an optional `instructions` string. The spec has no built-in provenance or signature field, so there are two documented extension points that fit without requiring a spec change:

1. **An `experimental` capability namespace entry** — e.g. `capabilities.experimental.agenid = { "id": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" }` — advertised at handshake time.
2. **A declared MCP resource** — e.g. `agenid://identity` — that a client can `resources/list` and `resources/read` through the standard resources capability, returning the server's manifest reference and current verification level.

Both are inferred conventions, not documented AgenID or MCP features — pick whichever fits your server's existing capability surface, and be explicit in your own docs that it's a convention, not a spec requirement.

```json
{
  "serverInfo": { "name": "acme-mcp-server", "version": "1.4.0" },
  "capabilities": {
    "experimental": {
      "agenid": { "id": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" }
    }
  }
}
```

## Verifying the identity

A client (or an agent orchestrating multiple MCP servers) that sees an `agenid:<ULID>` — via `experimental.agenid` or the `agenid://identity` resource — resolves it against `https://agenid.com/a/<ulid>` and checks the Ed25519 proof with `@agenid/core` before trusting the server's tool results for anything consequential. This is a client-side decision: MCP itself has no mechanism to require or enforce it, so treat it as defense-in-depth alongside whatever transport security (TLS, OAuth for remote servers) is already in place.

## What's not built yet

- No `@agenid/adapter-mcp` package on either the server or client side — the `experimental.agenid` / `agenid://identity` conventions above are illustrative starting points, not a ratified convention across the MCP ecosystem.
- No MCP spec change proposing identity/provenance as a first-class concept — this document works entirely within the existing `experimental` capability and resources mechanisms.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [MCP — Lifecycle specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- `@agenid/core` — the TypeScript reference implementation. Not published to npm, and its repository is not public yet.
