# @agenid/core

Reference implementation of the **AgenID v1.1.1 Final Protocol Specification** — protocol core only.

**In scope (Phase 1):** identifiers & ULIDs, RFC 8785 canonicalization, normative zod schemas, the single Ed25519 signing construction, verification procedures with stable failure codes, and a cross-implementation conformance suite.
**Out of scope by directive:** storage, HTTP server, adapters, UI.

```bash
npm install
npm run build && npm test
```

## Module map

| File | Spec | Purpose |
|---|---|---|
| `src/identifier.ts` | §2, §0.A, §9.2 | `agenid:<ULID>`, `agenid:key:<ULID>`, wire/query forms, fragment (`#`) rejection, well-known URIs |
| `src/jcs.ts` | §5 | Strict RFC 8785 JCS + number-domain rule (`InvalidNumberDomainError`) |
| `src/schemas.ts` | §6, §9, §11 | `Manifest`, `ManifestProof`, `VerificationAssertion`, `KeyDocument`, `KeysDocument`, `AuthoritiesDocument` — all `.strict()` |
| `src/crypto.ts` | §7 | Pure Ed25519 over canonical bytes; `sign*`/`verify*` for both signed objects; role enforcement; `VerifyResult` codes |
| `tests/v1_1_1_vectors.test.ts` | §8 | Executes the spec's vectors (fixture produced by an *independent* Python implementation) |
| `tests/identifier_and_schemas.test.ts` | §2, §6, §9, §11 | Identifier grammar, reserved-key rejection, L5 non-issuable, signing-time role guards |

## Design decisions that are load-bearing

- **The Manifest has no `$schema` member.** Adding one changes the canonical bytes and breaks the normative digest `81ba2680…ab5d`. The schema URI is exported as `MANIFEST_SCHEMA_ID`. `ManifestProof` and `VerificationAssertion` *do* carry `$schema`, and it is part of the signing input.
- **Verification never throws.** `verifyManifestProof` / `verifyVerificationAssertion` return `VerifyResult` with a code that maps 1:1 to the procedure step in §7.1/§7.2 (`manifest_digest_mismatch`, `key_role_mismatch`, `expired`, `signature_invalid`, `assertion_not_applicable_to_current_manifest`, …). Callers pass `now` explicitly — protocol code never reads a hidden clock.
- **Role is enforced before signature math.** An operator key presented against an assertion fails with `key_role_mismatch` even if the bytes would also fail.
- **`crypto.sign(null, …)`** is PureEdDSA in Node; there is no code path that could produce Ed25519ph. A test proves that signing a SHA-256 of the input does *not* reproduce the spec signature.
- **JCS is implemented in-package**, built on the two ECMAScript primitives RFC 8785 is defined in terms of (`JSON.stringify` for strings/numbers, UTF-16 code-unit key ordering). Conformance is proven byte-for-byte against the Python `rfc8785` vectors, including DEL/NBSP/astral characters and the `"10" < "9" < "B" < "a"` ordering case.

## Erratum E1 (spec §5 number-domain rule) — applied upstream

Status: **applied** in [`AgenID-protocol/spec`](https://github.com/AgenID-protocol/spec) as Erratum E1 (see its `ERRATA.md`). The text below is the original finding, kept for the record.

### Original finding

The spec's §5 prose says integers with magnitude > 2^53−1 are rejected. That sentence was written from the Python implementation's behavior, where `int` and `float` are distinct types — Python accepts the float `1e20` but rejects the int `100000000000000000000`. JavaScript has one number type, so the rule as worded is not implementable language-neutrally (JS cannot tell `1e20` from `100000000000000000000`).

**Resolution implemented here, proposed as the normative wording:** the rule is defined on the **canonical token**, not the host type —

> A number is rejected if it is non-finite, or if its RFC 8785 canonical token is an integer literal (no `.` and no `e`) with magnitude > 2^53−1.

Consequences: `9007199254740991` ok · `9007199254740992` rejected · `1e20` (token `100000000000000000000`) rejected · `1e21` (token `1e+21`) ok · `1e100` ok. This is *stricter* than Python's behavior for large floats and identical for ints; it never changes the bytes of any accepted value, so all §8 vectors still pass unchanged. Because no v1.1.1 schema field is a JSON number, no conformant document can reach this edge either way. A test (`number-domain rule is defined on the canonical token`) pins the behavior.

## Not implemented by design

- L5 `CONTINUOUSLY_MONITORED` — reserved name only; absent from the `VerificationLevel` enum so it cannot be issued.
- `permissions` / AUTHORIZED — no signed object in v1.1.1 (reserved for v1.2); the Manifest schema rejects the key.
- Key discovery *fetching* (HTTP), storage, resolver server, Retell adapter — Phase 2+, and the Retell-side field mapping remains BLOCKED pending documentation verification per the spec §18.
