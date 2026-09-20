# @agenid/cli

Operator CLI for the **AgenID v1.1.1** protocol. It generates an Ed25519 keypair, builds a manifest from attestations you pass explicitly, signs a `ManifestProof` over RFC 8785 canonical bytes, and re-verifies that proof locally before printing anything.

**Private keys never leave the machine.** The CLI makes no network call of any kind.

## Status

**Not published to npm.** `@agenid/cli` returns 404 on the npm registry today. Run it from a clone of this monorepo:

```bash
pnpm install
pnpm --filter @agenid/cli build
node packages/cli/dist/index.js
```

## Commands

```
agenid init --domain <hostname> --operator <name> --name <agent name> \
            --purpose <summary> [--discloses] [--escalates] [--out <dir>]

agenid dns-token [--domain <hostname>]
```

### `init`

Writes four files to `.agenid/` (or `--out`):

| File | Contents |
|---|---|
| `manifest.json` | The v1.1.1 manifest, exactly the fields the schema defines |
| `manifest-proof.json` | The signed `ManifestProof` |
| `key-document.json` | The public operator key document |
| `operator-private-key.b64u` | Your private key, written mode `0600` — never share or commit it |

`--discloses` and `--escalates` are **signed attestations about your agent's real behaviour** (EU AI Act Art. 50 disclosure, and whether a user can reach a human). They are false unless you pass them. Do not pass them unless they are true.

### `dns-token`

Prints a random per-invocation TXT value for `_agenid.<domain>`. Domain control is **evidence**, not a level: publishing the record does not by itself raise an agent above a self-declaration.

## What this tool does not do

- It does not print `VERIFIED`, `ORGANIZATION_VERIFIED`, or any level above a self-declaration. Under v1.1.1 those require an authority-signed `VerificationAssertion`, and **AgenID's root authority key ceremony has not been performed** — no such assertion can be issued by anyone today.
- It does not register anything. It produces signed material; submitting it is a separate step.
- It does not transmit, upload, or escrow a private key.
- It implements no authorization. `permissions` / `AUTHORIZED` have no signed object in v1.1.1; the v1.2 authorization layer in `@agenid/core` is **draft and non-normative**, and this CLI does not use it.

## Verification levels

`L1_REGISTERED` is the only level the reference deployment issues. `L2_DOMAIN_VERIFIED`, `L3_ORGANIZATION_VERIFIED` and `L4_DEPLOYMENT_VERIFIED` are defined by the specification but are **not issued**. `L5` is a reserved name, deliberately absent from the `VerificationLevel` enum, so it cannot be issued at all.

## Tests

```bash
pnpm --filter @agenid/cli test
```

## See also

- [Specification](https://github.com/AgenID-protocol/spec) — normative, and the source of truth
- [`@agenid/core`](../core) — the canonicalization and proof engine this CLI calls
- [Operator onboarding](../../docs/OPERATOR_ONBOARDING.md)

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 AI Venture Holdings LLC.
