# Attaching AgenID Identity to a Retell AI Agent

**Status: integration pattern, not a shipped package.** There is no `@agenid/adapter-retell` today. This document shows how to wire `agenid:<ULID>` identity and Ed25519 proof verification into a Retell AI agent using Retell's existing, documented APIs plus `@agenid/core`. It is written for engineers integrating the two platforms themselves; nothing described here implies AgenID has a first-party Retell package.

Field names below (`metadata`, `webhook_url`, `webhook_events`, `x-retell-signature`) are Retell's own, as documented at [docs.retellai.com](https://docs.retellai.com). Verify against Retell's current docs before shipping — API surfaces change.

## Why attach an identity at all

A Retell agent can act for an organization — booking, escalating, answering as that organization — but nothing in a raw Retell `Agent` object says who is accountable for it in a way a third party can check independently. `agenid:<ULID>` gives that agent a permanent identifier; an AgenID manifest and its Ed25519 proof give a caller (or an auditor, or another agent) something they can verify offline, without trusting Retell's or AgenID's database.

## Where identity fits in Retell's model

Retell's `Agent` object accepts a `metadata` field and `retell_llm_dynamic_variables`, both of which are echoed back in call and webhook payloads (per [Create Agent](https://docs.retellai.com/api-references/create-agent)). That is the natural place to carry an `agenid:<ULID>`:

```json
{
  "agent_name": "Support Agent — Acme Corp",
  "metadata": {
    "agenid": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"
  }
}
```

This does not make Retell verify anything — it just makes the identifier travel with every call and webhook event Retell already sends you.

## Verifying the identity at call time

Use a [Custom Function](https://docs.retellai.com/build/single-multi-prompt/function-calling) (Retell's term for mid-call tool calling) that resolves the agent's own `agenid:<ULID>` against `https://agenid.com/a/<ulid>` (or the equivalent `Accept: application/json` request) and reports the current verification level back into the conversation, or that a downstream system checks before trusting the call. `@agenid/core` supplies the Ed25519 + RFC 8785 verification primitives; the HTTP fetch and Retell function wiring are yours to write — no SDK glue exists for this yet.

## Verifying webhook authenticity

Retell signs every webhook payload and sends the signature in the `x-retell-signature` header; Retell's own SDKs include a verification helper (see [Webhook Overview](https://docs.retellai.com/features/webhook-overview)). Verifying that header authenticates the payload as coming from Retell — it is a separate concern from AgenID's proof, which authenticates a claim about the *agent's identity*. Both checks matter and neither substitutes for the other:

- `x-retell-signature` → "this event really came from Retell."
- AgenID manifest proof → "this specific agent's identity claim was really signed by its declared operator (and, if verified, checked by an independent authority)."

## What's not built yet

- No `@agenid/adapter-retell` package. If one gets built, it would wrap the Custom Function pattern above, not replace it.
- No confirmed shape for Retell's `metadata` field beyond "accepts an object, echoed back" — Retell's docs don't specify a schema for it, so treat the example above as illustrative, not normative.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [Retell AI — Create Agent](https://docs.retellai.com/api-references/create-agent)
- [Retell AI — Function Calling Overview](https://docs.retellai.com/build/single-multi-prompt/function-calling)
- [Retell AI — Webhook Overview](https://docs.retellai.com/features/webhook-overview)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- `@agenid/core` — the TypeScript reference implementation. Not published to npm, and its repository is not public yet.
