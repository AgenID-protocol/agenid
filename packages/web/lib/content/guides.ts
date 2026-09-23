import type { ContentPage } from "./types";

/**
 * Long-form pillar guides served under /learn/<slug>.
 *
 * Grounded in spec v1.1.1 (+ errata E1, E2), docs/trust-model.md, docs/api.md,
 * docs/threat-model.md, docs/SECURITY-GAP-ANALYSIS.md, docs/OPERATOR_ONBOARDING.md and
 * PROJECT_STATE.md. Third-party statements are limited to what each owner's own page
 * says, and every one is listed in `sources`.
 */

const CEILING =
  "The reference deployment at agenid.com issues nothing above L1_REGISTERED today. L2_DOMAIN_VERIFIED and every level above it require a VerificationAssertion signed by a root authority key, and that key has not been created yet. L5 is reserved and is not issuable at all.";

const IDENTITY_NOT_PERMISSION =
  "Which agent is acting is not the same question as what it is allowed to do. AgenID answers the first. Protocol v1.1.1 defines no signed authorization object, so the permission decision stays with the relying party and the operator. A v1.2 authorization layer exists only as a draft in development.";

const EXAMPLE_ID = "agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC";

export const GUIDES: readonly ContentPage[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. How to verify an AI agent
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "how-to-verify-an-ai-agent",
    title: "How to Verify an AI Agent: A Step-by-Step Guide",
    description:
      "How to verify an AI agent step by step: resolve its AgenID, recompute the manifest digest, check the Ed25519 proof and compare the operator key from two sources.",
    h1: "How to verify an AI agent, step by step",
    keywords: [
      "how to verify an AI agent",
      "verify AI agent identity",
      "AI agent verification procedure",
      "check AI agent signature",
      "AI agent identity check",
      "verify agent manifest",
    ],
    lead: [
      "An AI agent that calls your business, sends your API a request or offers to transact on someone's behalf will usually say who it is. Saying is not verifying. A name, a voice, a logo and a confident description are all things any agent can produce, so a verification procedure has to rest on something the agent cannot fake: a signature made by a key the agent's operator holds, over a statement you can check byte for byte.",
      "This guide is a procedure you can follow as a developer or a security reviewer. It uses the open AgenID protocol, version 1.1.1, and the reference registry at www.agenid.com. Every step can be run with a standard Ed25519 library and an RFC 8785 canonicalizer, and none of it requires an account, an API key or trust in AgenID's database.",
      "The procedure has ten steps. The first eight establish identity: which agent this is, which operator key signed its declaration, and whether that signature is intact and current. Steps nine and ten are about interpretation: what the resulting verification level means, and why the question of what the agent is allowed to do is a separate decision you still have to make.",
      "Honest limits are stated as they come up and collected near the end. The short version: today the reference registry can confirm that an operator signed a declaration and registered it, and nothing more.",
    ],
    sections: [
      {
        heading: "What does it mean to verify an AI agent?",
        body: [
          "Verifying an AI agent means checking, for yourself, that a specific operator key signed a specific set of statements about a specific agent at a specific time. It does not mean confirming those statements are true. An operator can sign a manifest that describes its agent inaccurately, and the signature will still be valid. What the check removes is the ability to lie about who is operating the agent without being caught.",
          "In AgenID an agent has a permanent identifier of the form `agenid:<ULID>`, described in the [AgenID identifier](/glossary/agenid-identifier) entry. Behind that identifier sits an [agent manifest](/glossary/agent-manifest) written by the [agent operator](/glossary/agent-operator): the agent's name and description, the operator's name, domain and contact, the agent's purpose and channels, and three disclosure attestations. The manifest is never signed directly. A [ManifestProof](/glossary/manifest-proof) signs a small payload that binds the manifest by its SHA-256 [manifest digest](/glossary/manifest-digest).",
          "The steps below rebuild that chain from public material, following section 7.1 of the specification and failing fast on the cheapest checks.",
        ],
        bullets: [
          "Identity: which agent is this, and which operator key stands behind it.",
          "Integrity: has the declaration been altered since it was signed.",
          "Currency: was the key active when it signed, and is the proof inside its validity window now.",
          "Assurance: which claims, if any, an independent authority has checked.",
          "Permission: what the agent may do, which the protocol leaves to you.",
        ],
      },
      {
        heading: "Steps 1 to 3: get the identifier, resolve the envelope, check the schema",
        body: [
          "Step 1, get the agenid. An agent that participates in AgenID presents its identifier directly, or links to its [Verification Card](/glossary/verification-card), or shows a [badge](/badge) that links there. Check the grammar before doing anything else: `agenid:` followed by exactly 26 Crockford base32 characters, matching `^agenid:[0-9A-HJKMNP-TV-Z]{26}$`. The format is explained in the [ULID](/glossary/ulid) entry. A malformed identifier is a stop, not a lookup. The only example identifier used on this site is the one from the specification, `" + EXAMPLE_ID + "`.",
          "Step 2, resolve the envelope. The same URL serves two representations. A browser gets the HTML card; a machine asks for JSON and gets the canonical [resolution envelope](/glossary/resolution-envelope): `curl -H \"Accept: application/json\" https://www.agenid.com/a/<agenid>`. You can also paste an identifier into [/verify](/verify). The envelope carries the manifest, the proof, the operator key document, a `proof_check` result, every assertion with its own check, the highest currently valid level, and key-discovery pointers naming both places the operator key can be fetched.",
          "Read the status code. For JSON, `404 agent_not_found` means there is no record, and an unregistered identifier is not evidence of anything beyond that. A `503 registry_unavailable` means the status is unknown, not disproven. The HTML card returns 200 even for an unknown identifier, so never infer existence from it.",
          "Step 3, check the schema. Validate the manifest, the proof and the key document against the normative JSON Schemas published with the [specification](https://github.com/AgenID-protocol/spec). The schemas are strict: unknown members are rejected, and reserved manifest keys such as `permissions` and `authorizations` are rejected by a v1.1.1 validator. Erratum E1 adds a number-domain rule, rejecting non-finite numbers and integer tokens larger than 2^53 minus 1, because two implementations can disagree about what such a number serialized to. No v1.1.1 field is a number, so a conformant document never reaches that edge.",
        ],
      },
      {
        heading: "Step 4: how do you recompute the manifest digest?",
        body: [
          "Before any signature math, confirm that the manifest in front of you is the manifest the operator signed. Canonicalize the manifest with [RFC 8785 JSON Canonicalization Scheme](/glossary/rfc-8785-jcs), hash the resulting UTF-8 bytes with SHA-256, and compare the lowercase hex result with `proof.manifest_digest.value`. The envelope's top-level `manifest_digest` should match as well.",
          "Canonicalize from a parsed data structure, never by editing serialized text. RFC 8785 sorts object members by UTF-16 code units, emits non-ASCII characters as raw UTF-8, escapes only quotation marks, backslashes and control characters, and serializes numbers in one defined form, so member order in the file you received is irrelevant.",
          "A mismatch fails with `manifest_digest_mismatch`, and you stop there. This is the check that catches tampering in transit, at rest or in a copied envelope: change one character of the manifest and the digest no longer matches.",
        ],
      },
      {
        heading: "Steps 5 and 6: how do you verify the Ed25519 ManifestProof?",
        body: [
          "Step 5, verify the signature. Take the proof object, remove the `signature` member and nothing else, canonicalize what remains with RFC 8785, and verify the signature over those exact bytes with the operator's public key. The `$schema` member stays in the signing input, so swapping the schema URI breaks the signature by design. The signature is base64url without padding and decodes to 64 bytes; the public key is the key document's `public_key_b64u`, 32 bytes.",
          "Use pure [Ed25519](/glossary/ed25519) as defined in RFC 8032. Do not pre-hash the payload with SHA-256 or SHA-512 and do not use the Ed25519ph variant. The only SHA-256 in the protocol is the manifest digest value carried inside the payload. A pre-hashed signature does not reproduce a spec signature, and some key services offer both modes on the same key, so this is a real way to get a silent wrong answer. A failed check is `signature_invalid`.",
          "Step 6, check the key's role and controller. Signature validity is necessary, not sufficient. Confirm that the proof's `key_id` matches the key document's `key_id`, that the key document's `role` is `operator`, and that its `controller` equals the agent's identifier. An authority-role key must never be accepted for a ManifestProof, even when the math validates; that is `key_role_mismatch`. A key controlling a different agent is `key_controller_mismatch`. See [operator key](/glossary/operator-key) and [authority key](/glossary/authority-key).",
        ],
      },
      {
        heading: "Step 7: how do you fetch the operator key from two sources?",
        body: [
          "The envelope carries a copy of the operator's key document, but a copy handed to you by the registry is exactly what a dishonest or compromised registry would substitute. [Two-path key discovery](/glossary/two-path-key-discovery) closes that gap by fetching the key from two places that are controlled by different parties and requiring them to agree.",
          "The registry path takes the key's wire form, the bare key ULID without the `agenid:key:` prefix: `curl https://www.agenid.com/v1/keys/<key-ulid>`. The envelope's `operator_key.discovery.registry_path` gives it to you. The operator path is a [well-known URI](/glossary/well-known-uri) on the operator's own domain, the `operator_domain` named in the manifest: `curl https://<operator_domain>/.well-known/agenid/keys.json`. That document lists every key the operator controls, and it must be served over HTTPS with a valid certificate for that domain.",
          "Compare the registry copy, the operator copy and the copy in the envelope. They must describe the same key: same `key_id`, same `public_key_b64u`, same role and controller. Disagreement is a hard failure, not a warning; it is the exact case two-path discovery exists to catch.",
          "Be precise about the one-source case. The operator publishes the `.well-known` copy, and AgenID cannot make it do so. If the operator's domain serves no key document, you have one source, not two, and the key-substitution defense is not in force for that agent. A verifier that treats a missing operator copy as agreement has disabled the check. Record it as a single-source result.",
        ],
      },
      {
        heading: "Step 8: how do you check key status and validity windows?",
        body: [
          "A key document carries `status` (`active`, `retired` or `revoked`) and the timestamps `retired_at` and `revoked_at`. Evaluate the key against the instant the proof claims to have been signed, its `created_at`, not against the current time. A proof created before a key was retired stays valid; a proof created after `revoked_at` fails regardless of its signature. The failure is `key_not_active_at_signing_time`. The [key rotation and revocation](/glossary/key-rotation-and-revocation) entry covers the model.",
          "Retired and revoked keys stay resolvable forever. Historical signatures must remain checkable. A 200 from the key endpoint is therefore not a statement that the key is usable today. Read the fields.",
          "Then check the proof's own window: `created_at` must be at or before now, and now must be at or before `expires_at`. Proofs expire, so operators re-sign. Verification applies no clock leeway. Pass the current time in explicitly so the result is reproducible. Outcomes are `not_yet_valid` and `expired`.",
          "One limit belongs here. The key model can express retirement and revocation, but the reference deployment has no write path that retires or revokes a key, and no agent revocation or suspension flow. Agent status values exist in the schema, and nothing writes them today. Every registered agent shows `ACTIVE`. Treat that field as unpopulated, not as an assurance.",
        ],
      },
      {
        heading: "Step 9: what does the verification level tell you?",
        body: [
          "If steps 1 to 8 pass, you have established a DECLARED claim bound to an operator key. The ManifestProof can never produce more than DECLARED. The [verification level](/glossary/verification-level) comes from a different object, a [VerificationAssertion](/glossary/verification-assertion) signed by an authority key, and each assertion is checked the same way: digest binding against the current manifest, signature, role `authority`, controller equal to the named authority, validity window, and trust in the authority itself through a pinned [root authority key](/glossary/root-authority-key).",
          "Do not take the envelope's `verification.level` on faith. Recompute it from the assertions that passed your own checks. An assertion bound to an older manifest version is reported as `assertion_not_applicable_to_current_manifest`; it is not invalid, but it does not speak for the manifest in front of you.",
          CEILING + " On the reference registry today every assertion list is empty and the level you compute should be L1_REGISTERED for a registered agent.",
        ],
        bullets: [
          "DECLARED: an operator signed a manifest. Nobody checked anything.",
          "L1_REGISTERED — that signed manifest is in this registry. Still a self-declaration, which is why it renders amber, never as verified.",
          "L2_DOMAIN_VERIFIED — an authority checked control of a domain. Defined by the protocol, not issuable today.",
          "L3_ORGANIZATION_VERIFIED and L4_DEPLOYMENT_VERIFIED — defined, not issuable today; L4's sampling method is still being specified.",
          "No level means compliant, audited, certified or safe. Verification is not compliance.",
        ],
      },
      {
        heading: "Step 10: how do you decide what the agent is allowed to do?",
        body: [
          IDENTITY_NOT_PERMISSION,
          "Keep three claim states apart, as the [declared, verified and authorized](/glossary/declared-verified-authorized) entry sets out. DECLARED is what the operator says. VERIFIED is what an authority checked, for one claim, in one scope, for one window. AUTHORIZED is what the agent may do, and v1.1.1 has no signed object for it. None of them is ever inferred from another, and a higher verification level does not grant any permission.",
          "In practice, the [relying party](/glossary/relying-party) makes the authorization decision under its own policy. A dental office may accept an L1 agent for booking a cleaning and require a human for anything touching records; see the [dentist appointment](/how-it-works/dentist-appointment) and [financial transaction](/how-it-works/financial-transaction) scenarios. What AgenID contributes is a stable answer to which agent and which operator you are dealing with, so that your policy and your logs attach to a persistent identity instead of a claim.",
        ],
      },
      {
        heading: "What does each check prove, and what are the honest limits?",
        body: [
          "The table below is the fastest way to read a verification result correctly. Each check establishes one narrow fact, and the right-hand column is as important as the middle one.",
        ],
        table: {
          caption: "Check, what it proves, what it does not prove",
          columns: ["Check", "What it proves", "What it does not prove"],
          rows: [
            ["Identifier grammar", "The string is a well-formed agenid", "That any agent is registered under it"],
            ["Resolution (200 envelope)", "The registry holds a record for this identifier", "Anything about the agent's behavior, or that the registry is honest"],
            ["Strict schema validation", "The objects have exactly the defined shape", "That the declared content is true"],
            ["Manifest digest recomputed", "The manifest is byte-for-byte what the proof binds", "Who wrote it or whether it is accurate"],
            ["Ed25519 ManifestProof", "The holder of this operator key signed this binding", "That the key holder is the organization named in the manifest"],
            ["Role and controller", "An operator key for this agent signed it, not an authority key or another agent's key", "That the operator is legitimate"],
            ["Two-path key agreement", "The registry did not substitute the key, if the operator publishes a copy", "Anything, when only one source exists"],
            ["Key status and window", "The key was active at signing and the proof is current", "That the key has not been stolen"],
            ["Recomputed level", "Which authority-checked claims currently apply", "Permission to act, compliance, or safety"],
          ],
        },
        bullets: [
          "L1 ceiling: " + CEILING,
          "One-source case: if the operator's domain serves no `.well-known/agenid/keys.json`, two-path discovery gives you one source and the substitution defense does not apply.",
          "No revocation flow: agent statuses are stored but never written, and there is no deployed path to retire or revoke a key.",
          "Operator attestations such as `discloses_to_user` and `human_escalation` are self-declared and unverifiable by anyone, including AgenID.",
          "Object, not request: a valid proof shows who signed a declaration, not that the live request in front of you came from that agent. See [agent-to-agent authentication](/learn/agent-to-agent-authentication).",
        ],
      },
      {
        heading: "How do you verify without trusting AgenID?",
        body: [
          "Every step above can be run without the registry being honest, and after step 2 without it being online. The envelope contains everything a verifier needs; your own code recomputes the digest, verifies the signature, checks role, controller and windows, and recomputes the level. The registry cannot forge an operator's signature, so a registry that lied about a manifest or a proof would fail your checks. The key comparison in step 7 is what stops it from swapping the key itself.",
          "That is why the registry holds no operator private keys. Keys are generated on the operator's machine or in the browser at [/issue](/issue) and are never sent to AgenID. The [trust overview](/trust) sets out what the system trusts and what it deliberately does not: the registry's stored level, the transport, the client's clock and the operator's honesty about behavior.",
          "Store the envelope you verified alongside your decision. It is self-contained evidence that anyone, including an auditor who trusts neither you nor AgenID, can re-check later. If your recomputation ever disagrees with what the registry reported, the registry is wrong.",
        ],
      },
      {
        heading: "How does the independent conformance suite help?",
        body: [
          "If you write your own verifier, test it against the independent conformance suite at [github.com/AgenID-protocol/conformance](https://github.com/AgenID-protocol/conformance). It is MIT-licensed, written in Python, and deliberately does not import AgenID's own code: it uses general-purpose libraries for RFC 8785, Ed25519 and JSON Schema.",
          "The suite reproduces the specification's deterministic test vectors: manifest canonicalization and digest, ManifestProof and VerificationAssertion signatures, role-substitution rejections, key-order independence, adversarial Unicode, number and sort-order cases, and the Erratum E1 rejections. Passing it shows your canonicalizer and Ed25519 call produce the exact bytes the protocol defines.",
          "Nothing is published to npm, so there is no AgenID package to install for verification. That is fine: the procedure needs only an RFC 8785 implementation, SHA-256 and pure Ed25519, all of which exist in every mainstream language. The normative text lives in the public [specification repository](https://github.com/AgenID-protocol/spec).",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the quickest way to verify an AI agent?",
        a: "Paste its identifier into [/verify](/verify) or open its Verification Card at `https://www.agenid.com/a/<agenid>`. For a machine check, request the same URL with `Accept: application/json`, recompute the manifest digest, verify the Ed25519 ManifestProof and compare the operator key from both discovery paths.",
      },
      {
        q: "Do I need an account or API key to verify an agent?",
        a: "No. Resolution and key discovery are public, unauthenticated reads, and the verification itself runs in your own code. You need an RFC 8785 canonicalizer, SHA-256 and a pure Ed25519 implementation.",
      },
      {
        q: "What if the operator does not publish a .well-known key file?",
        a: "Then you have one source for the operator key instead of two, and two-path discovery cannot detect a substituted key for that agent. Treat it as a single-source result. Do not treat a missing copy as agreement.",
      },
      {
        q: "Can the AgenID registry fake a verification result?",
        a: "It can report anything, but it cannot forge an operator's Ed25519 signature, and every assertion travels with its own signature. A verifier who recomputes the digest, the signatures and the level detects a registry that lied. Two-path key discovery covers key substitution where the operator publishes its copy.",
      },
      {
        q: "Which verification levels can an agent have today?",
        a: CEILING,
      },
      {
        q: "Does a valid verification mean the agent is allowed to act?",
        a: IDENTITY_NOT_PERMISSION,
      },
      {
        q: "Can I check whether an agent has been revoked?",
        a: "Not through an agent revocation flow, because none is deployed. Agent status values exist in the schema but nothing writes them. Key documents do carry status, retired_at and revoked_at, and you should evaluate them against the proof's signing time.",
      },
      {
        q: "How do I test my own verifier implementation?",
        a: "Run it against the vectors in the independent conformance suite at [AgenID-protocol/conformance](https://github.com/AgenID-protocol/conformance), which reproduces the specification's signatures, digests and adversarial canonicalization cases without depending on AgenID's code.",
      },
    ],
    related: ["/verify", "/how-it-works", "/glossary/resolution-envelope", "/glossary/two-path-key-discovery", "/trust", "/learn/agent-to-agent-authentication"],
    sources: [
      { label: "AgenID protocol specification v1.1.1 (AgenID-protocol/spec)", url: "https://github.com/AgenID-protocol/spec" },
      { label: "AgenID independent conformance suite (AgenID-protocol/conformance)", url: "https://github.com/AgenID-protocol/conformance" },
      { label: "RFC 8785: JSON Canonicalization Scheme (JCS)", url: "https://www.rfc-editor.org/rfc/rfc8785" },
      { label: "RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)", url: "https://www.rfc-editor.org/rfc/rfc8032" },
      { label: "RFC 8615: Well-Known Uniform Resource Identifiers", url: "https://www.rfc-editor.org/rfc/rfc8615" },
    ],
    updated: "2026-09-23",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Know Your Agent (KYA)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "know-your-agent-kya",
    title: "Know Your Agent (KYA) Explained",
    description:
      "Know Your Agent (KYA) is an emerging practice for establishing who an AI agent is and who answers for it. Its components, the KYC analogy, and where AgenID fits.",
    h1: "Know Your Agent (KYA): what it is and how to build on it",
    keywords: [
      "know your agent",
      "KYA",
      "know your agent KYA",
      "AI agent KYC",
      "AI agent identity verification",
      "agent accountability",
    ],
    lead: [
      "Know Your Agent, usually shortened to KYA, is an emerging term for the practice of establishing who an AI agent is, who is accountable for it, and what it should be permitted to do, before a business lets it act. The name deliberately echoes Know Your Customer. Where KYC asks a bank to know the person opening an account, KYA asks a merchant, an API provider or a service desk to know the software acting on someone's behalf.",
      "The term is new and not standardized. Several identity, fraud and payments companies now use it, each with its own emphasis, and there is no single authoritative definition. This guide sets out the components most definitions share, where the KYC analogy holds and where it breaks, and how an open, independently re-verifiable identity layer such as AgenID can serve as one building block of a KYA program.",
      "AgenID is not a KYA product and does not claim to cover the whole practice. It answers the identity and provenance questions with signatures anyone can re-check. Accountability to a verified person, authorization and monitoring need other components, and this guide is explicit about which is which. " + CEILING,
    ],
    sections: [
      {
        heading: "What is Know Your Agent (KYA)?",
        body: [
          "At its simplest, KYA is identity assurance applied to non-human actors that take actions. A KYA check tries to answer a short list of questions about an agent: which agent is this, who operates it, who is it acting for, what is it permitted to do, and is it still behaving within those bounds. The glossary entry for [Know Your Agent](/glossary/know-your-agent) gives a one-paragraph version.",
          "The practice exists because agents now do things that used to require a person at a keyboard. They place orders, book appointments, request quotes, move money and call other agents. The systems on the receiving end were built around logins, cookies and payment cards that assume a human is present. An agent using its owner's login proves only that someone knew a password; it says nothing portable about which software is acting or who answers for it. That gap is the subject of [why agent identity matters](/why-agent-identity).",
          "KYA sits inside the broader field of [non-human identity](/glossary/non-human-identity), which also covers service accounts, workloads and API keys. What distinguishes agents is that they act with some autonomy on behalf of a principal, often across organizations that have no prior relationship. That is why most KYA definitions go beyond authenticating software and try to connect it to an accountable party.",
        ],
      },
      {
        heading: "Who uses the term KYA, and how do they define it?",
        body: [
          "The following summarizes how several organizations describe KYA on their own pages. It is a sample, not a ranking, and each description is paraphrased or quoted from the source listed at the end of this guide.",
          "Reading them together, the shared core is clear: a persistent agent identity, a binding to an accountable person or organization, and some combination of policy, delegation and monitoring. The differences are mostly about which of those a given product emphasizes, and whether the binding is to a verified human, to an organization or to an operator key.",
        ],
        bullets: [
          "[Skyfire](https://docs.skyfire.xyz/docs/kya) describes KYA as verifying a real-world identity and having agents inherit it. Its KYA token discloses only the identity fields a particular service requires, for either an individual or an organization.",
          "[Vouched](https://www.vouched.id/know-your-agent) describes KYA as verifying AI agents, connecting them to verified humans and enforcing delegated permissions, and lists components including an access-control layer and a public agent registry.",
          "[Sumsub](https://sumsub.com/blog/know-your-agent/) describes KYA as a risk-based approach that defines an agent's identity, binds it to a responsible human or organization, and enforces policy, oversight and auditability. Its product emphasizes agent-to-human binding.",
          "[Entrust](https://www.entrust.com/resources/learn/know-your-agent) describes KYA as verifying and managing the identity of AI systems, bots and other autonomous non-human actors, and frames it as extending KYC principles rather than replacing them.",
          "[Experian](https://www.experianplc.com/newsroom/press-releases/2026/experian-announces-agent-trust-to-power-trusted-ai-driven-commer) announced a KYA framework in April 2026 that grounds agent-initiated transactions in verified consumer identity, naming Visa, Cloudflare and Skyfire among ecosystem contributors.",
          "Related research from MIT's Project NANDA describes [AgentFacts](https://www.media.mit.edu/publications/beyond-dns-unlocking-the-internet-of-ai-agents-via-the-nanda-index-and-verified-agentfacts/), cryptographically verifiable metadata resolved from a lean agent index. It addresses the same identity and capability questions without using the KYA label.",
        ],
      },
      {
        heading: "What are the components of a KYA program?",
        body: [
          "Most KYA definitions can be decomposed into five components. Separating them is useful because they are answered by different evidence, often by different systems, and a gap in one is not filled by strength in another.",
        ],
        bullets: [
          "Identity: a persistent, unique identifier for the agent that does not change when it moves platform or deployment, backed by a key only its operator holds.",
          "Provenance: a record of who declared the agent, what they said it is for and when, bound so that later edits are detectable. See [agent provenance](/glossary/agent-provenance).",
          "Operator accountability: a binding from the agent to a person or organization that answers for it, and evidence that the binding is real rather than typed into a form.",
          "Authorization: what the agent may do, for whom, within what limits and for how long, expressed in a form the receiving system can evaluate.",
          "Monitoring: ongoing observation of behavior, with the ability to withdraw trust, rotate keys or revoke permissions when something changes.",
        ],
      },
      {
        heading: "How does KYA map to what AgenID provides?",
        body: [
          "The table maps each component to what the AgenID protocol and its reference deployment provide today, and what they do not. The honest boundary matters more than the list of features: a KYA program that assumes AgenID covers a component it does not will have a hole it cannot see.",
        ],
        table: {
          caption: "KYA components mapped to AgenID v1.1.1 and the reference deployment",
          columns: ["KYA component", "What AgenID provides today", "What it does not provide"],
          rows: [
            ["Identity", "A permanent `agenid:<ULID>`, an operator-held Ed25519 key, and a signed manifest anyone can re-verify offline", "Any link between the identifier and a runtime deployment"],
            ["Provenance", "A ManifestProof binding the manifest by SHA-256 digest, a registration time from the registry's clock, and an append-only event ledger", "Any check that the declared content is true"],
            ["Operator accountability", "Operator name, domain and contact, signed by the operator; domain-control evidence via a DNS TXT record at /verify/domain", "A verified binding to a legal entity or a person. L2 and L3 are defined but not issuable today"],
            ["Authorization", "Nothing. v1.1.1 reserves the `permissions` and `authorizations` keys and defines no signed authorization object", "Scopes, grants, delegation limits. A v1.2 authorization layer is a draft in development"],
            ["Monitoring", "Stable identifiers that logs and reputation can attach to; key documents with status fields", "Behavioral monitoring, agent revocation or suspension. L5 is reserved and no revocation flow is deployed"],
          ],
        },
      },
      {
        heading: "How is KYA like KYC, and where does the analogy break?",
        body: [
          "The analogy is useful up to a point. Both practices try to attach an action to an accountable party before the action is allowed, both rely on evidence of differing strength, and both are risk-based: a low-value interaction warrants a lighter check than a high-value one.",
          "It breaks in four places, and each one changes how a KYA program should be designed.",
        ],
        bullets: [
          "The subject is not a person. An agent has no face or document to check. Its identity is a key and a declaration, so KYA has to verify signatures and bindings rather than biometrics.",
          "The subject changes. An agent can be reconfigured, re-prompted or moved to another platform in minutes. A KYA result must be tied to a specific declaration, which is why AgenID binds every assertion to a manifest digest: edit the manifest and older assertions no longer apply to it.",
          "Accountability is layered. A KYC subject answers for itself. An agent is built by one party, operated by another and acting for a third. KYA has to say which of those it has bound, and an [agent operator](/glossary/agent-operator) is not necessarily the principal the agent acts for.",
          "The check travels. KYC results usually stay inside the institution that ran them. Agents cross organizations constantly, so a KYA result is far more useful when the next relying party can re-check it without trusting whoever ran it first.",
        ],
      },
      {
        heading: "Why should agent identity be independently re-verifiable?",
        body: [
          "The last point is the one AgenID is built around. If every relying party must trust the same central service to tell it who an agent is, that service becomes a single point of failure and a single point of pressure. If it is wrong, compromised or offline, every decision built on it inherits the problem, and nobody downstream can tell.",
          "An independently re-verifiable identity turns the registry into a convenience rather than an authority. In AgenID the operator signs its own declaration, the registry stores and serves the public material, and any verifier recomputes the digest and checks the Ed25519 signature itself. The operator's key can be fetched from the registry and from the operator's own domain and compared, which is [two-path key discovery](/glossary/two-path-key-discovery). The procedure is written out in [how to verify an AI agent](/learn/how-to-verify-an-ai-agent).",
          "For a KYA program this has a concrete benefit: the identity component of your evidence file is portable and self-contained. You can store the envelope you checked and show an auditor, a partner or a regulator exactly why you accepted that agent, and they can re-run the check without an account with anyone.",
        ],
      },
      {
        heading: "How can a KYA program build on AgenID?",
        body: [
          "A practical pattern is to use AgenID for the identity and provenance layer, and to put the other components on top of it, keyed to the persistent identifier.",
          "Start at registration. Ask the agents you deal with, or your own agents, to carry an AgenID; operators can issue one in about a minute at [/issue](/issue), with the signing key generated in the browser and never sent to AgenID. Ask operators to publish their key at their own domain's `.well-known` path and to add the `_agenid` TXT record at [/verify/domain](/verify/domain). Confirming domain control records evidence; it does not raise the level above L1.",
          "At interaction time, resolve and re-verify the identifier, record the envelope, and apply your own policy to the result. Attach your own risk signals, human-binding checks, payment credentials and permission rules to the identifier, not to a name or an IP address. The [agentic commerce](/glossary/agentic-commerce) and [procurement](/how-it-works/b2b-procurement) pages show where this sits in a transaction.",
          CEILING + " A KYA program should therefore treat an AgenID result today as strong evidence of identity and provenance, and as a self-declaration for everything the operator says about itself.",
        ],
      },
      {
        heading: "What does KYA not answer on its own?",
        body: [
          IDENTITY_NOT_PERMISSION,
          "This is the most common mistake in early KYA designs: treating a verified identity as a permitted action. A verification level describes how carefully an identity was checked. It says nothing about what the agent may do. A receiving system that reads a strong identity as permission has collapsed two separate questions into one, and that is precisely the harm a careful KYA program exists to prevent. The [declared, verified and authorized](/glossary/declared-verified-authorized) entry explains the separation.",
          "Regulation adds context but not a shortcut. The EU AI Act's [Article 50](/glossary/eu-ai-act-article-50) sets transparency obligations for certain AI systems that interact with people, which is one reason the AgenID manifest carries `is_ai` and `discloses_to_user` attestations. Those attestations are self-declared, and nothing on this page is legal advice about whether a given deployment meets any obligation.",
        ],
      },
    ],
    faqs: [
      {
        q: "What does KYA stand for?",
        a: "Know Your Agent. It is an emerging term for establishing who an AI agent is, who is accountable for it and what it should be allowed to do, by analogy with Know Your Customer.",
      },
      {
        q: "Is KYA a formal standard?",
        a: "No. It is an industry practice and a product category that several companies describe in their own terms. There is no single normative definition, which is why this guide breaks it into components rather than adopting one vendor's version.",
      },
      {
        q: "Is AgenID a KYA provider?",
        a: "AgenID is an open identity protocol that a KYA program can build on. It covers agent identity and provenance with independently re-verifiable signatures. It does not bind agents to verified people, define permissions or monitor behavior.",
      },
      {
        q: "How is KYA different from KYC?",
        a: "KYC verifies a person who answers for themselves. KYA verifies software whose configuration can change quickly, that is built, operated and directed by potentially different parties, and whose identity has to be checkable across organizations.",
      },
      {
        q: "Can AgenID prove which company operates an agent?",
        a: "Not today beyond the operator's own signed declaration. " + CEILING,
      },
      {
        q: "Does a KYA check mean the agent is allowed to act?",
        a: IDENTITY_NOT_PERMISSION,
      },
      {
        q: "What should I store as KYA evidence?",
        a: "Store the resolution envelope you verified, the time you verified it, your recomputed result and the policy decision you made. The envelope is self-contained, so anyone can re-check the identity part of your evidence later without trusting you or AgenID.",
      },
    ],
    related: ["/glossary/know-your-agent", "/learn/how-to-verify-an-ai-agent", "/compare/skyfire-kyapay", "/why-agent-identity", "/glossary/non-human-identity", "/trust"],
    sources: [
      { label: "Skyfire documentation: Know Your Agent (KYA)", url: "https://docs.skyfire.xyz/docs/kya" },
      { label: "Vouched: Know Your Agent", url: "https://www.vouched.id/know-your-agent" },
      { label: "Sumsub: From AI Agents to Know Your Agent", url: "https://sumsub.com/blog/know-your-agent/" },
      { label: "Entrust: Know Your Agent (KYA) explained", url: "https://www.entrust.com/resources/learn/know-your-agent" },
      { label: "Experian: Experian announces Agent Trust (April 30, 2026)", url: "https://www.experianplc.com/newsroom/press-releases/2026/experian-announces-agent-trust-to-power-trusted-ai-driven-commer" },
      { label: "MIT Media Lab: Beyond DNS, the NANDA Index and Verified AgentFacts", url: "https://www.media.mit.edu/publications/beyond-dns-unlocking-the-internet-of-ai-agents-via-the-nanda-index-and-verified-agentfacts/" },
      { label: "EU AI Act, Article 50: Transparency obligations", url: "https://artificialintelligenceact.eu/article/50/" },
    ],
    updated: "2026-09-23",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. AI agent registry
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "ai-agent-registry",
    title: "AI Agent Registry: Discovery Without Blind Trust",
    description:
      "What an AI agent registry does, why it should serve discovery rather than trust, and how AgenID keeps its registry non-authoritative with operator signatures.",
    h1: "AI agent registries: built for discovery, not for trust",
    keywords: [
      "AI agent registry",
      "agent registry",
      "AI agent directory",
      "agent discovery",
      "agent name service",
      "agent identity registry",
    ],
    lead: [
      "An AI agent registry is a service that records agents and lets other software look them up. As agents multiply across platforms and organizations, some form of registry becomes unavoidable: a caller needs a way to go from a name or an identifier to an endpoint, a key and a description it can act on.",
      "The harder question is what a registry's answer should mean. If the registry is the thing everyone trusts, whoever controls it can quietly change who an agent is. This guide makes the case that a registry should be for discovery and resolution, not for trust, and shows how the AgenID registry is designed so that a verifier can disbelieve it and still get the right answer.",
      "It also surveys the main registry approaches in public discussion today, in neutral terms and with sources, and lists the design questions any registry has to answer. " + CEILING,
    ],
    sections: [
      {
        heading: "What is an AI agent registry?",
        body: [
          "An AI agent registry stores records about agents and serves them on request. A record typically includes an identifier or name, some description of the agent, one or more endpoints, and cryptographic material that lets a caller authenticate the agent or its publisher. Registries differ in who can write to them, what they check before accepting a record, and what their answers are supposed to mean.",
          "Registries are not new. DNS is a registry of names; certificate transparency logs are registries of certificates; package registries such as npm and PyPI are registries of code. Agent registries borrow from all three, and the choices they inherit, especially about who is trusted, carry over too.",
        ],
      },
      {
        heading: "What does a registry actually do: discovery, naming, resolution?",
        body: [
          "Three functions are often bundled together under the word registry. It helps to pull them apart, because a system can be good at one and deliberately absent from another.",
        ],
        bullets: [
          "Discovery: finding agents you did not already know about, usually by capability, category or search. This is the function a marketplace or a directory serves.",
          "Naming: assigning an identifier that is unique and stable, and deciding who may claim which names. Human-readable names raise disputes and squatting; opaque identifiers avoid them but need another route to be found.",
          "Resolution: going from a known identifier to the current record, including keys and endpoints. This is the function a verifier depends on, and the one where trust matters most.",
        ],
      },
      {
        heading: "Should a registry be the source of trust?",
        body: [
          "The core argument of this guide is that it should not. A registry that is the source of trust can change what any agent is, and every relying party inherits that change without being able to detect it. A registry compromise, an insider, a legal order or a plain bug then becomes an identity failure for everyone downstream. The more successful such a registry is, the more attractive a target it becomes.",
          "The alternative is to treat the registry as a distribution mechanism. Records are signed by the parties they describe, using keys the registry never holds, and verifiers check those signatures themselves. The registry can still be useful, even essential, for finding and fetching records. What it cannot do is make a false record verify.",
          "This is the same move certificate transparency made for web PKI and that package ecosystems are making with signed provenance: keep the convenient central service, but make its output checkable against something it does not control.",
        ],
      },
      {
        heading: "How does AgenID make its registry non-authoritative?",
        body: [
          "The AgenID registry at www.agenid.com is designed on the principle that it is a convenience, not an authority. Four properties make that concrete.",
        ],
        bullets: [
          "Operators sign, the registry does not. An operator generates an Ed25519 key on its own machine or in the browser at [/issue](/issue), signs a [ManifestProof](/glossary/manifest-proof) over its agent's manifest, and submits only public material. The registry holds no operator private keys and cannot sign on an operator's behalf.",
          "The registry checks before it stores, and so can you. Registration verifies the strict schema, the digest binding, the Ed25519 signature, the key's role and controller and the proof's validity window. A verifier re-runs the same checks on the [resolution envelope](/glossary/resolution-envelope) and reaches its own conclusion.",
          "The key comes from two places. [Two-path key discovery](/glossary/two-path-key-discovery) lets a verifier fetch the operator key from the registry at `/v1/keys/<key-ulid>` and from the operator's domain at `https://<operator_domain>/.well-known/agenid/keys.json`, and require that they agree. Where the operator publishes no copy, the verifier has one source, not two.",
          "Verification works offline. Once a verifier has the envelope, recomputing the digest, verifying the signature and computing the level needs no network access. A distributed envelope stays checkable even if the registry is unreachable.",
        ],
      },
      {
        heading: "What happens if the registry lies or goes down?",
        body: [
          "If the registry altered a manifest, the recomputed [manifest digest](/glossary/manifest-digest) would no longer match the proof, and the verifier would reject it with `manifest_digest_mismatch`. If it reported a level no valid assertion supports, a verifier that recomputes the level from the assertions would not reproduce it. If it served a different operator key, the comparison with the operator's own `.well-known` copy would disagree, provided the operator publishes one.",
          "The residual risks are stated in AgenID's threat model rather than hidden. A verifier who trusts the registry's reported level without recomputing it is not protected. A compromised database credential could suppress or delete records, and could substitute key documents for agents whose operators publish no domain copy. None of these lets an attacker forge an operator's signature.",
          "Availability failures are reported as such. A `503 registry_unavailable` means an identity's status is unknown, not disproven, and an unknown identifier returns a neutral result rather than a warning. Absence of a record is not evidence of anything beyond the absence.",
        ],
      },
      {
        heading: "What design questions does every agent registry have to answer?",
        body: [
          "Whatever the architecture, a registry makes choices on the questions below. Asking them of any registry you are evaluating is a quick way to learn what its answers mean.",
        ],
        table: {
          caption: "Registry design questions and AgenID's answers in v1.1.1",
          columns: ["Question", "Why it matters", "AgenID v1.1.1"],
          rows: [
            ["Namespacing", "Human-readable names invite disputes and impersonation; opaque ones need another route to be found", "Opaque `agenid:<ULID>` identifiers. No naming claim is made, so squatting has no value"],
            ["Identifier permanence", "If an identifier can be reassigned, history and reputation can be hijacked", "Immutable for the life of the record and never reissued, even for a revoked agent"],
            ["Platform independence", "An identity tied to one platform breaks when the agent moves", "The identifier is non-semantic and survives platform and deployment changes"],
            ["Key rotation", "Keys must change without breaking historical signatures", "A new key gets its own ULID; retired and revoked keys stay resolvable forever. No rotation write path is deployed yet"],
            ["Status and revocation", "Relying parties need to know when to stop accepting an agent", "Status values are defined, but nothing writes them today and no revocation flow is deployed"],
            ["Who can write", "Open registration scales but admits anything; gated registration concentrates power", "Anyone holding an operator key may register, rate limited. Registration is a self-declaration at L1"],
            ["What an answer means", "A registry answer can be an assertion or just a pointer", "A pointer to signed material the verifier re-checks"],
          ],
        },
      },
      {
        heading: "What registry approaches exist today?",
        body: [
          "Several approaches are in public discussion. The summary below describes each in its owner's or authors' own terms, with sources at the end of the page. It is a survey, not a ranking, and several of these can be combined. A 2025 academic survey, [Evolution of AI Agent Registry Solutions](https://arxiv.org/abs/2508.03095), compares five of them across security, authentication, scalability and maintainability.",
        ],
        bullets: [
          "Agent Name Service (ANS). An individual IETF Internet-Draft, [draft-narajala-ans](https://datatracker.ietf.org/doc/draft-narajala-ans/), proposed structured agent names resolved through a registry with X.509 certificates. Its successor, [ANS v2](https://datatracker.ietf.org/doc/draft-narajala-courtney-ansv2/), with authors from GoDaddy, OWASP and Cisco among others, anchors agent identity to a DNS domain, verifies domain control with ACME challenges and records lifecycle events in a transparency log. See the [GoDaddy ANS comparison](/compare/godaddy-ans).",
          "MCP Registry. The [MCP Registry](https://modelcontextprotocol.io/registry/about) is a centralized metadata repository for publicly accessible Model Context Protocol servers, currently in preview. It authenticates namespaces through GitHub, DNS or HTTP challenges and delegates security scanning to package registries and downstream aggregators. It describes servers rather than agents; see [Model Context Protocol](/glossary/model-context-protocol).",
          "A2A Agent Cards. The [Agent2Agent specification](https://a2a-protocol.org/latest/specification/) has each agent publish a self-describing Agent Card, typically at `/.well-known/agent-card.json` on its own domain. Cards may be signed with JWS over RFC 8785 canonical JSON. This is decentralized discovery with no central registry required. See [agent card](/glossary/agent-card) and the [A2A comparison](/compare/a2a-agent-cards).",
          "NANDA Index and AgentFacts. MIT's Project NANDA describes a lean index that resolves to [AgentFacts](https://www.media.mit.edu/publications/beyond-dns-unlocking-the-internet-of-ai-agents-via-the-nanda-index-and-verified-agentfacts/), cryptographically verifiable metadata about an agent's capabilities and endpoints, with privacy-preserving discovery across organizations.",
          "Enterprise directories. Identity providers extend existing workforce directories to agents, which suits agents that act inside one organization's boundary. The arXiv survey above includes Microsoft Entra Agent ID as an example; see the [Entra Agent ID comparison](/compare/microsoft-entra-agent-id).",
          "AgenID. A resolver for operator-signed agent identities with a non-authoritative registry, as described above. It provides resolution of a known identifier, not a browsable directory: there is no agent directory or capability search on agenid.com.",
        ],
      },
      {
        heading: "What can an agent registry not tell you?",
        body: [
          "A registry record tells you what was registered and, if it is built on signatures, who signed it. It cannot tell you that the declared content is true, that the operator is reputable, or that the agent behaves well at runtime. Those need other evidence, and the strength of that evidence should be labeled honestly. " + CEILING,
          IDENTITY_NOT_PERMISSION,
          "A registry also cannot bind a live request to a registered agent on its own. Resolving an identifier tells you about the identity; whether the request in front of you came from that agent is an authentication question, covered in [agent-to-agent authentication](/learn/agent-to-agent-authentication).",
        ],
      },
      {
        heading: "How should you evaluate an AI agent registry?",
        body: [
          "A short checklist, useful whether you are choosing a registry to publish in, to resolve against, or to build.",
        ],
        bullets: [
          "Can you verify a record without trusting the registry, and is the procedure written down?",
          "Who holds the signing keys for records: the subject, or the registry?",
          "Is there a second source for keys that the registry does not control?",
          "Are identifiers permanent, and can a name ever be reassigned?",
          "Does every level or badge say exactly what was checked, and does absence of verification render neutrally?",
          "Is there an independent conformance suite for implementations? AgenID's is at [AgenID-protocol/conformance](https://github.com/AgenID-protocol/conformance).",
          "Does the registry distinguish identity from permission, or does it imply that a listed agent may act?",
        ],
      },
    ],
    faqs: [
      {
        q: "What is an AI agent registry?",
        a: "A service that records AI agents and lets software look them up, typically returning an identifier, a description, endpoints and cryptographic material for authenticating the agent or its publisher.",
      },
      {
        q: "Is the AgenID registry a directory of agents?",
        a: "No. It resolves an identifier you already have into a signed, re-verifiable record. There is no browsable agent directory or capability search on agenid.com.",
      },
      {
        q: "Do I have to trust the AgenID registry?",
        a: "No. Operators sign their own declarations with keys the registry never holds, and you re-verify the digest and signature yourself. The operator key can also be fetched from the operator's own domain and compared with the registry's copy.",
      },
      {
        q: "What happens to an agent's identifier if it changes platform?",
        a: "Nothing. An AgenID identifier is non-semantic and permanent, so it survives platform, configuration and deployment changes, and it is never reissued to another agent.",
      },
      {
        q: "How is an AgenID different from an A2A Agent Card?",
        a: "An Agent Card describes an agent's capabilities, endpoints and authentication requirements and is usually published at the agent's own domain. AgenID provides a permanent identifier and an operator-signed identity record with a verification procedure. They address different questions and can be used together.",
      },
      {
        q: "Does being registered mean an agent is verified?",
        a: "Registration produces L1_REGISTERED, which is a self-declaration. " + CEILING,
      },
      {
        q: "Does a registry listing mean the agent is allowed to act?",
        a: IDENTITY_NOT_PERMISSION,
      },
    ],
    related: ["/glossary/resolution-envelope", "/glossary/two-path-key-discovery", "/compare/godaddy-ans", "/compare/a2a-agent-cards", "/learn/how-to-verify-an-ai-agent", "/trust"],
    sources: [
      { label: "Evolution of AI Agent Registry Solutions: Centralized, Enterprise, and Distributed Approaches (arXiv 2508.03095)", url: "https://arxiv.org/abs/2508.03095" },
      { label: "IETF Internet-Draft: Agent Name Service (draft-narajala-ans)", url: "https://datatracker.ietf.org/doc/draft-narajala-ans/" },
      { label: "IETF Internet-Draft: Agent Name Service v2 (draft-narajala-courtney-ansv2)", url: "https://datatracker.ietf.org/doc/draft-narajala-courtney-ansv2/" },
      { label: "Model Context Protocol: The MCP Registry", url: "https://modelcontextprotocol.io/registry/about" },
      { label: "Agent2Agent (A2A) Protocol Specification", url: "https://a2a-protocol.org/latest/specification/" },
      { label: "MIT Media Lab: the NANDA Index and Verified AgentFacts", url: "https://www.media.mit.edu/publications/beyond-dns-unlocking-the-internet-of-ai-agents-via-the-nanda-index-and-verified-agentfacts/" },
      { label: "AgenID protocol specification v1.1.1 (AgenID-protocol/spec)", url: "https://github.com/AgenID-protocol/spec" },
    ],
    updated: "2026-09-23",
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Agent-to-agent authentication
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "agent-to-agent-authentication",
    title: "Agent-to-Agent Authentication: Patterns Compared",
    description:
      "How AI agents authenticate each other: API keys, OAuth, mTLS, HTTP Message Signatures, A2A Agent Cards, DIDs and AgenID, and what each one actually authenticates.",
    h1: "Agent-to-agent authentication: what each pattern proves",
    keywords: [
      "agent-to-agent authentication",
      "AI agent authentication",
      "multi-agent authentication",
      "authenticate AI agents",
      "A2A authentication",
      "agent request signing",
    ],
    lead: [
      "When one AI agent calls another, the receiving agent has to decide whether to act on the request. Before it can apply any policy, it needs to know who is calling. Agent-to-agent authentication is the set of mechanisms that answer that question, and there are several in use, each borrowed from an older part of the web.",
      "The trouble is that these mechanisms authenticate different things. Some prove that a connection comes from a holder of a certificate. Some prove that a request was signed by a key. Some prove that an agent's declared identity is intact. Few prove which operator stands behind an agent, and none of them on its own says what the agent is allowed to do.",
      "This guide compares the main patterns by what they authenticate, explains how delegation chains complicate the picture, and states AgenID's boundary precisely: in v1.1.1 it binds an identity to an operator-signed manifest, and it does not bind a live HTTP request to a registered agent. " + CEILING,
    ],
    sections: [
      {
        heading: "What is agent-to-agent authentication?",
        body: [
          "Agent-to-agent authentication is the process by which one software agent establishes the identity of another before exchanging data or delegating work. The glossary entry for [agent-to-agent authentication](/glossary/agent-to-agent-authentication) gives a short definition. In practice it happens in multi-agent systems inside one company, in cross-company workflows such as procurement and travel booking, and in [agentic commerce](/glossary/agentic-commerce), where a buying agent and a selling agent may never have met.",
          "The problem is harder than service-to-service authentication in one important way: agents often act across organizational boundaries with no prior relationship, no shared identity provider and no pre-exchanged credentials. The receiving side needs an identity it can check without first becoming a customer of the caller's platform.",
        ],
      },
      {
        heading: "What exactly is being authenticated: the connection, the agent or the operator?",
        body: [
          "Three different subjects hide behind the phrase authenticate the agent. Keeping them apart is the single most useful habit when comparing mechanisms.",
        ],
        bullets: [
          "The connection or request: this TLS session or this HTTP message came from a holder of a particular credential or key, now.",
          "The agent: the caller is a specific, persistent agent identity, the same one it was yesterday and on another platform.",
          "The operator: a specific person or organization runs this agent and answers for it.",
        ],
        table: {
          caption: "Patterns compared by what they authenticate",
          columns: ["Pattern", "Authenticates", "Typical gap"],
          rows: [
            ["API key", "Possession of a shared secret issued by the receiver", "No portable agent identity; the key can be copied"],
            ["OAuth 2.0 client credentials", "A registered client of one authorization server", "Scoped to that server's ecosystem; the client is not the operator"],
            ["Mutual TLS", "A connection from a holder of a certificate's private key", "Identity is whatever the certificate names; needs shared PKI"],
            ["HTTP Message Signatures / Web Bot Auth", "A request signed by a key published by a service", "Identifies the signing service, not a specific agent's declaration"],
            ["A2A Agent Card", "Describes an agent and its required auth schemes; cards may be signed", "The card is discovery metadata; authentication is delegated to the schemes it names"],
            ["Decentralized Identifiers", "Control of keys listed in a DID document", "Depends on the DID method; says nothing about operator accountability by itself"],
            ["AgenID v1.1.1", "An agent identity bound to an operator-signed manifest", "Does not bind a live request to the agent today (GAP-C1)"],
          ],
        },
      },
      {
        heading: "API keys and OAuth client credentials",
        body: [
          "The most common pattern today is also the simplest. The receiving service issues an API key or registers an OAuth 2.0 client, and the calling agent presents the key or obtains an access token through the client credentials grant defined in [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749#section-4.4). The receiver then knows the request comes from a registered client.",
          "This works well inside one ecosystem. Its limits appear across ecosystems. The credential is issued per receiver, so an agent that talks to fifty services holds fifty credentials and has fifty identities. A bearer token or API key authenticates whoever holds it, so a leaked credential is a working identity. And the client registered with the authorization server is often a platform, not the specific agent or the operator accountable for it.",
          "For delegation, [RFC 8693](https://www.rfc-editor.org/rfc/rfc8693) OAuth 2.0 Token Exchange defines an `act` claim that records which party is acting on behalf of another, which is one of the more mature ways to represent a delegation hop inside an OAuth deployment.",
        ],
      },
      {
        heading: "Mutual TLS",
        body: [
          "Mutual TLS has both sides of a connection present certificates, so the server authenticates the client at the transport layer. [RFC 8705](https://www.rfc-editor.org/rfc/rfc8705) extends this to OAuth, allowing clients to authenticate with certificates and binding access tokens to the client certificate so a stolen token cannot be replayed by someone else.",
          "mTLS gives strong proof that a connection comes from the holder of a private key. What identity that proves depends entirely on what the certificate names and who issued it. It works best where both parties already share a PKI, such as within an enterprise or a closed partner network, and is harder to use between agents that have never met. It authenticates the connection; any link from the certificate to a specific agent or operator is a policy decision of the issuing CA.",
        ],
      },
      {
        heading: "HTTP Message Signatures and Web Bot Auth",
        body: [
          "[RFC 9421](https://www.rfc-editor.org/rfc/rfc9421), HTTP Message Signatures, defines how to sign and verify components of an HTTP message, so authentication travels with the request rather than with the connection. That makes it usable through proxies and across hops where TLS terminates.",
          "[Web Bot Auth](/glossary/web-bot-auth) builds on it for automated traffic. Under the IETF webbotauth working group's [draft protocol](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/), a client signs requests with a key, names where its keys are published in a `Signature-Agent` header, and publishes a key directory at a well-known URI on its own domain. [Cloudflare's description](https://blog.cloudflare.com/web-bot-auth/) uses Ed25519 keys and signatures with a validity window. The draft is a working-group Internet-Draft, not a finished standard.",
          "This is request-level authentication, which is exactly what the simpler patterns lack. What it identifies is the service that controls the signing key and its domain. It does not, by itself, carry a signed declaration of which agent is acting, who operates it or what it says it is for.",
        ],
      },
      {
        heading: "A2A Agent Cards",
        body: [
          "The [Agent2Agent protocol](https://a2a-protocol.org/latest/specification/) has each agent publish an Agent Card, a JSON document describing its skills, endpoints and the security schemes a caller must use, usually at `/.well-known/agent-card.json` on its domain. The specification lists API key, HTTP authentication, OAuth 2.0, OpenID Connect and mutual TLS schemes. Cards may be signed using JWS over RFC 8785 canonical JSON, so a caller can check that a card was not altered and came from the claimed provider.",
          "An Agent Card is discovery and negotiation metadata. It tells a caller how to authenticate, and a signed card tells it the card is intact. The authentication itself is performed by whichever scheme the card names. See [agent card](/glossary/agent-card) and the [A2A comparison](/compare/a2a-agent-cards) for how an AgenID identifier can sit alongside a card.",
        ],
      },
      {
        heading: "Decentralized Identifiers",
        body: [
          "[Decentralized Identifiers](https://www.w3.org/TR/did-1.0/), a W3C Recommendation since 2022, are URIs that resolve to a DID document listing keys and service endpoints. Proving control of a key in the document authenticates the controller of that DID, and verifiable credentials can then attach claims to it.",
          "DIDs are a general framework rather than one system. What a DID proves depends on its method, how the document is anchored and who controls updates. A DID alone says nothing about which organization is accountable for an agent; that comes from credentials issued about it. The [decentralized identifier](/glossary/decentralized-identifier) entry and the [DID comparison](/compare/decentralized-identifiers) cover the relationship to AgenID.",
        ],
      },
      {
        heading: "Where does AgenID fit, and what is its boundary today?",
        body: [
          "AgenID authenticates an object, not a request. Protocol v1.1.1 gives an agent a permanent identifier and binds it to a manifest its operator signed with an Ed25519 key. Any relying party can resolve the identifier, recompute the manifest digest, verify the signature and fetch the operator key from both the registry and the operator's own domain. That answers which agent this is and which operator key declared it, independently of AgenID's registry. The steps are in [how to verify an AI agent](/learn/how-to-verify-an-ai-agent).",
          "It does not answer whether the live request in front of you came from that agent. AgenID's own security gap analysis records this as GAP-C1: nothing binds a live HTTP request to a registered agent identity, and there is no proof-of-possession, request signing, nonce or challenge in the protocol. A signed ManifestProof is public; anyone who has seen it can present it. Replay is bounded only by the proof's validity window (GAP-C2).",
          "A challenge-response step, in which the relying party sends a fresh nonce and the agent signs it with its operator key, is a natural way to close that gap. It is a proposed pattern and is not specified in v1.1.1. Some AgenID scenario illustrations show such a challenge to explain the idea; it should be read as the model, not as a deployed feature. Until the protocol defines one, combine AgenID with a request-level mechanism such as HTTP Message Signatures or mTLS, and check that the key or domain on the request matches the operator identity you verified.",
          CEILING,
        ],
      },
      {
        heading: "How do delegation chains and audit work across agents?",
        body: [
          "Delegation is where authentication gets hard. A user's assistant hands a trip to a travel agent, which hands a seat hold to an airline agent and settlement to a payment agent. Each hop is an authentication decision and an authorization decision, and afterwards someone may need to reconstruct who did what. The [agent delegation](/how-it-works/agent-delegation) scenario and the [agent delegation](/glossary/agent-delegation) entry walk through it.",
          "A persistent, resolvable identity at every hop makes the chain attributable: each participant is named by an identifier anyone can re-check, so the record does not depend on one party's logs. What an identity alone does not express is scope: how far a delegation reaches, what each agent may do and when that authority ends.",
          IDENTITY_NOT_PERMISSION + " The draft adds a principal key role, a signed grant naming scopes and a validity window, and a signed revocation, all verifiable offline. It is not normative and nothing in the deployed registry stores or serves grants.",
        ],
      },
      {
        heading: "How should you combine these patterns?",
        body: [
          "No single mechanism covers the connection, the agent and the operator at once. A layered approach uses each for what it proves.",
        ],
        bullets: [
          "Transport and request: use TLS everywhere, and add mTLS or HTTP Message Signatures so each request is tied to a key the caller holds.",
          "Agent identity: resolve and re-verify a persistent identifier such as an AgenID, and record the envelope you checked.",
          "Binding: check that the request-level key or domain matches the operator identity you verified, for example the manifest's `operator_domain`.",
          "Assurance: read the verification level for what it is. Today that is L1_REGISTERED at most, a self-declaration.",
          "Permission: apply your own policy, scoped to the verified identity, and keep it separate from authentication. What the agent is allowed to do is your decision.",
          "Audit: log the identifier, the envelope, the request signature and the decision, so the chain can be reconstructed later.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is agent-to-agent authentication?",
        a: "It is how one AI agent establishes the identity of another before exchanging data or delegating work, using mechanisms such as API keys, OAuth, mTLS, HTTP Message Signatures, signed agent descriptions or verifiable agent identities.",
      },
      {
        q: "Is an API key enough to authenticate an AI agent?",
        a: "It authenticates possession of a secret issued by one service. It does not give the agent a portable identity, and anyone holding the key can use it. It is often adequate inside one ecosystem and weak across organizations.",
      },
      {
        q: "Does AgenID authenticate HTTP requests?",
        a: "Not in v1.1.1. AgenID binds an agent identity to an operator-signed manifest that anyone can re-verify. Nothing in the protocol binds a live request to a registered agent today; the gap analysis records this as GAP-C1. Combine it with a request-level mechanism.",
      },
      {
        q: "How does Web Bot Auth relate to AgenID?",
        a: "Web Bot Auth signs individual HTTP requests with a key published by the sending service, so it authenticates requests. AgenID provides a persistent agent identity with an operator-signed declaration. The two answer different questions and can be used together.",
      },
      {
        q: "What does an A2A Agent Card authenticate?",
        a: "The card itself is discovery metadata listing an agent's skills, endpoints and required security schemes. A signed card shows the card is intact and came from its provider. Authentication of requests is done by the schemes the card names.",
      },
      {
        q: "Is challenge-response part of the AgenID protocol?",
        a: "No. A challenge in which the agent signs a fresh nonce is a proposed pattern for binding a request to an identity. It is not specified in v1.1.1, and scenario illustrations that show it describe the model rather than a deployed feature.",
      },
      {
        q: "Does authenticating an agent mean it is allowed to act?",
        a: IDENTITY_NOT_PERMISSION,
      },
    ],
    related: ["/how-it-works/agent-delegation", "/glossary/agent-to-agent-authentication", "/glossary/web-bot-auth", "/compare/a2a-agent-cards", "/learn/how-to-verify-an-ai-agent", "/compare/decentralized-identifiers"],
    sources: [
      { label: "RFC 9421: HTTP Message Signatures", url: "https://www.rfc-editor.org/rfc/rfc9421" },
      { label: "IETF webbotauth WG: HTTP Message Signatures for automated traffic (Internet-Draft)", url: "https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/" },
      { label: "Cloudflare: Forget IPs, using cryptography to verify bot and agent traffic", url: "https://blog.cloudflare.com/web-bot-auth/" },
      { label: "RFC 8705: OAuth 2.0 Mutual-TLS Client Authentication and Certificate-Bound Access Tokens", url: "https://www.rfc-editor.org/rfc/rfc8705" },
      { label: "RFC 6749: The OAuth 2.0 Authorization Framework, client credentials grant", url: "https://www.rfc-editor.org/rfc/rfc6749#section-4.4" },
      { label: "RFC 8693: OAuth 2.0 Token Exchange", url: "https://www.rfc-editor.org/rfc/rfc8693" },
      { label: "Agent2Agent (A2A) Protocol Specification", url: "https://a2a-protocol.org/latest/specification/" },
      { label: "W3C Decentralized Identifiers (DIDs) v1.0", url: "https://www.w3.org/TR/did-1.0/" },
    ],
    updated: "2026-09-23",
  },
];
