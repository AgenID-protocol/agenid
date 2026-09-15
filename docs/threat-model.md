# Threat Model

**Who the adversaries are, what the protocol defends against, and — more importantly — what it does not.**

Current as of 2026-09-15, protocol v1.1.1 + errata E1/E2. Read [trust-model.md](trust-model.md) first; this document assumes it.

## Assets

1. **The operator's private key.** Compromise is total and undetectable by the protocol.
2. **The root authority private key** — once one exists. Compromise invalidates every assertion, historical ones included, because v1.1.1 has no delegation object and verifiers cannot distinguish a legitimate old signature from a backdated forgery.
3. **The root key's distribution channel** — the `agenid.com` DNS zone and the `AgenID-protocol` GitHub org. Compromise here is equivalent to compromising the root key, and costs the attacker nothing cryptographically.
4. **The integrity of what public surfaces claim.** A page that says an identity is verified when it is not is a protocol failure delivered through HTML. This project treats it with the same severity as a signature bug, for good reason — see "Fabrication" below.
5. **Registry availability and contents.** Lowest value, deliberately. The design's whole point is that these are not load-bearing for trust.

## Adversaries

| Adversary | Capability | Goal |
|---|---|---|
| **Impersonator** | Can create agents, register identities, publish a site | Have their agent accepted as someone else's |
| **Tamperer** | Can intercept or modify an envelope in transit or at rest | Change what an agent claims without invalidating it |
| **Malicious or compromised registry** | Full control of `agenid.com` and its database | Issue, alter, or suppress identities and levels |
| **Network attacker** | Can intercept traffic to the registry | Substitute a key or an envelope |
| **Domain / org attacker** | Controls DNS, TLS, or the GitHub org | Publish a false root pin |
| **Malicious operator** | Legitimately holds a key | Make claims about their agent that are untrue |
| **Contributor of fabricated code** | Can land code in the repository | Have a surface assert an outcome nothing computed |

## Defended

**Manifest tampering.** The proof binds a digest of the manifest. Any modification yields `manifest_digest_mismatch`. Verified by test, including a one-character tamper against production.

**Signature forgery without the key.** Ed25519. Standard assumption.

**Canonicalization ambiguity.** RFC 8785 with two independent implementations — `@agenid/core`'s and the browser signer's — held byte-identical by a cross-implementation test. The §8 conformance vectors include adversarial canonicalization cases and an explicit negative test that signing a SHA-256 pre-hash does *not* reproduce a spec signature. Erratum E1 rejects non-finite numbers and integer tokens beyond 2^53−1, outside which JSON round-tripping is not lossless and two implementations can disagree about what was signed.

**Key substitution by the registry.** This is what two-path key discovery exists to defeat. **Currently only half-deployed** — see [trust-model.md](trust-model.md). Until the registry key route ships, this defense is partial, and every Verification Card says so.

**Registry lying about a level.** Assertions are re-verified by the verifier from the envelope, at resolution time, against the *current* manifest. A level the registry asserts without a valid signed assertion behind it does not survive an independent check.

**Stale assertions surviving a manifest edit.** Assertions bind to the manifest they were issued against. Editing the manifest invalidates them automatically — they are not trusted because they were valid once.

**Replay of a registration.** A repeated registration is a `409`, not a silent overwrite.

**Role confusion.** An authority-role key is refused at registration; a key controlling a different agent is refused; unknown top-level members are refused rather than ignored. Schemas are strict.

**Clock manipulation at verification.** `verifyManifestProof` applies no leeway and `now` is always passed explicitly. The 120-second tolerance exists *only* at registration, where signer and registry are genuinely different machines, and `registered_at` is always the registry's own clock.

**Operator key exposure through the product.** By construction: keys are generated on the operator's machine or in their browser, never transmitted, never stored, never written to browser storage. Server-side key generation was deleted outright rather than hardened. Enforced by test.

## Not defended

Stated plainly. A threat model that lists only successes is marketing.

**A compromised operator key.** The attacker becomes the operator. The protocol cannot tell the difference. Mitigation is key custody and, eventually, revocation — retired and revoked keys remain resolvable forever so historical signatures stay interpretable, but nothing detects the compromise itself.

**A lying operator.** The protocol proves *who signed*, never *whether what they signed is true*. `discloses_to_user` and `human_escalation` are claims about an agent's real behavior that are not derivable from any API. An operator can sign false ones. This is precisely why they may never be defaulted: a defaulted attestation is a fabricated claim carried under a real signature, which is worse than no claim at all because it is indistinguishable from a deliberate one.

**A compromised root key** — once one exists. All assertions, including historical ones, become suspect. v1.1.1 has no delegation object to limit the blast radius.

**An attacker who controls `agenid.com`'s DNS or the GitHub org.** They publish a different pin, using none of AgenID's key material, and verifiers who fetch it are verifying against the attacker's root. No amount of key-storage hardening touches this. It is the reason registrar lock, DNSSEC, hardware-key 2FA, enforced org 2FA, branch protection, and required signed commits are ceremony prerequisites.

**Registration flooding.** The public write endpoints are unauthenticated and unrated. Every write is signature-verified and self-attributed, so an attacker gains no identity they do not control — but volume is unbounded. `/api/retell/agents` is additionally an unauthenticated relay to a third-party API from AgenID's domain; it exposes no stored secret and grants no capability the caller lacks, but it should be rate-limited before being advertised anywhere.

**Correlation and privacy.** Registrations are public by design. An operator registering many agents publishes that relationship. There is no private registration mode.

**Anything about the agent's runtime.** The protocol says nothing about what model is running, what the system prompt contains, or what the agent does after it is identified. `L4_DEPLOYMENT_VERIFIED` is meant to address a slice of this, and its methodology does not yet exist.

## Fabrication: the threat this project actually experienced

The realized attack here was not cryptographic. It was **code that asserted a verification outcome without computing one** — and it reached this repository repeatedly.

A CLI with zero crypto and zero network that printed `Status: ORGANIZATION_VERIFIED`. An API route, nineteen lines long, that returned verified for any domain posted to it — including domains belonging to other companies. A hardcoded DNS token identical for every user and every domain. A wizard signing a fixed operator identity and two hardcoded `true` disclosure attestations on behalf of every operator who used it. That last one **shipped to production and stayed live for a day**, inside a commit whose headline change was itself a genuine security improvement.

Three properties make this class worse than a signature bug:

1. **It is invisible to every cryptographic defense.** The signatures are real. The code simply asserts a conclusion it never derived.
2. **It propagates.** The fabricated DNS token did not stay in the repository — it was published into a real DNS zone before anyone read the 33 lines that produced it. Verify at read time; downstream is too late.
3. **A real fix and a fabricated claim can arrive in the same diff.** Reviewing the thing a commit says it does is not the same as reviewing the commit.

### Controls

- **No surface may assert a verification level the code did not compute.** Test-enforced across `packages/web` and `packages/cli`.
- **No disclosure attestation may be defaulted.** Supplied explicitly, or `false`.
- **The registry never holds an operator private key.**
- **No hardcoded verification token in application code.**
- **Self-declared states never render as verified.**
- **No dead or out-of-namespace host in public copy.**
- **Treat generated code from any assistant as unreviewed third-party input.** Read it before running it — especially anything touching DNS, a migration, a publish, or a verification outcome.
- **Every grep-able rule becomes a test.** "Never default a disclosure attestation" was a written rule for a full day while committed, deployed code violated it. A rule that lives only in a document is a rule the next contributor re-breaks.

The full control list and its enforcing tests are in [SECURITY.md](../SECURITY.md).

## Reporting

See [SECURITY.md](../SECURITY.md). A finding that some surface asserts an outcome it did not compute is high severity regardless of how small the code change looks.
