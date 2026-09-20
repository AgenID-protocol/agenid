# QR Identity & Verification — Architecture Spike

**Status:** Architecture discovery. Nothing in this document is built, and nothing in it is
normative. No QR code is generated anywhere in this repository today (`grep -ril "qrcode|qr code|qr-code"`
across `packages/`, `docs/` and `scripts/` returns only Next.js build-cache noise from a dependency).

**Method:** every architectural claim below was checked against the working tree at `2b8b035`
plus the concurrent v1.2-draft authorization work in flight, and every claim about the deployed
system was checked against `www.agenid.com` with `curl` rather than inferred from source.

**Scope discipline:** this spike changed no code. It did not touch the authorization
implementation, the Grok Bot pilot, `/how-it-works`, or any production route.

---

## 1. Executive conclusion

**Yes — AgenID should support QR, and it should be the thinnest possible thing: a rendering of a
URL that already exists.**

The working hypothesis in the brief is correct, with one correction to its shape. The chain is not

```
AgenID → signed identity → verification context → QR → scan → verification experience
```

because "verification context" is not an object in this architecture. The actual chain is:

```
AgenID  (agenid:<ULID>)                         ← the identity
   ↓
ResolutionEnvelope                              ← the authoritative, re-verifiable state
   ↓
/a/<agenid>                                     ← the canonical dual-representation resource
   ↓
QR image of that URL                            ← a pointer, carrying no claim of its own
   ↓
scan → the same Verification Card a link would open
```

**The QR is not the AgenID, and it is not a credential.** It carries a pointer. It proves nothing
by itself, and it must be designed so that nobody believes otherwise — because a QR image is
trivially copied, and any design in which possession of the image implies anything is broken from
the first screenshot.

The single recommendation, expanded in §11:

> **Encode the canonical Verification Card URL `https://www.agenid.com/a/<agenid>` and nothing else.
> Resolve online at scan time. Render through `lib/trust-presentation.ts`. Add no protocol object,
> no API, no database column, and no version bump. QR belongs entirely to the presentation layer.**

This is deliberately the least interesting of the five options evaluated, and that is the finding.
Every more sophisticated option — embedding a signed presentation, carrying an offline-verifiable
credential, minting a per-scan reference — either duplicates an object the protocol already has or
creates a second identity surface with weaker revocation semantics than the first.

---

## 2. Current AgenID architecture relevant to QR

Read from the tree, not summarised from memory.

### 2.1 The objects that exist

| Object | Where | What it is | Signed by |
|---|---|---|---|
| `Manifest` | `packages/core/src/schemas.ts` §6.1 | Operator self-declaration. Identity, ownership, purpose, three disclosure booleans. **Never signed directly.** | — |
| `ManifestProof` | same, §6.2 | Signs `sha256(RFC8785(manifest))` plus `agent_id`, `key_id`, `created_at`, `expires_at`. | operator key |
| `VerificationAssertion` | same, §6.3 | Authority statement binding a `level` (L1–L4) and a `claim` to a subject and a `manifest_digest`. | authority key |
| `KeyDocument` | same, §9.1 | `key_id`, Ed25519 public key, `role`, `controller`, `status`, retirement/revocation timestamps. | — (resolved, not signed) |
| `AuthoritiesDocument` | same, §9.5 | The pinned root. **Not published — `/.well-known/agenid/authorities.json` returns 404.** | — |
| `ResolutionEnvelope` | `packages/api/src/envelope.ts` | The composite a third party re-verifies without trusting the registry. | — (assembled) |

### 2.2 The identifiers

`packages/core/src/identifier.ts` is the complete namespace list. Relevant to QR:

- `agenid:<ULID>` — the agent. 33 characters. ULID is Crockford Base32, first char `0-7`.
- `agenid:key:<ULID>` — **logical** key form. The **wire** form is the bare ULID.
  `parseKeyReference()` is the only sanctioned translation and rejects `#` in raw and `%23` spellings.
- `assertion:<ULID>`, `agenid:authority:<name>`, `dep_<opaque>`.
- v1.2-DRAFT only: `agenid:principal:<ULID>`, `grant:<ULID>`, `revocation:<ULID>`.

**There is no "deployment" object in the deployed system.** `DeploymentId` and `subject_type:
"deployment"` exist in the schema, `L4_DEPLOYMENT_VERIFIED` is the only level that may carry them,
and no deployment has ever been registered because no assertion has ever been issued.

### 2.3 The public surfaces a QR could point at

Verified live on 2026-09-20:

| Surface | Behaviour |
|---|---|
| `/a/<agenid>` (browser) | `200` HTML Verification Card |
| `/a/<agenid>` (`Accept: application/json`) | `200` + full `ResolutionEnvelope` |
| `/a/<unregistered>` (browser) | **`200`**, neutral "Not registered — an unregistered identifier is not evidence of anything" |
| `/a/<unregistered>` (`Accept: application/json`) | `404` |
| `/api/resolve/<agenid>` | `200` + envelope |
| `/badge/<agenid>/shield.svg` | `200`, always — a non-200 renders as a broken image, not a badge |
| `/badge.js` | `200`, embeddable live badge |
| `/v1/keys/<key-ULID>` and `/v1/keys?key_id=` | `200`, byte-identical bodies from one builder |

`/a/<agenid>` is therefore already exactly what a QR target should be: **one resource, two
representations, content-negotiated, with the human representation refusing to render absence as
failure.** No new route is required.

### 2.4 Trust presentation is already centralised, and already fails closed

`packages/web/lib/trust-presentation.ts` is the one place that maps a level to a colour and a label.
Two properties make it the right and only home for a scan screen:

- `presentTrustLevel()` is an **exact-match lookup in a frozen `Map`**. An unrecognized, absent, or
  attacker-supplied level resolves to `UNKNOWN_TRUST` (neutral slate), never to VERIFIED. An earlier
  `level !== "L1_REGISTERED" → emerald` default is recorded in that file's own header as the defect
  this module exists to prevent.
- `presentEnvelopeTrust()` encodes the precedence every surface must apply, in order: not an
  envelope → neutral; unrecognized lifecycle status → neutral; `SUSPENDED`/`REVOKED` → alert;
  failed `proof_check` → alert; otherwise the enumerated level.

**A QR scan screen that computes its own trust state would be the sixth independent copy of a
mapping this project has already consolidated once (queue item #30). It must not exist.**

### 2.5 What the envelope does *not* contain

This is the most consequential finding for §8. The envelope's members are exactly:

```
agenid_envelope_version, agent_id, status, registered_at, manifest, manifest_digest,
proof, proof_check, operator_key, verification, assertions, verify_instructions
```

There is **no authorization member, no grant, no principal, and no capability list.** The v1.2-draft
`AuthorizationGrant` exists in `@agenid/core` and is exercised by the Grok pilot script, but nothing
distributes it: there is no `/v1/grants` route, the envelope does not carry it, and the registry
schema has no table for it.

Two further absences that bound what a QR can honestly say:

- **No revocation path.** `LedgerEvent` declares `agent.revoked` and `agent.status_changed`; only
  `agent.registered` and `key.published` are ever written. Every agent in production is `ACTIVE`.
  `docs/SECURITY-GAP-ANALYSIS.md` records this as GAP-A1, severity high.
- **No trust root.** No authority key exists, so no `VerificationAssertion` can be signed.
  **L1 is the ceiling on the reference deployment.** L2–L4 are illustrated on `/how-it-works` and
  issued nowhere.

---

## 3. Proposed conceptual model

```
                 ┌──────────────────────────────────────────────┐
                 │  SOURCE OF TRUTH                             │
                 │  ResolutionEnvelope, rebuilt on every read    │
                 │  from the agent + key rows                    │
                 └───────────────────┬──────────────────────────┘
                                     │ content negotiation
                 ┌───────────────────┴──────────────────────────┐
                 │  CANONICAL RESOURCE   /a/<agenid>            │
                 │  text/html  →  Verification Card              │
                 │  application/json  →  envelope                │
                 └───────────────────┬──────────────────────────┘
                                     │
      ┌──────────────┬───────────────┼───────────────┬──────────────┐
      │              │               │               │              │
  badge.js      shield.svg     hyperlink          QR image        NFC/deep link
  (embed)       (README)       (anywhere)       (print/screen)    (future, §10)
      │              │               │               │              │
      └──────────────┴───────────────┴───────────────┴──────────────┘
                     all render lib/trust-presentation.ts
                     none of them is a source of truth
```

The QR takes its place in a row that already exists. It is a **fourth renderer**, not a new primitive.

The one thing it adds that the others do not: it crosses the gap between a physical or
non-clickable surface and the resolver. That is a real gap — a printed sign, a phone screen showing
a voice-agent handoff, a PDF read on paper — and it is the whole of the QR's contribution.

---

## 4. Security analysis

### 4.1 What security value does the QR provide?

**None on its own. It is a transport, and it should be documented as one.**

The QR contributes exactly one security-relevant property: it makes it *cheap and unambiguous for a
human to reach the authoritative resolver*, which is the step an attacker most wants to prevent.
Everything a scanner learns comes from the fetch, not the image. The correct framing for every
public surface is:

> *Scanning this does not verify anything. It opens the record so you can.*

### 4.2 Copy attack — screenshot an authentic QR, put it on another site

**What happens:** the scan resolves the genuine agent, and shows the genuine operator name, domain
and purpose. The attacker has not forged anything; they have re-pointed at someone else's real record.

**What prevents harm:** nothing in the QR. The defence is entirely in what the card *says*. The
Verification Card leads with `identity.name`, `ownership.operator` and `ownership.operator_domain`,
which is the information that makes the mismatch visible — a card reading "AI Venture Holdings LLC /
aiventureholdings.com" scanned from a page claiming to be a bank is self-evidently wrong.

**Residual risk: high, and structural.** A QR cannot bind itself to the surface it is printed on.
Any design that claims otherwise is wrong. This is the single most important sentence in this document.

### 4.3 Clone attack — copy a legitimate agent's QR and claim it is your own agent

Identical to §4.2 and with the same answer: the scan shows the *real* operator, not the claimant.
The attack only works on a person who scans and does not read. Mitigation is UX — put operator
identity above the fold, in the largest type on the card — not cryptography.

### 4.4 Stale verification — QR printed while valid, agent later revoked

**With online resolution (the recommendation): correct behaviour is automatic.** The QR encodes a
URL; the URL is resolved at scan time; a revoked agent renders through `revokedTrust()` as an alert
state. The image does not need to change, because the image never carried the claim.

**With any offline or embedded-credential design: this is unfixable.** There is no revocation
distribution mechanism in this protocol today (§2.5, GAP-A1), and even if one existed, an offline
verifier by definition cannot consult it. This consideration alone eliminates Option D.

### 4.5 Deployment change — same agent moves to a different deployment

The QR identifies **the agent, and only the agent.** `agenid:<ULID>` is a stable identity; a
deployment is a separate subject type that no deployed code ever registers. A QR that claimed to
identify a deployment would be naming an object that does not exist in the running system.

If deployment identity ever ships, the correct answer is a *second* QR whose target is a deployment
resolver — not an overloaded one.

### 4.6 Authorization change — agent stays authentic, permissions change

**The QR communicates identity only.** It has no authorization semantics, because the resolver it
points at has none (§2.5). Even after v1.2, the right answer is that a scan surfaces *the existence
and scope of a grant as data*, and never a `PERMITTED` verdict — see §8.

### 4.7 Phishing — a malicious QR pointing at a fake verification site

This is the most serious QR-specific threat, and it is not solved by anything AgenID can put in a
QR code. A user cannot tell `agenid.com` from `agenid.co` in a browser chrome they glanced at.

Mitigations available, in order of value:

1. **One host, forever.** Erratum E2 already unified the namespace on `agenid.com`, and three tests
   forbid every known look-alike hostname from appearing anywhere in the repository (the literals live in
   `public-surface.test.ts`; they are deliberately not repeated here). Teach one hostname, never a second.
   A `qr.agenid.com` or a shortener would actively destroy this property.
2. **Never shorten.** A shortened or redirecting QR target removes the user's only defence.
   A 33×33-module symbol (§4.10) is already small enough that shortening buys nothing.
3. **The card is the recognizable artifact, not the domain.** Consistent layout, the operator's own
   domain shown prominently, and the "verify this yourself" block that already ships.
4. **Publish the shape of a real AgenID QR** so that operators printing them, and security teams
   reviewing them, know the target must begin `https://www.agenid.com/a/agenid:`.

**Residual risk: high, and shared with every QR system in existence.** State it plainly rather than
implying AgenID has solved it.

### 4.8 Offline scan — what can be verified with no network?

**Under the recommendation: nothing, and the screen must say so.** A scanner that cannot reach the
registry has learned only that a string was encoded.

What is *cryptographically provable* offline, if a signed presentation were embedded (Option D):
that some holder of a private key signed a manifest digest at a claimed time. What is **not**
provable offline, and cannot be made provable:

- that the key is still active (`KeyDocument.status` lives in the registry and on the operator's domain)
- that the agent has not been revoked (no revocation distribution exists)
- that any assertion is currently valid (`verifyVerificationAssertion` needs the authority key)
- that the presenter is the subject rather than a replayer of a copied blob

Offline verification of an AgenID is therefore **"a signature was once made," not "this agent is
currently what it claims."** The gap between those two sentences is the entire product.

### 4.9 Replay / possession

Possession of a QR proves possession of a QR. There is no challenge, no nonce, no holder binding
and no proof-of-possession anywhere in v1.1.1 — `docs/SECURITY-GAP-ANALYSIS.md` records this as
GAP-C2 (no replay protection) and GAP-C3 (no short-lived credentials). **A QR must never be placed
in a position where possessing it authorizes anything.**

### 4.10 Size — measured, not estimated

Measured with the `qrcode` encoder in a scratch sandbox (not added to this repository):

| Payload | Bytes | EC=M | EC=Q |
|---|---|---|---|
| `https://www.agenid.com/a/agenid:01M30753M8KR2AMB86WKR4DDFB` | 58 | v4 — 33×33 | v5 — 37×37 |
| `agenid:01M30753M8KR2AMB86WKR4DDFB` | 33 | v2 — 25×25 | v3 — 29×29 |
| Compact binary signed presentation → base64url | 216 | v8 — 49×49 | v10 — 57×57 |
| Minimal JSON signed presentation | 353 | v13 — 69×69 | v16 — 81×81 |
| Full `ResolutionEnvelope` (Grok pilot, 3,028 B) | 3028 | **does not fit** | **does not fit** |

The URL form is 33×33 at level M — scannable from a business card, a conference badge, or a phone
screen at a metre. The signed-presentation form is 2–4× the module count for a payload that cannot
answer any of the questions in §4.8. **The envelope cannot be encoded at all**, which settles the
"put the whole record in the QR" idea by arithmetic.

---

## 5. Representation options, evaluated

Mapped onto the routes that actually exist. The brief's Option A (`/verify/<reference>`) and Option B
(`/agents/<reference>`) are one option in this codebase, because `/a/<agenid>` is already the
content-negotiated resource both describe.

### Option A/B — canonical card URL: `https://www.agenid.com/a/agenid:<ULID>`

| Dimension | Assessment |
|---|---|
| Security | Contributes none; removes none. Every check happens at the resolver. |
| Portability | A URL. Works in every camera app, every OS, with no AgenID software. |
| Offline | Fails visibly and correctly — no network, no claim. |
| Revocation | Correct by construction: state is read at scan time. |
| Replay/copy | Copyable; copying re-points at the genuine record (§4.2). |
| Privacy | Reveals the agent id, which is public by design. Registry sees a resolve request. |
| Size | 33×33 at EC=M. |
| Human comprehension | Highest: the target is human-readable and names one known host. |
| Machine interop | `Accept: application/json` on the same URL returns the envelope. No second endpoint. |
| Infra dependence | Total. If `agenid.com` is down, `UNAVAILABLE_TRUST` renders neutral — unknown, not disproven. |
| Deployment identity | Not expressed. Correct: no deployment exists. |
| Long-term compatibility | The URL is stable; the envelope may grow. No protocol surface added. |

### Option C — raw identifier: `agenid:01M3...`

Smaller (25×25) and host-independent, but a generic camera app does nothing with it — no OS handler
is registered for the `agenid:` scheme, so the user sees an opaque string. It is the right payload
for an AgenID-aware scanner and the wrong payload for a stranger with an iPhone, which is the entire
use case. **Rejected as the primary encoding; retained as the value a machine consumer extracts from
the URL's last path segment.**

### Option D — embedded signed presentation

2–4× the symbol size, and it cannot answer key status, revocation, assertion validity or holder
binding (§4.8). It would also create a **second, weaker identity object** alongside `ManifestProof`,
with its own canonicalization and its own failure modes, contradicting the standing rule that there
is one implementation per security-critical business rule. **Rejected. This is the option most
likely to be proposed again later, so the reasoning is recorded here rather than left implicit.**

### Option E — hybrid (URL now, signed payload later)

Superficially attractive, and it is what the recommendation actually is — but only if "hybrid" means
*the URL is the payload and the signed material is fetched through it*, which is Option A/B. A
hybrid that stuffs both into the symbol inherits Option D's size and every one of its unanswerable
questions. **Adopted in the first sense, rejected in the second.**

---

## 6. Use cases

Honest assessment. "Does QR materially improve this?" is answered *no* wherever a hyperlink is
already available, because in those places the QR is decoration.

| # | Context | Who scans | Why | What AgenID proves | What it does NOT prove | QR earns its place? |
|---|---|---|---|---|---|---|
| 1 | AI agent website | Visitor | "Is this operator who it says?" | A registered identity exists, signed by the operator's key, naming an operator and domain | That this website is that agent, or that anything was checked by a third party | **No** — `badge.js` links directly; a QR on a clickable page is theatre |
| 2 | AI chatbot widget | End user mid-conversation | "Am I talking to a disclosed AI?" | The operator's signed `disclosure` booleans | That the running bot honours them | **No** on desktop web; **Yes** where the chat is on a screen the user cannot click (kiosk, TV, embedded display) |
| 3 | Voice AI agent | Caller | "Who is calling me?" | Operator identity, declared purpose, declared escalation path | That the voice on the line is this agent | **Partially** — voice has no visual channel. The QR helps only on an accompanying screen or printed collateral |
| 4 | AI-generated document | Reader | "What produced this?" | The claimed producing agent's identity | That this document came from that agent — no content binding exists | **Yes**, on print. State the limit loudly |
| 5 | AI-generated report | Recipient / auditor | Provenance trail | Same as 4 | Same as 4 | **Yes**, same caveat |
| 6 | Email from an AI agent | Recipient | "Is this legitimate?" | Operator identity | Sender authenticity — that is DKIM/DMARC's job, not AgenID's | **No** — email is clickable; a QR here trains users to scan images in email, which is an anti-pattern |
| 7 | SMS / voice → human handoff | Consumer | Continuity of identity | The same `agenid:<ULID>` across both legs | That the human is authorized | **Yes** — a link in SMS is clickable, but a QR shown on a screen during a handoff is the natural affordance |
| 8 | Physical business location | Walk-in customer | "Is this kiosk's assistant real?" | Operator identity behind a physical device | Anything about the device itself | **Yes** — the strongest case. No other affordance exists |
| 9 | Conference / demo badge | Attendee | Quick look-up | Identity + current level | Product quality or authorization | **Yes** |
| 10 | Agent marketplace listing | Buyer | Due diligence | Identity, operator, digest, key discovery paths | Fitness, safety, or that the listed agent is the delivered one | **No** — a listing is clickable |
| 11 | Agent → human handoff | Consumer | Who am I now dealing with | Agent identity only | The human's identity or authority | **Yes**, on screen |
| 12 | Security / audit investigation | Investigator | Pivot from artifact to record | Identity, digest, ledger timestamps, key documents | What the agent actually did | **Yes**, for artifacts found on paper or in images |
| 13 | AIVH Grok Bot | AIVH, reviewers | Dogfood — §9 | See §9 | See §9 | **Yes**, as the reference example |
| 14 | API / service documentation | Integrator | Trust the endpoint's operator | Operator identity | Endpoint security or uptime | **No** — docs are clickable |
| 15 | Printed business material | Prospect | Reach the record | Identity | Anything about the printed claims | **Yes** |

**Net: 9 of 15 are real; 6 are decoration.** The pattern is exact and worth stating as a rule:

> **A QR earns its place only where the surface is not clickable.** On any surface where a hyperlink
> works, a QR adds a scan step and removes the URL preview the user would otherwise get.

---

## 7. Human scan experience

What the architecture can legitimately support today, and only that.

```
SCAN
  ↓
https://www.agenid.com/a/agenid:01M30753M8KR2AMB86WKR4DDFB
  ↓
┌───────────────────────────────────────────────────────────┐
│ AGENT IDENTITY RECORD                                     │
│                                                           │
│ AIVH Grok Bot                          [ REGISTERED ·     │
│ agenid:01M30753M8KR2AMB86WKR4DDFB        not yet verified]│  ← amber, from
│                                                           │     presentEnvelopeTrust()
│ DECLARED BY THE OPERATOR                                  │
│   Operator   AI Venture Holdings LLC                      │  ← largest type after the name:
│   Domain     aiventureholdings.com                        │     this is the anti-clone defence
│   Purpose    Software engineering and operations …        │
│   AI disclosed / Human escalation                         │
│                                                           │
│ VERIFICATION                                              │
│   Ed25519 proof          ✓ signature valid                │
│   L2 domain              – not verified      (neutral)    │
│   L3 organization        – not verified      (neutral)    │
│   Assertions             0 valid of 0                     │
│                                                           │
│ Nobody checked these claims. Scanning did not verify       │
│ anything — it opened the record so you can.               │
│ [ Verify this yourself → ]                                │
└───────────────────────────────────────────────────────────┘
```

### The five concepts the card must keep apart

A QR that lets these blur is worse than no QR. The existing card already separates the first four;
the scan screen inherits that and must not flatten it.

| Concept | What it means | Where it comes from | Rendered as |
|---|---|---|---|
| **Operator claim** | The operator said so | `manifest.*` — every field under "Declared by the operator" | Plain text under a heading that says *declared* |
| **Identity** | A signed statement binds this manifest to this key | `proof_check.ok` | ✓ / alert. Never emerald |
| **Verification** | A third party checked something | `assertions[].check.ok`, `verification.level` | Emerald only for L2–L4 |
| **Current status** | The registry's lifecycle state right now | `status` | Alert for `SUSPENDED`/`REVOKED`; neutral for anything unrecognized |
| **Authorization** | Someone permitted this agent to act | **Nothing. No field exists.** | **Absent — see §8** |

### Rules the scan screen inherits and must not break

- **Not-verified renders neutral, never red.** Absence of verification is not a negative finding.
- **The absent-record case is a 200, not a 404 page.** A scanner reaching an unregistered identifier
  sees a neutral card, because a 404 would frame non-registration as a failure.
- **Registry unreachable is `UNAVAILABLE_TRUST`:** unknown, not disproven.
- **The screen states its own ceiling.** With no trust root, `L1` is the maximum; the scan screen says so.

---

## 8. Machine experience, and the authorization boundary

### 8.1 Machine consumers

A machine reads the same URL and asks for JSON:

```
GET https://www.agenid.com/a/agenid:<ULID>
Accept: application/json           →  200 ResolutionEnvelope
                                      404 for an unregistered identifier
```

It then performs the procedure in `verify_instructions` — recompute the digest, fetch the operator
key from **both** discovery paths and require agreement, verify Ed25519 over `RFC8785(proof minus
signature)`, and check each assertion against the authority key. This works today and requires no
new API. The identifier can be recovered from the URL's last path segment for any consumer that
wants `agenid:<ULID>` rather than the URL.

**One QR, both consumers, one resource.** That is the property content negotiation already gives us,
and it is the reason not to mint a QR-specific endpoint.

### 8.2 The authorization boundary

**A QR must never imply that an agent is authorized to do anything.** Identity and authorization are
orthogonal axes, and expressing permission as a verification level ("L3 agents may book
appointments") is the exact collapse `packages/core/src/authorization.ts` was written to avoid.

**What the architecture supports today:** nothing. The envelope has no authorization member, no
grant is distributed anywhere, and `docs/SECURITY-GAP-ANALYSIS.md` records GAP-D1 ("no authorization
model") at critical severity. Any authorization line on a scan screen today would be invented.

**What v1.2-draft would make possible, if it is ratified *and* a distribution path is built:**
`evaluateAuthorization()` already returns a three-valued `AuthorizationDecision` —
`PERMITTED | NOT_PERMITTED | UNKNOWN` — with `UNKNOWN` as a first-class outcome that is explicitly
not `NOT_PERMITTED`. That is the right vocabulary for a scan screen, with one hard constraint:

> **The scan screen may display a grant. It may not display a decision.**

The governing rule in that module is that *a grant is evaluated by the relying party, offline,
against the principal's own public key — never by asking AgenID whether an agent is allowed to do
something.* A registry endpoint answering `{"allowed": true}` from a database the caller must trust
is the architecture this product exists to argue against. A QR scan screen rendering AgenID's own
`PERMITTED` verdict would be that same mistake with a camera in front of it.

So the eventual honest shape is:

```
Identity        VERIFIED          ← proof_check.ok
Deployment      —                 ← no deployment object exists
Authorization   GRANT PRESENT     ← a signed AuthorizationGrant was found, v1.2-draft
Scope           appointment:create, appointment:cancel
Constraints     requires_human_confirmation
Decision        —  evaluate this yourself against the principal's key
```

`Decision` stays blank on AgenID's own surface, permanently, by design.

---

## 9. AIVH Grok Bot — the dogfood example

Read from `scripts/pilot-grok-bot.mjs` and `packages/web/data/pilot/grok-bot.json`; live state
confirmed by `curl` against production. **Nothing about it was modified.**

- **Agent:** `agenid:01M30753M8KR2AMB86WKR4DDFB`, registered `2026-09-20T20:12:15.537Z`
- **Live state:** `status ACTIVE`, `proof_check.ok true`, `verification.level L1_REGISTERED`,
  `0` assertions of `0`
- **Operator (declared):** AI Venture Holdings LLC / `aiventureholdings.com`
- **Operator key:** `agenid:key:01M30753MA1APW0S96E9QJZHCM`, resolves `200` at
  `/v1/keys/01M30753MA1APW0S96E9QJZHCM`
- **Disclosure (declared, explicitly, never defaulted):** `is_ai: true`,
  `discloses_to_user: false`, `human_escalation: true`
- **v1.2-draft grant, minted locally and distributed nowhere:** principal
  `agenid:principal:01M30753M8DX15F4QT6XYK5VXX`, scopes `host:execute`, `repo:read`,
  `network:egress`, constraint `requires_human_confirmation`

**What a person scanning this agent's QR could legitimately learn today:**

1. An identity with this ULID is registered and `ACTIVE`.
2. Its operator-signed proof verifies against a key resolvable from the registry.
3. AIVH declares itself the operator, names `aiventureholdings.com`, and declares the purpose,
   the single `api` channel, and the three disclosure booleans.
4. **No third party has checked any of it.** Zero assertions; L1 is the ceiling.

**What it must not claim:** any relationship with or endorsement by xAI. The manifest describes an
AIVH-operated assistant on an operator-controlled host reached through a vendor-brokered gateway.
Nothing more, and nothing about the vendor.

### 9.1 A defect this spike found while verifying, reported not fixed

The agent's own envelope advertises `well_known_url:
https://aiventureholdings.com/.well-known/agenid/keys.json`. That URL returns **HTTP 200 with
`content-type: text/html`** — the site's own HTML page, not a `KeysDocument`. It is a soft-404.

Consequences, in order of severity:

1. **Two-path key discovery cannot be completed for the flagship pilot agent.** The registry half
   resolves correctly; the operator half does not exist. A verifier is left with one source, which
   is exactly the residual risk README limitation 3 and GAP-F2 already name — now instantiated on
   the agent the project is using to demonstrate itself.
2. **A verifier that checks only the HTTP status code sees `200` and may record agreement**, because
   a soft-404 is indistinguishable from success without parsing. Any future two-path checker must
   parse against the strict `KeysDocument` schema and treat a parse failure as *absent*, never as
   *agreeing*.

This bears directly on QR: the scan screen's strongest honest claim is "you can check this yourself
against the operator's own domain." On this agent, today, that check dead-ends. **Recommend fixing
before any QR surface points at this agent publicly.** Left for the pilot's owning thread.

---

## 10. Threat model

Threat → existing AgenID protection → remaining risk → future mitigation.

| # | Threat | Existing protection | Remaining risk | Future mitigation |
|---|---|---|---|---|
| Q-1 | **Copied QR** on an unrelated surface | None in the image. The card names the real operator and domain | **High.** A QR cannot bind to its surface | UX only: operator identity above the fold. Never claim this is solved |
| Q-2 | **Forged QR** encoding an attacker-controlled AgenID | Registration requires a valid Ed25519 proof; a forged manifest fails `manifest_digest_mismatch` | **Medium.** An attacker can register *their own* honest L1 identity and print it | L2+ issuance, once a trust root exists. L1 must always read amber |
| Q-3 | **Modified URL** — QR looks right, target altered | None. The image is not signed | **High** | Publish the required target shape (`https://www.agenid.com/a/agenid:`) so it can be eyeballed. Never shorten |
| Q-4 | **Phishing domain** (`agenid.co`, `agenid-verify.com`) | Erratum E2's single-namespace rule; three tests forbid look-alike hosts in the repo | **High**, industry-wide | One host forever. No shortener, no `qr.` subdomain, no redirect |
| Q-5 | **Stale QR** printed before a change | Online resolution: state is read at scan time | **Low** under the recommendation; **unfixable** under Option D | Keep resolution online. This is the argument |
| Q-6 | **Revoked agent** | `presentEnvelopeTrust()` renders `REVOKED`/`SUSPENDED` as alert | **High in practice** — GAP-A1: nothing ever writes those statuses | Ship the revocation path. Until then a QR cannot show revocation, because nothing can |
| Q-7 | **Revoked authorization** | v1.2-draft `Revocation` exists in `@agenid/core`; nothing distributes it | **Total.** No authorization is shown, so nothing is falsely shown | Distribute grants and revocations before any authorization reaches a scan screen |
| Q-8 | **Deployment substitution** | None — no deployment object is registered | N/A today | Out of scope until deployment identity ships |
| Q-9 | **Agent substitution** — swap the QR for a different real agent's | The card names the substituted agent | **Medium**, same shape as Q-1 | UX |
| Q-10 | **Principal substitution** | v1.2-draft: `KeyDocument.role` is `principal` and neither `verifyManifestProof` nor `verifyVerificationAssertion` accepts one, asserted by test | Low *within* the draft; the draft is not deployed | Ratify v1.2 before relying on it |
| Q-11 | **Screenshot reuse** | None. No holder binding, no nonce, no proof of possession (GAP-C2/C3) | **High if QR is ever used as a credential** | Never use it as one. Document that possession proves nothing |
| Q-12 | **Offline verification limits** | Online-only by design | Accepted and disclosed | State on the scan screen that a network fetch happened and what it did |
| Q-13 | **Compromised verification website** | T-9 already holds: a fabricated record still fails `proof_check` in a verifier's own re-verification | **Medium.** A compromised site could render an honest record dishonestly | Two-path key discovery; the "verify this yourself" block; §9.1's soft-404 must be fixed for that path to bite |

---

## 11. Recommended architecture

One recommendation, not a ranking.

| Question | Answer |
|---|---|
| **1. Should AgenID support QR?** | Yes, scoped to non-clickable surfaces (§6) |
| **2. What should it represent?** | The agent's canonical Verification Card resource — nothing else |
| **3. URL, identifier, signed presentation, or other?** | **URL.** `https://www.agenid.com/a/agenid:<ULID>`, unshortened, no query parameters, no tracking |
| **4. What is the source of truth?** | The `ResolutionEnvelope`, rebuilt per read. The QR holds no state |
| **5. Online, offline, or hybrid?** | **Online.** Offline verification cannot answer key status, revocation or assertion validity (§4.8), so offline capability would be a claim the protocol cannot honour |
| **6. Revocation / staleness?** | Solved by construction: the image is a pointer, the state is fetched. Note that revocation *display* is blocked on GAP-A1, not on QR |
| **7. Agent, deployment, or verification context?** | **Agent.** Deployment is not a registered object; "verification context" is not an object at all |
| **8. What should the scan show?** | §7 — the existing Verification Card, rendered through `lib/trust-presentation.ts`, with a scan-specific line stating that scanning verified nothing |
| **9. What must it NOT claim?** | That the QR was verified; that its presence on a surface means anything; that the agent is authorized; any level not present in the envelope; any partnership |
| **10. Minimum future implementation** | A pure render function producing an SVG from an `agenid:<ULID>`; a `/badge/<agenid>/qr.svg` route in the shape of the existing shield route; a "show QR" affordance on the card and on `/issue`. **No new object, no new table, no new API, no new level, no new identifier.** |
| **11. v1.2, later, or presentation layer?** | **Presentation layer, entirely.** Independent of the root-key ceremony and of v1.2 |

### Where it lives

QR is **another renderer of existing trust data** (§2.4 / §7), not a new presentation primitive and
not a separate affordance. Concretely:

- A pure `qrMatrix(text) → boolean[][]` or a vetted encoder, with **zero** trust-state logic.
- An SVG route modelled on `/badge/<agenid>/shield.svg`, which already returns `200` unconditionally
  and already reads its colours from `trust-presentation`.
- **One rule, test-enforceable in the shape this repo already uses:** the QR module may not import
  `verifyManifestProof`, may not name a level string, may not write a hex colour, and may not
  produce any output whose content depends on verification state. A QR is monochrome and
  state-independent; if a future author makes it green when verified, the image starts carrying a
  claim it cannot support.

---

## 12. Explicit non-goals

- Not a credential, not a token, not a capability, not proof of possession.
- Not offline-verifiable.
- Not a second identity model, a second capability model, or a second trust-state mapping.
- Not a carrier of any signed object.
- Not an authorization display (today), and never an authorization *decision* display.
- Not a deployment identifier.
- Not colour-coded by trust state.
- Not shortened, redirected, or served from a second hostname.
- Not a tracking surface — no per-scan identifiers, no campaign parameters, no analytics in the payload.
- Not a replacement for `badge.js` or `shield.svg` on clickable surfaces.

---

## 13. Implementation prerequisites

None are blocking for the build; the first is blocking for pointing one at the pilot agent.

1. **Fix the `.well-known/agenid/keys.json` soft-404 on `aiventureholdings.com` (§9.1)** before a QR
   for the Grok pilot is shown publicly, and make any two-path checker parse the strict
   `KeysDocument` rather than trusting a status code.
2. Decide the `/issue` post-issuance panel placement (it already offers card link, JSON, HTML embed,
   README markdown and curl — QR would be a sixth artifact there).
3. Confirm the encoder choice. A dependency added to `packages/web` must clear the phantom-dependency
   constraint that keeps `zod` out of that package.
4. A scan-specific disclosure line, drafted with the same discipline as the `/how-it-works`
   `ISSUANCE_CEILING`: required by construction rather than remembered by an author.
5. Nothing here depends on the root-key ceremony, on v1.2, or on the OpenAPI/DNS-route cleanup.

---

## 14. Protocol and version implications

**None.** This is the finding that makes the recommendation cheap.

- No new object, no new field, no new identifier namespace, no new level.
- No erratum and no version bump — the specification governs identity, crypto, serialization,
  verification and schemas, and a QR touches none of them.
- No OpenAPI change beyond one optional SVG route, which would land with the #33 coverage work.
- Independent of the root-key ceremony (#1) and of the v1.2 delegation decision (#21).

The only future protocol coupling is one-directional and belongs to v1.2: *if* grants are ever
distributed through the envelope, the scan screen gains a grant display — but that is the envelope
growing a member, not QR acquiring semantics.

---

## 15. Open decisions for Mike

1. **Build it?** The recommendation is yes, scoped as §11.10 — roughly one route, one pure function,
   one affordance, one test file. No protocol risk.
2. **Where does it surface first?** Candidates, in order of value: the `/issue` post-issuance panel
   (operators need something to print), the Verification Card itself, then printed collateral.
3. **§9.1 — who fixes the `aiventureholdings.com` soft-404?** It is the pilot's owning thread, not
   this one. It is also a live gap in the flagship example, independent of QR.
4. **Should a QR ever be generated for an identifier that is not registered?** Recommendation: yes,
   and it resolves to the existing neutral "not registered" card — consistent with the shield badge
   returning `200` for unknown identifiers. Confirm that reading.
5. **Positioning.** A QR is the most marketing-legible artifact this product could ship, and it is
   the one that proves the least. If it appears in sales material, the "scanning did not verify
   anything" line has to travel with it. That is a positioning call, not a layout one — the same
   shape as queue item #37.

---

*AgenID — a project of AI Venture Holdings LLC. All rights reserved by AIVH LLC.*
