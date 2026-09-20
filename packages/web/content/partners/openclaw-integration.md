# Attaching AgenID Identity to an OpenClaw Gateway

**Status: integration pattern, not a shipped package — and thinner than the other briefs in this directory.** There is no `@agenid/adapter-openclaw` today, and OpenClaw's published documentation does not describe a metadata or identity-attachment field for the specific pattern below. This document is honest about that gap rather than inventing field names that don't exist in the project's docs.

## What OpenClaw actually is

OpenClaw ([openclaw/openclaw](https://github.com/openclaw/openclaw), MIT-licensed, run by an independent nonprofit foundation) is a local-first Gateway — a control plane for sessions, tools, and events — plus a CLI/TUI/Control UI and connectors to 20+ messaging channels (Discord, Slack, Teams, Telegram, WhatsApp, iMessage, and more). It is the kind of "local shell agent gateway" that routes messages and tool calls between channels and an underlying LLM/agent, run on infrastructure the operator controls rather than a hosted platform. Its published security model centers on manual device "pairing approval" (`openclaw pairing approve`) and treating inbound messages as untrusted, not on a metadata/identity schema.

## Why attach an identity at all

An OpenClaw-run agent can act across many channels under one operator's control, but a person on the other end of a Discord DM or WhatsApp thread has no independently checkable way to confirm who operates the bot answering them. `agenid:<ULID>` would give that deployment a permanent, verifiable identifier — the same reasoning that applies to a hosted voice agent applies to a self-hosted gateway.

## Where identity fits — and where it doesn't, yet

Because OpenClaw is self-hosted and open source, an operator has more direct control than with a closed platform, but also has to build the wiring themselves — there is no built-in field to fill in. Two honest paths:

1. **At the connector/channel-handler level** — since OpenClaw's channel connectors are the layer that actually sends outbound messages, an operator running their own OpenClaw instance could have that layer append or expose an `agenid:<ULID>` reference (e.g. in a bot's profile/about text on channels that support it, or in a periodic disclosure message per EU AI Act Article 50 obligations), and separately run a verification check against `https://agenid.com/a/<ulid>` from their own infrastructure before dispatching a response. This is custom work on top of OpenClaw, not a feature OpenClaw ships.
2. **Open an issue or discussion with the OpenClaw project** if a first-class metadata/identity field would be broadly useful — as an open-source, foundation-run project, that is the legitimate path to get a documented extension point rather than relying on an undocumented one.

## What's not built yet

- No `@agenid/adapter-openclaw` package, and no confirmed extension point in OpenClaw's core to build one against.
- No documented metadata or identity-attachment schema in OpenClaw's published docs — do not publish field names or JSON shapes for this integration until the project documents one.
- Multiple near-identical forks of OpenClaw exist under different GitHub usernames — confirm you're integrating against the canonical `openclaw/openclaw` repository before relying on anything project-specific.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [OpenClaw — GitHub repository](https://github.com/openclaw/openclaw)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- `@agenid/core` — the TypeScript reference implementation. Not published to npm, and its repository is not public yet.
