# Operator Onboarding Guide

**Audience:** engineers registering an AI agent with the AgenID registry so it has a permanent, independently verifiable `agenid:<ULID>` identity. This walks the actual registration flow implemented in `@agenid/core` and `@agenid/api` (spec v1.1.1, §2, §9, §13) — every command below runs against real code in this monorepo, not illustrative pseudocode.

Nothing here requires trusting AgenID's own database: every step is checkable by a third party against your own published key and the manifest digest. See "Verify without trusting AgenID" at the end.

## Step 1 — Generate an Ed25519 keypair and build your `agenid.json` manifest

Install `@agenid/core` (or vendor its pure-function primitives — Ed25519 + RFC 8785 canonicalization, no framework dependency):

```bash
npm install @agenid/core
```

Generate an operator keypair and a manifest describing your agent:

```js
import { generateKeyPair, generateAgentId, generateKeyId, makeKeyDocument, signManifestProof } from "@agenid/core";

const agentId = generateAgentId();          // agenid:<ULID> — permanent, never reused
const operatorKey = generateKeyPair();      // { publicKey, privateKey } — store the private key like any signing secret
const keyId = generateKeyId();              // agenid:key:<ULID>

const keyDocument = makeKeyDocument({
  keyId,
  publicKey: operatorKey.publicKey,
  role: "operator",                          // must be "operator" — an authority-role key cannot register an agent
  controller: agentId,
  createdAt: new Date().toISOString(),
});

const manifest = {
  manifest_version: "1.0",
  agent_id: agentId,
  identity: { name: "Your Agent's Name", description: "One sentence on what it does" },
  ownership: { operator: "Your Company LLC", operator_domain: "yourcompany.com", contact: "trust@yourcompany.com" },
  purpose: { summary: "What this agent actually does", channels: ["voice", "sms", "chat"] },
  disclosure: { is_ai: true, discloses_to_user: true, human_escalation: true },
};

const proof = signManifestProof(manifest, { privateKey: operatorKey.privateKey, document: keyDocument }, {
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // proofs expire — plan to re-sign
});
```

This is your `agenid.json`: `{ manifest, proof, key_document: keyDocument }`. It never leaves your control until step 2 — nothing about your agent exists in the registry yet.

## Step 2 — Register the manifest

`POST` your manifest, proof, and key document to the registry API:

```bash
curl -X POST https://api.agenid.com/v1/agents \
  -H "content-type: application/json" \
  -d '{"manifest": ..., "proof": ..., "key_document": ...}'
```

A `201` response returns your `agenid:<ULID>` and confirms `verification.level: "L1_REGISTERED"` — declared by you, not yet independently checked by anyone else. Your public identity record is now live at:

```
https://www.agenid.com/a/<your-agenid>
```

That page (and `GET` on the same URL with `Accept: application/json`) is the canonical resolver — a human reads the card, a machine reads the JSON envelope. Both come from the same registry record; nothing is faked for display.

**Also publish your operator key at your own domain** (spec §9.3 — two-path discovery): host the key document at

```
https://yourcompany.com/.well-known/agenid/keys.json
```

A verifier is required to check both the AgenID-hosted path and your own domain's path and require they agree. This is what makes the registry non-authoritative by design: AgenID cannot silently swap your key, because a verifier is checking your own domain too.

## Step 3 — Embed the verification badge

The live badge (`badge.js`) fetches the current verification level at page load — never a cached image — and links to your public identity record:

```html
<script src="https://www.agenid.com/badge.js" data-agent="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"></script>
```

**Non-JS fallback.** `badge.js` needs JavaScript to render; a plain anchor to the same resolver URL degrades gracefully for crawlers, email clients, and JS-disabled browsers, and doubles as the accessible fallback inside `<noscript>`:

```html
<script src="https://www.agenid.com/badge.js" data-agent="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"></script>
<noscript>
  <a href="https://www.agenid.com/a/agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y">
    View this agent's AgenID identity record
  </a>
</noscript>
```

(A `<script>` cannot be nested inside an `<a>` — browsers close the anchor before the script executes. Ship them as siblings, as above.)

## Step 4 — Request L2/L3 verification

`L1_REGISTERED` is a self-declared claim. Independent verification requires an authority to issue a signed `VerificationAssertion` against your manifest (`POST /v1/agents/:agent_id/assertions`, authority-only — see `@agenid/api`'s `app.ts`):

- **L2 — Domain Verified:** the authority confirms you control `ownership.operator_domain` (e.g. via the `.well-known` publication in step 2, or an equivalent domain-control check).
- **L3 — Organization Verified:** the authority confirms `ownership.operator` is a real legal entity.
- **L4 — Deployment Verified:** the authority reviews an actual production deployment sample (spec §11; the review methodology for this level is still being finalized — see the project queue).
- **L5** is a reserved name in v1.1.1 and is not issuable by any authority yet — do not claim it.

Contact the authority operating your registry (for the reference deployment: AI Venture Holdings LLC) to start a verification review. Each valid assertion raises `verification.level` on your public record automatically — nothing on your side changes; the registry re-derives the level from valid, unexpired assertions bound to your *current* manifest digest every time your record is resolved.

## Verify without trusting AgenID

Every resolved envelope includes `verify_instructions` and everything needed to check it independently:

1. Recompute `sha256(RFC8785(manifest))` and compare to `manifest_digest`.
2. Fetch the operator key from **both** discovery paths — `https://www.agenid.com/v1/keys/<key-ulid>` and `https://<operator_domain>/.well-known/agenid/keys.json` — and require they agree.
3. Verify the Ed25519 signature over `RFC8785(proof)` minus the `signature` field, using that key.
4. For each assertion, fetch the issuing authority's key the same way, verify its signature, and check its validity window and that `assertion.manifest_digest` matches your current manifest.

None of this requires AgenID's registry to be honest or even online. See [`AgenID-protocol/conformance`](https://github.com/AgenID-protocol/conformance) for an independent reference implementation of the same checks that deliberately never imports `@agenid/core` or talks to any registry.
