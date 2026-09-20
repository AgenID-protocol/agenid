# Attaching AgenID Identity to a LangChain / LangGraph Agent

**Status: integration pattern, not a shipped package.** There is no `@agenid/adapter-langchain` today. This document shows how to carry `agenid:<ULID>` identity through a LangChain or LangGraph run and verify it with `@agenid/core`. It is written for engineers integrating the two platforms themselves; nothing described here implies AgenID has a first-party LangChain package.

Field names below (`RunnableConfig`, `metadata`, `tags`, `callbacks`) are LangChain's own, as documented at [reference.langchain.com](https://reference.langchain.com). Verify against LangChain's current docs before shipping — API surfaces change, and LangGraph does not document an identity field beyond the same LangChain-core mechanism used here.

## Why attach an identity at all

A LangChain or LangGraph agent orchestrates tool calls and sub-chains on behalf of whoever deployed it — nothing in a raw chain run gives a caller, an auditor, or another agent a permanent, independently checkable identity to point to. `agenid:<ULID>` fills that gap; an AgenID manifest and its Ed25519 proof let a third party check that identity claim offline, without trusting LangSmith's or AgenID's database.

## Where identity fits in LangChain's model

`RunnableConfig` — the config object threaded through every `Runnable.invoke`/`.stream`/`.batch` call — exposes `metadata` (a JSON-serializable dict) and `tags` (a list of strings), both of which propagate automatically down the call stack via a context variable and merge across parent/child calls. That is the natural place to carry an `agenid:<ULID>`, and it reaches every callback handler and LangSmith trace for the run:

```python
result = agent.invoke(
    {"input": "..."},
    config={
        "metadata": {"agenid": "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"},
        "tags": ["agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"],
    },
)
```

As with the voice platforms, this does not make LangChain verify anything on its own — it makes the identifier travel with the run and show up in every trace and callback for later audit.

## Verifying the identity at run time

Two hooks fit, depending on whether verification should be automatic or on-demand:

- **A custom `@tool`-decorated function** the agent can call mid-run to hit `https://agenid.com/a/<ulid>` and get back the current verification level — this is on-demand, invoked only when the LLM decides to check.
- **A `BaseCallbackHandler` subclass** implementing `on_chain_start` / `on_agent_action` / `on_chain_end`, passed via `config["callbacks"]` — this fires automatically at run boundaries without the LLM needing to invoke anything, the same pattern third-party observability integrations (e.g. Langfuse) use to attach to every run.

`@agenid/core` (a TypeScript/Node package) supplies the Ed25519 + RFC 8785 verification primitives; for a Python LangChain agent, either call an internal verification service that wraps `@agenid/core`, or implement the RFC 8785 canonicalization + Ed25519 verification directly in Python against the published JSON Schemas and test vectors in [`AgenID-protocol/spec`](https://github.com/AgenID-protocol/spec) — no Python package exists yet.

## What's not built yet

- No `@agenid/adapter-langchain` package and no Python port of `@agenid/core` — a Python integration currently means calling a Node/TypeScript verification service, or implementing RFC 8785 + Ed25519 verification directly against the spec's published vectors.
- No LangGraph-specific identity field beyond the `RunnableConfig.metadata`/`tags` mechanism documented here — this is the natural fit, not a documented AgenID integration point in LangGraph itself.
- Regulatory framing for any AI-disclosure requirement in this flow should cite **EU AI Act Article 50**, not any California disclosure statute — see the AgenID spec's own disclosure guidance.

## References

- [LangChain — `RunnableConfig` reference](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig)
- [LangChain — Callbacks](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig/callbacks)
- [AgenID Protocol Specification](https://github.com/AgenID-protocol/spec)
- `@agenid/core` — the TypeScript reference implementation. Not published to npm, and its repository is not public yet.
