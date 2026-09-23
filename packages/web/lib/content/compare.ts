import type { ComparisonPage } from "./types";

/**
 * Comparison pages for /compare/<slug>.
 *
 * Legal-sensitive copy. Every statement about another organization's product is taken
 * from that organization's (or the standards body's) own public documentation, read in
 * September 2026, and listed in `sources`. Descriptions are neutral and dated; nothing
 * here speculates about another product's roadmap, pricing or adoption, and nothing
 * ranks one approach above another. AgenID's side states what the reference deployment
 * does today, including what it does not do.
 */

const DATED = "as described in its public documentation as of September 2026";

const CEILING =
  "Issuance ceiling: the reference deployment at agenid.com issues nothing above L1_REGISTERED today. The specification defines L2_DOMAIN_VERIFIED, L3_ORGANIZATION_VERIFIED and L4_DEPLOYMENT_VERIFIED, but each requires a VerificationAssertion signed by a root authority key, and that key has not been created yet. L1_REGISTERED is a self-declaration: it means an operator-signed manifest is in the registry, not that anyone checked the operator. L5 is reserved and not issuable.";

const NO_REVOCATION =
  "No revocation flow is deployed. Agent status values such as SUSPENDED and REVOKED exist in the schema so the envelope shape is stable, but nothing in production writes them, so every registered agent reads ACTIVE. The specification keeps retired and revoked keys resolvable permanently so that historical signatures remain checkable.";

const NO_AUTHORIZATION =
  "No authorization object exists in v1.1.1. The DECLARED, VERIFIED and AUTHORIZED claim states are never inferred from one another, AUTHORIZED has no signed object, and `permissions` and `authorizations` are reserved manifest keys that a v1.1.1 validator rejects. A v1.2 authorization layer is a draft in development, not something available.";

const TWO_PATH_LIMIT =
  "Two-path key discovery depends on the operator. The registry serves the operator key at `GET https://www.agenid.com/v1/keys/<key-ulid>`, and the operator is expected to publish its own copy at `https://<operator_domain>/.well-known/agenid/keys.json`. If the operator publishes no copy, a verifier has one source, not two.";

const AGENID_SPEC_SOURCE = { label: "AgenID protocol specification (MIT)", url: "https://github.com/AgenID-protocol/spec" } as const;

export const COMPARISONS: readonly ComparisonPage[] = [
  // ─────────────────────────────────────────────────────────────── GoDaddy ANS
  {
    slug: "godaddy-ans",
    subject: "Agent Name Service (ANS)",
    owner: "GoDaddy",
    title: "AgenID vs GoDaddy Agent Name Service (ANS)",
    description:
      "A sourced, neutral comparison of AgenID and GoDaddy Agent Name Service: identifiers, certificates versus signed manifests, verification, and how they fit together.",
    h1: "AgenID and GoDaddy Agent Name Service (ANS): a factual comparison",
    keywords: ["GoDaddy Agent Name Service", "ANS vs AgenID", "Agent Name Service ANS", "AI agent identity DNS", "agent identity certificates", "ANSName"],
    subjectSummary: `GoDaddy describes Agent Name Service (ANS) as an open standard that connects AI agents to domain names, creating verifiable identities discoverable through DNS, ${DATED}.`,
    lead: [
      "AgenID and GoDaddy's Agent Name Service (ANS) start from the same question: when an AI agent shows up, how does the other side check which agent it is and who stands behind it? They answer it with different building blocks. ANS anchors an agent's identity to a DNS domain and to X.509 certificates issued by a Registration Authority. AgenID anchors it to an operator-held Ed25519 key that signs a manifest, served by a registry that stores public material and cannot sign on the operator's behalf.",
      "This page describes ANS as described in its public documentation as of September 2026, citing GoDaddy's ANS page, the ANS v2 Internet-Draft and GoDaddy's public registry repository. It describes AgenID as the reference deployment at agenid.com runs today, including what is not deployed. It states differences; it does not rank either approach.",
    ],
    sections: [
      {
        heading: "What ANS is",
        body: [
          "GoDaddy's [ANS page](https://www.godaddy.com/ans) describes ANS as an open standard that connects AI agents to domain names, and says it is built on DNS, PKI and ACME. The technical definition is the Internet-Draft [draft-narajala-courtney-ansv2](https://datatracker.ietf.org/doc/draft-narajala-courtney-ansv2/), titled \"Agent Name Service v2 (ANS): A Domain-Anchored Trust Layer for Autonomous AI Agent Identity\", whose listed authors include contributors from GoDaddy, OWASP and Cisco. As an individual Internet-Draft, it states that it is not endorsed by the IETF and has no formal standing in the IETF standards process. It replaces the earlier draft-narajala-ans.",
          "In the ANS v2 draft, every agent identity anchors to a DNS domain name. A Registration Authority verifies domain control through ACME and then issues two certificates: a Server Certificate from a public certificate authority, and an Identity Certificate from a private certificate authority that binds a version-specific name. That name has the form `ans://v{version}.{agentHost}`, combining a semantic version with a fully qualified domain name. Lifecycle events are sealed into an append-only Transparency Log that the draft describes as aligned with IETF SCITT. GoDaddy publishes an Apache 2.0 licensed [registry implementation](https://github.com/godaddy/ans-registry) on GitHub.",
        ],
      },
      {
        heading: "What AgenID is",
        body: [
          "AgenID is an open protocol, specified in the MIT-licensed [AgenID specification](https://github.com/AgenID-protocol/spec), that gives an AI agent a permanent identifier of the form `agenid:<ULID>`. The operator, meaning the party accountable for the agent, generates an Ed25519 key pair on its own machine or in the browser at [/issue](/issue); the private key is never sent to AgenID. The operator writes a [manifest](/glossary/agent-manifest) covering identity, ownership, purpose and disclosure, and signs a [ManifestProof](/glossary/manifest-proof) that binds the manifest by SHA-256 digest. Signatures are pure Ed25519 over RFC 8785 canonical JSON.",
          "The registry at www.agenid.com validates and stores that public material and serves it at `https://www.agenid.com/a/<agenid>`: a [Verification Card](/glossary/verification-card) for browsers, or the [resolution envelope](/glossary/resolution-envelope) as JSON. A verifier re-checks the envelope offline. The registry holds no operator private keys, so it cannot forge an operator signature.",
        ],
      },
      {
        heading: "Key differences",
        body: [
          "The first difference is what the identity is attached to. In ANS the anchor is a domain name, confirmed by the Registration Authority through ACME before any certificate is issued. In AgenID the anchor is the operator key. The manifest's `operator_domain` is a declared value; proving control of it with an `_agenid` TXT record at [/verify/domain](/verify/domain) records evidence of domain control but raises nothing above L1_REGISTERED today.",
          "The second is what counts as a new identity. The ANS v2 draft binds identity to a software version, so a code change produces a new version number and a new registration. The AgenID specification separates an agent from its deployments: the `agenid:` identifier is never re-keyed by a platform, configuration or deployment change, and deployments are distinct records under the same agent.",
          "The third is the verification path. The ANS v2 draft has a client check certificate validation, DANE records under DNSSEC, and Transparency Log proofs through separate channels. AgenID has a verifier recompute the manifest digest, verify the operator's Ed25519 signature, and compare the operator key served by the registry with the copy the operator publishes on its own domain ([two-path key discovery](/glossary/two-path-key-discovery)).",
        ],
      },
      {
        heading: "Where they are complementary",
        body: [
          "An agent can carry both. An operator with an ANS registration can also sign an AgenID manifest that names the same domain as `operator_domain`, and a relying party can check each independently: ANS for the certificate chain and transparency record around a versioned endpoint, AgenID for an operator-signed record that stays constant across versions, platforms and channels. Neither protocol currently defines a field that references the other.",
          "Both are identity systems. Knowing which agent is acting is not the same as knowing what it is allowed to do. The ANS v2 draft centers on identity, discovery and lifecycle records. AgenID v1.1.1 defines no signed authorization object at all, so permission decisions stay with the business on the other side and with the operator.",
        ],
      },
      {
        heading: "When to use which",
        body: ["These are fit questions, not quality judgments."],
        bullets: [
          "Consider ANS when your agents are reached at their own domains, you want identity expressed through X.509 certificates and DNS records that existing TLS tooling understands, and version-level registration matches your release process.",
          "Consider AgenID when you want one identifier that stays the same across versions and across voice, SMS, chat, email and API channels, signed by a key only the operator holds, and re-verifiable offline by anyone without an account.",
          "Consider both when a relying party should be able to check a domain-anchored certificate chain and an operator-signed manifest for the same agent.",
        ],
      },
      {
        heading: "AgenID's current limits",
        body: ["The comparison is only fair if AgenID's boundaries are stated as plainly as its design."],
        bullets: [CEILING, NO_REVOCATION, NO_AUTHORIZATION, TWO_PATH_LIMIT],
      },
    ],
    matrix: {
      columns: ["Dimension", "AgenID", "GoDaddy Agent Name Service (ANS)"],
      rows: [
        ["What is identified", "A persistent logical agent, independent of platform and deployment", "An agent anchored to a DNS domain, with identity bound to a software version"],
        ["Identifier format", "`agenid:<ULID>` (26-character Crockford base32)", "`ans://v{version}.{agentHost}` (semantic version plus domain name)"],
        ["Who issues and controls", "The operator signs with its own key; the registry validates and stores public material", "A Registration Authority verifies domain control via ACME and issues certificates"],
        ["Verification without trusting the issuer", "Envelope re-verified offline; the registry cannot forge an operator signature", "Client checks PKI, DANE under DNSSEC, and Transparency Log proofs through separate channels"],
        ["Keys and cryptography", "Pure Ed25519 over RFC 8785 canonical JSON; SHA-256 manifest digest", "X.509 Server Certificate (public CA) and Identity Certificate (private CA)"],
        ["Scope", "Public and portable across platforms and channels", "Domain-anchored; a code change produces a new version and registration"],
        ["Authorization model", "None in v1.1.1; a v1.2 authorization layer is a draft", "Centered on identity, discovery and lifecycle records"],
        ["Openness and license", "Specification MIT-licensed; independent conformance suite MIT", "Individual IETF Internet-Draft; registry implementation Apache 2.0"],
        ["Deployment status", "Registration, resolution, cards and badges live at www.agenid.com; ceiling L1_REGISTERED", "Registry presented on GoDaddy's ANS page; see GoDaddy for current availability"],
      ],
    },
    faqs: [
      {
        q: "Is AgenID a replacement for ANS?",
        a: "No. They attach identity to different things: ANS to a domain and a versioned certificate, AgenID to an operator key and a signed manifest. An agent can have both, and a relying party can check each independently.",
      },
      {
        q: "Does ANS use the same cryptography as AgenID?",
        a: "Not the same construction. The ANS v2 draft uses X.509 certificates from public and private certificate authorities plus a transparency log. AgenID uses pure Ed25519 signatures over RFC 8785 canonical JSON, with no certificate authority in the signing path.",
      },
      {
        q: "Does AgenID verify an operator's domain the way ANS does?",
        a: "AgenID can record evidence of domain control through an `_agenid` TXT record at [/verify/domain](/verify/domain), but that evidence raises nothing above L1_REGISTERED today. A domain-verified level requires an assertion signed by a root authority key, which has not been created yet.",
      },
      {
        q: "Is ANS an IETF standard?",
        a: "ANS v2 is published as an individual Internet-Draft. Like all individual drafts, it states that it has no formal standing in the IETF standards process.",
      },
      {
        q: "Does either system decide what an agent may do?",
        a: "Both are identity systems. Which agent is acting is a different question from what it is allowed to do. AgenID v1.1.1 has no authorization object, so that permission decision stays with the relying party.",
      },
    ],
    complementary:
      "ANS gives an agent a domain-anchored, version-bound certificate identity, and AgenID gives it an operator-signed identity that stays constant across versions and platforms; a relying party can check both for the same agent.",
    related: ["/learn/how-to-verify-an-ai-agent", "/glossary/two-path-key-discovery", "/glossary/domain-control-verification", "/glossary/root-authority-key", "/glossary/agenid-identifier", "/compare"],
    sources: [
      { label: "GoDaddy: Agent Name Service (ANS)", url: "https://www.godaddy.com/ans" },
      { label: "IETF Datatracker: draft-narajala-courtney-ansv2 (ANS v2)", url: "https://datatracker.ietf.org/doc/draft-narajala-courtney-ansv2/" },
      { label: "IETF Datatracker: draft-narajala-ans (replaced)", url: "https://datatracker.ietf.org/doc/draft-narajala-ans/" },
      { label: "GitHub: godaddy/ans-registry", url: "https://github.com/godaddy/ans-registry" },
      AGENID_SPEC_SOURCE,
    ],
    updated: "2026-09-23",
  },

  // ─────────────────────────────────────────────────── Microsoft Entra Agent ID
  {
    slug: "microsoft-entra-agent-id",
    subject: "Microsoft Entra Agent ID",
    owner: "Microsoft",
    title: "AgenID and Microsoft Entra Agent ID",
    description:
      "How AgenID's public, operator-signed agent identity relates to Microsoft Entra Agent ID's tenant-scoped agent identities, blueprints and access controls. Sourced.",
    h1: "AgenID and Microsoft Entra Agent ID: public identity and tenant identity",
    keywords: ["Microsoft Entra Agent ID", "Entra agent identity", "agent identity blueprint", "AI agent identity enterprise", "non-human identity AI agents"],
    subjectSummary: `Microsoft describes Microsoft Entra Agent ID as an identity and security framework that extends Microsoft Entra capabilities to AI agents, ${DATED}.`,
    lead: [
      "Microsoft Entra Agent ID and AgenID both give an AI agent an identity, but they serve different audiences. Entra Agent ID creates agent identities inside an organization's Microsoft Entra tenant, where they authenticate with OAuth and are governed by that organization's access policies. AgenID gives an agent a public identifier and an operator-signed record that anyone outside the operator's organization can resolve and re-verify.",
      "This page describes Microsoft Entra Agent ID as described in its public documentation as of September 2026, citing Microsoft Learn. It describes AgenID as the reference deployment at agenid.com runs today, including what it does not do. The two are largely complementary, which is why this page says \"and\" rather than \"vs\".",
    ],
    sections: [
      {
        heading: "What Microsoft Entra Agent ID is",
        body: [
          "Microsoft's [overview](https://learn.microsoft.com/en-us/entra/agent-id/what-is-microsoft-entra-agent-id) describes Entra Agent ID as an identity and security framework that extends Microsoft Entra capabilities to AI agents. Microsoft's [agent identity documentation](https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/what-is-agent-id) defines agent identities as identity accounts within Microsoft Entra ID that provide unique identification and authentication capabilities for AI agents, and states that each time an AI agent is created, it gets an agent identity in the Microsoft Entra tenant. Agents can request access tokens from Microsoft Entra and use those tokens to access web services.",
          "Agent identities are created from an [agent identity blueprint](https://learn.microsoft.com/en-us/entra/agent-id/agent-blueprint), which Microsoft describes as an object in Microsoft Entra ID that serves as a template for creating agent identities. According to that page, credentials used to authenticate an agent identity are configured on the blueprint, and OAuth permissions granted to a blueprint are granted to all agent identities created from it.",
          "Around the identity, Microsoft lists Conditional Access, ID Protection, identity governance, network controls, and sign-in and audit logs for agents, with support for OAuth 2.0, the Model Context Protocol and agent-to-agent authentication. Microsoft states that Agent ID is available for all Microsoft Entra customers and that extending Microsoft Entra security features to agents requires Microsoft Agent 365.",
        ],
      },
      {
        heading: "What AgenID is",
        body: [
          "AgenID is an open protocol, specified in the MIT-licensed [AgenID specification](https://github.com/AgenID-protocol/spec), that gives an AI agent a permanent identifier of the form `agenid:<ULID>`. The operator generates an Ed25519 key pair on its own machine or in the browser at [/issue](/issue), writes a [manifest](/glossary/agent-manifest) covering identity, ownership, purpose and disclosure, and signs a proof that binds that manifest by SHA-256 digest. The private key never leaves the operator.",
          "Anyone can resolve `https://www.agenid.com/a/<agenid>` to a [Verification Card](/glossary/verification-card) or, with `Accept: application/json`, to the [resolution envelope](/glossary/resolution-envelope), and re-verify it offline. There is no account, no tenant and no sign-in for the verifier. The registry holds no operator private keys and cannot forge an operator signature.",
        ],
      },
      {
        heading: "Key differences",
        body: [
          "Scope is the clearest difference. An Entra agent identity lives in a Microsoft Entra tenant and is meaningful to resources that accept tokens from Microsoft Entra. An AgenID identity is public and portable: a business receiving a phone call or an API request from the agent can check it without any relationship with the operator's directory or with AgenID.",
          "The source of assurance also differs. In Entra, a relying resource accepts an access token that Microsoft Entra issued to the agent. In AgenID, a verifier does not take the registry's word for anything: it recomputes the manifest digest, verifies the operator's Ed25519 signature over RFC 8785 canonical JSON, and compares the registry's copy of the operator key with the operator's own copy ([two-path key discovery](/glossary/two-path-key-discovery)).",
          "The largest difference is permission. Entra Agent ID is, to a large degree, an access-management system: Microsoft's [authorization documentation](https://learn.microsoft.com/en-us/entra/agent-id/authorization-agent-id) describes delegated and application permissions, a requirement that administrators explicitly consent to any app permission an agent gets, high-privilege directory roles such as Global Administrator that agents cannot hold, and inheritable permissions granted once at the blueprint. AgenID v1.1.1 has no permission model. It answers which agent is acting and who declared it, not what that agent is allowed to do.",
        ],
      },
      {
        heading: "Where they are complementary",
        body: [
          "The two fit on opposite sides of an organization's boundary. Inside the organization, Entra Agent ID governs which resources an agent may reach and records what it did. Outside, the counterparty that receives the agent's call, message or request usually has no access to that tenant; an AgenID identifier gives that counterparty a public, operator-signed record to check. An operator could run an agent with an Entra agent identity for internal access and publish an AgenID identity for the outside world. Neither system defines a link to the other today, so any mapping between them would be the operator's own configuration.",
        ],
      },
      {
        heading: "When to use which",
        body: ["These are fit questions, not quality judgments."],
        bullets: [
          "Consider Microsoft Entra Agent ID when your agents run inside a Microsoft Entra environment and you need them to authenticate to protected resources under Conditional Access, consent, governance and audit logging.",
          "Consider AgenID when parties outside your organization, who have no access to your directory, need to check which agent contacted them and which operator stands behind it.",
          "Consider both when the same agent both reaches internal resources and contacts outside businesses or people.",
        ],
      },
      {
        heading: "AgenID's current limits",
        body: ["AgenID's boundaries, stated as plainly as its design:"],
        bullets: [CEILING, NO_REVOCATION, NO_AUTHORIZATION, TWO_PATH_LIMIT],
      },
    ],
    matrix: {
      columns: ["Dimension", "AgenID", "Microsoft Entra Agent ID"],
      rows: [
        ["What is identified", "A persistent logical agent and its accountable operator", "An AI agent as an identity account in a Microsoft Entra tenant"],
        ["Identifier format", "`agenid:<ULID>`", "An agent identity object in Microsoft Entra ID, created from an agent identity blueprint"],
        ["Who issues and controls", "The operator signs with its own key; the registry stores public material", "The organization's Microsoft Entra tenant; credentials are configured on the blueprint"],
        ["Verification without trusting the issuer", "Offline re-verification; the registry cannot forge an operator signature", "Resources accept access tokens issued by Microsoft Entra"],
        ["Keys and cryptography", "Pure Ed25519 over RFC 8785 canonical JSON", "OAuth 2.0 access tokens requested with blueprint credentials"],
        ["Scope", "Public and portable; no tenant or account needed to verify", "Tenant-scoped, for resources that accept Microsoft Entra tokens"],
        ["Authorization model", "None in v1.1.1; a v1.2 authorization layer is a draft", "Delegated and application permissions, admin consent, blocked high-privilege roles, inheritable permissions"],
        ["Governance and monitoring", "Append-only registry event ledger; no revocation flow deployed", "Conditional Access, ID Protection, identity governance, sign-in and audit logs"],
        ["Openness and license", "Specification MIT-licensed; independent conformance suite MIT", "Microsoft service; Microsoft states Entra security features for agents require Microsoft Agent 365"],
        ["Deployment status", "Live at www.agenid.com; ceiling L1_REGISTERED", "Microsoft states Agent ID is available for all Microsoft Entra customers"],
      ],
    },
    faqs: [
      {
        q: "Is AgenID an alternative to Microsoft Entra Agent ID?",
        a: "Not in the usual sense. Entra Agent ID manages agent identities and their access inside an organization's tenant. AgenID gives an agent a public identity that parties outside that tenant can check. They address different audiences and can be used together.",
      },
      {
        q: "Can AgenID control what an agent can access?",
        a: "No. AgenID v1.1.1 defines no authorization object, and `permissions` and `authorizations` are reserved manifest keys. Which agent is acting is a separate question from what it is allowed to do; access control stays with systems such as the relying party's own policies.",
      },
      {
        q: "Does a verifier need a Microsoft or AgenID account to check an AgenID identity?",
        a: "Not an AgenID account. A verifier resolves `https://www.agenid.com/a/<agenid>` and re-verifies the signed envelope offline. Microsoft's documentation describes Entra agent identities as accounts within a Microsoft Entra tenant, used to obtain access tokens from Microsoft Entra.",
      },
      {
        q: "Does AgenID offer levels beyond self-declaration?",
        a: "The specification defines higher levels, but the reference deployment issues nothing above L1_REGISTERED today, because those levels require an assertion signed by a root authority key that has not been created yet.",
      },
      {
        q: "Does either system support agent-to-agent scenarios?",
        a: "Microsoft lists agent-to-agent authentication among Entra Agent ID's supported protocols. AgenID identities can be resolved by another agent the same way a person or program resolves them, but AgenID v1.1.1 does not bind a live request to a registered agent.",
      },
    ],
    complementary:
      "Microsoft Entra Agent ID governs what an agent may access inside an organization's tenant, and AgenID gives parties outside that tenant a public, operator-signed record of which agent is acting; one agent can have both.",
    related: ["/glossary/non-human-identity", "/glossary/declared-verified-authorized", "/glossary/agent-to-agent-authentication", "/learn/how-to-verify-an-ai-agent", "/glossary/root-authority-key", "/compare"],
    sources: [
      { label: "Microsoft Learn: What is Microsoft Entra Agent ID?", url: "https://learn.microsoft.com/en-us/entra/agent-id/what-is-microsoft-entra-agent-id" },
      { label: "Microsoft Learn: Agent identities", url: "https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/what-is-agent-id" },
      { label: "Microsoft Learn: Agent identity blueprints", url: "https://learn.microsoft.com/en-us/entra/agent-id/agent-blueprint" },
      { label: "Microsoft Learn: Authorization in Microsoft Entra Agent ID", url: "https://learn.microsoft.com/en-us/entra/agent-id/authorization-agent-id" },
      { label: "Microsoft Learn: What's new in Microsoft Entra Agent ID", url: "https://learn.microsoft.com/en-us/entra/agent-id/whats-new-agent-id" },
      AGENID_SPEC_SOURCE,
    ],
    updated: "2026-09-23",
  },

  // ───────────────────────────────────────────────────────────── Skyfire KYAPay
  {
    slug: "skyfire-kyapay",
    subject: "KYAPay",
    owner: "Skyfire",
    title: "AgenID and Skyfire KYAPay (Know Your Agent)",
    description:
      "A sourced comparison of AgenID's operator-signed agent identity and Skyfire's KYAPay identity and payment tokens: issuers, keys, verification and scope.",
    h1: "AgenID and Skyfire KYAPay: agent identity records and identity tokens",
    keywords: ["KYAPay", "Skyfire KYA", "Know Your Agent protocol", "agent payment token", "agentic commerce identity", "KYA token"],
    subjectSummary: `The KYAPay site describes Know Your Agent (KYA) as a protocol that gives AI agent developers a standardized way to identify themselves, the platform they run on and the users they represent, with KYAPay extending it to declare user intent and support tokenized payment credentials, ${DATED}.`,
    lead: [
      "AgenID and Skyfire's KYAPay both help a service decide what it is dealing with when an AI agent arrives. KYAPay does it with signed tokens, issued by a token issuer, that carry claims about the human principal, the agent platform and the agent, and can carry payment details. AgenID does it with a long-lived identifier and an operator-signed manifest that any party can resolve and re-verify, with no payment component.",
      "This page describes KYAPay as described in its public documentation as of September 2026, citing kyapay.org, Skyfire's site, the KYAPay Token Internet-Draft and the protocol's GitHub repository. It describes AgenID as the reference deployment at agenid.com runs today, including what it does not do.",
    ],
    sections: [
      {
        heading: "What KYAPay is",
        body: [
          "[kyapay.org](https://kyapay.org/) defines Know Your Agent (KYA) as a protocol that provides AI agent developers with a standardized way to identify themselves, the platform they are running on, and the users they represent, and says KYAPay extends it by declaring user intent and supporting tokenized payment credentials. [Skyfire](https://skyfire.xyz/) describes itself as giving AI agents verified identity and payment credentials that work across the open internet.",
          "The token format is specified in the Internet-Draft [draft-skyfire-oauth-kyapay-token](https://datatracker.ietf.org/doc/draft-skyfire-oauth-kyapay-token/), authored by contributors from Skyfire Systems and Self-Issued Consulting; as an individual draft it has no formal standing in the IETF standards process. The draft defines JWT-based KYA, PAY and combined KYA-PAY tokens, identified by `typ` values `kya+jwt`, `pay+jwt` and `kya-pay+jwt`. It says JWTs must be signed using allowed algorithms, currently `ES256`, and that a validator discovers the issuer's JWK Set at the issuer URL with the `/.well-known/jwks.json` suffix.",
          "Claims are grouped into a human identity object (`hid`, with email required), an agent platform object (`apd`) and an agent identity object (`aid`). The verification-related sub-claims under `hid` are optional. PAY tokens add payment fields such as amount (`amt`) and currency (`cur`). The [GitHub repository](https://github.com/skyfire-xyz/kyapay) places the specification under the Community Specification License 1.0 and the code under the MIT License.",
        ],
      },
      {
        heading: "What AgenID is",
        body: [
          "AgenID is an open protocol, specified in the MIT-licensed [AgenID specification](https://github.com/AgenID-protocol/spec), that gives an AI agent a permanent identifier, `agenid:<ULID>`. The operator generates an Ed25519 key pair locally or in the browser at [/issue](/issue), writes a [manifest](/glossary/agent-manifest) covering identity, ownership, purpose and disclosure, and signs a proof binding that manifest by SHA-256 digest.",
          "The registry at www.agenid.com serves the result at `https://www.agenid.com/a/<agenid>` as a [Verification Card](/glossary/verification-card) or a JSON [resolution envelope](/glossary/resolution-envelope) that anyone can re-verify offline. The manifest names the operator, not the end user the agent serves, and AgenID moves no money.",
        ],
      },
      {
        heading: "Key differences",
        body: [
          "The signer differs. A KYAPay token is signed by its issuer, and a validator checks it against the issuer's published JWK Set, so the validator's confidence rests on that issuer's key and on what that issuer checked. An AgenID record is signed by the operator's own key; the registry stores it but cannot sign it, and a verifier compares the registry's copy of the operator key with the operator's own published copy ([two-path key discovery](/glossary/two-path-key-discovery)).",
          "The subject differs. A KYAPay token describes a human principal, an agent platform and an agent, and optionally a payment. An AgenID identifier is permanent and describes one agent and its accountable operator, independent of any single transaction or platform.",
          "The cryptography differs: KYAPay specifies `ES256` JWTs; AgenID uses pure Ed25519 over RFC 8785 canonical JSON. And the payment scope differs entirely: PAY tokens carry payment information, while AgenID has no payment object.",
        ],
      },
      {
        heading: "Identity is not permission",
        body: [
          "Which agent is acting is a separate question from what it is allowed to do or spend. KYAPay's PAY fields express payment terms such as amount and currency within its token format. AgenID v1.1.1 expresses no permissions at all: it identifies the agent and operator, and any decision about what that agent may do stays with the relying party.",
        ],
      },
      {
        heading: "Where they are complementary",
        body: [
          "The two answer adjacent questions at the moment an agent reaches a service. A KYAPay token tells the service about the principal, the platform and, optionally, a payment, as vouched for by the token's issuer. An AgenID identifier tells the service which persistent agent this is and which operator signed its declaration, checkable without trusting the registry. Neither specification defines a claim that references the other today, so combining them would be a relying party's own policy.",
        ],
      },
      {
        heading: "When to use which",
        body: ["These are fit questions, not quality judgments."],
        bullets: [
          "Consider KYAPay when a service needs issuer-vouched information about the human principal and agent platform, or a payment token, in a JWT format.",
          "Consider AgenID when a counterparty needs a permanent, operator-signed identity for the agent itself that it can re-verify offline, with no account and no payment relationship.",
          "Consider both in agentic commerce flows where the merchant wants a persistent agent identity and an issuer-signed principal or payment token.",
        ],
      },
      {
        heading: "AgenID's current limits",
        body: ["AgenID's boundaries, stated as plainly as its design:"],
        bullets: [CEILING, NO_REVOCATION, NO_AUTHORIZATION, TWO_PATH_LIMIT],
      },
    ],
    matrix: {
      columns: ["Dimension", "AgenID", "Skyfire KYAPay"],
      rows: [
        ["What is identified", "A persistent logical agent and its accountable operator", "A human principal, agent platform and agent, per token"],
        ["Identifier format", "`agenid:<ULID>`", "JWT claims (`hid`, `apd`, `aid`) with `typ` `kya+jwt`, `pay+jwt` or `kya-pay+jwt`"],
        ["Who issues and controls", "The operator signs with its own key; the registry stores public material", "A token issuer signs each token"],
        ["Verification without trusting the issuer", "Offline re-verification; the registry cannot forge an operator signature", "Validator checks the signature against the issuer's JWK Set at `/.well-known/jwks.json`"],
        ["Keys and cryptography", "Pure Ed25519 over RFC 8785 canonical JSON", "`ES256` JWTs"],
        ["Scope", "Public and portable; permanent identifier", "Token-based; covers identity and optionally payment"],
        ["Authorization model", "None in v1.1.1; a v1.2 authorization layer is a draft", "PAY tokens carry payment terms such as amount and currency"],
        ["Openness and license", "Specification MIT-licensed; independent conformance suite MIT", "Specification under Community Specification License 1.0; code MIT; individual IETF Internet-Draft"],
        ["Deployment status", "Live at www.agenid.com; ceiling L1_REGISTERED", "Offered by Skyfire; see Skyfire for current availability"],
      ],
    },
    faqs: [
      {
        q: "Does AgenID handle payments like KYAPay?",
        a: "No. AgenID has no payment object and moves no money. It identifies an agent and its operator. KYAPay's PAY and KYA-PAY tokens carry payment information.",
      },
      {
        q: "Who signs a KYAPay token compared with an AgenID record?",
        a: "The KYAPay Token draft has the token's issuer sign it, and a validator checks it against that issuer's JWK Set. In AgenID, the operator signs with its own key, and the registry cannot sign on the operator's behalf.",
      },
      {
        q: "Does AgenID identify the human user behind an agent?",
        a: "No. An AgenID manifest names the operator accountable for the agent, with a contact address, not the end user it serves. KYAPay tokens include a human identity object with a required email claim.",
      },
      {
        q: "Is KYAPay a finished standard?",
        a: "The KYAPay Token specification is published as an individual Internet-Draft, which has no formal standing in the IETF standards process. The specification text in its repository is published under the Community Specification License 1.0.",
      },
      {
        q: "Can an AgenID identity say how much an agent may spend?",
        a: "No. Which agent is acting is separate from what it is allowed to do. AgenID v1.1.1 has no authorization object; `permissions` and `authorizations` are reserved manifest keys.",
      },
    ],
    complementary:
      "A KYAPay token carries issuer-vouched information about the principal, the platform and, optionally, a payment, and an AgenID identifier carries a permanent, operator-signed identity for the agent itself; a service can check both.",
    related: ["/glossary/know-your-agent", "/learn/know-your-agent-kya", "/glossary/agentic-commerce", "/how-it-works/financial-transaction", "/glossary/declared-verified-authorized", "/compare"],
    sources: [
      { label: "KYAPay: Know Your Agent protocol", url: "https://kyapay.org/" },
      { label: "IETF Datatracker: draft-skyfire-oauth-kyapay-token (KYAPay Token)", url: "https://datatracker.ietf.org/doc/draft-skyfire-oauth-kyapay-token/" },
      { label: "GitHub: skyfire-xyz/kyapay", url: "https://github.com/skyfire-xyz/kyapay" },
      { label: "Skyfire", url: "https://skyfire.xyz/" },
      AGENID_SPEC_SOURCE,
    ],
    updated: "2026-09-23",
  },

  // ─────────────────────────────────── Visa Trusted Agent Protocol / Web Bot Auth
  {
    slug: "visa-trusted-agent-protocol",
    subject: "Trusted Agent Protocol and Web Bot Auth",
    owner: "Visa (Trusted Agent Protocol); IETF webbotauth working group and Cloudflare (Web Bot Auth)",
    title: "AgenID and Visa Trusted Agent Protocol",
    description:
      "How AgenID's operator-signed agent identity relates to Visa's Trusted Agent Protocol and Web Bot Auth request signatures built on HTTP Message Signatures.",
    h1: "AgenID, Visa Trusted Agent Protocol and Web Bot Auth: identity records and signed requests",
    keywords: ["Visa Trusted Agent Protocol", "Web Bot Auth", "HTTP Message Signatures", "RFC 9421", "agentic commerce agent verification", "signed agent requests"],
    subjectSummary: `Visa describes the Trusted Agent Protocol as signature-based authentication for agentic commerce in which agents generate signatures that are specific to the merchant and purpose, time bound, and not replayable, based on HTTP Message Signatures (RFC 9421) and aligned with Web Bot Auth, ${DATED}.`,
    lead: [
      "Visa's Trusted Agent Protocol and the Web Bot Auth work it builds on sign individual HTTP requests, so a server can check that a request came from the holder of a published key. AgenID signs a different thing: a declaration about an agent and its operator, stored under a permanent identifier that anyone can resolve and re-verify. One is about the request in front of you; the other is about the agent's standing identity record.",
      "This page describes the Trusted Agent Protocol and Web Bot Auth as described in their public documentation as of September 2026, citing Visa's developer documentation and GitHub repository, Cloudflare's documentation, RFC 9421 and the IETF webbotauth working group. It describes AgenID as the reference deployment at agenid.com runs today, including what it does not do.",
    ],
    sections: [
      {
        heading: "What the Trusted Agent Protocol and Web Bot Auth are",
        body: [
          "Visa's [Trusted Agent Protocol overview](https://developer.visa.com/capabilities/trusted-agent-protocol/overview) describes agents generating signatures that are specific to the merchant and purpose, time bound, and unable to be replayed or relayed, so merchants can verify agents and connect a browsing or payment action to a customer's existing merchant account. Visa's page states that the product is in the process of development and deployment. The [specification page](https://developer.visa.com/capabilities/trusted-agent-protocol/trusted-agent-protocol-specifications) says the protocol is based on HTTP Message Signatures defined by RFC 9421 and aligned with Web Bot Auth. Its `Signature-Input` carries `created`, `expires`, `keyid`, `alg`, `nonce` and `tag`, with tag values `agent-browser-auth` for browsing and `agent-payer-auth` for payment. Examples include Ed25519, and public keys are retrieved as a JWKS. The specification describes the agent as a certified AI platform onboarded by a payment scheme, acting on behalf of its account holders.",
          "Visa's [GitHub repository](https://github.com/visa/trusted-agent-protocol) describes itself as a sample implementation, and its license file refers to the Visa Developer Center Terms of Use.",
          "Web Bot Auth is the underlying pattern. [Cloudflare's documentation](https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/) describes it as an authentication method that uses cryptographic signatures in HTTP messages to verify that a request comes from an automated bot. A bot hosts a key directory at `/.well-known/http-message-signatures-directory`, sends a `Signature-Agent` header pointing to it, uses the tag `web-bot-auth`, and Cloudflare supports Ed25519 keys. The IETF [webbotauth working group](https://datatracker.ietf.org/wg/webbotauth/about/) is active, and [draft-ietf-webbotauth-httpsig-protocol](https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/) is its working-group Internet-Draft. [RFC 9421](https://www.rfc-editor.org/rfc/rfc9421.html), HTTP Message Signatures, is a Standards Track RFC and includes EdDSA using Curve edwards25519.",
        ],
      },
      {
        heading: "What AgenID is",
        body: [
          "AgenID is an open protocol, specified in the MIT-licensed [AgenID specification](https://github.com/AgenID-protocol/spec), that gives an AI agent a permanent identifier, `agenid:<ULID>`. The operator generates an Ed25519 key pair locally or in the browser at [/issue](/issue) and signs a proof binding a [manifest](/glossary/agent-manifest) that declares identity, ownership, purpose and disclosure. The registry at www.agenid.com serves it at `https://www.agenid.com/a/<agenid>` as a [Verification Card](/glossary/verification-card) or a JSON [resolution envelope](/glossary/resolution-envelope) that anyone can re-verify offline.",
        ],
      },
      {
        heading: "Key differences",
        body: [
          "The signed object differs. Web Bot Auth and the Trusted Agent Protocol sign HTTP request components, with creation and expiry times and a nonce, so the signature is about one request. AgenID signs a proof over a manifest digest, so the signature is about an agent's declared identity, and it stays valid across requests. AgenID v1.1.1 does not bind a live HTTP request to a registered agent at all.",
          "The unit of identity differs. In the Trusted Agent Protocol specification, the agent is a certified AI platform onboarded by a payment scheme. In Web Bot Auth, the signer is the automated client whose key directory the `Signature-Agent` header names. In AgenID, the subject is an individual logical agent with an accountable operator.",
          "The key discovery differs. Web Bot Auth publishes keys in a JWKS directory at a well-known path on the signer's domain. AgenID publishes the operator key in the registry at `GET https://www.agenid.com/v1/keys/<key-ulid>` and expects the operator to publish a copy at `/.well-known/agenid/keys.json` on its own domain, so a verifier can compare the two ([two-path key discovery](/glossary/two-path-key-discovery)).",
        ],
      },
      {
        heading: "Identity is not permission",
        body: [
          "A valid request signature shows who sent a request; a valid AgenID record shows which agent an operator declared. Neither, on its own, says what the agent is allowed to do. AgenID v1.1.1 defines no authorization object, so permission decisions stay with the merchant or service.",
        ],
      },
      {
        heading: "Where they are complementary",
        body: [
          "Request signing and identity records sit at different layers, so they can be used together. A merchant could verify a signed request under Web Bot Auth or the Trusted Agent Protocol and separately resolve the agent's AgenID identifier to see its operator and declared purpose. Neither specification currently defines a field that carries or references the other, so linking them would be an implementation choice by the parties involved, not a feature of either protocol.",
        ],
      },
      {
        heading: "When to use which",
        body: ["These are fit questions, not quality judgments."],
        bullets: [
          "Consider Web Bot Auth when a server needs to check, per request, that automated traffic comes from the holder of a published key.",
          "Consider the Trusted Agent Protocol when you are a merchant or agent platform working within Visa's agentic commerce program.",
          "Consider AgenID when a counterparty needs a permanent, operator-signed identity for a specific agent that it can re-verify offline, across channels that include voice, SMS and email as well as HTTP.",
        ],
      },
      {
        heading: "AgenID's current limits",
        body: ["AgenID's boundaries, stated as plainly as its design:"],
        bullets: [CEILING, NO_REVOCATION, NO_AUTHORIZATION, TWO_PATH_LIMIT],
      },
    ],
    matrix: {
      columns: ["Dimension", "AgenID", "Visa Trusted Agent Protocol and Web Bot Auth"],
      rows: [
        ["What is identified", "A persistent logical agent and its accountable operator", "The sender of an HTTP request; in Visa's specification, a certified AI platform"],
        ["What is signed", "A proof binding the agent's manifest by SHA-256 digest", "HTTP request components, with created, expires, nonce and tag parameters"],
        ["Who issues and controls", "The operator signs with its own key; the registry stores public material", "The agent or platform signs each request with its own key"],
        ["Verification without trusting the issuer", "Offline re-verification of the envelope; the registry cannot forge an operator signature", "Server verifies the request signature against keys from the signer's JWKS directory"],
        ["Keys and cryptography", "Pure Ed25519 over RFC 8785 canonical JSON", "RFC 9421 HTTP Message Signatures; Ed25519 supported, with other algorithms in Visa's specification"],
        ["Key discovery", "Registry key endpoint plus the operator's `/.well-known/agenid/keys.json`", "JWKS directory, for Web Bot Auth at `/.well-known/http-message-signatures-directory`"],
        ["Scope", "Channel-independent identity record", "Per-request, HTTP traffic"],
        ["Authorization model", "None in v1.1.1; a v1.2 authorization layer is a draft", "Request authentication; tags distinguish browsing from payment interactions"],
        ["Openness and status", "Specification MIT-licensed; live at www.agenid.com with ceiling L1_REGISTERED", "RFC 9421 Standards Track; webbotauth working-group draft; Visa describes its product as in development and deployment"],
      ],
    },
    faqs: [
      {
        q: "Does AgenID sign HTTP requests like Web Bot Auth?",
        a: "No. AgenID v1.1.1 signs a proof over an agent's manifest, not individual requests, and nothing in it binds a live HTTP request to a registered agent. Web Bot Auth and the Trusted Agent Protocol sign requests using HTTP Message Signatures.",
      },
      {
        q: "Do they use the same signature algorithm?",
        a: "They overlap. RFC 9421 includes EdDSA using Curve edwards25519, Cloudflare supports Ed25519 for Web Bot Auth, and AgenID uses pure Ed25519. The bytes signed are different: an HTTP signature base versus RFC 8785 canonical JSON.",
      },
      {
        q: "Who is the agent in the Trusted Agent Protocol?",
        a: "Visa's specification describes the agent as a certified AI platform onboarded by a payment scheme, acting on behalf of its account holders. In AgenID, the subject is an individual agent with an accountable operator.",
      },
      {
        q: "Does a signed request mean the agent is allowed to buy something?",
        a: "Not by itself. A signature shows who sent the request. What the agent is allowed to do is a separate decision for the merchant. AgenID v1.1.1 has no authorization object.",
      },
      {
        q: "Can AgenID issue a verified level to a commerce agent today?",
        a: "The reference deployment issues nothing above L1_REGISTERED today. Higher levels require an assertion signed by a root authority key, and that key has not been created yet.",
      },
    ],
    complementary:
      "Web Bot Auth and the Trusted Agent Protocol authenticate individual HTTP requests, and AgenID provides a permanent, operator-signed identity record for the agent; a merchant can check a request signature and resolve the agent's identity separately.",
    related: ["/glossary/web-bot-auth", "/glossary/agentic-commerce", "/how-it-works/buying-tires", "/glossary/ed25519", "/glossary/two-path-key-discovery", "/compare"],
    sources: [
      { label: "Visa Developer: Trusted Agent Protocol overview", url: "https://developer.visa.com/capabilities/trusted-agent-protocol/overview" },
      { label: "Visa Developer: Trusted Agent Protocol specifications", url: "https://developer.visa.com/capabilities/trusted-agent-protocol/trusted-agent-protocol-specifications" },
      { label: "GitHub: visa/trusted-agent-protocol", url: "https://github.com/visa/trusted-agent-protocol" },
      { label: "Cloudflare Docs: Web Bot Auth", url: "https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/" },
      { label: "RFC 9421: HTTP Message Signatures", url: "https://www.rfc-editor.org/rfc/rfc9421.html" },
      { label: "IETF Datatracker: draft-ietf-webbotauth-httpsig-protocol", url: "https://datatracker.ietf.org/doc/draft-ietf-webbotauth-httpsig-protocol/" },
      { label: "IETF Datatracker: Web Bot Auth (webbotauth) working group", url: "https://datatracker.ietf.org/wg/webbotauth/about/" },
      AGENID_SPEC_SOURCE,
    ],
    updated: "2026-09-23",
  },

  // ──────────────────────────────────────────────────── Decentralized Identifiers
  {
    slug: "decentralized-identifiers",
    subject: "Decentralized Identifiers (DIDs)",
    owner: "W3C",
    title: "AgenID and Decentralized Identifiers (DIDs)",
    description:
      "How AgenID's agenid identifiers and signed manifests relate to W3C Decentralized Identifiers and Verifiable Credentials. A sourced, neutral comparison.",
    h1: "AgenID and Decentralized Identifiers (DIDs): how they relate",
    keywords: ["decentralized identifiers AI agents", "DID vs AgenID", "W3C DID Core", "verifiable credentials AI agents", "agent DID"],
    subjectSummary: `The W3C DID Core Recommendation describes decentralized identifiers (DIDs) as a new type of identifier that enables verifiable, decentralized digital identity, designed so that they may be decoupled from centralized registries, identity providers and certificate authorities, ${DATED}.`,
    lead: [
      "Decentralized Identifiers (DIDs) are a general-purpose W3C standard for identifiers whose control is proven cryptographically. AgenID is a narrower protocol for one kind of subject, an AI agent, with a fixed identifier format, a fixed manifest schema and a registry that serves the records without being trusted to vouch for them. Both put the proof in signatures rather than in a registry's say-so.",
      "This page describes DIDs and Verifiable Credentials as described in their public documentation as of September 2026, citing W3C specifications. It describes AgenID as the reference deployment at agenid.com runs today, including what it does not do.",
    ],
    sections: [
      {
        heading: "What DIDs and Verifiable Credentials are",
        body: [
          "[Decentralized Identifiers (DIDs) v1.0](https://www.w3.org/TR/did-core/) is a W3C Recommendation, published 19 July 2022. A DID has three parts: the `did:` scheme, a method name and a method-specific identifier, as in the specification's example `did:example:123456789abcdefghi`. A DID resolves to a DID document containing verification methods, such as public keys, and services related to the DID subject. Each DID method defines how its DIDs are created, resolved, updated and deactivated. The W3C [DID Extensions](https://www.w3.org/TR/did-extensions/) Group Note collects registered parameters and methods for the ecosystem.",
          "[Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/), a W3C Recommendation published 15 May 2025, describes a verifiable credential as a way to express a set of claims made by an issuer, secured from tampering, in a three-party ecosystem of issuers, holders and verifiers. It states that verification of a credential does not imply evaluation of the truth of the claims it encodes.",
        ],
      },
      {
        heading: "What AgenID is",
        body: [
          "AgenID is an open protocol, specified in the MIT-licensed [AgenID specification](https://github.com/AgenID-protocol/spec). Its agent identifiers have one fixed form, `agenid:<ULID>`, with keys identified as `agenid:key:<ULID>`. The operator generates an Ed25519 key pair locally or in the browser at [/issue](/issue), writes a [manifest](/glossary/agent-manifest) with identity, ownership, purpose and disclosure fields, and signs a [ManifestProof](/glossary/manifest-proof) that binds the manifest by SHA-256 digest.",
          "The registry at www.agenid.com serves each record at `https://www.agenid.com/a/<agenid>` as a [Verification Card](/glossary/verification-card) or a JSON [resolution envelope](/glossary/resolution-envelope). A verifier re-checks the envelope offline; the registry cannot forge an operator signature.",
        ],
      },
      {
        heading: "Key differences",
        body: [
          "Generality is the first difference. DID Core is a framework for any subject and any method, and leaves the details of creation, resolution and key management to each method. AgenID specifies one subject type, one identifier grammar, one signature scheme (pure Ed25519 over RFC 8785 canonical JSON) and one manifest schema that rejects unknown fields. AgenID v1.1.1 defines no DID method, and an `agenid:` identifier is not a DID.",
          "Resolution differs. A DID resolves through its method to a DID document. An AgenID identifier resolves through the registry to a resolution envelope carrying the manifest, the operator's proof, per-assertion checks and key-discovery pointers. The registry is a convenience, not an authority: a verifier recomputes everything from signatures and compares the registry's copy of the operator key with the operator's own copy ([two-path key discovery](/glossary/two-path-key-discovery)).",
          "Claims are structured differently. In the VC data model, any issuer can make claims about a subject. AgenID separates operator self-declaration (DECLARED, from the operator's proof) from authority verification (VERIFIED, from a VerificationAssertion) by object type, and never infers one from the other.",
          "They share a principle. The VC data model says verifying a credential does not evaluate the truth of its claims; AgenID's trust model says verification is not compliance, and the protocol shows who signed, not whether what they signed is true.",
        ],
      },
      {
        heading: "Identity is not permission",
        body: [
          "A DID, a credential or an AgenID record can each help establish which agent is acting. None of them, by itself, settles what the agent is allowed to do. AgenID v1.1.1 has no authorization object, and permission decisions stay with the relying party.",
        ],
      },
      {
        heading: "Where they are complementary",
        body: [
          "DIDs and AgenID can coexist around the same agent. An organization that already uses DIDs for its own identity could name the same organization as operator in an AgenID manifest, and a relying party could check each through its own mechanism. AgenID v1.1.1 does not define a DID method, a Verifiable Credential encoding of its records, or a field that references a DID, so any mapping between them today is the operator's own practice rather than part of either specification.",
        ],
      },
      {
        heading: "When to use which",
        body: ["These are fit questions, not quality judgments."],
        bullets: [
          "Consider DIDs and Verifiable Credentials when you need a general identity framework across many kinds of subjects and issuers, with a choice of DID methods.",
          "Consider AgenID when you need a narrow, fixed-format identity for AI agents that any counterparty can resolve at one address and re-verify offline, with operator accountability and disclosure fields built in.",
          "Consider both when an organization already manages DIDs and also wants its agents to carry a portable agent-specific identity.",
        ],
      },
      {
        heading: "AgenID's current limits",
        body: ["AgenID's boundaries, stated as plainly as its design:"],
        bullets: [CEILING, NO_REVOCATION, NO_AUTHORIZATION, TWO_PATH_LIMIT],
      },
    ],
    matrix: {
      columns: ["Dimension", "AgenID", "Decentralized Identifiers (DIDs)"],
      rows: [
        ["What is identified", "An AI agent and its accountable operator", "Any DID subject: a person, organization, thing or other entity"],
        ["Identifier format", "`agenid:<ULID>` only", "`did:<method>:<method-specific-id>`"],
        ["Who issues and controls", "The operator signs with its own key; the registry stores public material", "The DID controller, according to the rules of each DID method"],
        ["Resolution", "Registry resolution envelope at `https://www.agenid.com/a/<agenid>`", "DID resolution through the DID method to a DID document"],
        ["Verification without trusting the issuer", "Offline re-verification; the registry cannot forge an operator signature", "Verification methods in the DID document; trust depends on the method"],
        ["Keys and cryptography", "Pure Ed25519 over RFC 8785 canonical JSON", "Method-dependent verification methods"],
        ["Claims model", "DECLARED (operator proof) and VERIFIED (authority assertion), separated by object", "Verifiable Credentials: issuer, holder and verifier roles"],
        ["Authorization model", "None in v1.1.1; a v1.2 authorization layer is a draft", "Not defined by DID Core"],
        ["Openness and status", "Specification MIT-licensed; live at www.agenid.com with ceiling L1_REGISTERED", "W3C Recommendations: DID Core v1.0 (2022), VC Data Model v2.0 (2025)"],
      ],
    },
    faqs: [
      {
        q: "Is an AgenID identifier a DID?",
        a: "No. An AgenID identifier has the form `agenid:<ULID>`, and AgenID v1.1.1 defines no DID method. The two can describe the same agent or organization side by side.",
      },
      {
        q: "Is AgenID decentralized?",
        a: "AgenID uses a registry at www.agenid.com to serve records, but it does not ask verifiers to trust it. Operators hold their own keys, a verifier re-checks signatures offline, and the registry cannot forge an operator signature.",
      },
      {
        q: "Are AgenID records Verifiable Credentials?",
        a: "No. AgenID uses its own signed objects, a ManifestProof for operator declarations and a VerificationAssertion for authority verification, not the W3C VC data model.",
      },
      {
        q: "Does verifying a DID or an AgenID record prove the claims are true?",
        a: "No. The VC data model states that verification does not imply the truth of a credential's claims, and AgenID's trust model states that verification is not compliance. Both show who signed.",
      },
      {
        q: "Does either decide what an agent may do?",
        a: "Neither DID Core nor AgenID v1.1.1 defines an authorization model. Which agent is acting is a separate question from what it is allowed to do.",
      },
    ],
    complementary:
      "DIDs offer a general identity framework for any subject, and AgenID offers a fixed-format, agent-specific identity that any counterparty can resolve and re-verify offline; an organization can use both side by side.",
    related: ["/glossary/decentralized-identifier", "/glossary/agenid-identifier", "/glossary/declared-verified-authorized", "/glossary/resolution-envelope", "/learn/ai-agent-registry", "/compare"],
    sources: [
      { label: "W3C: Decentralized Identifiers (DIDs) v1.0", url: "https://www.w3.org/TR/did-core/" },
      { label: "W3C: Verifiable Credentials Data Model v2.0", url: "https://www.w3.org/TR/vc-data-model-2.0/" },
      { label: "W3C: Decentralized Identifier Extensions (Group Note)", url: "https://www.w3.org/TR/did-extensions/" },
      AGENID_SPEC_SOURCE,
    ],
    updated: "2026-09-23",
  },

  // ─────────────────────────────────────────────────────────────── A2A Agent Cards
  {
    slug: "a2a-agent-cards",
    subject: "A2A Agent Cards",
    owner: "A2A Protocol project (Linux Foundation)",
    title: "AgenID and A2A Agent Cards",
    description:
      "How AgenID's operator-signed agent identity relates to A2A Agent Cards, the discovery documents A2A servers publish. Sourced, neutral and complementary.",
    h1: "AgenID and A2A Agent Cards: identity records and discovery documents",
    keywords: ["A2A Agent Card", "Agent2Agent protocol", "agent-card.json", "agent discovery", "agent-to-agent authentication", "signed agent card"],
    subjectSummary: `The A2A specification describes the Agent Card as a document that every A2A server must make available, describing the server's identity, capabilities, skills and interaction requirements so clients can discover suitable agents and configure interactions, ${DATED}.`,
    lead: [
      "An A2A Agent Card tells a client how to work with an agent: what it can do, where to reach it and how to authenticate. An AgenID record tells a counterparty which agent this is and which operator signed its declaration, in a form anyone can re-verify without trusting the registry. The card is a discovery and interaction document; the AgenID record is an identity record. They fit together more than they overlap.",
      "This page describes A2A Agent Cards as described in their public documentation as of September 2026, citing the A2A specification and project repository. It describes AgenID as the reference deployment at agenid.com runs today, including what it does not do.",
    ],
    sections: [
      {
        heading: "What an A2A Agent Card is",
        body: [
          "The [A2A specification](https://a2a-protocol.org/latest/specification/), at version 1.0.0, describes A2A as an open standard for communication and interoperability between independent, potentially opaque AI agent systems. The project [repository](https://github.com/a2aproject/A2A) states that A2A is an open source project under the Linux Foundation, contributed by Google, licensed under Apache 2.0.",
          "Under the specification, A2A servers must make an Agent Card available. Clients can find one at `https://{server_domain}/.well-known/agent-card.json`, through registries or catalogs, or by direct configuration. The card carries the agent's name, description and interfaces, its skills and capability flags, a `provider` object naming the provider's organization and URL, and the security schemes a client must use, which include API keys, HTTP authentication, OAuth 2.0, OpenID Connect and mutual TLS.",
          "Agent Cards may be signed with JSON Web Signature (RFC 7515). Before signing, the card must be canonicalized with the JSON Canonicalization Scheme, RFC 8785. The protected header names the algorithm, for example ES256 or RS256, and a key ID, and may include a `jku` URL for a JSON Web Key Set. The specification says clients should verify at least one signature before trusting a card, retrieve keys over HTTPS, and may keep a trusted key store for known providers.",
        ],
      },
      {
        heading: "What AgenID is",
        body: [
          "AgenID is an open protocol, specified in the MIT-licensed [AgenID specification](https://github.com/AgenID-protocol/spec), that gives an AI agent a permanent identifier, `agenid:<ULID>`. The operator generates an Ed25519 key pair locally or in the browser at [/issue](/issue), writes a [manifest](/glossary/agent-manifest) covering identity, ownership, purpose and disclosure, and signs a proof binding the manifest by SHA-256 digest. The registry at www.agenid.com serves the result at `https://www.agenid.com/a/<agenid>` as a [Verification Card](/glossary/verification-card) or a JSON [resolution envelope](/glossary/resolution-envelope) that anyone can re-verify offline.",
        ],
      },
      {
        heading: "Key differences",
        body: [
          "Purpose differs. An Agent Card is written so a client can connect: interfaces, skills, capabilities and required authentication. An AgenID manifest is written so a counterparty can hold someone accountable: the agent's name and purpose, the operator and its domain and contact, and whether the agent is disclosed as an AI.",
          "Where the record lives differs. An Agent Card is typically served by the agent's own server at a well-known path. An AgenID record is served by a registry under a permanent identifier that does not change when the agent's endpoint, platform or version changes.",
          "Key trust differs. A2A leaves the question of which signing keys to accept to the client, whether through a `jku` URL or a trusted key store. AgenID specifies a procedure: confirm the key's role is `operator`, confirm its controller is the agent, and compare the key the registry serves at `GET https://www.agenid.com/v1/keys/<key-ulid>` with the operator's own copy at `/.well-known/agenid/keys.json` ([two-path key discovery](/glossary/two-path-key-discovery)).",
          "They share a building block: both canonicalize JSON with RFC 8785 before signing. A2A signs with JWS and algorithms such as ES256; AgenID signs with pure Ed25519 over the canonical bytes.",
        ],
      },
      {
        heading: "Identity is not permission",
        body: [
          "An Agent Card declares how clients must authenticate, and the specification states that A2A does not define the scope, representation, validity or revocation semantics of the authorization decision obtained when a task requires additional authorization. AgenID v1.1.1 defines no authorization object either. In both, which agent is acting is a different question from what it is allowed to do, and that decision stays with the implementation or the relying party.",
        ],
      },
      {
        heading: "Where they are complementary",
        body: [
          "A client that discovers an agent through its Agent Card can also resolve that agent's AgenID identifier to check which operator declared it, and compare the card's `provider` organization with the operator named in the signed manifest. A2A v1.0 defines no field for an AgenID identifier and AgenID v1.1.1 defines no Agent Card binding, so publishing the identifier alongside a card is an implementation choice, not a feature of either specification.",
        ],
      },
      {
        heading: "When to use which",
        body: ["These are fit questions, not quality judgments."],
        bullets: [
          "Use an A2A Agent Card when your agent speaks A2A and clients need to discover its skills, interfaces and authentication requirements.",
          "Use AgenID when counterparties, including people and businesses outside A2A, need a permanent, operator-signed identity for the agent that they can re-verify offline.",
          "Use both when an A2A agent also interacts with parties who need to know which operator stands behind it.",
        ],
      },
      {
        heading: "AgenID's current limits",
        body: ["AgenID's boundaries, stated as plainly as its design:"],
        bullets: [CEILING, NO_REVOCATION, NO_AUTHORIZATION, TWO_PATH_LIMIT],
      },
    ],
    matrix: {
      columns: ["Dimension", "AgenID", "A2A Agent Cards"],
      rows: [
        ["What is described", "An agent's identity, operator, purpose and disclosure", "An A2A server's identity, capabilities, skills and interaction requirements"],
        ["Identifier or location", "`agenid:<ULID>`, resolved at `https://www.agenid.com/a/<agenid>`", "Typically `https://{server_domain}/.well-known/agent-card.json`"],
        ["Who publishes and controls", "The operator signs with its own key; the registry stores public material", "The agent's provider publishes the card"],
        ["Signing", "Required: operator ManifestProof, pure Ed25519", "Optional: JWS signatures, for example ES256 or RS256"],
        ["Canonicalization", "RFC 8785 (JCS)", "RFC 8785 (JCS)"],
        ["Verification without trusting the issuer", "Offline re-verification plus comparison of registry and operator-hosted keys", "Client retrieves keys by `kid` and `jku` or from a trusted key store"],
        ["Authorization model", "None in v1.1.1; a v1.2 authorization layer is a draft", "Cards declare required authentication schemes; authorization semantics left to implementations"],
        ["Openness and license", "Specification MIT-licensed; independent conformance suite MIT", "Open source under the Linux Foundation, Apache 2.0"],
        ["Deployment status", "Live at www.agenid.com; ceiling L1_REGISTERED", "Specification version 1.0.0 released"],
      ],
    },
    faqs: [
      {
        q: "Is an AgenID record the same as an A2A Agent Card?",
        a: "No. An Agent Card describes how to interact with an A2A server. An AgenID record is an operator-signed identity for an agent, resolvable under a permanent identifier. An agent can have both.",
      },
      {
        q: "Do Agent Cards and AgenID use the same canonicalization?",
        a: "Yes. The A2A specification requires RFC 8785 canonicalization before signing an Agent Card, and AgenID signs RFC 8785 canonical JSON. The signature formats differ: JWS for A2A, pure Ed25519 over the canonical bytes for AgenID.",
      },
      {
        q: "Can I put an AgenID identifier in an Agent Card?",
        a: "A2A v1.0 defines no field for it, and AgenID v1.1.1 defines no Agent Card binding, so doing so would be your own implementation choice rather than part of either specification.",
      },
      {
        q: "Does a signed Agent Card or AgenID record say what an agent may do?",
        a: "No. Both help establish which agent is acting. What it is allowed to do is decided by the implementation or the relying party; AgenID v1.1.1 has no authorization object.",
      },
      {
        q: "Can an A2A agent get a verified AgenID level today?",
        a: "The reference deployment issues nothing above L1_REGISTERED today. Higher levels require an assertion signed by a root authority key, which has not been created yet.",
      },
    ],
    complementary:
      "An A2A Agent Card tells a client how to interact with an agent, and an AgenID record tells a counterparty which agent it is and which operator signed its declaration; one agent can publish both.",
    related: ["/glossary/agent-card", "/glossary/agent-to-agent-authentication", "/learn/agent-to-agent-authentication", "/glossary/rfc-8785-jcs", "/how-it-works/agent-delegation", "/compare"],
    sources: [
      { label: "A2A Protocol specification", url: "https://a2a-protocol.org/latest/specification/" },
      { label: "GitHub: a2aproject/A2A", url: "https://github.com/a2aproject/A2A" },
      AGENID_SPEC_SOURCE,
    ],
    updated: "2026-09-23",
  },
];
