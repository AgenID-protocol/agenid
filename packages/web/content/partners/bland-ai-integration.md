# Attaching AgenID Identity to a Bland AI Agent

**Status: integration pattern, not a shipped package.** There is no `@agenid/adapter-bland` today. This document shows how to wire `agenid:<ULID>` identity and Ed25519 proof verification into a Bland AI phone agent using Bland's existing, documented APIs plus `@agenid/core`. It is written for engineers integrating the two platforms themselves; nothing described here implies AgenID has a first-party Bland package.

Field names below (`metadata`, `request_data`, Custom Tools, `X-Webhook-Signature`) are Bland's own, as documented at [docs.bland.ai](https://docs.bland.ai). Verify against Bland's current docs before shipping — API surfaces change.

## Why attach an identity at all

Bland is used for enterprise telephony at scale — outbound and inbound calling on behalf of an organization. Nothing in a raw Bland call or agent config gives a call recipient, or another agent, a permanent, independently checkable identity to point to. `agenid:<ULID>` fills that gap; an AgenID manifest and its Ed25519 proof let a third party check that identity claim offline, without trusting Bland's or AgenID's database.

## Where identity fits in Bland's model

Bland's [Send Call](https://docs.bland.ai/api-v1/post/calls) (`POST /v1/calls`) request accepts a `metadata` field (arbitrary JSON object, opaque to Bland) and a `request_data` field (values available for `{{variable}}` templating into prompts and tool calls). That is the natural place to carry an `agenid:<ULID>`:

```json
{
  "phone_number": "+15555550100",
  "metadata": {
    "agenid": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"
  }
}
```

As with the other voice platforms, this does not make Bland verify anything on its own — it makes the identifier travel with the call record and, via `request_data`, available for templating into prompts and tool calls.

## Verifying the identity at call time

Use a Bland [Custom Tool](https://docs.bland.ai/tutorials/custom-tools) — a tool definition with `name`, `url`, `method`, `headers`, `body` (templated from LLM-extracted conversation values via `{{input.property}}`), and a `response` map that extracts fields (via JSONPath) back into the conversation as `{{variable_name}}` — that resolves the agent's `agenid:<ULID>` against `https://agenid.com/a/<ulid>` and folds the verification level back into the call. Bland's optional `speech` field lets the agent talk while awaiting the response, so a verification lookup doesn't need to create dead air. `@agenid/core` supplies the Ed25519 + RFC 8785 verification primitives; the HTTP fetch and tool wiring are yours to write — no SDK glue exists for this yet.

## Verifying webhook authenticity

Bland signs its webhooks (including [post-call webhooks](https://docs.bland.ai/api-v1/post/postcall-webhooks-create)) with an `X-Webhook-Signature` header — an HMAC-SHA256 hex digest computed over the raw request body using your signing secret (see [Webhook Signing](https://docs.bland.ai/tutorials/webhook-signing)). Verifying that header authenticates the payload as coming from Bland — it is a separate concern from AgenID's proof, which authenticates a claim about the *agent's identity*. Both checks matter and neither substitutes for the other:

- `X-Webhook-Signature` → "this event really came from Bland."
- AgenID manifest proof → "this specific agent's identity claim was really signed by its declared operator (and, if verified, checked by an independent authority)."

## What's not built yet

- No `@agenid/adapter-bland` package. If one gets built, it would wrap the Custom Tool pattern above, not replace it.
- No confirmed schema for Bland's `metadata` field beyond "accepts an arbitrary JSON object" — treat the example above as illustrative, not normative.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [Bland AI — Send Call](https://docs.bland.ai/api-v1/post/calls)
- [Bland AI — Custom Tools](https://docs.bland.ai/tutorials/custom-tools)
- [Bland AI — Create a Custom Tool](https://docs.bland.ai/api-v1/post/tools)
- [Bland AI — Webhook Signing](https://docs.bland.ai/tutorials/webhook-signing)
- [Bland AI — Post-call Webhooks](https://docs.bland.ai/api-v1/post/postcall-webhooks-create)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- [`@agenid/core`](https://github.com/AgenID-protocol/agenid)
