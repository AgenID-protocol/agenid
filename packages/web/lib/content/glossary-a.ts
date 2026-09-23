import type { GlossaryTerm } from "./types";

/**
 * Glossary, part A: seventeen DefinedTerm pages for /glossary/<slug>.
 *
 * Grounded in AgenID v1.1.1 (+ errata E1, E2) and PROJECT_STATE.md. Anything above
 * L1_REGISTERED is described as the model and carries the issuance ceiling beside it.
 */

const UPDATED = "2026-09-23";

const SPEC_SOURCE = {
  label: "AgenID protocol specification (public repository)",
  url: "https://github.com/AgenID-protocol/spec",
} as const;

export const GLOSSARY_A: readonly GlossaryTerm[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "ai-agent-identity",
    term: "AI agent identity",
    category: "Identity",
    alsoKnownAs: ["agent identity", "AI agent ID"],
    title: "What Is AI Agent Identity? A Plain Definition",
    description:
      "AI agent identity is a checkable answer to which agent is acting and who answers for it. See how AgenID builds it from signed, re-verifiable records.",
    h1: "AI agent identity: which agent is acting, and who stands behind it",
    keywords: ["AI agent identity", "agent identity", "verify AI agent", "AI agent ID", "agent identity protocol"],
    definition:
      "AI agent identity is a persistent, checkable answer to two questions about software acting in the world: which agent is this, and which accountable party stands behind it. In AgenID it is a permanent identifier backed by an operator-signed manifest that anyone can re-verify.",
    lead: [
      "When an AI agent calls a business, places an order or messages another agent, the other side usually has only what the agent says about itself: a name, a voice, a claimed employer. Any agent can produce those. AI agent identity replaces the claim with something the other side can check for itself.",
      "AgenID is an open protocol for that layer. It gives each agent an [AgenID identifier](/glossary/agenid-identifier), binds it to an [agent manifest](/glossary/agent-manifest) the operator signs, and publishes the result so any [relying party](/glossary/relying-party) can resolve and re-verify it without an account or a relationship with AgenID.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "An operator registers an agent at [/issue](/issue). The browser generates an Ed25519 key, signs a proof over the manifest and sends only public material. Anyone can then resolve the identifier at `/a/<agenid>`: a browser gets a Verification Card, and a client asking for JSON gets the [resolution envelope](/glossary/resolution-envelope), which a verifier re-checks offline. The registry cannot forge an operator signature, so it does not need to be believed.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Accounts and API keys prove something to one service. An agent identity travels: the same identifier works on every platform the agent uses, so history attaches to the agent rather than to a login. It also gives accountability a name, because the manifest records the [agent operator](/glossary/agent-operator) and a contact. The [why identity walkthrough](/how-it-works/why-identity) shows the difference in a single phone call.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Identity is not permission. Which agent is acting is a different question from what it is allowed to do, and AgenID v1.1.1 defines no signed authorization object. Identity is not a safety rating either: an identified agent can still behave badly. Today the reference registry issues L1_REGISTERED at most, a registered self-declaration; anything higher needs a root authority key that has not been created yet.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is AI agent identity the same as authentication?",
        a: "Related, but different. Authentication usually proves a live request came from a key holder. AgenID today identifies the agent and its operator through signed records; binding a live HTTP request to a registered agent is planned, not deployed.",
      },
      {
        q: "Do I need to trust AgenID to check an agent's identity?",
        a: "No. You re-verify the signature yourself from the envelope, and you can compare the operator key with the copy on the operator's own domain using [two-path key discovery](/glossary/two-path-key-discovery).",
      },
      {
        q: "How do I get an identity for my agent?",
        a: "Register it at [/issue](/issue). It takes about a minute, the signing key stays in your browser, and you can check the result at [/verify](/verify).",
      },
    ],
    related: ["/learn/how-to-verify-an-ai-agent", "/how-it-works/why-identity", "/issue", "/glossary/agenid-identifier", "/glossary/declared-verified-authorized"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "know-your-agent",
    term: "Know Your Agent (KYA)",
    category: "Policy and regulation",
    alsoKnownAs: ["KYA"],
    title: "What Is Know Your Agent (KYA)?",
    description:
      "Know Your Agent (KYA) is an emerging term for vetting AI agents before they act. Learn what it covers and how AgenID serves as an open identity layer for it.",
    h1: "Know Your Agent (KYA): vetting AI agents before they act",
    keywords: ["know your agent", "KYA", "KYA AI agents", "agent due diligence", "AI agent verification program"],
    definition:
      "Know Your Agent (KYA) is an emerging industry term for the checks a business runs before letting an AI agent act on its systems: which agent it is, who operates it and what it may do. It borrows its shape from Know Your Customer programs in finance.",
    lead: [
      "As agents start to book, buy and negotiate, businesses face the question banks faced with customers: who am I dealing with? Several vendors now use the term Know Your Agent for products and programs that answer it, and their definitions vary. What they share is a need for an identity signal that holds up under scrutiny.",
      "AgenID is not a KYA program. It is an open identity layer a KYA program can build on: a permanent identifier, an operator-signed manifest, and records any party can re-verify without trusting the registry that served them.",
    ],
    sections: [
      {
        heading: "Where AgenID fits in a KYA program",
        body: [
          "A KYA check typically needs three inputs. First, a stable identifier to attach decisions to, which AgenID provides as `agenid:<ULID>`. Second, an accountable party, which the [agent manifest](/glossary/agent-manifest) names along with an operator domain and contact. Third, evidence about that party, which AgenID models as a [verification assertion](/glossary/verification-assertion) scoped to one claim. A program resolves the agent at [/verify](/verify), re-checks the signature and applies its own policy.",
        ],
      },
      {
        heading: "What exists today",
        body: [
          "Registration, resolution, the Verification Card and badges are live at agenid.com. The reference registry issues nothing above L1_REGISTERED, a registered self-declaration. L2 domain verification and higher require a VerificationAssertion signed by a root authority key, and that key has not been created yet. Operators can already record domain-control evidence at [/verify/domain](/verify/domain); that evidence raises nothing above L1.",
        ],
      },
      {
        heading: "What a KYA program still decides",
        body: [
          "Identity is one input. Which agent is acting is a different question from what it is allowed to do, and v1.1.1 defines no signed permission object; a v1.2 authorization layer is a draft in development. Risk scoring, limits and policy stay with the business running the program. The [KYA guide](/learn/know-your-agent-kya) shows how the pieces fit.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is KYA a standard?",
        a: "Not today. It is an industry term used in different ways by different vendors. AgenID is an open protocol with a public [specification](https://github.com/AgenID-protocol/spec) that a KYA program can adopt as its identity layer.",
      },
      {
        q: "Does an AgenID identity pass a KYA check on its own?",
        a: "No. It gives the check something reliable to inspect. Whether that is enough is the relying business's policy decision.",
      },
      {
        q: "Does KYA with AgenID require sharing private keys?",
        a: "No. Operator keys are generated in the browser or with the CLI and are never sent to the registry.",
      },
    ],
    related: ["/learn/know-your-agent-kya", "/verify", "/glossary/ai-agent-identity", "/glossary/verification-level", "/how-it-works/financial-transaction"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agenid-identifier",
    term: "AgenID identifier",
    category: "Identity",
    alsoKnownAs: ["agent_id"],
    title: "What Is an AgenID Identifier? Format and Rules",
    description:
      "An AgenID identifier is the permanent, non-semantic name of an AI agent: agenid: plus a 26-character ULID. See its format, rules and what it does not tell you.",
    h1: "The AgenID identifier: a permanent name for an AI agent",
    keywords: ["AgenID identifier", "agenid ULID", "AI agent identifier", "agent_id", "permanent agent ID"],
    definition:
      "An AgenID identifier is the permanent, non-semantic name of an AI agent in the AgenID protocol, written `agenid:` followed by a 26-character ULID. It is assigned once, never reissued and never re-keyed when the agent changes platform.",
    lead: [
      "Every registered agent has exactly one identifier, of the form `agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC` (an illustrative value). It is the handle everything else hangs from: the manifest, the operator's proof, any verification assertions and the public Verification Card.",
      "The identifier deliberately carries no meaning. It does not encode the operator, the platform or the agent's name, so none of those can be read into it or spoofed through it.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The grammar is fixed: `^agenid:[0-9A-HJKMNP-TV-Z]{26}$`, where the tail is a [ULID](/glossary/ulid) in Crockford base32. Registration checks uniqueness before commit. Related namespaces follow the same pattern: keys are `agenid:key:<ULID>` with their own ULID, and authorities are `agenid:authority:<node>`. Resolve any agent at `https://www.agenid.com/a/<agenid>` for the Verification Card, or ask for JSON to get the resolution envelope.",
          "The same identifier appears everywhere the agent is presented: on the Verification Card, in the JSON envelope, in the [badge](/badge) embed and in the shield image at `/badge/<agenid>/shield.svg`. A relying party that records it can resolve the agent again later and see the same subject, whatever platform the agent was using at the time.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Platform IDs belong to platforms. An agent that moves between voice providers would lose its history if its identity were the provider's ID. The specification forbids using a platform-native ID as, or inside, an AgenID identifier, and a deployment gets its own separate identifier, so the agent's identity survives migration. The [agent delegation scenario](/how-it-works/agent-delegation) shows why a stable handle matters when agents act for each other.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Holding an identifier says nothing about trustworthiness and nothing about what the agent is allowed to do. It names the subject; the signed manifest and any assertions are what a verifier evaluates. Malformed identifiers are rejected with `invalid_identifier` rather than guessed at.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can an identifier be transferred or reused?",
        a: "No. It is immutable for the life of the record and is never reissued to another agent.",
      },
      {
        q: "Where do I get one?",
        a: "Register at [/issue](/issue). The identifier is part of what you sign, and you can look it up afterwards at [/verify](/verify).",
      },
      {
        q: "Is the identifier secret?",
        a: "No. It is public by design. Security rests on the operator's private key, not on the identifier being hidden.",
      },
    ],
    related: ["/glossary/ulid", "/glossary/resolution-envelope", "/issue", "/verify", "/how-it-works/agent-delegation"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "ulid",
    term: "ULID",
    category: "Identity",
    alsoKnownAs: ["Universally Unique Lexicographically Sortable Identifier"],
    title: "What Is a ULID? Sortable IDs for AI Agents",
    description:
      "A ULID is a 128-bit, time-sortable identifier written as 26 Crockford base32 characters. Learn how AgenID uses ULIDs for agent and key identifiers.",
    h1: "ULID: the sortable identifier behind every AgenID",
    keywords: ["ULID", "ULID spec", "Crockford base32", "sortable unique identifier", "ULID vs UUID"],
    definition:
      "A ULID (Universally Unique Lexicographically Sortable Identifier) is a 128-bit identifier made of a 48-bit millisecond timestamp and 80 bits of randomness, written as 26 Crockford base32 characters. AgenID uses ULIDs for agent and key identifiers.",
    lead: [
      "ULIDs solve a practical problem: identifiers that are unique without a central counter, safe to put in a URL, and sortable by creation time. The format is defined in the public [ULID specification](https://github.com/ulid/spec).",
      "In AgenID, every agent is `agenid:<ULID>`, and every [operator key](/glossary/operator-key) has its own ULID, written `agenid:key:<ULID>` inside signed payloads and as the bare ULID in HTTP paths.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The first 10 characters encode the timestamp and the last 16 the randomness. Crockford base32 omits I, L, O and U, which avoids look-alike characters and makes every character path-safe. That is why a key can be fetched at `https://www.agenid.com/v1/keys/<key-ulid>` with no escaping. The registry still checks uniqueness before committing a new identifier rather than relying on collision resistance alone.",
          "Because ULIDs sort by time, a list of identifiers ordered as text is also ordered by creation, which keeps [registry](/learn/ai-agent-registry) indexes and logs readable without a separate timestamp column.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "An earlier draft of the specification named keys with a URI fragment, which HTTP never sends to a server, so keys collided. Giving each key its own ULID fixed that. ULIDs are also non-semantic: they carry no operator name or platform, so an [AgenID identifier](/glossary/agenid-identifier) cannot be forged by guessing a meaningful pattern or confused with a platform's own ID.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A ULID is a name, not a credential. It proves nothing about who created it and grants no permission; what an agent is allowed to do is a separate question the identifier does not answer. Because the leading characters are a timestamp, a ULID also reveals roughly when it was generated, which is public by design in AgenID.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a ULID the same as a UUID?",
        a: "Both are 128 bits. A ULID sorts by creation time and uses a shorter base32 text form; a random UUID does not sort.",
      },
      {
        q: "Can two agents get the same ULID?",
        a: "The 80 random bits make it vanishingly unlikely, and AgenID also checks uniqueness at registration.",
      },
      {
        q: "Do I generate the ULID myself?",
        a: "The flow at [/issue](/issue) produces it before signing, because the identifier is part of what the operator signs. Check any identifier at [/verify](/verify).",
      },
    ],
    related: ["/glossary/agenid-identifier", "/glossary/operator-key", "/issue", "/verify", "/learn/ai-agent-registry"],
    sources: [{ label: "ULID specification", url: "https://github.com/ulid/spec" }, SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agent-manifest",
    term: "Agent manifest",
    category: "Identity",
    alsoKnownAs: ["manifest"],
    title: "What Is an Agent Manifest? AgenID's Declaration",
    description:
      "An agent manifest is the operator's signed-by-digest self-declaration about an AI agent: identity, ownership, purpose and disclosure. See what it covers.",
    h1: "The agent manifest: an operator's declaration about its AI agent",
    keywords: ["agent manifest", "AI agent manifest", "AgenID manifest", "agent self-declaration", "AI disclosure attestation"],
    definition:
      "An agent manifest is the operator's canonical-JSON self-declaration about an AI agent: its identity, its accountable operator, its purpose and how it discloses itself. In AgenID the manifest is never signed directly; a ManifestProof binds it by SHA-256 digest.",
    lead: [
      "The manifest is what a relying party reads when it asks who an agent is. It is plain JSON with a strict schema: a version, the `agent_id`, and four groups of fields.",
      "Everything in it is DECLARED. It is what the operator says about its own agent, bound by signature so it cannot change without detection, but not checked by anyone else.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The schema rejects unknown members. The [manifest digest](/glossary/manifest-digest) is SHA-256 over its RFC 8785 canonical bytes, and the [ManifestProof](/glossary/manifest-proof) signs that digest. The four groups are fixed:",
        ],
        bullets: [
          "`identity`: the agent's `name` and `description`.",
          "`ownership`: `operator`, `operator_domain` and `contact`.",
          "`purpose`: a `summary` and its `channels` (voice, sms, chat, email or api).",
          "`disclosure`: `is_ai`, `discloses_to_user` and `human_escalation`.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "The disclosure attestations describe real behavior that no API can discover, so AgenID requires the operator to set them explicitly; the flow at [/issue](/issue) starts them at false rather than pre-checking them. A defaulted attestation would be a fabricated claim under a real signature. Binding by digest also means any edit, even one flipped boolean, fails verification with `manifest_digest_mismatch`.",
          "The `purpose` and `channels` fields tell a relying party what the agent says it is for, which is useful context when a call or message arrives on an unexpected channel. A scheduling agent that turns up on email is not proof of misuse, but it is a fair question to put to the operator.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Operator attestations are self-declared and unverifiable by anyone, including AgenID. The keys `permissions` and `authorizations` are reserved and rejected in v1.1.1, so a manifest cannot state what the agent is allowed to do. It describes the agent; it grants nothing.",
        ],
      },
    ],
    faqs: [
      {
        q: "What happens if the manifest changes?",
        a: "It produces a different digest, so it needs a new ManifestProof. A verification assertion bound to the old digest no longer applies to the new version.",
      },
      {
        q: "Is the manifest public?",
        a: "Yes. It appears in the resolution envelope and on the Verification Card, so keep secrets and private data out of it. The [onboarding guide](/docs/onboarding) covers each field.",
      },
      {
        q: "Why not sign the manifest directly?",
        a: "Binding by digest keeps the manifest freely cacheable and lets several signed objects reference one version without re-signing it.",
      },
    ],
    related: ["/glossary/manifest-proof", "/glossary/manifest-digest", "/issue", "/docs/onboarding", "/how-it-works/dentist-appointment"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "manifest-proof",
    term: "ManifestProof",
    category: "Cryptography",
    alsoKnownAs: ["manifest self-declaration proof"],
    title: "What Is a ManifestProof? The Operator's Signature",
    description:
      "A ManifestProof is the operator-signed object binding an AgenID identifier to one manifest version by digest. See its fields, checks and limits.",
    h1: "ManifestProof: how an operator signs for its AI agent",
    keywords: ["ManifestProof", "manifest proof", "operator signature", "AgenID proof", "signed agent manifest"],
    definition:
      "A ManifestProof is the operator-signed object that binds an AgenID identifier to one version of its manifest by SHA-256 digest. It is signed with an operator-role Ed25519 key and can only ever produce the DECLARED claim state.",
    lead: [
      "The manifest says what the operator declares. The ManifestProof makes that declaration tamper-evident: the operator signs a small payload naming the agent, the manifest version and the manifest's digest.",
      "It is one of the two signed objects in AgenID v1.1.1. The other is the [verification assertion](/glossary/verification-assertion), signed by an authority. Keeping them separate stops one key role from speaking for the other.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The payload carries `$schema`, `proof_type` (always `manifest_self_declaration`), `agent_id`, `manifest_version`, `manifest_digest`, `key_id`, `created_at` and `expires_at`. The signing input is the [RFC 8785](/glossary/rfc-8785-jcs) canonical bytes of that payload without `signature`, `$schema` included, signed with pure [Ed25519](/glossary/ed25519) and carried as base64url.",
          "A verifier recomputes the manifest digest first, then resolves `key_id`, requires `role` operator with `controller` equal to the agent, checks the time window, and only then checks the signature.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Because anyone can verify the proof, the registry that stores it cannot alter it unnoticed. Registration at [/issue](/issue) rejects a tampered manifest, a wrong key, an authority-role key and a replay before anything is stored.",
          "The time window matters too. `expires_at` is checked independently of the key's status, so an old proof cannot be presented indefinitely, and the registry bounds how far into the future a new proof's `created_at` may sit. Everything is re-derivable from the signed object, the manifest and the key document, so a verifier needs nothing from AgenID's database.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A valid ManifestProof shows who signed and what they declared. It does not make any statement true, and it cannot produce VERIFIED; that needs an authority. Nor does it say what the agent is allowed to do: AUTHORIZED has no signed object in v1.1.1.",
        ],
      },
    ],
    faqs: [
      {
        q: "Who can create a ManifestProof?",
        a: "Only the holder of the operator private key. AgenID never holds it; the key is generated in your browser or with the CLI.",
      },
      {
        q: "What happens when a proof expires?",
        a: "Verification fails outside the `created_at` to `expires_at` window. Re-attestation issues a new proof rather than changing the old one.",
      },
      {
        q: "Can I check a proof myself?",
        a: "Yes. Resolve the agent at [/verify](/verify) and re-run the checks offline against the envelope, as the [verification guide](/learn/how-to-verify-an-ai-agent) describes.",
      },
    ],
    related: ["/glossary/agent-manifest", "/glossary/operator-key", "/issue", "/verify", "/learn/how-to-verify-an-ai-agent"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "manifest-digest",
    term: "Manifest digest",
    category: "Cryptography",
    alsoKnownAs: ["manifest_digest"],
    title: "What Is a Manifest Digest? SHA-256 Binding",
    description:
      "A manifest digest is the SHA-256 hash of an agent manifest's canonical bytes. It binds every AgenID signature to exactly one version of the manifest.",
    h1: "Manifest digest: binding a signature to one manifest version",
    keywords: ["manifest digest", "manifest_digest", "SHA-256 manifest hash", "digest binding", "AgenID digest"],
    definition:
      "A manifest digest is the SHA-256 hash of an agent manifest's RFC 8785 canonical bytes, recorded as `manifest_digest` inside AgenID's signed objects. It binds each signature to exactly one version of the manifest.",
    lead: [
      "AgenID never signs the manifest itself. Both signed objects, the operator's ManifestProof and an authority's verification assertion, carry the manifest's digest as a data value instead. Change one character of the manifest and the digest no longer matches.",
      "The field holds an algorithm, `sha-256`, and a 64-character hex value. It is the only SHA-256 in the protocol; the signatures themselves are pure Ed25519 over canonical bytes.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "Canonicalize the manifest with [RFC 8785](/glossary/rfc-8785-jcs), hash the UTF-8 bytes with SHA-256 and encode the result as lowercase hex. Canonicalization matters: the same content in a different member order produces identical bytes and the same digest. A verifier recomputes the digest before any signature math, and a mismatch fails with `manifest_digest_mismatch`.",
          "The specification's worked example produces a digest any reader can reproduce with a conformant library, which is how implementers confirm their canonicalization before signing anything real. The [verification guide](/learn/how-to-verify-an-ai-agent) walks through the same check on a live agent.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "The digest stops an old verification being reused against a new claim. A [verification assertion](/glossary/verification-assertion) names the digest it was issued for; if the operator edits the manifest, the assertion stays validly signed but is reported as `assertion_not_applicable_to_current_manifest`, which is precise rather than alarming. It also lets many signed objects point at one manifest without re-signing it. On the Verification Card, the digest is what connects the manifest you read to the signature beneath it.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A matching digest shows the manifest is the one that was signed. It says nothing about whether its contents are true, or about what the agent is allowed to do. Assertions that would reuse it need a root authority key that has not been created yet, so today the digest is bound only by the operator's [ManifestProof](/glossary/manifest-proof), at up to L1_REGISTERED.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why hash the manifest instead of signing it?",
        a: "Binding by digest keeps the manifest plain, cacheable JSON and lets several signed objects reference the same version.",
      },
      {
        q: "Can I compute the digest myself?",
        a: "Yes. Any RFC 8785 implementation plus SHA-256 reproduces it. The [specification](https://github.com/AgenID-protocol/spec) includes a worked vector, and the [conformance suite](https://github.com/AgenID-protocol/conformance) checks implementations against it.",
      },
      {
        q: "Where do I see an agent's digest?",
        a: "In the resolution envelope from `/a/<agenid>` with `Accept: application/json`, or through [/verify](/verify).",
      },
    ],
    related: ["/glossary/agent-manifest", "/glossary/rfc-8785-jcs", "/verify", "/learn/how-to-verify-an-ai-agent", "/how-it-works/insurance-claim"],
    sources: [{ label: "RFC 8785: JSON Canonicalization Scheme", url: "https://www.rfc-editor.org/rfc/rfc8785" }, SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agent-operator",
    term: "Agent operator",
    category: "Identity",
    alsoKnownAs: ["operator"],
    title: "What Is an Agent Operator? Who Answers for an AI",
    description:
      "An agent operator is the entity accountable for an AI agent. In AgenID it holds the signing key and is named in the manifest. See what that does and does not mean.",
    h1: "Agent operator: the party accountable for an AI agent",
    keywords: ["agent operator", "AI agent operator", "who operates an AI agent", "AI agent accountability", "operator domain"],
    definition:
      "An agent operator is the legal or operational entity accountable for an AI agent. In AgenID the operator holds the signing key, signs the agent's manifest and is named in it; it is never simply the platform that hosts the agent.",
    lead: [
      "When something goes wrong with an agent, the first question is who answers for it. The operator is that party: the company or person that runs the agent and puts its name to the manifest.",
      "The distinction from the hosting platform is deliberate. A voice or model platform may run the agent's code, but the business that deploys it is the one accountable, and the one whose identity travels with the agent across platforms.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The manifest's `ownership` group records the `operator` name, an `operator_domain` and a `contact`. The operator generates an [operator key](/glossary/operator-key) at [/issue](/issue) or with the CLI, signs the ManifestProof and registers; the registry never receives the private key. The operator can also publish its public key at `https://<operator_domain>/.well-known/agenid/keys.json`, giving verifiers a second, independent copy.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Naming an accountable party turns an anonymous agent into one a business can contact, complain about and decide whether to deal with. The [onboarding guide](/docs/onboarding) walks operators through registration, attestations and domain evidence.",
          "It also puts the operator's own domain on the record. A relying party can compare `operator_domain` with the business it thought it was dealing with, and the [sales outreach scenario](/how-it-works/sales-outreach) shows why that comparison matters when an agent calls on a company's behalf.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "The operator fields are self-declared. At L1_REGISTERED nobody, including AgenID, has checked that the named company exists or controls the domain. Those checks would be L2 and L3, and both require a VerificationAssertion signed by a root authority key, which has not been created yet. Evidence recorded at [/verify/domain](/verify/domain) raises nothing above L1. Being the operator also says nothing about what the agent is allowed to do for any given business.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the platform my agent runs on the operator?",
        a: "Usually not. The operator is whoever is accountable for the agent, and one platform can host many operators' agents.",
      },
      {
        q: "Can one operator run many agents?",
        a: "Yes, each with its own identifier. In v1.1.1 each operator key is bound to one agent; operator-level keys spanning many agents are reserved for a later version.",
      },
      {
        q: "What attestations does the operator make?",
        a: "Whether the agent is an AI, whether it discloses that to users and whether it can escalate to a human. Each must be set explicitly and starts at false.",
      },
    ],
    related: ["/docs/onboarding", "/glossary/operator-key", "/glossary/agent-manifest", "/verify/domain", "/how-it-works/sales-outreach"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "operator-key",
    term: "Operator key",
    category: "Keys and discovery",
    alsoKnownAs: ["operator-role key"],
    title: "What Is an Operator Key in AgenID?",
    description:
      "An operator key is the Ed25519 key pair an operator uses to sign for its AI agent. The private half never leaves the operator. See how it is published and checked.",
    h1: "Operator key: the key an operator signs its agent with",
    keywords: ["operator key", "AgenID operator key", "agent signing key", "Ed25519 key document", "key role operator"],
    definition:
      "An operator key is the Ed25519 key pair an agent operator uses to sign ManifestProofs. Its public half is published as a key document with `role` operator and a `controller` naming the agent; its private half never leaves the operator.",
    lead: [
      "The operator key is what makes an agent's manifest attributable. Whoever holds the private key can sign for the agent; everyone else can only verify.",
      "AgenID is built so the registry is never that holder. At [/issue](/issue) the key pair is generated in your browser and only public material is sent. The CLI writes the private key to a local file and does not print it.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "Each key has its own identifier, `agenid:key:<ULID>`. Its key document lists `key_type`, the base64url public key, `role`, `controller`, `created_at`, a `status`, and optional `retired_at` and `revoked_at`. In v1.1.1 the controller is the agent's identifier. Verifiers fetch it from the registry at `https://www.agenid.com/v1/keys/<key-ulid>` and, where the operator publishes one, from `https://<operator_domain>/.well-known/agenid/keys.json`.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Role is enforced at verification time, not just documented. A ManifestProof signed with an authority-role key is rejected even if the Ed25519 math validates, so an operator key can only produce DECLARED statements. That is the line between what an operator says and what an authority has checked; see [declared, verified and authorized](/glossary/declared-verified-authorized).",
          "Keeping the private key off the registry also limits what a registry breach could do. Someone who took over AgenID's database would hold public keys and signed records, none of which lets them sign a new manifest for your agent.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Holding the key proves control of the key, not honesty. No revocation flow is deployed today: the status values exist in the schema, and retired or revoked keys would stay resolvable so old signatures remain checkable, but nothing currently writes them. The key also signs identity claims only; it is not a credential for what the agent is allowed to do.",
        ],
      },
    ],
    faqs: [
      {
        q: "What if I lose my operator key?",
        a: "AgenID cannot recover it, because it never had it. Store the one-time download from [/issue](/issue) somewhere safe.",
      },
      {
        q: "Why publish the key on my own domain?",
        a: "It gives verifiers a second source to compare with the registry's copy; without it they have one source, not two. [Domain evidence](/verify/domain) reports whether your file parses.",
      },
      {
        q: "Can one key sign for several agents?",
        a: "Not in v1.1.1. The key's controller must equal the agent being signed for.",
      },
    ],
    related: ["/glossary/two-path-key-discovery", "/glossary/ed25519", "/issue", "/verify/domain", "/docs/onboarding", "/learn/how-to-verify-an-ai-agent"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "authority-key",
    term: "Authority key",
    category: "Keys and discovery",
    alsoKnownAs: ["authority-role key"],
    title: "What Is an Authority Key? Signing Verification",
    description:
      "An authority key is an Ed25519 key with the authority role, used to sign verification assertions. None exists yet. See how it would work and what it would not mean.",
    h1: "Authority key: the key that would sign what was checked",
    keywords: ["authority key", "verification authority", "AgenID authority", "key role authority", "verification assertion signing"],
    definition:
      "An authority key is an Ed25519 key with `role` authority, held by a verification authority and used to sign verification assertions. In AgenID no authority key has been created yet, so no assertion can be issued.",
    lead: [
      "An operator key signs what the operator declares. An authority key signs what someone else has checked: that a domain is controlled, that an organization matches its registration. The two roles never substitute for each other.",
      "This is the part of AgenID that turns DECLARED into VERIFIED. It is specified and testable in the protocol, and not yet operating in the reference deployment.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "A verification authority is named `agenid:authority:<node>`. Its key document declares `role` authority with the authority as `controller`, and is discoverable at the authority's own `/.well-known/agenid/keys.json`. A verifier checks a [verification assertion](/glossary/verification-assertion) against that key and must also decide whether it recognizes the authority; a valid signature from an unrecognized authority is `authority_untrusted`, not VERIFIED. The registry refuses an authority-role key at agent registration.",
          "Every assertion names the `key_id` that signed it, and an authority key follows the same lifecycle rules as an operator key: its own ULID, a status field, and resolvability for as long as signatures made with it need checking.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Separate roles stop self-verification. If one key could sign both the declaration and the check, an operator could vouch for itself. The model also admits authorities other than AgenID's own without a protocol change, so verification need not depend on a single vendor.",
        ],
      },
      {
        heading: "What it does not mean today",
        body: [
          "The reference deployment issues nothing above L1_REGISTERED. L2 and higher require a VerificationAssertion signed by a [root authority key](/glossary/root-authority-key), and that key has not been created yet, so L2, L3 and L4 describe the model rather than anything obtainable. Even when assertions exist, an authority's signature covers one claim in one scope; it says nothing about what the agent is allowed to do.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I become a verification authority?",
        a: "The model admits other authorities, but none is recognized today, and the authority registry is not published because the root key that would sign it does not exist.",
      },
      {
        q: "Why is there no authority key yet?",
        a: "Creating the trust root is an operational key ceremony that has not taken place. The [trust page](/trust) explains what is live.",
      },
      {
        q: "What can I do in the meantime?",
        a: "Register at [/issue](/issue) and record domain-control evidence at [/verify/domain](/verify/domain). That evidence raises nothing above L1.",
      },
    ],
    related: ["/glossary/root-authority-key", "/glossary/verification-assertion", "/trust", "/verify/domain", "/learn/how-to-verify-an-ai-agent"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "root-authority-key",
    term: "Root authority key",
    category: "Keys and discovery",
    alsoKnownAs: ["trust anchor", "AgenID root key"],
    title: "What Is the AgenID Root Authority Key?",
    description:
      "The root authority key is the trust anchor for every AgenID level above L1. It has not been created yet. See how it would work and why that matters today.",
    h1: "The root authority key: AgenID's trust anchor, not yet created",
    keywords: ["root authority key", "AgenID root key", "trust anchor", "key ceremony", "pinned root key"],
    definition:
      "The root authority key is the Ed25519 trust anchor at the top of AgenID's verification model: the key whose signature makes an assertion above L1_REGISTERED valid, and whose public value verifiers pin out of band. It has not been created yet.",
    lead: [
      "Every verification system has to start trust somewhere. In AgenID that starting point is a single root authority key, whose public value is to be published in the public [specification repository](https://github.com/AgenID-protocol/spec) and pinned by verifiers, so nobody has to rely only on TLS to agenid.com.",
      "The status is plain: the mechanism is specified and testable, and the key itself does not exist. That is why the reference deployment issues nothing above L1_REGISTERED today.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The specification defines an authority registry document at `/.well-known/agenid/authorities.json` on agenid.com, listing each recognized authority's domain and [authority key](/glossary/authority-key), signed by the root authority key. A verifier checks it over TLS and against the pinned root value; disagreement is `trust_anchor_mismatch`, a hard fail. That document is deliberately not published today, because a pin for a key that does not exist would be a false claim.",
          "The pin would live in the specification repository precisely because that channel is separate from the registry, so a verifier can compare the two.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "L2, L3 and L4 all require a VerificationAssertion signed by a root authority key; see [verification levels](/glossary/verification-level). Without it, AgenID can show that an operator signed a declaration but not that anyone checked it. The creation ceremony is gated on hardening the agenid.com zone and the GitHub organization first, because an attacker controlling either could publish a different pin without touching the key. Custody in a hardware security module is planned.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A root key would anchor verification, not permission: it would sign what was checked, never what an agent is allowed to do. v1.1.1 also has no delegation object, so the root would sign assertions directly; a v1.2 delegation design that narrows that exposure is a draft, not available.",
        ],
      },
    ],
    faqs: [
      {
        q: "When will the root authority key exist?",
        a: "No date is published. The ceremony has prerequisites that must close first, and the [trust page](/trust) tracks what is live.",
      },
      {
        q: "Does AgenID work without it?",
        a: "Yes, at L1_REGISTERED. Registration, resolution, the Verification Card and badges are live, and every signature is re-verifiable offline at [/verify](/verify).",
      },
      {
        q: "Why pin a key instead of relying on HTTPS?",
        a: "A verifier that relies only on TLS is relying on AgenID's infrastructure. Checking a pinned value as well is independent verification.",
      },
    ],
    related: ["/trust", "/glossary/authority-key", "/glossary/verification-level", "/learn/how-to-verify-an-ai-agent", "/verify"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "ed25519",
    term: "Ed25519",
    category: "Cryptography",
    alsoKnownAs: ["EdDSA (Ed25519)", "PureEdDSA"],
    title: "What Is Ed25519? Signatures for AI Agents",
    description:
      "Ed25519 is the RFC 8032 signature scheme AgenID uses for every proof and assertion. Learn how it signs canonical JSON and what a valid signature does not prove.",
    h1: "Ed25519: the signature scheme behind AgenID",
    keywords: ["Ed25519", "RFC 8032", "EdDSA", "Ed25519 signature", "AI agent signature"],
    definition:
      "Ed25519 is a public-key signature scheme, specified in RFC 8032, that uses the edwards25519 curve with 32-byte public keys and 64-byte signatures. AgenID signs every proof and assertion with pure Ed25519 over RFC 8785 canonical JSON.",
    lead: [
      "Ed25519 is widely used in SSH and software signing because it is fast, its keys and signatures are small, and signing is deterministic, so it does not depend on a fresh random number each time.",
      "AgenID uses it for both signed objects in the protocol: the operator's [ManifestProof](/glossary/manifest-proof) and an authority's [verification assertion](/glossary/verification-assertion).",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The signer removes `signature`, canonicalizes the rest with [RFC 8785](/glossary/rfc-8785-jcs) and passes those exact bytes to Ed25519. This is PureEdDSA: no Ed25519ph and no separate pre-hash of the payload. The 64-byte result is carried as base64url without padding, and public keys appear in key documents as `public_key_b64u`. The browser signer at [/issue](/issue) generates the key pair locally and never transmits the private key. With 32-byte keys and 64-byte signatures, a key document and proof fit comfortably in a resolution envelope.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Anyone with the public key can check a signature offline, so a verifier needs neither an account with AgenID nor faith in its registry. The registry can store an operator's signature but cannot forge one. The specification publishes executed test vectors, and the independent [conformance suite](https://github.com/AgenID-protocol/conformance) lets another implementation show it reproduces them byte for byte.",
          "Deterministic signing also keeps testing honest. The same key and the same canonical bytes always produce the same signature, so a published vector either reproduces exactly or it does not; there is no result that is merely close.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A valid signature proves the key holder signed these bytes. It does not prove the signed statements are true, it does not show the key had the right role (AgenID checks that separately), and it does not say what the agent is allowed to do.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why Ed25519 rather than ECDSA or RSA?",
        a: "Small keys, deterministic signatures and a single well-specified variant make independent re-implementation and byte-exact test vectors practical.",
      },
      {
        q: "Is anything hashed before signing?",
        a: "The manifest is bound by a SHA-256 digest inside the payload. The payload itself goes to Ed25519 unhashed.",
      },
      {
        q: "Can I verify an AgenID signature with a standard library?",
        a: "Yes. Any RFC 8032 Ed25519 implementation plus an RFC 8785 canonicalizer is enough. Try an agent at [/verify](/verify).",
      },
    ],
    related: ["/glossary/rfc-8785-jcs", "/glossary/manifest-proof", "/issue", "/verify", "/learn/how-to-verify-an-ai-agent"],
    sources: [
      { label: "RFC 8032: Edwards-Curve Digital Signature Algorithm (EdDSA)", url: "https://www.rfc-editor.org/rfc/rfc8032" },
      SPEC_SOURCE,
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "rfc-8785-jcs",
    term: "RFC 8785 (JSON Canonicalization Scheme)",
    category: "Cryptography",
    alsoKnownAs: ["JCS", "JSON Canonicalization Scheme"],
    title: "What Is RFC 8785 (JCS)? Canonical JSON Explained",
    description:
      "RFC 8785, the JSON Canonicalization Scheme, gives any JSON value one exact byte form. See why AgenID canonicalizes everything it hashes or signs with it.",
    h1: "RFC 8785 (JCS): one exact byte form for signed JSON",
    keywords: ["RFC 8785", "JSON Canonicalization Scheme", "JCS", "canonical JSON", "signing JSON"],
    definition:
      "RFC 8785, the JSON Canonicalization Scheme (JCS), defines one exact byte serialization for any JSON value, with sorted members, fixed number formatting and no insignificant whitespace. AgenID canonicalizes every hashed or signed object with it.",
    lead: [
      "Signatures work on bytes, and JSON can express the same data many ways: member order, spacing, escapes and number formats all vary between libraries. Without a canonical form, a verifier could compute different bytes from the signer and reject a valid signature, or two parties could disagree about what was signed.",
      "JCS removes that ambiguity. It is published by the IETF as [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785).",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "Canonicalization runs on a parsed data structure, never by patching serialized text. Members are sorted by UTF-16 code units, non-ASCII text is emitted as raw UTF-8, strings escape only quotation marks, backslashes and control characters, and numbers follow ECMAScript formatting, so `1.0` becomes `1`. AgenID adds one rule: NaN, infinity and integer literals above 2^53 minus 1 are rejected as `invalid_number_domain`, and no schema field is a number at all. The canonical bytes feed both the [manifest digest](/glossary/manifest-digest) and the [Ed25519](/glossary/ed25519) signing input.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "It is what makes a signature independently re-verifiable. The specification publishes adversarial vectors for numbers, Unicode, sort order and empty values; the browser signer at [/issue](/issue) uses its own independent JCS implementation; and the public [conformance suite](https://github.com/AgenID-protocol/conformance) lets any other implementation check itself.",
          "Without JCS, an innocent difference such as one library writing `1.0` where another writes `1` would change the bytes and break the signature. With it, a verifier in any language reconstructs the exact input the signer used, which is the precondition for checking anything offline.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Canonical bytes make agreement about what was signed possible; they say nothing about whether it is true. Canonicalization is also not a permission mechanism: it fixes what a statement says, not what an agent is allowed to do. Nor is it encryption: canonical JSON is readable by anyone.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is JCS the same as sorting keys before JSON.stringify?",
        a: "No. Sorting alone misses number formatting, string escaping and UTF-16 ordering, which is where implementations diverge.",
      },
      {
        q: "Is the signature member canonicalized too?",
        a: "No. `signature` is removed first. Including it in the input is a verification failure.",
      },
      {
        q: "Where are AgenID's canonicalization test vectors?",
        a: "In section 8 of the public [specification](https://github.com/AgenID-protocol/spec). You can also check a live agent at [/verify](/verify).",
      },
    ],
    related: ["/glossary/ed25519", "/glossary/manifest-digest", "/verify", "/learn/how-to-verify-an-ai-agent", "/docs/onboarding"],
    sources: [{ label: "RFC 8785: JSON Canonicalization Scheme (JCS)", url: "https://www.rfc-editor.org/rfc/rfc8785" }, SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "verification-level",
    term: "Verification level",
    category: "Verification",
    alsoKnownAs: ["trust level"],
    title: "What Is a Verification Level? L1 to L5 Explained",
    description:
      "AgenID verification levels say exactly how an AI agent's identity was checked. See each level, what it means, and why nothing above L1 is issued today.",
    h1: "Verification levels: how carefully an agent's identity was checked",
    keywords: ["verification level", "AI agent trust level", "L1_REGISTERED", "L2 domain verified", "agent verification levels"],
    definition:
      "A verification level is AgenID's label for how an agent's identity was checked, from a registered self-declaration (L1_REGISTERED) up through domain, organization and deployment checks. Levels above L1 are expressed as signed verification assertions.",
    lead: [
      "A level tells a relying party exactly what was checked, and nothing more. It is a property of an assertion; status, such as ACTIVE, is a separate property of the agent.",
      "The honest summary: the reference deployment at agenid.com issues nothing above L1_REGISTERED today. L2 and higher require a VerificationAssertion signed by a root authority key, and that key has not been created yet.",
    ],
    sections: [
      {
        heading: "The levels in AgenID v1.1.1",
        body: [
          "Each level has a fixed claim type and evidence type, and covers only its own claim and scope.",
          "L1_REGISTERED is where every agent starts: a signed declaration the registry has accepted and anyone can re-verify. The step up to L2 is domain control, the one check whose evidence a third party can re-derive for itself. L3 waits on a written evidence standard and L4 on a deployment sampling method that does not exist yet.",
        ],
        table: {
          columns: ["Level", "What was checked", "Issued today"],
          rows: [
            ["DECLARED", "An operator signed a manifest; not registered", "Yes"],
            ["L1_REGISTERED", "The signed manifest is registered; still a self-declaration", "Yes, the ceiling"],
            ["L2_DOMAIN_VERIFIED", "The operator controls a domain, via DNS", "No"],
            ["L3_ORGANIZATION_VERIFIED", "The operator's legal entity was reviewed", "No"],
            ["L4_DEPLOYMENT_VERIFIED", "A deployment was sampled", "No; method not yet defined"],
            ["L5", "Reserved name only", "Not issuable at all"],
          ],
        },
      },
      {
        heading: "Why it matters",
        body: [
          "Levels make weight explicit. L2's evidence is a DNS record anyone can re-query, so a mistaken L2 is externally detectable, which is why it is planned first. On the Verification Card and [badges](/badge), L1 renders amber and an unverified agent renders neutral grey, never red, because absence of verification is not a negative finding.",
          "Levels also have time limits. Every assertion carries `verified_at` and `expires_at`, so a level describes a window rather than a permanent mark, and editing the manifest makes an assertion inapplicable to the new version.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "No level means compliant, audited, certified or safe. L2 would mean domain control, not trustworthiness. No level says what an agent is allowed to do either; see [declared, verified and authorized](/glossary/declared-verified-authorized). A level is also not the agent's status: the status values in the schema are separate, and today every registered agent is ACTIVE.",
        ],
      },
    ],
    faqs: [
      {
        q: "What level do I get when I register?",
        a: "L1_REGISTERED, at [/issue](/issue). It means your signed declaration is registered; nobody has reviewed it.",
      },
      {
        q: "Can I get L2 today?",
        a: "Not yet. You can record domain-control evidence at [/verify/domain](/verify/domain), but it raises nothing above L1 until the root authority key exists.",
      },
      {
        q: "What about L5?",
        a: "L5 is reserved. It is a name only and is not issuable at all.",
      },
    ],
    related: ["/glossary/verification-assertion", "/glossary/root-authority-key", "/badge", "/verify/domain", "/how-it-works/why-identity", "/trust"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "declared-verified-authorized",
    term: "Declared, verified and authorized",
    category: "Verification",
    alsoKnownAs: ["claim states"],
    title: "Declared vs Verified vs Authorized: Agent Claims",
    description:
      "Declared, verified and authorized are three separate claim states in AgenID. See why none implies another and why identity is not the same as permission.",
    h1: "Declared, verified and authorized: three claims that never blend",
    keywords: ["declared verified authorized", "AI agent claim states", "identity vs permission", "agent authorization", "verified AI agent"],
    definition:
      "Declared, verified and authorized are AgenID's three claim states: what an operator says about its agent, what an authority has checked against evidence, and what the agent may do. None is ever inferred from another.",
    lead: [
      "Most confusion about agent trust comes from blending these. A mark that means signed gets read as checked, and something checked gets read as permitted. AgenID keeps them apart structurally, by object, rather than with a field someone could flip.",
      "The rule is short: declared does not imply verified, and verified does not imply authorized.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "Role is enforced: an operator key cannot produce VERIFIED and an authority key cannot produce DECLARED, even when the signature math validates.",
        ],
        bullets: [
          "DECLARED is produced only by an operator, through the [agent manifest](/glossary/agent-manifest) and its [ManifestProof](/glossary/manifest-proof).",
          "VERIFIED is produced only by an authority, through a [verification assertion](/glossary/verification-assertion) whose digest matches the current manifest.",
          "AUTHORIZED has no signed object in v1.1.1; the `permissions` and `authorizations` manifest keys are reserved.",
        ],
      },
      {
        heading: "What exists today",
        body: [
          "The reference registry records DECLARED statements at L1_REGISTERED. VERIFIED needs an assertion signed by a root authority key, which has not been created yet, so nothing is VERIFIED today. A v1.2 authorization layer, with signed grants and revocations, is a draft in development and is not available.",
          "Operators can record evidence of domain control at [/verify/domain](/verify/domain) today. That is useful context for a relying party, but it is evidence, not an assertion, and it does not change the claim state.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Which agent is acting is not the same question as what it is allowed to do. A business deciding whether an agent may book, pay or sign needs its own permission policy, and the [agent delegation scenario](/how-it-works/agent-delegation) shows where that decision sits. AgenID supplies the identity input, honestly labelled, so nobody mistakes a signature for a permission. A permission decision can use identity as an input; it should never be read off identity alone.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is a registered agent verified?",
        a: "No. Registration records a self-declaration at L1. Nobody has checked it.",
      },
      {
        q: "Can a verified agent act for me?",
        a: "Verification would say a specific claim was checked. Whether the agent may act is your decision, and v1.1.1 has no object that expresses it.",
      },
      {
        q: "Why not one trust score?",
        a: "A single score hides what was checked. Three states tell a relying party exactly what it is relying on. Check any agent's state at [/verify](/verify).",
      },
    ],
    related: ["/how-it-works/agent-delegation", "/glossary/verification-level", "/glossary/manifest-proof", "/verify", "/trust"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "verification-assertion",
    term: "Verification assertion",
    category: "Verification",
    alsoKnownAs: ["VerificationAssertion"],
    title: "What Is a Verification Assertion in AgenID?",
    description:
      "A verification assertion is an authority-signed statement that one claim about an AI agent was checked. See its fields, its limits and why none is issued yet.",
    h1: "Verification assertion: a signed record of one specific check",
    keywords: ["verification assertion", "VerificationAssertion", "authority signed claim", "agent verification evidence", "AgenID assertion"],
    definition:
      "A verification assertion is an authority-signed statement that one specific claim about an agent was checked against one piece of evidence, at one level, in one scope, for one time window, bound to one manifest version. It is the only object that produces VERIFIED.",
    lead: [
      "Where the operator's ManifestProof says what the operator declares, a verification assertion says what an authority checked. It is deliberately narrow, so a relying party can see exactly what it covers.",
      "The format is closed in the specification, but none can be issued today. The reference deployment issues nothing above L1_REGISTERED, because L2 and higher require a VerificationAssertion signed by a root authority key, and that key has not been created yet.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "Required members include `assertion_id`, `subject`, `subject_type`, `level`, a typed `claim`, `authority`, an `evidence` pointer, `verified_at`, `expires_at`, `scope`, `manifest_digest` and `key_id`. Claim types map to levels: `registration`, `domain_control`, `organization_identity` and `deployment_conformance`. It is signed with pure [Ed25519](/glossary/ed25519) over [RFC 8785](/glossary/rfc-8785-jcs) bytes by an [authority key](/glossary/authority-key).",
          "`subject_type` is `agent` for the first three levels and `deployment` for L4, where the subject is a platform-scoped deployment identifier rather than the agent's own.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Every field a relying party needs is mandatory, so a claim without evidence, authority, scope or time cannot be a valid assertion. The digest binding means an edited manifest makes an old assertion `assertion_not_applicable_to_current_manifest` rather than silently reused. Evidence is a pointer, such as a DNS name, never the evidence itself, so the registry does not become a store of private documents. Scope is explicit as well: an authority publishes the scope identifiers it uses, and a verifier reads an assertion as covering that scope and nothing more.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "An assertion shows that an authority asserted a claim, not that the claim is true, and it implies nothing outside its scope: domain control is not organizational identity. It says nothing about what the agent is allowed to do. The endpoint that would store assertions is not deployed.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can an operator sign its own assertion?",
        a: "No. An assertion signed with an operator-role key is rejected even if the signature validates.",
      },
      {
        q: "Do assertions expire?",
        a: "Yes. `expires_at` is required, and an assertion outside its window fails verification.",
      },
      {
        q: "How would I check one?",
        a: "Resolve the agent at [/verify](/verify). Assertions appear in the resolution envelope and are re-verified offline, like the proof.",
      },
    ],
    related: ["/glossary/authority-key", "/glossary/verification-level", "/verify", "/learn/how-to-verify-an-ai-agent", "/how-it-works/b2b-procurement"],
    sources: [SPEC_SOURCE],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "two-path-key-discovery",
    term: "Two-path key discovery",
    category: "Keys and discovery",
    title: "Two-Path Key Discovery: Checking an Agent's Key",
    description:
      "Two-path key discovery fetches an operator's public key from the AgenID registry and from the operator's own domain, then compares them. See how it works.",
    h1: "Two-path key discovery: two independent copies of one key",
    keywords: ["two-path key discovery", "operator key discovery", "well-known keys.json", "key substitution", "AgenID key verification"],
    definition:
      "Two-path key discovery is AgenID's method for obtaining an operator's public key from two independent sources, the AgenID registry and the operator's own domain, and comparing them. Agreement means a single compromised source cannot swap a key unnoticed.",
    lead: [
      "A signature is only as good as the public key you check it with. If the only copy comes from the registry, a verifier is back to relying on the registry. Two-path discovery asks a second party, the operator's domain, for its copy.",
      "It is how AgenID makes the registry a convenience rather than an authority: a verifier who follows both paths can detect a registry that serves the wrong key.",
    ],
    sections: [
      {
        heading: "How it works in AgenID",
        body: [
          "The verifier fetches both, requires them to agree, then checks `role` and `controller`. A disagreement is `key_discovery_mismatch`, a hard fail. The [well-known URI](/glossary/well-known-uri) convention makes the second location predictable. Both copies must also match the operator key document carried in the resolution envelope, so a verifier is comparing three views of one key.",
        ],
        bullets: [
          "Registry path: `GET https://www.agenid.com/v1/keys/<key-ulid>` returns the key document. This is deployed.",
          "Operator path: `https://<operator_domain>/.well-known/agenid/keys.json`, one document listing every key the operator controls, published by the operator over HTTPS.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "The operator path ties a key to a domain the operator controls, independently of AgenID. [Domain evidence](/verify/domain) reports whether an operator's file strictly parses for that domain. The [partner integration patterns](/docs/partners) show where a relying platform would run the check; each is a pattern, not a package.",
          "It also keeps part of the verification path outside AgenID entirely: the operator's web server, its TLS certificate and its DNS are infrastructure AgenID does not run.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "If the operator publishes no copy, the verifier has one source, not two, and the key-substitution defense is not in force. Formal domain verification at L2 needs a VerificationAssertion signed by a root authority key, which has not been created, so the deployment issues nothing above L1_REGISTERED. A matching key identifies the signer; it says nothing about what the agent is allowed to do.",
        ],
      },
    ],
    faqs: [
      {
        q: "Do I have to publish keys.json?",
        a: "No, but without it verifiers of your agent have one source instead of two. The [onboarding guide](/docs/onboarding) shows the file.",
      },
      {
        q: "What if the two copies differ?",
        a: "Verification fails with `key_discovery_mismatch`. Treat it as a hard stop, not a warning.",
      },
      {
        q: "Where is the registry copy?",
        a: "At `/v1/keys/<key-ulid>` on www.agenid.com. A percent-encoded `?key_id=` query returns the identical document.",
      },
    ],
    related: ["/glossary/operator-key", "/glossary/well-known-uri", "/verify/domain", "/docs/partners", "/learn/how-to-verify-an-ai-agent"],
    sources: [
      { label: "RFC 8615: Well-Known Uniform Resource Identifiers", url: "https://www.rfc-editor.org/rfc/rfc8615" },
      SPEC_SOURCE,
    ],
    updated: UPDATED,
  },
];
