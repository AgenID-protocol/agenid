# Threat Model

**Built from the actual architecture, not from generic security prose.** Current as of 2026-09-15, commit `a95928b`. Read [trust-model.md](trust-model.md) first; this document assumes it.

## Assets

Only assets that actually exist, ordered by what their loss costs.

| Asset | Where it lives | Loss means |
|---|---|---|
| **Operator private keys** | The operator's machine or browser tab. **Never in AgenID's systems.** | The attacker *is* that operator. Undetectable by the protocol. |
| **Root authority private key** | Does not exist yet. Planned: Google Cloud KMS, HSM. | Every assertion, historical ones included, becomes suspect — v1.1.1 has no delegation object to bound it. |
| **The root key's distribution channel** | `agenid.com` DNS zone; `AgenID-protocol` GitHub org | Equivalent to root compromise, at zero cryptographic cost to the attacker. |
| **Integrity of public claims** | Every page, badge, card and API response | A surface asserting an unearned level is a protocol failure delivered through HTML. |
| **Registration records** | Supabase: `agents`, `keys`, `assertions` | Availability loss. **Not a trust loss** — distributed envelopes still verify offline. |
| **The event ledger** | Supabase `events` | Audit-trail loss. Holds pointers and hashes only, never evidence. |
| **Supabase service-role credential** | Vercel production environment | Full write access to the registry — see T-9. |

Deliberately **not** assets: user accounts (none exist), payment data (none), PII (the evidence field is a pointer by design, length-capped to discourage embedding content).

## Actors

| Actor | Capability | Goal |
|---|---|---|
| Impersonator | Can create agents, register identities, publish a site | Have their agent accepted as someone else's |
| Tamperer | Can modify an envelope in transit or at rest | Change what an agent claims without invalidating it |
| Malicious or compromised registry | Full control of `agenid.com` and its database | Issue, alter or suppress identities and levels |
| Network attacker | Can intercept traffic to the registry | Substitute a key or an envelope |
| Domain / org attacker | Controls DNS, TLS or the GitHub org | Publish a false root pin |
| Malicious operator | Legitimately holds a key | Make untrue claims about their agent |
| Contributor of fabricated code | Can land code in the repository | Have a surface assert an outcome nothing computed |
| Resource abuser | Can send HTTP requests | Exhaust registry capacity or relay through AgenID's domain |

## Attack surfaces

Public and unauthenticated: `POST /api/v1/agents`, `/api/retell/bind`, `/api/retell/declare`, `/api/retell/agents`, `/api/v1/verify`, `/api/verify-dns`, `/api/dns/verify`, `/api/dns/detect`, `/api/dns/auto-add`, `/api/resolve/{agenid}`, `/a/{agenid}`, both badges, `/api/v1/openapi.json`. Eight of these send `access-control-allow-origin: *` on their responses and are cross-origin callable from any browser — verified live, and listed in [api.md](api.md#cors). The DNS routes and `/api/retell/agents` are same-origin only.

Also in scope: the browser signer (`lib/client-crypto.ts`), the Supabase service-role credential in the Vercel environment, the CI pipeline and repository, the `agenid.com` DNS zone, and the eight partner integration briefs as documentation that could mislead.

## Threats

### T-1 · Manifest tampering after signing
**Vector** — modify the manifest in transit, at rest, or in a copied envelope. **Impact** — an agent appears to claim something its operator never signed. **Mitigation** — the proof binds a SHA-256 digest of the manifest; any modification yields `manifest_digest_mismatch`. Verified against production with a one-character tamper. **Residual risk** — none material.

### T-2 · Signature forgery without the key
**Vector** — forge an Ed25519 signature. **Impact** — total impersonation. **Mitigation** — Ed25519. **Residual risk** — standard cryptographic assumption.

### T-3 · Canonicalization divergence
**Vector** — exploit a disagreement between two implementations about what bytes were signed, so a payload verifies in one and not another. **Impact** — a silent protocol fork; signatures that are valid to one party and invalid to another. **Mitigation** — RFC 8785 with two independently written implementations held byte-identical by a cross-implementation test; §8 conformance vectors including adversarial canonicalization; Erratum E1's number-domain rule; an explicit negative test that a SHA-256 pre-hash does not reproduce a spec signature. **Residual risk** — a third-party implementation could still diverge; the independent conformance suite exists to catch that and is forbidden from depending on `@agenid/core`.

### T-4 · Key substitution by the registry
**Vector** — the registry serves a key it controls instead of the operator's. **Impact** — the registry can mint apparently-valid identities. **Mitigation** — two-path key discovery: fetch from the registry *and* the operator's `.well-known` and require agreement. **Residual risk — MEDIUM. Both paths are now deployed**, so a verifier can complete the full cross-check against `agenid.com`. The remaining risk is that the operator half is published by the operator, not by us: an agent whose `operator_domain` serves no `.well-known/agenid/keys.json` leaves a verifier with a single source, and this registry cannot make an operator publish one. A verifier that treats a missing operator copy as equivalent to an agreeing one has disabled the defense.

### T-5 · Registry lying about a level
**Vector** — return a `verification.level` unsupported by any valid assertion. **Impact** — an unverified agent appears verified. **Mitigation** — every assertion travels in the envelope with its own signature; the verifier recomputes the level. **Residual risk** — verifiers who trust `verification.level` without recomputing are unprotected. Mitigated only by documentation, which is why the verification procedure is written out in [api.md](api.md) and [trust-model.md](trust-model.md).

### T-6 · Stale assertion surviving a manifest change
**Vector** — edit the manifest after obtaining an assertion. **Impact** — an assertion about old claims appears to endorse new ones. **Mitigation** — assertions bind a `manifest_digest` and are re-checked at resolution against the *current* manifest; mismatch yields `assertion_not_applicable_to_current_manifest`. **Residual risk** — none material.

### T-7 · Replay of a registration
**Vector** — resubmit a captured registration. **Impact** — overwrite or hijack an existing record. **Mitigation** — `createAgent` is an atomic insert returning `409 agent_exists` on a unique violation; a *different* key document under an existing `key_id` is `409 key_conflict`. **Residual risk** — none material.

### T-8 · Role and controller confusion
**Vector** — register with an authority-role key, or a key controlling a different agent. **Impact** — privilege confusion between operator and authority. **Mitigation** — `role === "operator"` and `controller === agent_id` enforced server-side and in `@agenid/core`; strict schemas reject unknown members. **Residual risk** — none material.

### T-9 · Compromise of the Supabase service-role credential
**Vector** — a leaked or stolen production environment variable. **Impact** — arbitrary writes to `agents`, `keys`, `assertions` and `events`: fabricated registrations, substituted keys, a rewritten ledger. **Mitigation** — the credential lives only in the Vercel production environment; RLS permits public read but all writes go through the service role; **and crucially, the attacker still cannot forge a signature** — a fabricated registration fails `proof_check` in every verifier's own re-verification. **Residual risk** — an attacker could substitute key documents (see T-4) and delete or suppress records. Key substitution is exactly what two-path discovery defeats, and both discovery paths are now deployed — but the defense only bites for an agent whose operator domain actually publishes a `.well-known` key copy. **This is the highest-impact operational threat today.**

### T-10 · Clock manipulation
**Vector** — sign with a skewed clock to place a proof inside or outside a validity window. **Impact** — a proof accepted when it should not be, or an expiry evaded. **Mitigation** — `verifyManifestProof` applies **no leeway** and `now` is always passed explicitly. Registration tolerates at most 120s of *forward* client skew, refuses beyond it with `clock_skew_too_large`, and always records `registered_at` from the registry's own clock. **Residual risk** — up to 120s of forward skew is accepted at registration by design. It cannot extend a validity window at verification time, where no leeway exists.

### T-11 · Operator key exposure through the product
**Vector** — the product transmits, stores or logs a private key. **Impact** — total compromise of that identity. **Mitigation** — by construction: keys are generated client-side, never transmitted, never stored, never written to `localStorage` or `sessionStorage`. Server-side key generation was **deleted outright** rather than hardened, after it was found silently storing `plain:<hex>` when its encryption secret was unset. Test-enforced: no private key may appear in a request body or browser storage. **Residual risk** — the operator's own machine remains their responsibility.

### T-12 · Registration flooding and relay abuse
**Vector** — unbounded requests to the public write endpoints; `/api/retell/bind` accepts an unbounded array. **Impact** — storage and cost exhaustion; database load; `/api/retell/agents` acts as an open relay to a third-party API from AgenID's domain, attributing traffic to it. **Mitigation** — every write is signature-verified and self-attributed, so an attacker gains no identity they do not control, and the relay exposes no stored secret and grants no capability the caller lacks. **Since `2026-09-18`: every one of the ten POST routes is rate limited** (`packages/web/lib/rate-limit.ts`), keyed on a platform-set client header rather than the caller-controllable `x-forwarded-for`, with a per-instance floor that holds even when the durable counter is unreachable — so the failure mode is *degraded to per-instance*, never *unbounded*. `/api/retell/bind` also caps its array at `MAX_BATCH_SIZE`. **Residual risk — MEDIUM.** The bound is per client-IP-prefix, so a distributed source with many address ranges is limited only in proportion to its ranges; and the in-process floor bounds one serverless instance rather than the deployment. Neither is a bypass of the durable limit while Postgres is reachable.

### T-13 · Domain or GitHub org compromise
**Vector** — control the `agenid.com` zone, its TLS, or the `AgenID-protocol` org, and publish a different root pin. **Impact** — verifiers verify against the attacker's root. **Mitigation** — none cryptographic. Hardening (registrar lock, DNSSEC, hardware-key 2FA, enforced org 2FA, branch protection, required signed commits, audit-log export) is a **prerequisite of the key ceremony**. **Residual risk — this is the trust root's real ceiling.** Key storage is irrelevant to it. Currently moot only because no root key exists.

### T-14 · Root key compromise
**Vector** — theft or misuse of the root authority key, once one exists. **Impact** — **retroactive and total**: a verifier cannot distinguish a legitimate historical signature from a backdated forgery, so every assertion ever issued becomes suspect. **Mitigation** — planned HSM custody, IAM gating, audit logging; no automatic rotation (it would orphan the pin). **Residual risk** — unbounded until a v1.2 delegation object exists. This is the single largest unresolved architectural risk.

### T-15 · Fabricated verification claims in the codebase
**Vector** — code that asserts a verification outcome without computing one. **Impact** — for a protocol whose entire value is that a claim cannot be forged, the worst possible defect class. **Mitigation** — see *Fabrication* below; every rule is now a build-breaking test. **Residual risk** — tests catch grep-able patterns, not novel shapes. Human review of every diff that touches a verification outcome remains required.

### T-16 · Misleading integration documentation
**Vector** — a partner brief read as evidence of a shipped integration. **Impact** — a platform or buyer believes an adapter exists. **Mitigation** — all eight briefs carry an explicit "no adapter package exists" disclaimer, grep-checked before every push; the ecosystem registry's validator mechanically enforces that `verified` equals `status !== "compatible"`. **Residual risk** — low; the failure mode is a stale disclaimer after a real integration ships, which is why the rule is that the disclaimer changes in the same commit.

## Abuse cases

- **Registering an agent named after someone else's brand.** Nothing prevents it. L1 is a self-declaration and the protocol makes no naming claim — which is exactly why L1 must never render as verified. The mitigation is the honest label, not a name check.
- **Using a Verification Card as a trust badge in a phishing flow.** The card states plainly that L1 is not a third-party check and renders amber. A protocol that rendered it green would be supplying the fraud.
- **Bulk-registering to squat identifiers.** Identifiers are ULIDs, not names, so squatting has no value — but T-12 still applies to cost.
- **Using `/api/retell/agents` to probe Retell with stolen keys.** The relay neither validates nor stores the key, but the traffic originates from AgenID's domain. Now bounded at the tightest limit in the policy table, deliberately: the abuse lands on someone else's API with AgenID as the apparent source, so the reputational blast radius is larger than the load. An explicit relay policy is still owed.

## Operational threats

**Misconfiguration** — a missing Supabase credential silently falls back to the non-durable `MemoryStore`. Registrations would appear to succeed and vanish. Mitigated in production by verified cross-invocation persistence; the risk is a future environment where this is not re-checked.
**Deployment mistakes** — Vercel does not build workspace dependencies on its own; omitting that once broke production. Now in the build script.
**CI blind spots** — three of five package suites were each silently excluded from the matrix at different points, and the Node 20 leg failed for several commits while the other two stayed green and hid it. Both are why CI status is checked after every push, not just the local suite.
**Dependency behavior** — a library's eager subsystem initialization imposed a runtime requirement the product does not have. Realtime is now stubbed to throw if anything reaches it.
**Database corruption** — there are no multi-statement transactions; a mid-sequence failure can leave an agent without its ledger events. Degrades the audit trail, not verifiability.
**Unauthorized administrative access** — see T-9.

## Fabrication: the threat this project actually experienced

The realized attack here was not cryptographic. It was **code that asserted a verification outcome without computing one**, and it reached this repository seven times.

A CLI with zero crypto and zero network that printed `Status: ORGANIZATION_VERIFIED`. A nineteen-line API route that returned verified for any domain posted to it, including other companies'. A hardcoded DNS token identical for every user — which was published into a real DNS zone before anyone read the 33 lines that produced it. A wizard signing a fixed operator identity and two hardcoded `true` attestations on behalf of every operator who used it; that one **shipped to production and stayed live for a day**, inside a commit whose headline change was itself a genuine security improvement. After it was fixed, a project-wide search found two more copies of the same pattern — on the highest-traffic page on the site, and in the MCP server's manifest skeleton.

Four properties make this class worse than a signature bug:

1. **It is invisible to every cryptographic defense.** The signatures are real; the code asserts a conclusion it never derived.
2. **It propagates.** A fabricated claim does not stay in the repository — it reaches DNS, production, and anything downstream that trusts it.
3. **A real fix and a fabricated claim can arrive in the same diff.** Reviewing the thing a commit says it does is not the same as reviewing the commit.
4. **A fix scoped to the instance you found is a sample, not a fix.** The first correction's regression test scanned only the directories where the defect was noticed, so two live copies survived the pass that was hunting for them.

## Security controls

Controls that actually exist. Each one below is a test that fails the build, and each exists because the corresponding defect reached this repository.

| Control | Enforced by |
|---|---|
| No surface asserts a verification level the code did not compute | `web/test/issuance.test.ts`, `retell-manifest.test.ts`, `cli/test/cli.test.ts` |
| No disclosure attestation defaulted to `true` — pre-checking a box is defaulting | `web/test/public-surface.test.ts`, scanning `web/{app,components,lib}` **and all four sibling packages** |
| No hardcoded operator identity in manifest-building code | `public-surface.test.ts` |
| No private key in a request body or browser storage | `issuance.test.ts` |
| No hardcoded verification token in application code | `issuance.test.ts` |
| No dead or out-of-namespace host in public copy | `public-surface.test.ts` |
| Self-declared states never render as verified; the level string comes from the response | `public-surface.test.ts` |
| **Trust presentation fails closed** — an unknown, absent, empty or malformed level renders neutral, never verified, on every surface | `web/test/trust-presentation.test.ts` (20 hostile inputs against the real shield and the generated `/badge.js`) |
| One implementation per write path — no route may verify, store or clock-policy on its own | `public-surface.test.ts`, `retell-bind.test.ts` |
| No timestamp truncation anywhere in the repo | `public-surface.test.ts` |
| Storage backend cannot change a protocol field's serialization | `api/tests/store-timestamp-shape.test.ts` |
| `SupabaseStore` constructs without a global `WebSocket` | `api/tests/supabase-store-runtime.test.ts` |
| Platform compatibility status may not exceed its evidence | `web/test/ecosystem.test.ts` |
| Root `package.json` keeps `"private": true` | Manual check before any npm work |

Non-test controls: strict schemas rejecting unknown members; RLS on every table; the evidence field as a length-capped pointer; append-only ledger of hashes; `.env*` gitignored with `.env.example` templates.

**If a rule can be grepped for, it belongs in a test.** "Never default a disclosure attestation" was a written rule for a full day while committed, deployed code violated it in three places.

## Known vulnerabilities and unresolved risks

Ranked. Nothing material is omitted.

1. ~~**No rate limiting anywhere**~~ (T-12) — **CLOSED 2026-09-18.** All ten POST routes bounded; batch array capped. Residual risk is now MEDIUM (distributed sources, per-instance floor) rather than unmitigated. A wiring test asserts every POST route calls the limiter *before* reading the request body, so a new unbounded public endpoint fails CI on the day it is added — that guard is what found six routes the first pass had missed.
2. **Two-path key discovery is only as strong as the operator's half** (T-4, T-9) — both routes resolve, but an agent with no `.well-known` copy gives a verifier a single source.
3. **Root compromise would be retroactive and unbounded** (T-14) — largest architectural risk; moot until a key exists.
4. **Domain and org control is the trust root's real ceiling** (T-13) — hardening not yet complete.
5. **Service-role credential compromise permits record fabrication and suppression** (T-9), though not signature forgery.
6. **Two registration validation implementations can drift** — equivalence is held by test only.
7. **No agent revocation or status transition in production** — the enum exists; nothing writes it.
8. **The OpenAPI document covers 4 of 13 deployed routes**, understating the public attack surface to anyone auditing from the spec.
9. **No `security@` mailbox exists** — the `agenid.com` zone publishes no MX records, so a conventional reporting address would silently drop mail. Private vulnerability reporting is enabled and verified on the two public repositories instead, and cannot be enabled here while this repository is private.
10. **`/onboarding/retell` has never been rendered in a browser** — exercised only over HTTP and by grepping the shipped bundle.

## Residual risk

**Accepted:** 120s of forward clock skew at registration; the absence of multi-statement transactions; the operator's own key custody; the truth of operator attestations, which no party can verify.

**Not accepted, tracked, not yet fixed:** ceremony hardening (4), OpenAPI coverage (8), vulnerability reporting (9). Rate limiting (1) is fixed.

**Newly documented, not yet fixed:** the system has no authorization layer, no principal (human/organization) key role, and no revocation path — see [SECURITY-GAP-ANALYSIS.md](SECURITY-GAP-ANALYSIS.md), gaps B1, D1 and A1. These are absences in the object model rather than threats against the current one, which is why they are recorded there rather than as T-numbers here.

**Structurally unresolved until v1.2:** root-compromise blast radius (3). A delegation object is the fix; it is designed and undecided.

## Reporting

See [SECURITY.md](../SECURITY.md). A finding that some surface asserts an outcome it did not compute is high severity regardless of how small the code change looks.
