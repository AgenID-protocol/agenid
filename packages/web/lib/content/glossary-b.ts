import type { GlossaryTerm } from "./types";

/**
 * Glossary, part B: discovery, resolution, ecosystem and policy terms.
 *
 * Third-party facts are stated only as their own documentation states them and every
 * such page carries `sources`. Anything above L1_REGISTERED is described as the model,
 * next to the issuance ceiling.
 */

const CEILING =
  "The reference deployment at agenid.com issues nothing above L1_REGISTERED today. L2 and higher require a VerificationAssertion signed by a root authority key, and that key has not been created yet.";

const UPDATED = "2026-09-23";

export const GLOSSARY_B: readonly GlossaryTerm[] = [
  // ---------------------------------------------------------------------------
  {
    slug: "well-known-uri",
    term: "Well-known URI",
    category: "Keys and discovery",
    alsoKnownAs: ["/.well-known/ path", "RFC 8615 well-known location"],
    definition:
      "A well-known URI is a URI whose path begins with `/.well-known/`, a prefix defined by RFC 8615 so that clients can find metadata about an origin at a predictable location before making other requests.",
    title: "Well-known URI: Definition and AgenID Key Discovery",
    description:
      "What a well-known URI is under RFC 8615, and how AgenID uses /.well-known/agenid/keys.json on an operator's own domain as the second path for key discovery.",
    h1: "Well-known URI",
    keywords: ["well-known URI", "RFC 8615", ".well-known path", "agenid keys.json", "operator key discovery"],
    lead: [
      "RFC 8615 reserves the path prefix `/.well-known/` in HTTP, HTTPS and some other URI schemes so that applications can discover information about an origin without guessing where it lives. IANA keeps a registry of well-known names, and each name is defined by its own specification.",
      "AgenID uses the pattern for key discovery. An operator can publish the public keys it controls at `https://<operator_domain>/.well-known/agenid/keys.json`, so a verifier has a copy of the [operator key](/glossary/operator-key) that comes from the operator's own domain rather than from the registry.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "The spec defines one document per domain listing every key that domain vouches for, not one file per key. It is the second half of [two-path key discovery](/glossary/two-path-key-discovery): the registry serves the same key at `GET https://www.agenid.com/v1/keys/<key-ulid>`, and a verifier compares the two copies.",
          "The operator publishes the `.well-known` file, not AgenID. The [domain check](/verify/domain) reports it as published only when it parses as a valid keys document for that domain.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "A key that appears in two independent places is harder to substitute than a key that appears in one. If an attacker altered the registry's copy, the operator's own domain would still serve the original, and the mismatch is detectable by anyone.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A file at a well-known path proves only that someone who controls that web origin put it there. It does not say the operator is reputable, and it says nothing about what an agent is allowed to do. If the operator publishes no copy, a verifier has one source, not two. The spec also defines `/.well-known/agenid/authorities.json` on agenid.com for authority keys; it is deliberately not published, because no root authority key exists.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is the agenid well-known name registered with IANA?",
        a: "This page makes no claim about registration status. The path and document format are defined by the AgenID spec, published at [github.com/AgenID-protocol/spec](https://github.com/AgenID-protocol/spec).",
      },
      {
        q: "Do I have to publish a keys.json file to register an agent?",
        a: "No. Registration at [/issue](/issue) works without it. Publishing the file gives verifiers a second, independent source for your key.",
      },
      {
        q: "Does a verifier have to fetch it?",
        a: "A careful one should. The [resolution envelope](/glossary/resolution-envelope) names both discovery paths so the comparison can be made without extra configuration.",
      },
    ],
    related: ["/learn/how-to-verify-an-ai-agent", "/verify/domain", "/glossary/two-path-key-discovery", "/glossary/operator-key"],
    sources: [
      { label: "RFC 8615: Well-Known Uniform Resource Identifiers (URIs)", url: "https://www.rfc-editor.org/rfc/rfc8615.html" },
      { label: "IANA Well-Known URIs registry", url: "https://www.iana.org/assignments/well-known-uris/" },
      { label: "AgenID protocol specification", url: "https://github.com/AgenID-protocol/spec" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "resolution-envelope",
    term: "Resolution envelope",
    category: "Verification",
    alsoKnownAs: ["AgenID envelope", "canonical resolution response"],
    definition:
      "The resolution envelope is the canonical JSON document AgenID returns for an agent identifier: the manifest, its operator-signed ManifestProof, per-assertion checks, the highest currently-valid level and key-discovery pointers, packaged so a verifier can re-check everything offline.",
    title: "Resolution Envelope: The JSON Behind an AgenID",
    description:
      "The resolution envelope is the JSON an AgenID identifier resolves to. It carries everything a verifier needs to re-check the agent's signature offline.",
    h1: "Resolution envelope",
    keywords: ["resolution envelope", "AgenID JSON", "resolve AI agent identity", "agent identity resolver", "offline verification"],
    lead: [
      "Every AgenID identifier resolves at `https://www.agenid.com/a/<agenid>`. Browsers receive a [Verification Card](/glossary/verification-card); a client that sends `Accept: application/json` receives the resolution envelope, the machine-readable form of the same resource.",
      "The envelope is built to be checked, not believed. It includes the proof check result, a check for each assertion, the highest level that is currently valid, and pointers to both places the operator's key can be fetched.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "The envelope is the resolver's output in the protocol. A verifier recomputes the [manifest digest](/glossary/manifest-digest), confirms the [ManifestProof](/glossary/manifest-proof) binds it, and re-runs the Ed25519 check over RFC 8785 canonical bytes. The registry cannot forge an operator signature, so a tampered envelope fails that check.",
          "Identifiers have the shape of the spec's example, `agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC`. Paste any registered identifier into [/verify](/verify) to see its envelope checked.",
          "The key-discovery pointers name both sources for the operator key: the registry copy at `GET https://www.agenid.com/v1/keys/<key-ulid>` and the operator's own `/.well-known/agenid/keys.json`.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "A registry that only returns an answer asks you to trust it. The envelope moves the decision to the verifier: a service can compute the level itself from the checks that passed instead of taking a field on faith.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A valid envelope says which operator key signed which statements about which agent. It does not say those statements are true, and it does not say what the agent is allowed to do. Identity and permission are separate questions.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do I request the JSON instead of the HTML card?",
        a: "Send `Accept: application/json` to `https://www.agenid.com/a/<agenid>`. An unknown identifier returns `404 agent_not_found` as JSON.",
      },
      {
        q: "Can I verify an envelope without contacting AgenID again?",
        a: "Yes. After fetching it once, the signature and digest checks run offline. Fetching the operator's key from its own domain is the one further step.",
      },
      {
        q: "Should I trust the level field?",
        a: "Treat it as a convenience. Compute the level yourself from the assertions that verified.",
      },
    ],
    related: ["/how-it-works", "/verify", "/glossary/verification-card", "/glossary/manifest-proof"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "verification-card",
    term: "Verification Card",
    category: "Verification",
    alsoKnownAs: ["AgenID card", "agent verification page"],
    definition:
      "A Verification Card is the human-readable page at `/a/<agenid>` that shows an agent's operator, declared purpose, signature check and current level, rendered from the same data as the JSON resolution envelope.",
    title: "Verification Card: An AI Agent's Public Identity Page",
    description:
      "A Verification Card is the public page for an AgenID identifier, showing who operates an AI agent and what was checked. Unregistered agents render neutral.",
    h1: "Verification Card",
    keywords: ["verification card", "AI agent verification page", "agent identity card", "verify AI agent", "AgenID badge"],
    lead: [
      "When a person opens `https://www.agenid.com/a/<agenid>` in a browser, they see a Verification Card: the agent's name, the operator that declared it, its stated purpose and channels, whether the signature verified, and the level it currently holds.",
      "The card and the [resolution envelope](/glossary/resolution-envelope) are two representations of one resource. The card is for a person deciding whether to continue a conversation; the envelope is for software that wants to re-check the math.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "Every agent registered at [/issue](/issue) gets a card immediately. A [badge](/badge) embedded with `/badge.js` or served as `/badge/<agenid>/shield.svg` links back to it, so a visitor can move from a small mark on a website to the full record.",
          "The card shows the operator's declared domain, the channels named in the manifest and the disclosure attestations exactly as the operator signed them. Operator attestations are unverifiable by anyone, including AgenID, so the card presents them as statements rather than findings.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Most people will never parse JSON. A card gives them the same answer in plain language, including what the level does not cover. An unknown identifier returns a neutral \"Not registered\" card, and \"not verified\" is grey, never red: absence of verification is not a negative finding.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A card is not a certificate of good behavior, an audit or an endorsement. L1_REGISTERED means an operator signed a manifest and it is in the registry; nobody has checked the operator. The card also says nothing about what the agent is allowed to do.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why is an L1 card amber rather than green?",
        a: "L1_REGISTERED is a self-declaration. Rendering it as verified would claim a check that did not happen.",
      },
      {
        q: "Can I link to a card from my site?",
        a: "Yes. Use the [badge](/badge) embed, which renders the live level and links to the card.",
      },
      {
        q: "What does a card show for an identifier that does not exist?",
        a: "A neutral \"Not registered\" state, not an error or a warning.",
      },
    ],
    related: ["/how-it-works/why-identity", "/verify", "/badge", "/glossary/resolution-envelope"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "domain-control-verification",
    term: "Domain control verification",
    category: "Verification",
    alsoKnownAs: ["domain verification", "DNS TXT challenge"],
    definition:
      "Domain control verification is a check that the party making a claim can change DNS or web content for a domain, usually by publishing a challenge value in a TXT record or at a well-known URL.",
    title: "Domain Control Verification for AI Agent Operators",
    description:
      "How AgenID checks that an operator controls a domain with an _agenid TXT record, what that evidence shows, and why it raises nothing above L1_REGISTERED today.",
    h1: "Domain control verification",
    keywords: ["domain control verification", "DNS TXT verification", "_agenid TXT record", "L2_DOMAIN_VERIFIED", "verify operator domain"],
    lead: [
      "Domain control verification answers one narrow question: can this party change what a domain publishes? The usual method is a TXT record containing a value the verifier chose. Only someone with access to the domain's DNS can add it.",
      "In AgenID the operator's manifest names an `operator_domain`. Confirming control of that domain is the evidence behind the protocol's L2_DOMAIN_VERIFIED level.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "At [/verify/domain](/verify/domain) an operator publishes an `_agenid` TXT record and AgenID performs a real, read-only DNS lookup. The spec lists `dns_txt_challenge` and `http_wellknown_challenge` as evidence types for L2. AgenID holds no DNS provider credential and has no DNS write path.",
          CEILING,
          "Confirming domain control today records evidence and raises nothing above L1.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Domain evidence is re-derivable: anyone can query the same DNS record. A mistaken or forged L2 would be externally detectable, which is why the published issuance policy starts with L2 and only L2 once the trust root exists. L3 evidence, by contrast, is offline documentation nobody outside can re-check.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Controlling a domain does not make an operator trustworthy, and it does not grant the agent any permission. Which agent is acting is a different question from what it is allowed to do.",
          "In the protocol model an L2 assertion also carries the manifest digest, so it would apply to one manifest version and stop applying when the manifest changes.",
        ],
      },
    ],
    faqs: [
      {
        q: "Will adding the TXT record raise my agent's level?",
        a: "Not today. It records evidence of domain control. Issuing L2 needs an assertion signed by the root authority key, which does not exist yet.",
      },
      {
        q: "Can AgenID add the record for me?",
        a: "No. You add it at your DNS provider. One-click setup through [Domain Connect](/glossary/domain-connect) is pending provider template registration.",
      },
      {
        q: "Is this the same as a TLS certificate check?",
        a: "It is a similar idea applied to a different claim. The result is bound to one manifest version through its digest.",
      },
    ],
    related: ["/verify/domain", "/learn/how-to-verify-an-ai-agent", "/glossary/domain-connect", "/glossary/verification-assertion"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "domain-connect",
    term: "Domain Connect",
    category: "Keys and discovery",
    definition:
      "Domain Connect is an open standard that lets a service provider ask a user's DNS provider to apply a predefined set of DNS records, described in a template, after the user signs in and consents.",
    title: "Domain Connect: One-Click DNS Setup Explained",
    description:
      "Domain Connect lets a service apply DNS records at a user's provider from a template. Here is how it would fit AgenID domain evidence and why it is pending today.",
    h1: "Domain Connect",
    keywords: ["Domain Connect", "one-click DNS setup", "Domain Connect template", "DNS TXT automation", "agenid domain verification"],
    lead: [
      "Domain Connect describes itself as an open standard that makes it easy for a user to configure DNS for a domain at a DNS provider so it works with a service at an independent service provider. It replaces point-to-point integrations with one protocol.",
      "The core object is a template: a JSON description of every DNS record a service needs. Service providers publish templates in a public repository, and each DNS provider decides which templates to onboard.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "Domain control evidence in AgenID is an `_agenid` TXT record, which fits the template model. The [domain check](/verify/domain) detects whether a provider supports Domain Connect. The one-click path is pending provider template registration, so today the operator adds the record by hand.",
          "Nothing is written to anyone's DNS by AgenID: there is no DNS write path, and AgenID holds no provider credential. Confirming domain control records evidence and raises nothing above L1_REGISTERED.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Manual DNS edits are where many operators stop. A template flow, once providers onboard it, would let an operator publish the record in a few clicks with the change visible and consented at their own provider.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Domain Connect is a DNS configuration protocol, not a verification or identity standard. Applying a record through it proves only that the user could authorize a DNS change. It grants the agent no permission and does not decide what the agent is allowed to do.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does every DNS provider support Domain Connect?",
        a: "No. The spec says a DNS provider can be selective about templates, can require a contractual relationship, or can charge for onboarding.",
      },
      {
        q: "What are the synchronous and asynchronous flows?",
        a: "In the synchronous flow the user follows a link, signs in at the DNS provider and consents, and the change applies immediately. The asynchronous flow uses OAuth so a service can apply templates later.",
      },
      {
        q: "Can I verify my domain today without it?",
        a: "Yes. Add the TXT record manually and check it at [/verify/domain](/verify/domain).",
      },
    ],
    related: ["/verify/domain", "/docs/onboarding", "/glossary/domain-control-verification", "/how-it-works"],
    sources: [
      { label: "Domain Connect", url: "https://www.domainconnect.org/" },
      { label: "Domain Connect specification (GitHub)", url: "https://github.com/Domain-Connect/spec/blob/master/Domain%20Connect%20Spec%20Draft.adoc" },
      { label: "Domain Connect templates repository", url: "https://github.com/Domain-Connect/Templates" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "relying-party",
    term: "Relying party",
    category: "Identity",
    alsoKnownAs: ["verifier", "RP"],
    definition:
      "A relying party is the service or person that depends on an identity claim to make a decision, such as a business deciding whether to continue a call with an AI agent.",
    title: "Relying Party: Who Checks an AI Agent's Identity",
    description:
      "A relying party is whoever depends on an identity claim to decide what to do. In AgenID it is the business or agent that resolves and re-verifies an identifier.",
    h1: "Relying party",
    keywords: ["relying party", "verifier", "AI agent verification", "who verifies AI agents", "identity relying party"],
    lead: [
      "The term comes from federated identity: an identity provider makes an assertion, and the relying party is the one that relies on it. The relying party carries the risk if the assertion is wrong, so it is the party that most needs to check it.",
      "In AgenID the relying party is whoever an agent contacts: a clinic's phone system, a retailer's checkout, another agent. It needs no account and no relationship with AgenID.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "A relying party resolves the identifier, reads the [resolution envelope](/glossary/resolution-envelope), recomputes the digest and re-runs the Ed25519 check itself. It can then fetch the operator key through [two-path key discovery](/glossary/two-path-key-discovery) and compare copies. [/verify](/verify) runs the same checks in a browser.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "The protocol is designed so the relying party does not have to trust the registry. A registry that lied would be caught by a relying party that follows the documented procedure, because the registry cannot forge an operator signature.",
          "In practice a relying party weighs signals. A registered identity whose key matches the copy on the operator's own domain is a stronger signal than a registered identity alone, and both are stronger than an agent's spoken claim. It should compute the level itself from assertions that verified rather than reading a field on faith.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Verifying an identity does not decide the outcome. What the agent is allowed to do remains the relying party's own policy decision. AgenID says which agent is acting and who declared it; permission is a separate question the protocol v1.1.1 does not answer.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does a relying party need an AgenID account?",
        a: "No. Resolution and verification are public, and the checks can run offline after one fetch.",
      },
      {
        q: "What should a relying party do with an unregistered agent?",
        a: "Apply its normal policy. AgenID renders an unregistered or unverified agent as neutral, because absence of verification is not a negative finding.",
      },
      {
        q: "Can a relying party be another agent?",
        a: "Yes. See [agent-to-agent authentication](/glossary/agent-to-agent-authentication).",
      },
    ],
    related: ["/learn/how-to-verify-an-ai-agent", "/verify", "/glossary/resolution-envelope", "/glossary/two-path-key-discovery"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agent-card",
    term: "Agent Card (A2A)",
    category: "Agents and ecosystems",
    alsoKnownAs: ["AgentCard", "A2A Agent Card", "agent-card.json"],
    definition:
      "In the Agent2Agent (A2A) protocol, an Agent Card is a JSON metadata document an agent publishes to describe its identity, capabilities, skills, service endpoint and authentication requirements so other agents can discover it.",
    title: "Agent Card (A2A): Definition and How AgenID Fits",
    description:
      "What an A2A Agent Card is, where it is published, and how an AgenID identifier can sit beside it as an operator-signed statement a counterparty re-verifies.",
    h1: "Agent Card (A2A)",
    keywords: ["A2A agent card", "agent-card.json", "Agent2Agent protocol", "agent discovery", "agent card signature"],
    lead: [
      "The A2A specification describes the Agent Card as the way agents dynamically find and understand the capabilities of other agents. It carries identity information, skills, security schemes, a service endpoint, supported interfaces and capability flags.",
      "The specification places the card at a standard [well-known URI](/glossary/well-known-uri), `/.well-known/agent-card.json`, and defines an `AgentCardSignature` so a card can be signed with JWS.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "An Agent Card is primarily about capability discovery: what an agent can do and how to call it. An AgenID [agent manifest](/glossary/agent-manifest) is a narrower statement about who operates the agent, its declared purpose and its disclosure behavior, signed by the operator and resolvable by anyone. The two can coexist; a card could reference an AgenID identifier, and a counterparty could resolve it. See the [comparison](/compare/a2a-agent-cards).",
          "A practical pattern is to publish both: the Agent Card for discovery, and an AgenID identifier for an operator statement a counterparty can resolve and re-verify with Ed25519 over RFC 8785 canonical JSON.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Discovery tells an agent where to send a task. A relying party still needs to know who stands behind the agent at the other end, from a source it can check independently of the card's host.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Neither an Agent Card nor an AgenID says what an agent is allowed to do on a particular person's behalf. Listing a skill is not authorization, and AgenID v1.1.1 defines no signed authorization object.",
          "An AgenID level also describes only what was checked about the operator. It says nothing about whether the skills listed on a card work as described.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is an AgenID a replacement for an Agent Card?",
        a: "No. They answer different questions and can be used together.",
      },
      {
        q: "Who governs A2A?",
        a: "The A2A specification is published under The Linux Foundation, according to its own documentation.",
      },
      {
        q: "Can I check an AgenID referenced from a card?",
        a: "Yes. Paste it into [/verify](/verify) or resolve it as JSON.",
      },
    ],
    related: ["/compare/a2a-agent-cards", "/learn/agent-to-agent-authentication", "/verify", "/glossary/agent-manifest", "/glossary/agent-to-agent-authentication"],
    sources: [
      { label: "A2A Protocol specification", url: "https://a2a-protocol.org/latest/specification/" },
      { label: "A2A project on GitHub", url: "https://github.com/a2aproject/A2A" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agent-to-agent-authentication",
    term: "Agent-to-agent authentication",
    category: "Identity",
    alsoKnownAs: ["A2A authentication", "machine-to-machine agent authentication"],
    definition:
      "Agent-to-agent authentication is how one AI agent establishes which agent it is dealing with, and who operates it, before exchanging data or completing a task with it.",
    title: "Agent-to-Agent Authentication: What Can Be Checked",
    description:
      "When two AI agents transact, each needs to know who is on the other side. What agent-to-agent authentication covers, what AgenID adds, and what it does not do yet.",
    h1: "Agent-to-agent authentication",
    keywords: ["agent-to-agent authentication", "AI agent authentication", "authenticate AI agents", "multi-agent identity", "agent identity verification"],
    lead: [
      "When a purchasing agent talks to a supplier's sales agent, neither side has a person present to vouch for it. Each needs some way to learn which agent it is talking to and who is accountable for it.",
      "The term covers several layers: authenticating the channel, authenticating individual requests, and identifying the accountable operator. Different standards address different layers.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "AgenID covers the operator-identity layer. An agent presents its identifier; the other agent resolves it, re-verifies the operator's Ed25519 signature and reads the declared purpose. The [learn guide](/learn/agent-to-agent-authentication) walks through the flow. The check needs no account or API key, and the verifying agent does not have to trust AgenID, because the registry cannot forge an operator signature.",
          "AgenID does not authenticate live requests today: nothing binds a specific HTTP request to a registered agent. Request signing is the layer approaches like [Web Bot Auth](/glossary/web-bot-auth) work on.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Agents increasingly act on both sides of a transaction. A stable identity lets history and accountability attach to the agent across platforms instead of restarting at every service. Without a shared identity layer, each pair of agents needs a bilateral arrangement such as exchanged API keys, which does not work for agents meeting for the first time.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Authentication answers who; it does not answer what the agent is allowed to do. Delegated authority from a principal is a separate object that v1.1.1 does not define.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can two agents verify each other with AgenID today?",
        a: "Each can resolve the other's identifier and re-check the operator signature. Binding that identity to a particular live request is not implemented yet.",
      },
      {
        q: "Is this the same as OAuth between services?",
        a: "No. OAuth grants access to resources. AgenID identifies the accountable operator of an agent.",
      },
      {
        q: "Where does the A2A Agent Card fit?",
        a: "It handles discovery and capabilities. See [Agent Card](/glossary/agent-card).",
      },
    ],
    related: ["/learn/agent-to-agent-authentication", "/how-it-works/agent-delegation", "/verify", "/glossary/agent-card", "/glossary/web-bot-auth"],
    sources: [
      { label: "A2A Protocol specification", url: "https://a2a-protocol.org/latest/specification/" },
      { label: "RFC 9421: HTTP Message Signatures", url: "https://www.rfc-editor.org/rfc/rfc9421.html" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "non-human-identity",
    term: "Non-human identity (NHI)",
    category: "Identity",
    alsoKnownAs: ["NHI", "machine identity"],
    definition:
      "A non-human identity is any identity that belongs to software rather than a person, such as a service account, API key, workload credential or AI agent.",
    title: "Non-Human Identity (NHI) and AI Agents Explained",
    description:
      "Non-human identities are credentials held by software, not people. How AI agents differ from service accounts, and where a portable operator-signed identity fits.",
    h1: "Non-human identity (NHI)",
    keywords: ["non-human identity", "NHI", "machine identity", "AI agent identity", "service account security"],
    lead: [
      "Organizations already run far more software identities than human ones: service accounts, API keys, certificates and cloud workload roles. These are usually called non-human identities, and managing them is its own security discipline.",
      "AI agents are a new kind of non-human identity. They act with more autonomy than a script and often deal with parties outside the organization that issued their credentials.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "Most NHI tooling manages credentials inside one organization. AgenID gives an agent an identity meant to be read outside it: a permanent `agenid:<ULID>` identifier and an operator-signed [manifest](/glossary/agent-manifest) any counterparty can resolve and re-verify. You can create one at [/issue](/issue); the key is generated in your browser and never sent to AgenID.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "An API key says a caller holds a secret. It does not tell an outside party which agent is calling or who answers for it. A portable identity gives that party something to check without a prior relationship.",
          "NHI programs usually track an owner for each credential. An agent identity makes that owner statement public: the manifest names the accountable operator, and the operator key signs it.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "An AgenID is not an access credential and does not replace secrets management. It grants no permission; what an agent is allowed to do is still decided by the systems it calls. It also does not inventory an organization's agents or detect unmanaged ones; it identifies the agents operators choose to register.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is an AI agent just another service account?",
        a: "It often runs on one, but it makes decisions and may represent a person or company to outside parties, which a service account usually does not.",
      },
      {
        q: "Does AgenID store my agent's private key?",
        a: "No. Operator keys are generated and held client-side only.",
      },
      {
        q: "Where does Know Your Agent fit?",
        a: "See [Know Your Agent](/glossary/know-your-agent) for the counterparty-checking side of the same problem.",
      },
    ],
    related: ["/why-agent-identity", "/learn/know-your-agent-kya", "/issue", "/glossary/ai-agent-identity", "/glossary/know-your-agent"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agent-delegation",
    term: "Agent delegation",
    category: "Identity",
    alsoKnownAs: ["delegated authority", "acting on behalf of"],
    definition:
      "Agent delegation is the act of a person or organization, the principal, giving an AI agent authority to act on its behalf, usually within limits of scope, amount and time.",
    title: "Agent Delegation: Identity vs. Authority to Act",
    description:
      "Agent delegation is a principal giving an AI agent authority to act for it. Why that is separate from identity, and what AgenID v1.1.1 does not yet define.",
    h1: "Agent delegation",
    keywords: ["agent delegation", "delegated authority AI agent", "AI agent acting on behalf", "agent authorization", "principal agent"],
    lead: [
      "\"I'm calling on behalf of my client\" is a delegation claim. It has three parts: who the agent is, who the principal is, and what the principal allowed. A careful counterparty wants all three.",
      "Delegation is where identity ends and permission begins. Knowing which agent is acting is not the same as knowing what it is allowed to do.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "AgenID v1.1.1 answers the first part: which agent, and which operator declared it. It keeps [DECLARED, VERIFIED and AUTHORIZED](/glossary/declared-verified-authorized) strictly separate, and AUTHORIZED has no signed object in v1.1.1. The manifest keys `permissions` and `authorizations` are reserved and rejected by a v1.1.1 validator.",
          "A v1.2 authorization layer, with a signed grant from a principal and a way to withdraw it, is a draft in development. It is not available on agenid.com.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Delegation chains are where fraud hides: an agent with a real identity can still overstate what it was asked to do. Separating the two questions keeps a valid identity from being read as permission. The [delegation scenario](/how-it-works/agent-delegation) walks through it.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A registered AgenID is not evidence of delegation. It does not say who the agent represents in a given transaction or what that party approved.",
          "It also does not say whether the operator and the principal are the same party. A booking agent may be operated by a software vendor while acting for a traveler: three parties, three separate questions.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I prove my agent is authorized to spend money today?",
        a: "Not with AgenID. v1.1.1 defines no signed authorization object; that decision stays with you and the business on the other side.",
      },
      {
        q: "Is the v1.2 authorization layer usable?",
        a: "No. It is a draft and nothing in the deployed registry stores or serves a grant.",
      },
      {
        q: "Who is the principal?",
        a: "The person or organization on whose behalf the agent acts, which may differ from the operator that runs it.",
      },
    ],
    related: ["/how-it-works/agent-delegation", "/docs/onboarding", "/glossary/declared-verified-authorized", "/glossary/relying-party"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "web-bot-auth",
    term: "Web Bot Auth",
    category: "Agents and ecosystems",
    alsoKnownAs: ["webbotauth", "HTTP message signatures for bots"],
    definition:
      "Web Bot Auth is an IETF working group, and the family of drafts it develops, for cryptographically authenticating automated clients such as crawlers and agents when they access websites.",
    title: "Web Bot Auth: Signed Requests for Bots and Agents",
    description:
      "Web Bot Auth is the IETF effort to let bots and AI agents sign HTTP requests using RFC 9421. What it covers, and how it complements an operator-signed AgenID.",
    h1: "Web Bot Auth",
    keywords: ["Web Bot Auth", "webbotauth", "RFC 9421", "HTTP message signatures", "bot authentication"],
    lead: [
      "The Web Bot Auth working group charter notes that IP allowlisting, User-Agent strings and shared API keys have significant limitations for identifying automated clients, and commits the group to standardizing cryptographic authentication for them.",
      "Its protocol draft, `draft-ietf-webbotauth-httpsig-protocol`, describes clients signing outbound requests with HTTP Message Signatures (RFC 9421), using a `Signature-Agent` header for key discovery and a key directory served at a [well-known URI](/glossary/well-known-uri). It is an Internet-Draft, not an RFC.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "Web Bot Auth works at the request layer: this HTTP request was signed by this key. AgenID works at the operator layer: this agent was declared by this operator, in a manifest bound by an operator-signed proof that anyone can resolve. AgenID does not authenticate individual requests today, so the two are complementary rather than competing.",
          "The working group also lists related drafts, including one on a registry and a Signature Agent card and one on use cases. These are Internet-Drafts whose scope may change, so this page does not describe their details.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "A website that can verify a request signature knows the traffic came from a particular key holder. Pairing that with a resolvable operator identity would tell the site who is accountable for the agent behind the key. Request signatures say this request came from this key; an operator identity says which accountable party stands behind the agent.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "A signed request authenticates the sender; it does not decide what the bot is allowed to do. Access policy remains the site's choice. AgenID makes no claim about any site's support for these drafts.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is Web Bot Auth a finished standard?",
        a: "No. The working group's protocol document is an Internet-Draft. RFC 9421, which it builds on, is a published Standards Track RFC.",
      },
      {
        q: "Does AgenID sign HTTP requests?",
        a: "No. Request-level authentication is planned, not implemented.",
      },
      {
        q: "Could one key serve both?",
        a: "This page makes no claim about that. The AgenID key format is defined in the [spec](https://github.com/AgenID-protocol/spec).",
      },
    ],
    related: ["/learn/agent-to-agent-authentication", "/verify", "/glossary/agent-to-agent-authentication", "/glossary/well-known-uri"],
    sources: [
      { label: "IETF Web Bot Auth working group charter", url: "https://datatracker.ietf.org/wg/webbotauth/about/" },
      { label: "Web Bot Auth working group documents", url: "https://datatracker.ietf.org/group/webbotauth/documents/" },
      { label: "RFC 9421: HTTP Message Signatures", url: "https://www.rfc-editor.org/rfc/rfc9421.html" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agentic-commerce",
    term: "Agentic commerce",
    category: "Agents and ecosystems",
    alsoKnownAs: ["agent-driven commerce", "AI shopping agents"],
    definition:
      "Agentic commerce is buying and selling in which an AI agent, rather than a person clicking through a checkout, searches, compares, negotiates or pays on someone's behalf.",
    title: "Agentic Commerce: The Identity Question for AI Buyers",
    description:
      "In agentic commerce an AI agent shops and pays for someone. Why merchants need to know which agent is buying, and why identity is not the same as payment authority.",
    h1: "Agentic commerce",
    keywords: ["agentic commerce", "AI shopping agent", "agent payments", "AI agent checkout", "agentic commerce identity"],
    lead: [
      "Checkout flows assume a person is present: someone who logs in, reviews the cart and answers for the order. In agentic commerce that person has handed the task to software, and the merchant sees an agent instead.",
      "That creates two separate questions for the merchant. Which agent is this, and who operates it? And is it allowed to make this purchase for this customer?",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "AgenID answers the first question. An agent presents its identifier, and the merchant resolves it at [/verify](/verify) or as JSON and re-checks the operator's signature. The [tire-buying scenario](/how-it-works/buying-tires) and the [financial transaction scenario](/how-it-works/financial-transaction) show the flow.",
          "A merchant can also fetch the operator key from the operator's own domain and compare it with the registry's copy, so a substitution on either side would show up as a mismatch.",
          "AgenID is not a payment rail and holds no payment credential. Other approaches to agent payments are covered in [comparisons](/compare).",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Merchants handle disputes, fraud and returns. When the buyer is an agent, a stable operator identity gives those processes a party to hold accountable across every store the agent visits. Because the identifier is the same everywhere, a merchant can recognize an operator it has dealt with before instead of treating each visit as new.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "An identity is not payment authority. Whether the agent is allowed to spend a given amount is a permission question that AgenID v1.1.1 does not answer; see [agent delegation](/glossary/agent-delegation).",
          "It also does not tell a merchant whether the customer approved this specific cart. That confirmation sits between the merchant, the payment provider and the customer.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does AgenID process payments?",
        a: "No. It identifies the agent's operator; payment authorization happens elsewhere.",
      },
      {
        q: "Should a merchant refuse unregistered agents?",
        a: "That is the merchant's policy. AgenID renders an unregistered agent as neutral, not as a warning.",
      },
      {
        q: "Can an operator register a shopping agent today?",
        a: "Yes, at [/issue](/issue), up to L1_REGISTERED.",
      },
    ],
    related: ["/how-it-works/buying-tires", "/how-it-works/financial-transaction", "/compare/visa-trusted-agent-protocol", "/issue", "/glossary/agent-delegation"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "model-context-protocol",
    term: "Model Context Protocol (MCP)",
    category: "Agents and ecosystems",
    alsoKnownAs: ["MCP"],
    definition:
      "The Model Context Protocol is an open-source standard for connecting AI applications to external systems such as data sources, tools and workflows.",
    title: "Model Context Protocol (MCP) and Agent Identity",
    description:
      "MCP is an open standard connecting AI applications to tools and data. How it relates to agent identity, and how an MCP client could resolve an AgenID identifier.",
    h1: "Model Context Protocol (MCP)",
    keywords: ["Model Context Protocol", "MCP", "MCP server", "AI tools protocol", "MCP agent identity"],
    lead: [
      "MCP's documentation describes it as an open-source standard for connecting AI applications to external systems, and compares it to a USB-C port for AI applications: one standard connection instead of many custom ones.",
      "With MCP, an AI application can reach data sources such as files and databases, tools such as search engines, and workflows such as specialized prompts.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "MCP connects an agent to capabilities. AgenID identifies the agent and its operator. A tool exposed over MCP could let an agent resolve and verify an AgenID identifier during a task. The [MCP server integration](/docs/partners/mcp-server-integration) doc describes that pattern, not a package; nothing is published to npm.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "As agents gain tools through MCP, the parties on the other end of those tools need a way to know which agent is calling. Tool access and identity are complementary layers.",
          "MCP's documentation lists AI assistants and development tools among the clients that support it, so a resolve-and-verify tool built once could be offered to many different agents.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Connecting to an MCP server does not establish who operates the calling agent, and an AgenID does not grant access to any MCP tool. What an agent is allowed to do through a tool is the tool owner's permission decision. An identity check is one input to that decision, not a replacement for it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is there an AgenID MCP server I can install?",
        a: "Not from npm. The partner doc is an integration pattern, not a package.",
      },
      {
        q: "Does MCP define agent identity?",
        a: "This page makes no claim beyond MCP's own description as a standard for connecting AI applications to external systems.",
      },
      {
        q: "How would an agent verify another agent through MCP?",
        a: "By calling a tool that resolves the identifier and re-runs the checks described in [how to verify an AI agent](/learn/how-to-verify-an-ai-agent).",
      },
    ],
    related: ["/docs/partners/mcp-server-integration", "/learn/how-to-verify-an-ai-agent", "/glossary/agent-card", "/glossary/agent-to-agent-authentication"],
    sources: [
      { label: "What is the Model Context Protocol (MCP)?", url: "https://modelcontextprotocol.io/docs/getting-started/intro" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "key-rotation-and-revocation",
    term: "Key rotation and revocation",
    category: "Keys and discovery",
    alsoKnownAs: ["key retirement", "key lifecycle"],
    definition:
      "Key rotation replaces a signing key with a new one and retires the old key; key revocation declares a key no longer trustworthy from a point in time. In AgenID, retired and revoked key documents stay resolvable forever.",
    title: "Key Rotation and Revocation in the AgenID Protocol",
    description:
      "How the AgenID spec defines key rotation, retirement and revocation, why old keys stay resolvable forever, and what is and is not deployed on agenid.com today.",
    h1: "Key rotation and revocation",
    keywords: ["key rotation", "key revocation", "retired key", "Ed25519 key lifecycle", "agent key management"],
    lead: [
      "Every signing key eventually needs replacing, whether on a schedule or because it was exposed. A key lifecycle has to answer two questions: how to move to a new key, and what happens to signatures made with the old one.",
      "The AgenID spec answers both in its key model. A key document carries a `status` of `active`, `retired` or `revoked`, with `retired_at` and `revoked_at` timestamps.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "In the spec, rotation means a new key with its own ULID, and the old key marked `retired`. Proofs created before `retired_at` remain valid. `revoked_at` invalidates proofs created after it regardless of signature, and every signed payload carries its own `expires_at`, checked independently.",
          "Retired and revoked key documents stay resolvable forever, so historical signatures remain checkable. Without that, revoking a key would silently rewrite history.",
          "What is deployed: no revocation flow is deployed on agenid.com, and there is no rotation flow either. Agent status values such as `SUSPENDED` and `REVOKED` exist in the schema, but nothing writes them; every registered agent is `ACTIVE`.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "A verifier checks whether the key was active at the moment the proof claims it was signed, not merely whether it is active now. That is how a signature survives a later rotation. The spec also has re-attestation issue a new signed object rather than mutating an old one, so a verifier can always see which statement was made when.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Key status says whether a key's signatures can be relied on. It says nothing about what the agent is allowed to do; permission withdrawal belongs to a v1.2 authorization layer that is a draft in development.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I revoke my agent's key on agenid.com today?",
        a: "No. No revocation flow is deployed. The spec defines the model; the reference deployment does not implement it yet.",
      },
      {
        q: "Why keep a revoked key resolvable?",
        a: "So signatures made before revocation can still be checked against the key that made them.",
      },
      {
        q: "What if I lose my private key?",
        a: "AgenID never holds it and cannot recover it. The browser flow at [/issue](/issue) offers a one-time download.",
      },
    ],
    related: ["/how-it-works", "/trust", "/verify", "/glossary/operator-key", "/glossary/two-path-key-discovery"],
    sources: [
      { label: "AgenID protocol specification", url: "https://github.com/AgenID-protocol/spec" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "agent-provenance",
    term: "Agent provenance",
    category: "Identity",
    alsoKnownAs: ["agent origin", "operator provenance"],
    definition:
      "Agent provenance is the verifiable record of where an AI agent comes from: which operator declared it, when, and with what stated purpose.",
    title: "Agent Provenance: Tracing an AI Agent to Its Operator",
    description:
      "Agent provenance traces an AI agent back to the operator that declared it. What AgenID records, what a verifier can re-check, and what provenance does not cover.",
    h1: "Agent provenance",
    keywords: ["agent provenance", "AI agent origin", "AI agent accountability", "operator-signed proof", "trace AI agent"],
    lead: [
      "When an unfamiliar agent shows up in a phone call or an API request, the first useful question is where it came from. Provenance is the answer in a form that can be checked rather than asserted.",
      "In AgenID, provenance starts with the [agent operator](/glossary/agent-operator): the entity accountable for the agent, which is never the hosting platform.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "The operator signs a [ManifestProof](/glossary/manifest-proof) that binds the manifest by SHA-256 digest, with a creation time and an operator key whose `controller` is the agent. Registration adds an append-only ledger event. Anyone can re-verify the chain from the envelope at [/verify](/verify).",
          "Because the operator key can be fetched from the registry and from the operator's own domain, a verifier can confirm that the key which signed the manifest is the one the operator's domain vouches for, where the operator has published a copy.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "A traceable operator gives disputes, complaints and reputation somewhere to land. It also means a verifier can tell when a manifest changed, because any edit changes the digest.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "AgenID provenance is about the declaration, not the model or the runtime. v1.1.1 has no object tying an identity to the deployment it executes on, and the `platform` and `configuration_fingerprint` manifest keys are reserved. Operator attestations are self-declared and unverifiable by anyone, including AgenID. Provenance also says nothing about what the agent is allowed to do, and it traces the agent, not the content the agent produces.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does provenance tell me which AI model an agent uses?",
        a: "No. The manifest does not carry model or platform fields in v1.1.1.",
      },
      {
        q: "Can provenance be faked?",
        a: "A different operator can declare its own agent, but it cannot produce another operator's signature. Compare the operator key against the operator's own domain.",
      },
      {
        q: "Where do I read an agent's provenance?",
        a: "On its [Verification Card](/glossary/verification-card) or in the JSON envelope.",
      },
    ],
    related: ["/how-it-works/why-identity", "/trust", "/verify", "/glossary/manifest-proof", "/glossary/agent-operator"],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "decentralized-identifier",
    term: "Decentralized identifier (DID)",
    category: "Identity",
    alsoKnownAs: ["DID", "W3C DID"],
    definition:
      "A decentralized identifier (DID) is a W3C-standardized identifier of the form `did:<method>:<method-specific-id>` that its controller can create and prove control of cryptographically, without a central issuing authority.",
    title: "Decentralized Identifier (DID) vs. an AgenID",
    description:
      "What a W3C decentralized identifier is, how its did:method syntax works, and how the AgenID identifier and its two-path key discovery differ from a DID.",
    h1: "Decentralized identifier (DID)",
    keywords: ["decentralized identifier", "DID", "W3C DID", "DID method", "AI agent DID"],
    lead: [
      "The W3C Decentralized Identifiers (DIDs) v1.0 Recommendation, published on 19 July 2022, describes DIDs as a type of identifier that enables verifiable, decentralized digital identity. A DID has three parts: the `did` scheme, a method name, and a method-specific identifier.",
      "Each DID method defines how its identifiers are created and resolved to a DID document containing keys and service endpoints.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "An [AgenID identifier](/glossary/agenid-identifier) is `agenid:<ULID>`, for example `agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC`. It is not a DID, and v1.1.1 does not define a DID method. Where a DID method specifies its own resolution, AgenID resolves through its registry and cross-checks the operator key against the operator's own domain using [two-path key discovery](/glossary/two-path-key-discovery). The [comparison](/compare/decentralized-identifiers) covers the trade-offs.",
          "Those two paths are the registry at `GET https://www.agenid.com/v1/keys/<key-ulid>` and the operator's `https://<operator_domain>/.well-known/agenid/keys.json`.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "Both approaches aim for identities a verifier can check without trusting a single database. AgenID adds a fixed manifest schema for agents, with operator, purpose and disclosure fields, and a verification level model. The identifier is immutable for the life of the record and never reissued.",
          CEILING,
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Neither a DID nor an AgenID, on its own, says what the identified agent is allowed to do. Identity and permission are separate questions. Each shows control of a key; neither is a statement that the controller is reputable.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I use a DID as my AgenID?",
        a: "No. The identifier must match `agenid:` followed by a 26-character ULID, and platform-native identifiers must not be encoded into it.",
      },
      {
        q: "Is AgenID built on blockchain?",
        a: "No. It uses Ed25519 signatures over RFC 8785 canonical JSON, a registry that cannot forge signatures, and the operator's own domain.",
      },
      {
        q: "Could AgenID interoperate with DIDs?",
        a: "This page makes no claim about future interoperability. The current spec is at [github.com/AgenID-protocol/spec](https://github.com/AgenID-protocol/spec).",
      },
    ],
    related: ["/compare/decentralized-identifiers", "/learn/ai-agent-registry", "/verify", "/glossary/agenid-identifier", "/glossary/two-path-key-discovery"],
    sources: [
      { label: "W3C Decentralized Identifiers (DIDs) v1.0", url: "https://www.w3.org/TR/did-1.0/" },
    ],
    updated: UPDATED,
  },

  // ---------------------------------------------------------------------------
  {
    slug: "eu-ai-act-article-50",
    term: "EU AI Act Article 50",
    category: "Policy and regulation",
    alsoKnownAs: ["AI Act transparency obligations", "Article 50 AI disclosure"],
    definition:
      "Article 50 of the EU AI Act sets transparency obligations, including that providers design AI systems meant to interact directly with people so those people are informed they are interacting with an AI system.",
    title: "EU AI Act Article 50: AI Disclosure in Context",
    description:
      "Context on EU AI Act Article 50 transparency obligations and how an AgenID manifest records an operator's own disclosure declarations. Not legal advice.",
    h1: "EU AI Act Article 50",
    keywords: ["EU AI Act Article 50", "AI transparency obligations", "AI disclosure requirement", "AI voice agent disclosure", "AI Act chatbot disclosure"],
    lead: [
      "This page is context, not legal advice. Article 50 of Regulation (EU) 2024/1689, the AI Act, is titled \"Transparency obligations for providers and deployers of certain AI systems\". Paragraph 1 requires providers to ensure that AI systems intended to interact directly with natural persons are designed so those persons are informed they are interacting with an AI system, with stated exceptions.",
      "Paragraph 2 addresses marking synthetic outputs in a machine-readable format. According to the source cited below, Article 50 applies from 2 August 2026.",
    ],
    sections: [
      {
        heading: "How it relates to AgenID",
        body: [
          "An AgenID [agent manifest](/glossary/agent-manifest) has a `disclosure` section with `is_ai`, `discloses_to_user` and `human_escalation`. These are operator attestations: self-declared, signed by the operator, and unverifiable by anyone, including AgenID. The browser flow at [/issue](/issue) starts them at `false` so nothing is claimed by default.",
        ],
      },
      {
        heading: "Why it matters",
        body: [
          "For [voice agents](/use-cases/voice-agents) and other conversational agents, a signed, resolvable declaration gives the other party a record of what the operator stated about disclosure. It is evidence of a statement, not of behavior. Because the manifest is bound by digest, any later edit changes the digest, so a reader can see which version of the declaration was signed.",
        ],
      },
      {
        heading: "What it does not mean",
        body: [
          "Verification is not compliance. Registering an agent, or holding any verification level, does not satisfy Article 50 or any other law, and AgenID makes no compliance determination. It also does not decide what an agent is allowed to do. Consult qualified counsel and the current official text, which may be amended.",
        ],
      },
    ],
    faqs: [
      {
        q: "Does an AgenID make my agent compliant with Article 50?",
        a: "No. It records what you declared. Whether your system meets the law is a legal question for qualified counsel. This is not legal advice.",
      },
      {
        q: "Does AgenID check that my agent actually discloses it is an AI?",
        a: "No. `discloses_to_user` is a self-declaration no one can verify from the protocol.",
      },
      {
        q: "Where can I read the official text?",
        a: "On EUR-Lex, linked in the sources on this page.",
      },
    ],
    related: ["/use-cases/voice-agents", "/how-it-works/dentist-appointment", "/issue", "/glossary/agent-manifest"],
    sources: [
      { label: "Regulation (EU) 2024/1689 (AI Act), EUR-Lex", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" },
      { label: "Article 50: Transparency obligations (artificialintelligenceact.eu)", url: "https://artificialintelligenceact.eu/article/50/" },
    ],
    updated: UPDATED,
  },
];
