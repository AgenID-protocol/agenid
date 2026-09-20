# AgenID + Grok Bot — the first real pilot agent

**AgenID identifies and verifies the specific agent. It does not certify Grok, xAI, or any other company or provider.**

This document records AgenID's first dogfood integration: a real, running AI agent operated by AI Venture Holdings LLC, given an AgenID identity through the ordinary public code paths — the same `/issue` registration path any operator uses, the same `@agenid/core` signing construction, the same registry.

| | |
|---|---|
| **Agent** | AIVH Grok Bot |
| **AgenID** | `agenid:01M30753M8KR2AMB86WKR4DDFB` |
| **Verification Card** | [`/a/agenid:01M30753M8KR2AMB86WKR4DDFB`](https://www.agenid.com/a/agenid:01M30753M8KR2AMB86WKR4DDFB) |
| **Trust level** | `L1_REGISTERED` — the ceiling on this deployment |
| **Operator** | AI Venture Holdings LLC *(self-declared, unverified)* |
| **Record** | [`packages/web/data/pilot/grok-bot.json`](../packages/web/data/pilot/grok-bot.json) |

## 1. What AgenID verifies here

Exactly three things, and each is re-derivable by anyone without trusting our registry:

1. **The identifier is bound to a manifest.** `manifest_digest` is the SHA-256 of the RFC 8785 canonical manifest bytes. Change one character and the binding breaks.
2. **The manifest was signed by the key that claims to control the agent.** A pure Ed25519 `ManifestProof` over canonical bytes, by a key whose `controller` is this agent, whose `role` is `operator`, and which was active when it signed.
3. **That key is discoverable by two independent paths.** The registry serves it at `/v1/keys/01M30753MA1APW0S96E9QJZHCM`; the operator may publish the same document at their own `.well-known`. A verifier fetches both and requires agreement.

The decisive property: `packages/web/test/pilot.test.ts` re-verifies the committed record with `@agenid/core` alone — no network call, no registry. If our registry vanished tomorrow, every claim above would still check.

## 2. What AgenID does NOT verify here

Everything else, and the list is longer than the one above.

- **Not the operator.** "AI Venture Holdings LLC" is a string the operator typed and signed. Nobody checked it. That is precisely what `L1_REGISTERED` means.
- **Not the domain.** `aiventureholdings.com` is self-declared. Domain control evidence can be collected at `/verify/domain`, but turning it into `L2_DOMAIN_VERIFIED` needs an authority-signed assertion, and AgenID's root authority key ceremony has not been performed. **No level above L1 is issuable by this deployment.**
- **Not the provider.** See §3 — this is where the pilot found something.
- **Not the deployment.** v1.1.1 has no deployment-binding object. The identity is not cryptographically tied to the host it runs on. Presenting this identity from anywhere else would be indistinguishable.
- **Not the capabilities.** v1.1.1 has no signed representation of what an agent can do.
- **Not the behavioral claims.** `discloses_to_user` and `human_escalation` are operator attestations. No API can confirm them.

## 3. The finding: the branded provider is not the verified vendor

The product is called **Grok Bot** and is documented by xAI as an xAI product. The binary actually installed on the pilot host is code-signed and notarized by **Anysphere Incorporated** (Team ID `DCNK4UB866`, bundle identifier `com.anysphere.sand`). Every signed executable inside the bundle carries that same authority. **No xAI-signed component exists in the installed bundle.**

Re-derive it:

```
codesign -dv --verbose=2 "/Applications/Grok Bot.app"
spctl -a -vvv -t execute "/Applications/Grok Bot.app"
```

Neither fact is surprising once you know the product is surfaced through a partner environment, and neither is an accusation. The point is narrower and more useful: **"whose agent is this?" had a different answer from the brand on the box, and only one of the two answers is backed by a signature.** So the record keeps them in separate fields — `vendor_of_running_binary` is marked independently re-verifiable, `brand_named_by_product` is not — and AgenID asserts nothing whatsoever about xAI.

**No model identifier is claimed.** The running bot's model is not determinable from local configuration, so the field is `null` rather than guessed.

## 4. Capability is not authorization

This is the distinction the pilot exists to make concrete. **Capability** is what the agent can technically do. **Authorization** is what its principal permits. Collapsing them into a verification level — "L3 agents may execute commands" — is the mistake the protocol's authorization work is designed to avoid, because identity assurance and permission are orthogonal axes.

| Capability | Present | Authorized | Constraint |
|---|---|---|---|
| `host:execute` | yes | **yes** | requires human confirmation |
| `repo:read` | yes | **yes** | requires human confirmation |
| `network:egress` | yes | **yes** | requires human confirmation |
| `network:tunnel` | yes | **no** | — |
| `messages:send` | yes | **no** | — |
| `mcp:invoke` | yes | **no** | — |

Three rows disagree. The agent ships those capabilities and is not permitted to use them in this deployment. Every row is drawn from configuration on the operator-controlled host, and a test asserts the table and the signed grant agree exactly — flip one `authorized` without changing the grant and the suite goes red.

## 5. How authorization is represented — and its status

Through an **`AuthorizationGrant`**: a principal signs, over the same RFC 8785 + Ed25519 construction, a grant naming a subject agent, an explicit scope list, constraints, and a validity window. A relying party evaluates it offline against the principal's public key. The registry distributes grants; it never decides them, and it cannot forge one, because it never holds a principal's private key.

> **This layer is `v1.2-draft`. It is NOT normative, NOT ratified, and NOT issuable on the reference deployment.** It is implemented and tested; it becomes part of the protocol when it is ratified and the conformance suite carries vectors for it. `PROTOCOL_VERSION` remains `1.1.1` and is deliberately tracked separately from `AUTHORIZATION_DRAFT_VERSION`.

The pilot's grant permits three scopes under a `requires_human_confirmation` constraint. That constraint is returned to the relying party as an **obligation** — something it must enforce itself before acting — never as something AgenID has checked. AgenID cannot know whether a human actually confirmed.

## 6. Architectural gaps this pilot exposed

Recorded rather than papered over. Each is a real limit of v1.1.1, not a bug in the pilot.

1. **No deployment binding.** No object ties an identity to a runtime, so deployment substitution is not detectable by the protocol.
2. **No capability object.** `platform`, `permissions` and `configuration_fingerprint` are reserved manifest keys that `.strict()` rejects, so the capability table above is repository evidence, not protocol material.
3. **No provider/vendor attestation.** Nothing lets a vendor attest that a given agent runs on its platform, which is exactly the gap §3 walked into.
4. **Authorization is draft-only.** Grants verify, and nothing in the deployed registry stores, serves or revokes them yet.
5. **Actor binding is optional in the evaluator.** `evaluateAuthorization` binds the presented agent to the grant's subject only when both the manifest and the operator key are supplied; omit them and a grant issued for another agent evaluates `PERMITTED`. Pinned by a core test that runs the same forged grant bound and unbound. Callers must always supply both until the evaluator reports this the way it already reports `revocationsChecked`.

## 7. Reproducing it

```
node scripts/pilot-grok-bot.mjs --mint       # generate keys, sign, self-verify
node scripts/pilot-grok-bot.mjs --register   # POST public material to the registry
pnpm --filter @agenid/web test -- pilot      # re-verify the record offline
```

Private keys are written to `~/.aivh/agenid-pilot` with mode `0600` and never enter the repository, the request body, or any log. The registration request carries exactly `{manifest, proof, key_document}` — public material only.

## See also

- [Trust model](./trust-model.md) — what each level does and does not mean
- [Architecture](./architecture.md) — the registry, the store seam, the envelope
- [Project state](../PROJECT_STATE.md) — what is deployed versus implemented
