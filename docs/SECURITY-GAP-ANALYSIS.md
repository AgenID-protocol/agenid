# AgenID — Security Gap Analysis

**Date:** 2026-09-18
**Baseline commit:** `5dd259d`
**Method:** every claim below was established by reading the implementation or by
calling the deployed system. Nothing here is carried forward from a previous
document. Where a claim came from a live request, the request and its response
are shown.

---

## 0. Summary

AgenID today is a **credible identity and provenance layer with no authorization
layer at all.**

The cryptographic core is genuinely strong and should not be touched: one signing
construction, RFC 8785 canonicalization, pure Ed25519, digest binding, explicit
clocks, verification outcomes as values with stable codes, and a registry that a
verifier can disbelieve and re-check independently. That is the hard part and it
is done.

What is missing is everything above identity. Of the five questions this analysis
was asked to make answerable by an external system, **two are answerable today and
three are not**:

| Question | Answerable today |
|---|---|
| Who is this agent? | **Yes** |
| Who does it represent? | **No** — an unverified free-text string |
| Is its credential valid? | **Yes** |
| What is it authorized to do? | **No** — no authorization model exists |
| Is that authorization currently active? | **No** — there is nothing to be active |

Three findings drive everything else in this document:

- **GAP-B1** — an agent's binding to a human or organization is a **string the
  operator typed**, not a cryptographic fact. There is no key role representing a
  person or a company anywhere in the protocol.
- **GAP-D1** — there is **no permission model**. Verification levels L1–L4 describe
  *how carefully an identity was checked*. They say nothing about *what the agent
  may do*. These are orthogonal, and only the first exists.
- **GAP-C1** — there is **no request-level authentication**. Every deployed endpoint
  is unauthenticated, and no mechanism binds a live HTTP request to a registered
  agent identity.

A direct consequence worth stating plainly, because it constrains the build order:
**the security demo cannot be built honestly yet.** "Access my medical records →
NOT PERMITTED" requires a permission model to deny against. Today AgenID would
answer "identity verified" and would have nothing at all to say about the action.
Shipping that demo before the model exists would be the same defect class this
project has already hit seven times — a surface asserting an outcome no code
computed.

---

## A. Agent Identity

**Verdict: implemented and sound. One real gap — no revocation path.**

| Property | State | Evidence |
|---|---|---|
| Agent ID format | `agenid:<ULID>`, regex-enforced at every boundary | `packages/core/src/identifier.ts`, `AGENT_ID_REGEX` |
| Registration | `POST /api/v1/agents` — 201 | signature, digest binding, key role, controller and expiry all checked before any write; single implementation in `packages/web/lib/register.ts` |
| Ownership | operator key, `role=operator`, `controller === agent_id` | enforced in `verifyManifestProof` step 3 and re-checked at signing time |
| Lifecycle status | **stored, never written** | `agents.status` has a five-value CHECK (`ACTIVE`/`CHANGED`/`STALE`/`SUSPENDED`/`REVOKED`); only `ACTIVE` is ever set |
| Revocation | **does not exist** | see GAP-A1 |
| Rotation | modelled correctly, no write path | see GAP-A2 |

### GAP-A1 — There is no revocation path for an agent. *(Severity: high)*

`LedgerEvent` declares the event types `manifest.changed`, `agent.status_changed`,
`assertion.issued` and `agent.revoked`. Only `agent.registered` and `key.published`
are ever emitted. Every agent in production is `ACTIVE` and no code can move it out
of that state.

For an identity protocol this is the most conspicuous gap in the system. An
identity you cannot withdraw is not an identity system; it is an append-only log.
The failure is not theoretical — the intended remedy for a compromised agent key
today is *nothing*.

Note what **does** work, because it is the foundation the fix builds on: key-level
revocation is fully modelled. `KeyDocument` carries `status`, `retired_at` and
`revoked_at`; `keyActiveAt()` evaluates them against the signing instant, not
against `now`, so a signature made before revocation stays valid and one made after
does not. Retired and revoked keys remain resolvable forever so historical
signatures stay checkable. The semantics are right. Nothing publishes them.

### GAP-A2 — Key rotation has no write path. *(Severity: medium)*

Same shape as A1. Each key has its own ULID, its own lifecycle fields, and
`GET /v1/keys/<ulid>` serves it. There is no endpoint that retires a key and
publishes its successor.

### GAP-A3 — Registration writes four rows with no transaction. *(Severity: low, accepted)*

`agents`, `keys` and two `events` rows are separate statements. A mid-sequence
failure leaves an agent without its ledger events. Already documented in
`docs/architecture.md` as an accepted trade: it degrades the audit trail, not
verifiability, because the envelope is reconstructed from the agent and key rows
alone. It stops being acceptable the moment the ledger becomes load-bearing for
authorization decisions — which §D below proposes.

---

## B. Human / Organization Binding

**Verdict: does not exist as a cryptographic fact. This is the most important gap
in the system.**

### What the protocol actually models today

```
agenid:<ULID>  (the agent)
      ^
      | controller
      |
KeyDocument { role: "operator", controller: "agenid:<ULID>" }
```

The operator key's controller is **the agent's own identifier**. The key graph
terminates at the agent. There is nothing above it.

The only place a human or organization appears is inside the manifest:

```jsonc
"ownership": {
  "operator":        "AI Venture Holdings LLC",   // FreeText(300) — typed by the operator
  "operator_domain": "aiventureholdings.com",     // Hostname     — typed by the operator
  "contact":         "…"                          // email        — typed by the operator
}
```

`packages/core/src/schemas.ts` — all three are self-asserted strings.

### GAP-B1 — "Who does this agent represent" is answered by an unverified string. *(Severity: critical)*

The Ed25519 signature over the manifest proves the manifest was not tampered with
after signing. It proves **nothing whatsoever** about whether AI Venture Holdings
LLC actually authorized this agent. Anyone can generate a keypair at `/issue`, type
any company's name into `ownership.operator`, and obtain a cryptographically valid,
registry-resolvable `L1_REGISTERED` identity claiming to represent them.

This is not a bug in the implementation — the implementation is faithful to the
spec, and the product is careful to label L1 as self-declaration. It is a gap in
the **protocol's object model**: there is no `KeyRole` that represents a person or
a company, so there is no signature a principal could make even if they wanted to.

`KeyRole` is exhaustively `["operator", "authority"]`.

### GAP-B2 — The one mechanism that could bind it is blocked. *(Severity: critical, known)*

`L2_DOMAIN_VERIFIED` over `operator_domain` would make the binding checkable — a
`_agenid` TXT record any third party can re-derive. `/verify/domain` already
collects exactly that evidence and re-checks it continuously.

It cannot be turned into anything. Issuing `L2` requires a `VerificationAssertion`
signed by the root authority key, and that key does not exist:

```
GET https://www.agenid.com/.well-known/agenid/authorities.json   ->  404
```

So the evidence side of domain binding is built and the issuance side is blocked on
the root key ceremony. That ceremony is gated on its own hardening checklist
(`claude/agenid-root-key-policy.md` §7, H-1…H-8) and three open items.

**Consequence for this analysis:** even after the authorization layer in §D is
built, an authorization grant's *principal* is only as trustworthy as the binding
between that principal and a real-world organization. Until L2 issues, that binding
is self-asserted. The authorization layer is still worth building first — it is
independent work, and a self-asserted principal signing a scoped grant is strictly
more informative than no grant at all — but the product must not describe a grant
as proving organizational authorization until L2 exists.

---

## C. Authentication

**Verdict: object authentication is strong. Request authentication does not exist.**

These are two different questions and AgenID currently answers only the first.

### What works — object authentication

"Did the holder of this key sign this object?" is answered rigorously:

- Pure Ed25519 (RFC 8032), never pre-hash. Node's `sign(null, …)` makes Ed25519ph
  unrepresentable, which is deliberate.
- Signing input is RFC 8785 JCS canonical bytes with the `signature` member
  stripped — one construction, one code path, `signingInputOf()`.
- `$schema` is inside the signing input where present, so a schema swap breaks the
  signature.
- Digest binding is checked **before** any signature math.
- Key identity, role, controller and activity-at-signing-time are all checked, and
  each failure has its own stable code.
- `now` is always passed explicitly. Protocol code never reads a hidden clock.

**There is no permanent API key acting as a trust mechanism anywhere in the
protocol.** No bearer token authenticates any protocol object. That is the right
answer and it is already in place.

### GAP-C1 — No request-level authentication on any endpoint. *(Severity: high)*

Nothing binds a live HTTP request to a registered agent. Every deployed endpoint is
unauthenticated. There is no proof-of-possession, no request signing, no nonce, and
no challenge.

The brief asks AgenID to be able to verify "this request actually came from the
registered agent." Today it cannot. It can verify that *an object it is handed* was
signed by a key — which is a different and weaker statement, because the object can
be handed over by anyone who has seen it.

### GAP-C2 — No replay protection. *(Severity: high)*

Replay is bounded only by the validity window inside the signed object
(`created_at` … `expires_at`). A window limits a proof's **lifetime**, not its
**reuse**. Within its window the same valid `ManifestProof` can be submitted an
unlimited number of times, by anyone holding a copy.

There is no nonce, no `jti`, and no server-side record of consumed proofs. For
registration this is largely harmless — `createAgent` is an atomic create and a
replay collides on the primary key. For anything that authorizes an **action**, as
§D proposes, it is not harmless at all, and replay protection must be designed in
rather than added afterwards.

### GAP-C3 — No short-lived credentials. *(Severity: medium)*

There is no credential shorter-lived than the manifest proof itself, and no
issuance path that could mint one. A grant-bearing request needs something with a
lifetime measured in minutes, not the proof's own window.

### What is correctly absent

Worth recording so a future session does not "fix" it: there is deliberately **no
OAuth/OIDC in the protocol core**. AgenID's object model is signature-based and
storage-independent precisely so a verifier needs no session with AgenID. Adding a
token-issuing identity provider to the core would reintroduce the trusted third
party the product exists to remove. OIDC belongs at the edge, for *operators*
managing their own agents — not between a verifier and an identity.

---

## D. Authorization

**Verdict: does not exist. No permission model, no scopes, no check.**

### The conflation to avoid

`VerificationLevel` is `L1_REGISTERED` … `L4_DEPLOYMENT_VERIFIED`. These describe
**how carefully an identity was checked**. They are an assurance ladder.

They say nothing about **what the agent may do**. An `L4`-verified agent and an
`L1` agent have exactly the same permissions today: none, expressed nowhere.

These two axes are orthogonal and the product currently has only the first. Any
design that tries to express permissions as a verification level — "L3 agents may
book appointments" — collapses them and is wrong.

### Evidence

- No scope, permission or capability type exists in `packages/core`.
- No permission check exists anywhere in the codebase.
- The endpoint is not deployed:

```
POST https://www.agenid.com/api/v1/authorization/check   ->  404
```

### The spec already reserved the namespace

`packages/core/src/schemas.ts`:

```ts
export const RESERVED_MANIFEST_KEYS = [
  "platform", "permissions", "jurisdictions", "status",
  "change_history", "authorizations", "configuration_fingerprint",
] as const;
```

`permissions` and `authorizations` are **reserved names that v1.1.1 must reject**,
and `Manifest` is `.strict()`, so it does reject them. The spec authors anticipated
this layer and left the namespace clear. That is the designated landing spot, and
it settles the version question: adding authorization is a **minor version bump**,
not an erratum — a v1.1.1 verifier will reject objects a v1.2 verifier accepts.

### GAP-D1 — No authorization model. *(Severity: critical)*

Nothing in the protocol can express "this agent may create an appointment but may
not read medical records." This is the single largest functional gap and everything
in the brief's §3, §6 and §7 depends on closing it.

### GAP-D2 — No least-privilege default, because there is no privilege model. *(Severity: critical)*

Framed carefully: the current system is not *permissive* — an agent receives no
authority from AgenID, because AgenID grants none. The risk is what receiving
systems do with an identity in the absence of a permission statement. A dentist's
booking system handed a valid `L1` identity has no machine-readable way to learn
that this agent was never authorized to do anything, so the pressure is to treat
"verified identity" as "permitted action." **That conflation is the exact harm the
product exists to prevent, and today the protocol does not give a receiving system
the vocabulary to avoid it.**

---

## E. Delegation

**Verdict: does not exist, in either of the two distinct senses.**

### E-1 Capability delegation (principal → agent → action) — nothing exists

The brief's chain:

```
Human / Organization  →  authorizes  →  Agent
                      →  to perform   →  specific action
                      →  within       →  specific scope
                      →  for          →  specific period
```

No part of this is representable. There is no principal (§B), no scope (§D), and no
object that binds them with a validity window.

### E-2 Authority key delegation (root → subordinate) — designed, not adopted, not built

Designed in `claude/agenid-v1.2-delegation-proposal.md` (Sept 14), never ratified.
Verified again for this analysis by reading `@agenid/core`: `AuthoritiesDocument`
publishes the pin (`root_key_id`, `root_public_key_b64u`), `VerificationAssertion`
names its own `key_id`, and `verifyVerificationAssertion()` checks role, controller
and activity — but **no object binds a non-root authority key to the pinned root.**

Consequences already on record and still true:

1. The root cannot be isolated; it must sign every assertion.
2. Compromise is unbounded in scope — any signing key can sign anything.
3. Compromise is unbounded in **time** — an attacker holding the root chooses
   `verified_at`, so a forged assertion can be backdated and a verifier cannot
   distinguish it from a legitimate historical one. Root compromise therefore
   invalidates all history, and `revoked_at` does not help.

Point 3 is the strongest argument for adopting delegation **before** issuance
volume grows. It is cheap now, when the verifier population is zero, and expensive
later.

**These two are independent.** E-1 is the product gap; E-2 is a trust-root
resilience gap. E-1 does not depend on E-2 and should not wait for it.

---

## F. Verification

**Verdict: the mechanism is excellent and answers two of the five questions.**

### What works, and is genuinely good

The resolution envelope is machine-readable, and — the property that matters — a
verifier can **re-derive every claim in it without trusting the registry**. That
was confirmed independently: an envelope pulled from production verifies offline
with `@agenid/core` alone, and a one-character tamper of the manifest is rejected
with `manifest_digest_mismatch`.

Two-path key discovery is deployed on both halves, so a verifier can fetch the
operator key from the registry and from the operator's own domain and require they
agree.

`GET /a/<agenid>` serves both representations of the same resource — HTML card for
browsers, canonical envelope for `Accept: application/json` — and an unregistered
identifier renders neutral, never as a failure.

### GAP-F1 — Three of the five questions have no answer. *(Severity: critical)*

Restating the summary table with its cause:

| Question | Today | Blocked by |
|---|---|---|
| Who is this agent? | answered | — |
| Who does it represent? | **unanswered** | GAP-B1 |
| Is its credential valid? | answered | — |
| What is it authorized to do? | **unanswered** | GAP-D1 |
| Is that authorization currently active? | **unanswered** | GAP-D1, GAP-A1 |

### GAP-F2 — The residual risk in two-path discovery points at the operator. *(Severity: medium, known)*

Both paths resolve, but the `.well-known` copy is published by the operator. An
agent whose `operator_domain` serves no key document leaves a verifier with a
single source, and a verifier that treats a **missing** operator copy as
*agreement* has disabled the defense entirely. Already named in `README`
limitation 3 and `docs/trust-model.md`; the product does not yet tell an operator
that their missing copy weakens their own agent's verifiability.

---

## G. Cross-cutting gaps

### GAP-G1 — No rate limiting on any public endpoint. *(Severity: critical — highest-priority unaddressed item)*

Measured against production for this analysis — 25 rapid unauthenticated POSTs to
the public write endpoint:

```
POST https://www.agenid.com/api/v1/agents  x25
400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400 400
```

Twenty-five of twenty-five processed. No `429`, no backoff, no bound.

Four distinct exposures:

| Surface | Exposure |
|---|---|
| `POST /api/v1/agents` | unauthenticated public **write**; every write is signature-verified and self-attributed, but nothing bounds volume |
| `POST /api/retell/bind` | accepts an **unbounded array** — one request can trigger an unbounded number of store writes |
| `POST /api/retell/agents` | unauthenticated relay forwarding a caller-supplied key to a third party **from AgenID's domain** — an open relay |
| `POST /api/domain/status` | polled by the browser every 6s, makes up to four outbound probes per call **against a caller-supplied hostname** — an unauthenticated amplifier |

Each probe is individually bounded at 4s. Nothing bounds the number of probes.

### GAP-G2 — No trust root. *(Severity: critical, known, gated on ceremony)*

`/.well-known/agenid/authorities.json` → `404`, verified. Nothing above `L1` is
issuable on the reference deployment. This is correctly and prominently disclosed
on every public surface, which is the right handling — but it is still the ceiling
on the product's main conversion path.

### GAP-G3 — No tenancy, ownership or RBAC model. *(Severity: medium — architectural)*

The registry is a public directory with no account model. There is no organization
object, no membership, no role assignment, and no data isolation boundary, because
every row is deliberately world-readable.

That is correct for a public identity registry and should not be changed. But the
brief's §12 asks that enterprise capabilities be reachable **without a rewrite**,
and the principal object proposed in §H below is what makes that true: an
organization principal is the natural anchor for membership and RBAC later, and
introducing it now costs nothing extra.

### GAP-G4 — No abuse detection, no monitoring, no incident response runbook. *(Severity: medium)*

There is no anomaly detection, no alerting on registration volume, and no written
incident-response procedure for a key compromise or a fabricated-registration
event. `SECURITY.md` covers vulnerability *reporting*; it does not cover response.

---

## H. What to build — recommended design

Three new signed objects, one new key role, and one new endpoint family. All
additive. The v1.1.1 verification path is untouched and remains valid indefinitely.

**Shipping posture:** implemented and deployed as **`v1.2-draft`**, explicitly
labelled not-yet-normative on every public surface, exactly as `L5` and
`AUTHORIZED` are handled today. It becomes normative when it is ratified and the
conformance suite carries vectors for every failure code — not when the code
merges. This keeps the irreversible act (declaring v1.2) separate from the
reversible one (building it).

### H-1 New key role: `principal`

Closes GAP-B1 and unblocks GAP-G3.

```
PrincipalId  ::=  agenid:principal:<ULID>
KeyRole      ::=  operator | authority | principal          // + principal
```

A principal key's `controller` is a `PrincipalId`. A principal is a human or an
organization — the entity an agent represents and from which it derives authority.

This is the missing node above the agent in the key graph:

```
agenid:principal:<ULID>          the human / organization
        |  AuthorizationGrant (signed by the principal key)
        v
agenid:<ULID>                    the agent
        |  ManifestProof (signed by the operator key)
        v
        self-declared identity
```

### H-2 New signed object: `AuthorizationGrant`

Closes GAP-D1, GAP-D2 and GAP-E1.

```
AuthorizationGrantPayload {
  $schema:      ".../v1.2/authorization-grant.json"
  grant_id:     "grant:<ULID>"
  principal:    PrincipalId          // who authorizes
  subject:      AgentId              // which agent
  scopes:       [Scope]              // what it may do — non-empty, explicit
  constraints:  Constraint[]?        // optional bounds (counterparty, ceiling, …)
  not_before:   Rfc3339Utc           // for what period
  expires_at:   Rfc3339Utc
  key_id:       KeyId                // the principal key that signs this
}

AuthorizationGrant = payload + signature        // Ed25519 over JCS canonical bytes,
                                                // signature member absent — the same
                                                // single construction as every other object
```

Design rules, each with its reason:

- **`scopes` is non-empty and explicit.** An unconstrained grant is just a second
  principal. Same reasoning that makes `permitted_levels` mandatory in the E-2
  proposal.
- **No wildcards in v1.2.** `payment:*` is how least privilege dies quietly. A
  grant lists what it grants. Wildcard semantics can be added later with a vector
  suite; they cannot be removed later.
- **Scope syntax is `resource:action`**, flat, matched by exact string equality.
  Exact equality has no ambiguous cases and no path-traversal analogue. Hierarchy
  is a v1.3 question, deliberately deferred.
- **The grant is verified offline.** A verifier fetches the grant and the
  principal's key document and checks the math itself. The registry is a
  distribution mechanism, never an authority. This is the whole point: an
  authorization API that answers `{"allowed": true}` from a database the caller
  must trust is precisely what this product argues against.

### H-3 New signed object: `Revocation`

Closes GAP-A1 and GAP-A2, and makes GAP-D1's grants withdrawable.

```
RevocationPayload {
  $schema:     ".../v1.2/revocation.json"
  revocation_id: "revocation:<ULID>"
  revokes:     AgentId | GrantId | KeyId | AssertionId
  revokes_type: "agent" | "grant" | "key" | "assertion"
  reason:      RevocationReason          // enum, not free text
  revoked_at:  Rfc3339Utc
  key_id:      KeyId                     // the key entitled to revoke this target
}
```

**Revocation must be signed, and by the key that controls the target** — principal
for a grant, operator for its own agent, authority for an assertion. A registry
that can revoke unilaterally is the same trust failure as one that can grant
unilaterally, pointed the other way. `verifyRevocation()` enforces the
target/controller correspondence.

Revocation is evaluated **against the instant the signature was made**, reusing the
existing `keyActiveAt()` semantics: a grant used before revocation stays
historically valid, one used after does not. This is why the existing key model is
the right foundation rather than something to replace.

### H-4 `POST /v1/authorization/check` — a decision plus its evidence

Never a bare boolean. The response carries the decision **and every object that
produced it**, so the caller can re-derive the answer offline and disbelieve the
registry:

```jsonc
{
  "decision": "PERMITTED" | "NOT_PERMITTED" | "UNKNOWN",
  "reason_code": "scope_not_granted",          // stable code, one cause each
  "evidence": {
    "agent": { … }, "grant": { … },            // the signed objects themselves
    "principal_key": { … }, "operator_key": { … }
  },
  "verify_instructions": "…"                   // how to re-derive this offline
}
```

`UNKNOWN` is a first-class outcome, distinct from `NOT_PERMITTED`. "The registry is
unreachable" and "this agent is not authorized" are different facts, and collapsing
them either fails open or slanders an agent. Same reasoning as the existing `503
registry_unavailable`.

### H-5 Replay protection for authorized actions

Closes GAP-C2 for the surface that needs it. A grant authorizes a *capability*; a
specific *action* needs a per-action object with a nonce, a short window, and
server-side single-use enforcement. Design deferred to the implementation pass, but
it must land **with** the grant model, not after it — retrofitting replay protection
onto a deployed authorization system is how this goes wrong.

---

## I. Recommended order

Ordered by dependency and by blast radius, not by visibility.

| # | Work | Closes | Why this position |
|---|---|---|---|
| 1 | **Rate limiting + batch caps** | G1 | Exploitable today by anyone with an HTTP client; independent of everything else; nothing should be advertised before it |
| 2 | **`principal` key role** | B1, G3 | The missing node. Everything in §D and §E-1 hangs off it |
| 3 | **`AuthorizationGrant`** | D1, D2, E1 | The product gap. Makes §6's demo honest for the first time |
| 4 | **`Revocation`** | A1, A2 | Must ship with #3 — a grant you cannot withdraw is worse than no grant |
| 5 | **Replay protection** | C2 | Must ship with #3 for the same reason |
| 6 | **`POST /v1/authorization/check` + `GET /v1/audit`** | F1 | The external-facing surface for #3 and #4 |
| 7 | **Security demo** | brief §6 | Only honest once 3–6 exist |
| 8 | **Request-level authentication** | C1, C3 | Larger design; not blocking 1–7 |
| 9 | **Root key ceremony → L2 issuance** | B2, G2 | Gated on hardening + Mike's approval, not on engineering |
| 10 | **Authority key delegation (E-2)** | E2 | Independent; cheapest now, before issuance history exists |

---

## J. Explicitly out of scope

Recorded so a future session does not add them on momentum:

- **Blockchain, tokens, cryptocurrency.** Solve no problem in this system. The
  registry is not the trust anchor; signatures are.
- **A proprietary transport or envelope format.** HTTP, JSON, RFC 8785 and RFC 8032
  are sufficient and already load-bearing.
- **Microservices.** Five packages behind one deployment is correct at this size.
- **OAuth/OIDC in the protocol core.** See §C — it would reintroduce the trusted
  third party the product exists to remove. It is appropriate at the operator
  console edge, and nowhere else.
- **Arbitrary-depth delegation chains.** Fixed depth of one, per the E-2 proposal.
  Path building is where X.509 generates most of its divergence and most of its
  CVEs.

---

*AgenID Protocol — agenid.com. All rights reserved by AIVH LLC.*
