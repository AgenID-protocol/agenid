# Attaching AgenID Identity to a Grok Bot

**Status: integration pattern, not a shipped package — and thinner than the other briefs in this directory.** There is no `@agenid/adapter-grok-bot` today, and unlike Retell, Vapi, ElevenLabs, and Bland, **xAI's own documentation for Grok Bot does not publish a metadata, custom-tool, or webhook-signing surface** as of this writing. This document is honest about that gap rather than inventing field names that don't exist in xAI's docs.

## What Grok Bot actually is

Grok Bot (per [docs.x.ai](https://docs.x.ai)) is xAI's product for persistent AI "teammates" — bots with names, jobs, and memory that compounds over time, each running on a persistent cloud computer (browser, filesystem, terminal) with skills/routines and app connectors, surfaced inside environments like Cursor. It is a distinct product from the base Grok LLM API and from X's `@grok` reply bot — don't conflate the three when scoping an integration.

## Why attach an identity at all

A Grok Bot acting as a persistent teammate can take real actions (browsing, filesystem, terminal, connected apps) under an identity that, from the outside, is just "a bot named X." `agenid:<ULID>` would give that bot a permanent, independently checkable identifier — the same reasoning that applies to a Retell or Vapi voice agent applies here.

## Where identity fits — and where it doesn't, yet

xAI's published docs do not currently document a metadata field, a custom-tool/webhook mechanism, or any place to attach an external identifier to a Grok Bot. Until that surface is published, there are two honest options, in order of preference:

1. **Ask xAI directly** whether Grok Bot supports custom metadata or connector-level custom headers — this is the only way to get a real, non-speculative answer.
2. **Fall back to the bot's own memory/instructions layer** — since Grok Bot supports persistent memory and instructions per bot, an `agenid:<ULID>` could be recorded there as a convention (e.g. in the bot's stated instructions: "This bot's AgenID is `agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" — verify at agenid.com") so it is at least discoverable by a human or another agent reading the bot's configuration, even without a structured field. This is a workaround, not an integration — treat it as such in any copy describing it.

## What's not built yet

- No `@agenid/adapter-grok-bot` package, and no confirmed API surface to build one against.
- No documented metadata, custom-tool, or webhook-signing mechanism in xAI's public Grok Bot docs — do not publish field names or JSON shapes for this integration until xAI documents one, or until direct confirmation is obtained from xAI.
- Community projects referencing "Grok Bot" (CLI wrappers, unofficial SDKs) exist but are third-party and unverified — do not treat them as xAI's documented surface.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [xAI — Grok Bot overview](https://docs.x.ai/grok-bot/overview)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- `@agenid/core` — the TypeScript reference implementation. Not published to npm, and its repository is not public yet.
