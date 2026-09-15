# Trust Model

**What the system trusts, why it trusts it, and what it does not trust.** Current as of 2026-09-15, commit `a95928b`, protocol v1.1.1 + errata E1/E2.

## The claim

Stated precisely, because the value of the whole system is the gap between this claim and the one people assume:

> An AgenID identity lets a third party check, for themselves, that a specific operator key signed a specific set of statements about a specific agent, at a specific time — without trusting AgenID.

It is **not** a claim that the statements are true. It is not a certification, an audit, or a compliance attestation. **Verification is not compliance.** An agent with a valid AgenID identity may still be badly behaved, badly built, or operated by someone you should not do business with. What the protocol removes is the ability to *lie about who is operating it* without being caught.

## Trust principles

1. **The registry is a convenience, not an authority.** Every claim it serves is independently re-checkable, and a verifier who follows the documented procedure detects a lying registry.
2. **Verification is a pure function.** No I/O, no ambient clock, outcomes as values rather than exceptions. A verifier's decision is deterministic and reproducible.
3. **Operators hold their own keys.** A registry that can sign on your behalf issues assertions that mean nothing.
4. **Evidence that a third party can re-derive is worth more than evidence only we have seen.** This orders the whole level design.
5. **Absence of verification is not a negative finding.** Unregistered and unverified states render neutral, never as warnings.
6. **Claims never exceed what the implementation computes.** Enforced by test, not by review.

## Actors

| Actor | Exists today | Role |
|---|---|---|
| **Operator** | Yes | Holds the private key, signs the manifest, registers the agent. The only party that can make a signed claim about an agent. |
| **Agent** | Yes, as a subject | The thing being identified. It does not act in the protocol; it is named by it. |
| **Registry** | Yes — `www.agenid.com` | Validates, stores and serves public material. Holds no private keys and is not trusted by verifiers. |
| **Verifier** | Yes — any third party | Resolves an identity and re-checks it. Needs no account and no relationship with AgenID. |
| **Authority** | **No — does not exist yet** | Would sign `VerificationAssertion`s for levels above L1. No root authority key has been generated. |
| **Registry operator (AIVH)** | Yes | Runs the deployment and controls the `agenid.com` zone and the `AgenID-protocol` GitHub org. |

There is no end-user account system, no organization entity, and no administrator role in the protocol.

## Identity model

**Subject.** An agent, identified as `agenid:<ULID>`. The assertion schema also allows a `deployment` subject type; no deployment assertions can be issued today.

**Identifier.** `agenid:<ULID>` — a fixed grammar, validated by `@agenid/core`, rejected with `invalid_identifier` when malformed. Keys carry their own ULIDs.

**Controller.** Every `KeyDocument` names the agent it controls. A proof is only valid if the key's `controller` matches the agent being registered — a key that controls a different agent is refused.

**Role.** `role ∈ {operator, authority}`. An operator key cannot sign an assertion; an authority key is refused at registration. Role confusion is a rejected state, not a warning.

**Keys and lifecycle.** A key document carries a `status` plus `retired_at` and `revoked_at`. `keyActiveAt` evaluates a key against the instant a signature claims to have been made, so a signature made before revocation stays interpretable afterwards. **Retired and revoked keys remain resolvable forever** — historical signatures must stay checkable, or revocation would silently rewrite history.

**Signatures.** A `ManifestProof` signs a proof payload that binds a digest of the manifest. **A manifest is never signed directly.**

**Authority.** An `AuthoritiesDocument` publishes `authority_id`, `authority_domain`, `root_key_id` and `root_public_key_b64u` — that is the pin a verifier holds. It is not published, because no root key exists.

## Assertions and attestations

Two different things share the word "claim", and confusing them is how forged claims got into this repository twice.

**Operator attestations** live inside the manifest and are signed by the operator. `discloses_to_user` and `human_escalation` are claims about an agent's real behavior. They are **not discoverable from any API**, so they must be supplied explicitly or be `false`. **Defaulting one — including pre-checking a checkbox — is a fabricated claim carried under a real Ed25519 signature**, which is worse than no claim at all because it is indistinguishable from a deliberate one. Test-enforced across every package.

**Verification assertions** are signed by an authority and carry `subject`, `subject_type`, `level`, a typed `claim`, `authority`, an `evidence` pointer, `verified_at`, `expires_at`, `scope`, `manifest_digest` and `key_id`.

- **Who can create them:** an authority key. None exists, so **none can be created today.**
- **Who can verify them:** anyone, from the envelope, offline.
- **What they prove:** that the named authority asserted that specific claim about that specific manifest at that time.
- **What they do not prove:** that the claim is true. The evidence field is a **pointer, never content** — length-capped deliberately to discourage embedding evidence, which would make the registry a repository of private material.
- **Expiry:** `expires_at` is required, and an expired assertion fails with `expired`.
- **Binding:** an assertion names a `manifest_digest`. Edit the manifest and it fails with `assertion_not_applicable_to_current_manifest`. There is no separate revocation object; re-signing the manifest is what invalidates stale assertions.

Claim types are bound to levels: `registration` → L1, `domain_control` → L2, `organization_identity` → L3, `deployment_conformance` → L4. Evidence types are a closed enum: `schema_validation`, `dns_txt_challenge`, `http_wellknown_challenge`, `business_registry_match`, `document_review`, `deployment_sample_review`.

## Trust levels

| Level | Means | Evidence | Independently re-derivable? | Issuable today |
|---|---|---|---|---|
| `DECLARED` | An operator signed a manifest. Not registered. | The signature | Yes | Yes |
| `L1_REGISTERED` | That signed manifest is in this registry | Signature + registry presence | Yes | **Yes — the ceiling** |
| `L2_DOMAIN_VERIFIED` | The operator demonstrated control of a domain | DNS TXT record | **Yes** — anyone can query DNS | No |
| `L3_ORGANIZATION_VERIFIED` | The operator's legal entity was checked | Offline documentation | **No** | No |
| `L4_DEPLOYMENT_VERIFIED` | The agent's deployment was sampled | Sampling methodology | Not yet defined | No |
| `L5_CONTINUOUSLY_MONITORED` | **Reserved name only** | — | — | **Never in v1.1.1** — absent from the enum |

**What each level does *not* mean, stated plainly:**

- **`DECLARED` and `L1` do not mean anyone checked anything.** They mean a key holder said something and the signature is intact. No third party has reviewed the operator, the domain, the organization or the agent's behavior.
- **`L2` would not mean the operator is trustworthy** — only that they control a domain.
- **`L3` would not mean the organization is reputable** — only that documents were reviewed.
- **`L4` would not mean the agent behaves well at runtime** — only that a sample was examined at a point in time.
- **No level means "compliant", "audited", "certified" or "safe".**

The fourth column is the organizing principle. **L1 and L2 survive AgenID's own compromise; L3 and L4 do not.** A forged or mistaken L2 is externally detectable — the DNS record either exists or it does not. A bad L3 is undetectable by anyone outside AIVH.

That is why issuance policy is **L2 first, and only L2**: start a trust root at the level whose claims survive its own compromise. L3 is deferred behind a written evidence standard; L4 behind a sampling methodology that does not yet exist.

## Claim states

`declared`, `verified` and `authorized` are distinct and stay distinct in every surface's copy. `VerifyResult` returns `claimState: "DECLARED" | "VERIFIED"` — there is no third value.

**`AUTHORIZED` — the state that would say an agent may act on some principal's behalf — has no signed object in v1.1.1.** Nothing can legitimately claim it until v1.2 defines one. Treat any surface claiming `AUTHORIZED` today as a defect.

## Verification model

How a verifier establishes trust, in order:

1. Resolve the identifier and obtain the envelope.
2. Recompute the manifest digest and confirm it matches what the proof binds.
3. Verify the Ed25519 signature over the RFC 8785 canonical proof payload minus `signature`.
4. Confirm `key_id` matches, `role === "operator"`, and `controller` matches the subject.
5. Confirm the key was active at the proof's `created_at`.
6. For each assertion, repeat against the authority key, confirm the assertion binds the *current* manifest, and confirm it has not expired.
7. Compute the level yourself from the assertions that passed. Do not take `verification.level` on faith.
8. Fetch the operator's key from **both** discovery paths and require they agree.

Steps 1–7 can be completed today, entirely offline after step 1. **Step 8 cannot be completed against `agenid.com`**: the registry key route is not deployed. The partial check that works is comparing the envelope's `operator_key.document` against the operator's own `.well-known` copy, and every Verification Card says so.

## Cryptographic model

| Property | Value |
|---|---|
| Signature algorithm | **Pure Ed25519 (RFC 8032)**. PureEdDSA only. |
| Canonicalization | **RFC 8785 JCS** |
| Signing input | Canonical bytes of the proof payload **minus the `signature` member**. `$schema` **is** signed. |
| Digest | SHA-256, carried as `{ alg: "sha-256", value }` |
| Manifest signing | **Never signed directly** — a `ManifestProof` signs the proof payload |
| Number domain (E1) | Non-finite rejected; integer tokens beyond 2^53−1 rejected |
| Key custody | Generated on the operator's machine or in their browser. Never transmitted, never stored server-side, never written to browser storage. |
| Implementations | `@agenid/core` (Node native `crypto`) and `packages/web/lib/client-crypto.ts` (`@noble/curves`), each with its own JCS, held byte-identical by a cross-implementation test |

**Signing a SHA-256 pre-hash does not reproduce a spec signature**, and there is an explicit negative test asserting it. This is not a footnote: AWS KMS offers both pure and pre-hash Ed25519 on the same key, and choosing wrong yields spec-invalid signatures silently, with no error at signing time. It is the decisive reason root custody is Google Cloud KMS, where Ed25519 exists only in PureEdDSA mode and the dangerous configuration is unrepresentable.

**Never claim more than this.** The protocol provides signature authenticity and integrity over a canonical serialization. It provides no confidentiality, no non-repudiation beyond key custody, and no guarantee about the truth of what was signed.

## Trust boundaries

**Established** at key generation, on the operator's machine. **Transferred** by signature, and only by signature — never by the registry's say-so, a TLS connection, or a page's styling. **Rejected** at every strict-schema boundary, every role and controller check, and every digest mismatch.

## Non-trust assumptions

What the system explicitly does **not** trust:

- **The registry**, including its stated level, its stored records and its availability.
- **The transport.** TLS to `agenid.com` is not what makes an envelope trustworthy; the signature is.
- **The client's clock**, at verification. Registration tolerates 120s of forward skew as an engineering accommodation; verification tolerates none, and `registered_at` is always the registry's own clock.
- **Referential integrity in the database.** Verification re-derives everything from signatures.
- **Any external service.** None can raise a level.
- **The operator's honesty about behavior.** The protocol proves who signed, never whether what they signed is true.
- **Prior validity.** An assertion valid when issued is re-checked against the current manifest at every resolution.

## What must be trusted

Ranked by how much collapses if it fails.

1. **The operator's private key.** If it leaks, the attacker *is* the operator for every purpose this protocol has, and nothing downstream detects it.
2. **Ed25519 and SHA-256.**
3. **The distribution channel for the root public key** — once a root exists. Verifiers learn the pin from the `agenid.com` zone and the `AgenID-protocol` GitHub org. **An attacker controlling either publishes a different pin using none of AgenID's key material.** Hardware protection of the private key does nothing against this. It is the real security ceiling of the trust root, and it is why registrar lock, DNSSEC, hardware-key 2FA, enforced org 2FA, branch protection and required signed commits are prerequisites of the key ceremony rather than adjacent chores.
4. **The authority's diligence, per level** — only above L1, and only to the extent that level's evidence is not independently re-checkable.

## The trust root, today

**No root authority key exists.** `/.well-known/agenid/authorities.json` returns 404, correctly — publishing a pin for a key that does not exist would be the most consequential possible false claim.

Custody is decided: **Google Cloud KMS, `EC_SIGN_ED25519`, HSM protection level.** **Automatic rotation must never be enabled** on the root key; it would orphan the published pin.

## The delegation gap

**v1.1.1 has no delegation or cross-signing object.** `verifyVerificationAssertion` checks that the assertion's `key_id` matches, the role is `authority`, the controller matches and the key was active — but **nothing binds a non-root authority key to the pinned root.** A verifier holding the pin cannot validate an assertion signed by any other key.

1. **The offline-root / online-intermediate CA pattern is unavailable.** The pinned root must sign every assertion itself. This settles custody in favour of a callable, IAM-gated, audit-logged key — an air-gapped root that must sign every assertion is not a security control, it is an outage.
2. **Root compromise invalidates all history.** A verifier cannot distinguish a legitimate historical signature from a backdated forgery, so every assertion ever issued becomes suspect.

A v1.2 delegation object would restore the offline-root pattern and sharply reduce that blast radius. It does not block the first ceremony; it materially changes the next one.

## How trust state is displayed

`DECLARED` and `L1_REGISTERED` **always render amber, never emerald** — on badges, verification cards and the issuance flow. Verified Emerald is reserved strictly for genuinely verified state.

This is not styling. **A self-declaration rendered in the verified colour *is* a false verification claim**, delivered visually instead of in JSON, and it is the exact defect that shipped here once. Test-enforced.

Separately: **"not verified" and "merely compatible" always render neutral — never red, never a warning.** An unknown identifier renders neutral grey, reads `NOT REGISTERED`, and returns HTTP 200 so it renders as a badge rather than a broken image; the HTML card returns 200 with "an unregistered identifier is not evidence of anything." A protocol that punishes non-participation with a scarlet letter is a protection racket rather than an identity layer.

## Limitations

1. No trust root exists; nothing above L1 is issuable.
2. No delegation object; the pinned root must sign everything and compromise is retroactive.
3. Two-path key discovery is half-deployed.
4. The trust root's ceiling is domain and org control, not key storage.
5. Operator attestations are unverifiable by anyone, including AgenID. The protocol can only guarantee they were stated explicitly under a real key.
6. There is no revocation of an *agent* in production — the status enum exists but no transition writes it.
7. Registration is unauthenticated and unrated.

Adversaries, attack vectors and residual risk: [threat-model.md](threat-model.md).
