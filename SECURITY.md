# Security Policy

AgenID is a trust product. Its entire value rests on the claim that an assertion cannot be forged and can be independently re-verified. A vulnerability here is not a bug that degrades a feature — it is a bug that makes the product a lie. We treat reports accordingly.

## Reporting a vulnerability

**Use GitHub's private vulnerability reporting** on this repository: *Security → Report a vulnerability*. This opens a private advisory visible only to maintainers.

Please do not open a public issue for a security report, and please do not disclose publicly before we have responded.

What helps most: the affected component and version or commit, a concrete reproduction, and what an attacker gains. If the finding is that some surface asserts a verification outcome it did not compute, say so plainly and we will treat it as high severity regardless of how small the code change looks.

**Response targets:** acknowledgement within 3 business days; an initial assessment within 10 business days; coordinated disclosure timing agreed with the reporter. We will credit reporters who want credit.

## Scope

**In scope**

- `@agenid/core` — canonicalization, signing, verification, schema validation, identifier handling
- `@agenid/api` and the registry routes in `@agenid/web` — validation, storage boundary, resolution envelope construction
- `@agenid/cli` and the browser signer (`packages/web/lib/client-crypto.ts`) — key generation and handling
- `www.agenid.com` — any route under it, and any public surface that states a verification outcome
- Anything that causes a verification level, claim state, or badge to be rendered more favorably than the evidence supports

**Out of scope**

- The registry being unavailable. The registry is deliberately not authoritative: an envelope is re-verifiable offline, so downtime is an availability problem, not a trust problem.
- Rate limiting on the public write endpoints. This is a known, documented gap — see [PROJECT_STATE.md](PROJECT_STATE.md). Reports that registration volume is unbounded tell us something we already published.
- Third-party platform vulnerabilities reached through an integration brief in `docs/partners/`. Report those to the platform.

## Security model

The full treatment is in [docs/trust-model.md](docs/trust-model.md) and [docs/threat-model.md](docs/threat-model.md). The load-bearing properties:

**The registry is not trusted.** A resolution envelope contains everything a verifier needs to check the claim itself, offline, using `@agenid/core` alone. If AgenID's registry lied, a verifier following the documented procedure would detect it. This is the design's central property and no change may weaken it.

**Operators hold their own keys.** Private keys are generated on the operator's machine or in the operator's browser and never transmitted. Server routes receive public material only. The registry cannot sign on an operator's behalf, by construction — a registry that could would be issuing assertions that mean nothing.

**Signing is pure Ed25519 over RFC 8785 canonical bytes.** The signing input is the canonical serialization minus the `signature` member. `$schema` is signed. A manifest is never signed directly; a `ManifestProof` signs the proof payload. Signing a SHA-256 pre-hash does **not** reproduce a spec signature, and there is an explicit negative test asserting that.

**Verification tolerates no clock leeway.** `verifyManifestProof` is strict. Registration separately tolerates up to 120 seconds of forward client skew, because the signer and the registry are different machines in one request — but `registered_at` is always the registry's own clock, and resolution applies no leeway at all. These two decisions are deliberately separate and must stay separate.

**There is no trust root yet.** No root authority key has been generated. Nothing above `L1_REGISTERED` can be issued on the reference deployment, `/.well-known/agenid/authorities.json` correctly returns 404, and no public surface claims otherwise. Until the ceremony runs, treat every level above L1 as unimplemented rather than pending.

**The real security ceiling is domain and org control.** The root public key reaches verifiers through the `agenid.com` DNS zone and the `AgenID-protocol` GitHub org. An attacker controlling either can publish a different pin using none of AgenID's key material — so hardware protection of the private key is irrelevant to that attack. Registrar lock, DNSSEC, hardware-key 2FA, enforced org 2FA, branch protection, and required signed commits on the spec repo are prerequisites of the key ceremony, not adjacent chores.

## Standing rules, enforced by test

These are not review conventions. Each one is a test that fails the build, and each one exists because the corresponding defect actually reached this repository.

| Rule | Enforced by |
|---|---|
| No surface may assert a verification level the code did not compute | `packages/web/test/issuance.test.ts`, `packages/web/test/retell-manifest.test.ts`, `packages/cli/test/cli.test.ts` |
| No disclosure attestation may be defaulted to `true` — `discloses_to_user` and `human_escalation` are signed claims about real behavior and must be supplied explicitly or be `false` | `packages/web/test/public-surface.test.ts` |
| No private key may appear in a request body or in browser storage | `packages/web/test/issuance.test.ts` |
| No hardcoded verification token may appear in application code | `packages/web/test/issuance.test.ts` |
| No dead or out-of-namespace host in public copy (`agenid.org`, `agenid.ai`, `api.agenid.com`) | `packages/web/test/public-surface.test.ts` |
| A self-declared state never renders as verified — `DECLARED` and `L1` render amber, never emerald | `packages/web/test/public-surface.test.ts` |
| A platform's compatibility status may not exceed its evidence | `packages/web/test/ecosystem.test.ts` |
| Storage backend must not change a protocol field's serialization | `packages/api/tests/store-timestamp-shape.test.ts` |
| Root `package.json` keeps `"private": true` — it is the only guard preventing a root `npm publish` from publishing the whole monorepo | Verify manually before any npm work |

**If a rule in this project can be grepped for, it belongs in a test.** "Never default a disclosure attestation" was a written rule for a full day while committed, deployed code violated it. A rule that lives only in a document is a rule the next contributor re-breaks.

## Reviewing generated code

Treat code generated by any assistant as unreviewed third-party input, and read it before running it — especially anything touching DNS, a database migration, a publish, or a verification outcome.

This is not a general caution. Fabricated verification artifacts have reached this repository more than once: code that printed `ORGANIZATION_VERIFIED` without performing any verification, an API route that returned verified for any domain submitted to it, and a hardcoded DNS token identical for every user that was published into a real DNS zone before anyone read the 33 lines that produced it. One instance shipped to production inside a commit whose headline change was itself a genuine security improvement.

The lesson that generalizes: **a fabricated claim does not stay in the repository.** It propagates into DNS, into production, and into anything downstream that trusts it. Catch it at read time. And reviewing the thing a commit says it does is not the same as reviewing the commit.

## Handling credentials

Never commit a secret. Never paste a credential into an issue, a pull request, a document, or a chat transcript. Configuration uses environment variables with safe examples; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Supported versions

Protocol **v1.1.1** (plus errata E1 and E2) is the current specification. The reference implementation tracks it. Changes to identity, cryptography, serialization, verification, or schemas require an erratum or a new protocol version — they are never made silently in the implementation.
