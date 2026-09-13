# Attaching AgenID Identity to an ElevenLabs Conversational AI Agent

**Status: integration pattern, not a shipped package.** There is no `@agenid/adapter-elevenlabs` today. This document shows how to wire `agenid:<ULID>` identity and Ed25519 proof verification into an ElevenLabs Conversational AI agent using ElevenLabs' existing, documented APIs plus `@agenid/core`. It is written for engineers integrating the two platforms themselves; nothing described here implies AgenID has a first-party ElevenLabs package.

Field names below (`dynamic_variables`, `conversation_initiation_client_data`, server tools, `ElevenLabs-Signature`) are ElevenLabs' own, as documented at [elevenlabs.io/docs](https://elevenlabs.io/docs). Verify against ElevenLabs' current docs before shipping — API surfaces change.

## Why attach an identity at all

An ElevenLabs Conversational AI agent can speak for an organization on a call — nothing in the raw agent config gives a caller, or another agent, a permanent, independently checkable identity to point to. `agenid:<ULID>` fills that gap; an AgenID manifest and its Ed25519 proof let a third party check that identity claim offline, without trusting ElevenLabs' or AgenID's database.

## Where identity fits in ElevenLabs' model

ElevenLabs agents support `dynamic_variables`, passed via `conversation_initiation_client_data` (WebSocket/API) or `ConversationInitiationData` (SDK). Values injected this way are available to the system prompt, first message, and tool parameters/headers using `{{variable_name}}` interpolation. That is the natural place to carry an `agenid:<ULID>`:

```json
{
  "conversation_initiation_client_data": {
    "dynamic_variables": {
      "agenid": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"
    }
  }
}
```

ElevenLabs also reserves a `system__` prefix for its own built-in variables (`system__conversation_id`, `system__agent_id`, `system__caller_id`, etc.) — do not collide with that namespace. As with Retell and Vapi, injecting the identifier does not make ElevenLabs verify anything on its own — it makes the identifier travel with the conversation and any tool calls that reference it.

## Verifying the identity at call time

Use an ElevenLabs [Server tool](https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools) (also called a "webhook tool") — a per-agent tool definition with a URL, HTTP method, and templated parameters/headers — that resolves the agent's `{{agenid}}` dynamic variable against `https://agenid.com/a/<ulid>` and folds the verification level back into the conversation (server tools support writing their response back into a dynamic variable via dot-notation). `@agenid/core` supplies the Ed25519 + RFC 8785 verification primitives; the HTTP fetch and tool wiring are yours to write — no SDK glue exists for this yet.

## Verifying webhook authenticity

ElevenLabs signs its post-call webhooks with the `ElevenLabs-Signature` header, formatted as `t=<timestamp>,v0=<hex HMAC-SHA256>` computed over `"<timestamp>.<raw_body>"` (see [Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)). Verifying that header authenticates the payload as coming from ElevenLabs — it is a separate concern from AgenID's proof, which authenticates a claim about the *agent's identity*. Both checks matter and neither substitutes for the other:

- `ElevenLabs-Signature` → "this event really came from ElevenLabs."
- AgenID manifest proof → "this specific agent's identity claim was really signed by its declared operator (and, if verified, checked by an independent authority)."

## What's not built yet

- No `@agenid/adapter-elevenlabs` package. If one gets built, it would wrap the server-tool pattern above, not replace it.
- No confirmed schema for `dynamic_variables` beyond "arbitrary key/value pairs, minus the `system__` reserved prefix" — treat the example above as illustrative, not normative.
- The exact `ElevenLabs-Signature` format was corroborated against a third-party (Hookdeck) reference alongside ElevenLabs' own docs page — re-verify directly against ElevenLabs' current docs before relying on it in production signature-verification code.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [ElevenLabs — Dynamic variables](https://elevenlabs.io/docs/agents-platform/customization/personalization/dynamic-variables)
- [ElevenLabs — Server tools](https://elevenlabs.io/docs/agents-platform/customization/tools/server-tools)
- [ElevenLabs — Post-call webhooks](https://elevenlabs.io/docs/eleven-agents/workflows/post-call-webhooks)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- [`@agenid/core`](https://github.com/AgenID-protocol/agenid)
