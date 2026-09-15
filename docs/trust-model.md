# Trust Model

**What a verifier must trust, what they can check for themselves, and what each verification level actually means.**

Current as of 2026-09-15, protocol v1.1.1 + errata E1/E2.

## The claim

AgenID's claim is narrow and worth stating precisely, because the value of the whole system is the gap between this claim and the one people assume:

> An AgenID identity lets a third party check, for themselves, that a specific operator key signed a specific set of statements about a specific agent, at a specific time — without trusting AgenID.

It is **not** a claim that the statements are true. It is not a certification, an audit, or a compliance attestation. Verification is not compliance. An agent with a valid AgenID identity may still be badly behaved, badly built, or operated by someone you should not do business with. What the protocol removes is the ability to *lie about who is operating it* without being caught.

## What must be trusted

Ranked by how much of the system collapses if it fails.

**1. The operator's private key.** If it leaks, the attacker is the operator, for every purpose this protocol has. Nothing downstream can detect this. Key custody is the operator's responsibility, which is why the registry never has the opportunity to mishandle it.

**2. Ed25519 and SHA-256.** Standard cryptographic assumptions. If these fall, so does most of the internet.

**3. The distribution channel for the root public key** — *once a root exists.* A verifier learns which key is AgenID's root from the published pin. Today that means the `agenid.com` DNS zone and the `AgenID-protocol` GitHub organization. **An attacker who controls either can publish a different pin using none of AgenID's key material.** Hardware protection of the private key does nothing against this attack. This is the real security ceiling of the trust root, and it is why domain and repository hardening are prerequisites of the key ceremony rather than adjacent chores.

**4. The authority's diligence, per level.** Only for levels above L1, and only to the extent that level's evidence is not independently re-checkable. This is the axis the level design is built around.

## What must *not* be trusted, and is not

**The registry.** A resolution envelope contains the manifest, the proof, the operator key document, and every assertion. A verifier re-runs the verification locally with `@agenid/core` and reaches their own conclusion. If `agenid.com` served a forged envelope, the signature check fails on the verifier's machine.

A concrete consequence worth internalizing: **registry downtime is an availability problem, not a trust problem.** An envelope captured yesterday still verifies today with no network access at all.

**The registry's stated level.** `verification.level` in the envelope is a convenience. The assertions that produce it are all present in the envelope with their own signatures, and the verifier can recompute the level themselves. They should.

## Two-path key discovery

The protocol requires an operator's key to be discoverable two ways — from the registry, and from the operator's own domain under `.well-known` — and requires a verifier to **fetch both and require they agree**.

This is the mechanism that makes the registry non-authoritative in practice rather than in principle. A registry that substitutes a key it controls is caught by the operator's own copy disagreeing.

**Status: half-deployed.** The registry's key route (`GET /v1/keys/<key-ulid>`) returns 404 today. The envelope includes both discovery pointers and the card's `verify_instructions` say plainly that one path is not deployed, naming the partial check that does work: compare `operator_key.document` from the envelope against the operator's `.well-known` copy. This should be closed before any external party is invited to verify anything — it is a read-only route over data already in the store.

## Verification levels

| Level | Meaning | Evidence | Independently re-derivable? | Issuable today |
|---|---|---|---|---|
| `DECLARED` | Operator signed a manifest. Not registered. | The signature | Yes | Yes |
| `L1_REGISTERED` | The signed manifest is in the registry | The signature, plus registry presence | Yes | **Yes — this is the ceiling** |
| `L2_DOMAIN_VERIFIED` | The operator demonstrated control of a domain | A DNS TXT record | **Yes** — anyone can query DNS | No |
| `L3_ORGANIZATION_VERIFIED` | The operator's legal entity was checked | Offline documentation | **No** | No |
| `L4_DEPLOYMENT_VERIFIED` | The agent's deployment was sampled | Sampling methodology | Not yet defined | No |
| `L5` | **Reserved by the specification** | — | — | **Never — not issuable in v1.1.1** |

The fourth column is the design's organizing principle. **L1 and L2 survive AgenID's own compromise; L3 and L4 do not.** A forged or mistaken L2 is externally detectable, because the DNS record either exists or it does not and anyone can check. A bad L3 is undetectable by anyone outside AIVH, because the evidence is documentation nobody else has seen.

That is why issuance policy is **L2 first, and only L2**: start a trust root at the level whose claims survive its own compromise. L3 is deferred behind a written evidence standard, L4 behind a sampling methodology that does not yet exist, and L5 has no rank in the code at all — the type system, not a policy document, is what makes it unissuable.

## Claim states

`declared`, `verified`, and `authorized` are distinct and stay distinct in every surface's copy.

`AUTHORIZED` is the state that would say an agent is permitted to act on some principal's behalf. **There is no signed object for it in v1.1.1.** Nothing can legitimately claim it until protocol v1.2 defines one. Treat any surface claiming `AUTHORIZED` today as a defect.

## How self-declared state is displayed

`DECLARED` and `L1_REGISTERED` **always render amber, never emerald**, on every surface — badges, verification cards, and the issuance flow. Verified Emerald is reserved strictly for genuinely verified state.

This is not styling. A self-declaration rendered in the verified colour *is* a false verification claim, delivered visually instead of in JSON, and it is the exact defect that shipped once here. It is now enforced by test.

Separately: **"not verified" and "merely compatible" always render neutral — never red, never a warning.** Absence of verification is not a negative finding, and a protocol that punishes non-participation with a scarlet letter is a protection racket rather than an identity layer. An unknown identifier on the SVG badge renders neutral grey, reads `NOT REGISTERED`, and returns HTTP 200 so it renders as a badge rather than a broken image.

## The trust root, today

**No root authority key exists.** No key has been generated. `/.well-known/agenid/authorities.json` returns 404, correctly, because publishing a pin for a key that does not exist would be the most consequential possible false claim.

Custody has been decided: **Google Cloud KMS, `EC_SIGN_ED25519`, HSM protection level.** Google was chosen over AWS for one decisive reason — AWS offers both pure Ed25519 and a pre-hash variant on the same key, and selecting the wrong one produces signatures that fail AgenID's own verifier silently, with no error at signing time. Google offers Ed25519 only in PureEdDSA mode, so that misconfiguration is unrepresentable. Given this project's history with fabricated verification outcomes, preferring the platform where the dangerous configuration cannot be expressed is worth more than any other difference between them.

**Automatic rotation must never be enabled on the root key.** It would orphan the published pin.

## The delegation gap

**v1.1.1 has no delegation or cross-signing object.** `AuthoritiesDocument` publishes the root key as the pin. `verifyVerificationAssertion` checks that the assertion's `key_id` matches, that the role is `authority`, that the controller matches, and that the key was active — but **nothing binds a non-root authority key to the pinned root.** A verifier holding the pin cannot validate an assertion signed by any other key.

Two consequences:

1. **The classic offline-root / online-intermediate CA pattern is unavailable.** The pinned root must sign every assertion itself. This is what settles custody in favour of a callable, IAM-gated, audit-logged key rather than air-gapped hardware — an air-gapped root that must sign every assertion is not a security control, it is an outage.

2. **Root compromise invalidates all history.** A verifier cannot distinguish a legitimate historical signature from a backdated forgery, so every assertion ever issued becomes suspect, not just future ones.

A v1.2 delegation object would restore the offline-root pattern and sharply reduce that blast radius. It does not block the first ceremony; it materially changes the next one.

## What this model does not cover

Adversaries, attack scenarios, and what the protocol defends against versus what it does not: [threat-model.md](threat-model.md).
