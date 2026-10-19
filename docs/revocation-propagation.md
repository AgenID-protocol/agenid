# Revocation propagation — proposal

**Status: PROPOSAL, not normative.** This document proposes text for a future specification erratum or minor version. Nothing here is part of protocol v1.1.1, and the reference deployment does not enforce any obligation on relying parties. It exists because revocation is only as fast as the slowest party still holding an old answer, and nothing in v1.1.1 says how slow that may be.

## What exists today

Verified against production on 2026-10-19.

- An operator can permanently revoke their own agent: `POST /api/v1/agents/{agenid}/revocation` with a `Revocation` signed by the agent's operator key ([api.md](api.md#post-apiv1agentsagenidrevocation--revoke-an-agent)). The status becomes `REVOKED`, the signed object is stored, and an `agent.revoked` ledger event is appended, atomically.
- The resolution envelope (`/api/resolve/{agenid}`, `/a/{agenid}` as JSON) carries the signed revocation in `revocation`, so a verifier can check that the operator made the change.
- The registry answers resolution with `cache-control: no-store`. The SVG badge and `badge.js` send `cache-control: public, max-age=0`.

What does **not** exist: any statement of how long a relying party may rely on an `ACTIVE` answer, what it must do when the registry is unreachable, or how revocation reaches a party that never re-resolves. The registry cannot fix that by itself — it controls only its own response headers — which is why it belongs in the specification.

## The problem in one example

A voice platform resolves `agenid:A` at 09:00, sees `ACTIVE`, and caches the result for a day. At 09:05 the operator discovers the operator key was stolen and revokes the agent. Until the next day the platform keeps accepting calls from an identity whose own operator has disowned it. The revocation worked; the propagation did not.

## Proposed normative text

The keywords are used as in RFC 2119.

**P-1 · Maximum reliance window.** A relying party MUST NOT rely on an `ACTIVE` resolution result for longer than **300 seconds** after it was obtained. After that, it MUST re-resolve before relying on the identity again. A registry MAY advertise a shorter window; it MUST NOT be read as permission for a longer one.

**P-2 · Revocation is final on sight.** A relying party that observes `REVOKED` for an identifier, from any registry response it has verified, MUST treat the identity as revoked from that moment on, MAY cache that result indefinitely, and MUST NOT return to `ACTIVE` on the strength of a later response. Revocation is permanent (§12), so a later `ACTIVE` is evidence of a fault or an attack, not a reprieve.

**P-3 · Verify the revocation, not the status.** A relying party SHOULD verify the envelope's `revocation` against `operator_key.document` and require `revokes` to equal the agent identifier. A `REVOKED` status without a verifiable revocation object SHOULD still be honored as revoked — refusing service is the safe failure — but SHOULD be reported as a registry fault.

**P-4 · Registry unreachable.** When re-resolution fails because the registry is unreachable, the relying party MUST treat the identity's status as **unknown**, not as `ACTIVE`. Whether it then proceeds is its own risk decision, and it MUST NOT represent the identity to its users as verified or active while the status is unknown. For actions with financial or safety consequences it SHOULD fail closed.

**P-5 · Grace is explicit.** A relying party that chooses to continue during an outage (P-4) SHOULD bound that grace — this proposal suggests no more than **one hour** past the last successful resolution — and SHOULD log that it did so.

**P-6 · Registry obligations.** A registry MUST serve resolution responses with caching directives no more permissive than P-1, and MUST serve `REVOKED` with the revocation object in the same response, never in a separate fetch the relying party might skip.

## Why these numbers

- **300 seconds** matches the window the reference registry already uses for operator-signed consents and revocations (`revoked_at` must be within five minutes of the registry clock), so the protocol uses one notion of "recent". It is short enough that a stolen key buys an attacker minutes, not days, and long enough that a busy relying party is not resolving on every request.
- **Final on sight** costs nothing and removes a whole class of replay: an attacker who can serve one stale `ACTIVE` response cannot undo a revocation the relying party has already seen.
- **Unknown is not active** is the same rule every surface on agenid.com already follows: a registry outage renders neutral "unavailable", never green.

## Known gaps this proposal does not close

1. **Badges in third-party caches.** A README badge is fetched through image proxies (GitHub's among them) that may cache regardless of `max-age=0`. A revoked agent's badge can show the old state there for longer than P-1 allows. Badges are a human-facing hint; P-1 applies to relying parties making decisions, which must resolve the envelope.
2. **Parties that never re-resolve.** No specification can reach a relying party that checked once and never again. P-1 makes that party non-conforming; it does not make it safe.
3. **Push notification.** A webhook or feed of revocations would shorten propagation below the polling interval. It is deliberately out of scope here: it needs subscriber authentication and delivery guarantees, and polling under P-1 is already bounded.
4. **Grant and key revocation.** The v1.2-draft `Revocation` also targets grants, keys and assertions. The same rules should apply to them, but this registry records agent revocations only, so they are not exercised yet.

## Path to adoption

This is queued as a specification change (project queue item #40b). It needs an erratum or a minor version of `AgenID-protocol/spec`, conformance vectors for P-2 and P-4, and — before any financial capability is designed — adoption, since payments-gate G-2 makes revocation propagation a prerequisite.
