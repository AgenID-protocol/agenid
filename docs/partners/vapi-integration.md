# Attaching AgenID Identity to a Vapi Assistant

**Status: integration pattern, not a shipped package.** There is no `@agenid/adapter-vapi` today. This document shows how to wire `agenid:<ULID>` identity and Ed25519 proof verification into a Vapi assistant using Vapi's existing, documented APIs plus `@agenid/core`. It is written for engineers integrating the two platforms themselves; nothing described here implies AgenID has a first-party Vapi package.

Field names below (`metadata`, `server`, `tools`, `message.type`) are Vapi's own, as documented at [docs.vapi.ai](https://docs.vapi.ai). Verify against Vapi's current docs before shipping — API surfaces change.

## Why attach an identity at all

A Vapi assistant can act for an organization the same way a Retell agent can — nothing in the raw `Assistant` object gives a caller, or another agent, a permanent, independently checkable identity to point to. `agenid:<ULID>` fills that gap; an AgenID manifest and its Ed25519 proof let a third party check that identity claim offline, without trusting Vapi's or AgenID's database.

## Where identity fits in Vapi's model

Vapi's `Assistant` object accepts a `metadata` (object) field on create/update (per [Create Assistant](https://docs.vapi.ai/api-reference/assistants/create)). That is the natural place to carry an `agenid:<ULID>`:

```json
{
  "name": "Support Assistant — Acme Corp",
  "metadata": {
    "agenid": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"
  }
}
```

As with Retell, this does not make Vapi verify anything on its own — it makes the identifier travel with the assistant config and, depending on Vapi's event payloads, with server events tied to that assistant.

## Verifying the identity at call time

Use a Vapi [Tool](https://docs.vapi.ai/tools) — specifically a function-type Custom Tool with a `server.url` your infrastructure controls — that resolves the assistant's `agenid:<ULID>` against `https://agenid.com/a/<ulid>` and folds the verification level back into the conversation, or that a downstream system checks before trusting the interaction. `@agenid/core` supplies the Ed25519 + RFC 8785 verification primitives; the HTTP fetch and tool wiring are yours to write — no SDK glue exists for this yet.

## Verifying server-event authenticity

Vapi's server events (`message.type` values including `tool-calls`, `end-of-call-report`, `status-update`, etc. — see [Server events](https://docs.vapi.ai/server-url/events)) reach your `server.url`. Authentication of those events is **configurable, not signed by default**: Vapi supports a static bearer token, a legacy `X-Vapi-Secret` header, or an HMAC credential with a selectable hash algorithm and header name (see [Server authentication](https://docs.vapi.ai/server-url/server-authentication)). Whichever mechanism you pick, it authenticates "this event really came from Vapi" — a separate concern from AgenID's proof, which authenticates a claim about the *assistant's identity*:

- Vapi server-event auth (bearer / `X-Vapi-Secret` / HMAC) → "this event really came from Vapi."
- AgenID manifest proof → "this specific assistant's identity claim was really signed by its declared operator (and, if verified, checked by an independent authority)."

**Do not skip configuring one of Vapi's authentication options.** Unlike Retell, Vapi does not sign server events by default — that has to be turned on.

## What's not built yet

- No `@agenid/adapter-vapi` package. If one gets built, it would wrap the Custom Tool pattern above, not replace it.
- No confirmed schema for Vapi's `metadata` field beyond "accepts an object" — treat the example above as illustrative, not normative.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [Vapi — Create Assistant](https://docs.vapi.ai/api-reference/assistants/create)
- [Vapi — Introduction to Tools](https://docs.vapi.ai/tools)
- [Vapi — Custom Tools](https://docs.vapi.ai/tools/custom-tools)
- [Vapi — Server events](https://docs.vapi.ai/server-url/events)
- [Vapi — Server authentication](https://docs.vapi.ai/server-url/server-authentication)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- [`@agenid/core`](https://github.com/AgenID-protocol/agenid)
