import type { ContentPage } from "./types";

/**
 * Pillar hubs.
 *
 * WHY_HUB expands /why-agent-identity into the site's pillar page. It preserves the
 * substance of the page it replaces: agents act without a human per step; session
 * tokens and API keys answer only for a session; the five directions; the "claim about
 * incentives and architecture, not a claim about law" framing; and the three things
 * AgenID adds. VOICE_HUB is the /use-cases/voice-agents page.
 */

const CEILING =
  "The reference deployment at agenid.com issues nothing above L1_REGISTERED today: L2 and higher require a VerificationAssertion signed by a root authority key, and that key has not been created yet. L5 is reserved and is not issuable at all.";

// -----------------------------------------------------------------------------

export const WHY_HUB: ContentPage = {
  slug: "why-agent-identity",
  title: "Why AI Agents Need an Identity",
  description:
    "AI agents now call, book, buy and act for organizations. Why a portable, independently verifiable identity becomes infrastructure once that is true.",
  h1: "Why AI agents need an identity",
  keywords: [
    "AI agent identity",
    "why AI agents need identity",
    "verify AI agents",
    "agent provenance",
    "know your agent",
    "AI agent impersonation",
    "agent accountability",
  ],
  lead: [
    "AI agents now call businesses, book appointments, compare prices, place orders and hand work to other agents on behalf of people and organizations. What makes them useful is that they act without a human approving each step. That is also what makes the question of who they are different from the one the web already answers.",
    "Today's credentials were built for a person at a keyboard or a service holding a secret. A session token or an API key answers for a session: it says the caller once logged in or holds a key. It says nothing portable about which agent is acting, who operates it, or whether anyone independent has checked either. This page sets out why a portable, independently verifiable agent identity becomes infrastructure once agents act on their own, what AgenID adds, and where its limits are today.",
  ],
  sections: [
    {
      heading: "The problem: agents act without a human per step",
      body: [
        "When a person uses a website, accountability travels with the person. They log in, they click, and if something goes wrong there is someone who answers for it. When an agent acts, the person or organization it represents is usually not watching that step. The agent decides, within whatever instructions it was given, and the counterparty sees only the agent.",
        "The credentials in use today do not close that gap. A session token proves that someone authenticated to one service at some point. An API key proves that the caller holds a secret one service issued. Both are scoped to a relationship between a caller and a single service, and both are silent on the questions a counterparty actually has: which agent is this, who runs it, what does it say it is for, and has anyone other than its operator checked any of that.",
        "Those questions cannot be answered from inside one platform either. An agent built on one vendor's stack may call a business that has never heard of that vendor. Whatever identity the platform assigned stops at the platform's edge, which is exactly where the interesting interactions begin.",
      ],
    },
    {
      heading: "Five directions an agent faces",
      body: [
        "An agent's identity is not one relationship but several. Each direction below has its own counterparty with its own question, and a credential that serves one direction rarely serves the others.",
      ],
      bullets: [
        "Human→Agent: a person deciding whether to talk to, rely on, or hand a task to an agent needs to know it is an AI, who operates it and what it claims to be for.",
        "Agent→Agent: an agent delegating work to another agent, or accepting work from one, needs to know which agent is on the other end before handing anything over.",
        "Agent→API: a service receiving automated calls needs to tell one agent from another, and a known operator's agent from an anonymous script.",
        "Agent→Business: a company answering a phone call, a booking or an inquiry from an agent needs to know who sent it and who answers for it.",
        "Agent→Transaction: a party settling a purchase or a commitment made by an agent needs a stable record of which agent acted, so the transaction can be attributed later.",
      ],
    },
    {
      heading: "A claim about incentives and architecture",
      body: [
        "The argument for agent identity here is a claim about incentives and architecture, not a claim about law. It does not depend on any regulation requiring it. It rests on two observations. First, as agents act more often without a human per step, every counterparty has an incentive to ask who is acting, and the cost of not knowing grows with the value of what agents are allowed to do. Second, the architecture of existing credentials cannot answer that question portably, because each one is issued by and meaningful to a single service.",
        "Regulation may add its own requirements, and some already concern disclosure that a person is talking to an AI. The case for identity would hold without them. That matters because infrastructure built to satisfy one rule tends to be shaped around that rule, while infrastructure built around the incentives of every party tends to be useful to each of them.",
      ],
    },
    {
      heading: "The threat: impersonation, unaccountable agents and lock-in",
      body: [
        "Three failure modes follow from agents acting without a portable identity. None of them requires a sophisticated attacker.",
      ],
      bullets: [
        "Impersonation. An agent can say any name, adopt any voice and claim to represent any company. Without something the counterparty can check, a claim of \"I'm calling for this business\" costs nothing to make and nothing to fake.",
        "Unaccountable agents. When something goes wrong, reconstructing which agent acted, and who operated it, depends on whichever participant's logs you can get. Each has its own account of events and its own reasons to tell it a certain way.",
        "Platform lock-in. If identity lives inside one platform, an agent's history and reputation belong to that platform. Moving the agent to a different vendor means starting from zero, and counterparties can only check identities issued by platforms they already have a relationship with.",
      ],
    },
    {
      heading: "The solution: what AgenID adds",
      body: [
        "AgenID is an open protocol for agent identity. It adds three things that the existing credentials do not.",
        "A permanent identifier bound to a signed operator manifest. Every agent gets an identifier of the form `agenid:<ULID>`, such as the spec's example `agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC`. Behind it is a manifest in which the operator states the agent's name and description, the operating organization and its domain, the agent's purpose and channels, and whether it is an AI, whether it discloses that to users and whether a human can take over. The operator signs it with its own key. The identifier survives a change of platform: the agent can move from one vendor to another and keep the same identity, history and record.",
        "A strict separation between what was declared and what was independently checked. The operator's own statements are DECLARED. A specific claim that an authority checked against evidence, such as control of a domain, is VERIFIED at a named level and only for that claim. What an agent is permitted to do is a third question, AUTHORIZED, which is never inferred from the other two. Which agent is acting is not the same question as what it is allowed to do.",
        "Machine-readable resolution. Anyone can resolve an identifier at `https://www.agenid.com/a/<agenid>`. A browser gets a Verification Card; a client that asks for `application/json` gets the canonical resolution envelope, which carries the proof check, per-assertion checks, the highest currently valid level and pointers to where the operator's key can be fetched. No account, API key or business relationship with AgenID is needed.",
      ],
    },
    {
      heading: "Provenance: a record that stays attached to the agent",
      body: [
        "Provenance is the question of where an agent came from and who stands behind it. In AgenID it is carried by signed objects rather than by a platform's say-so. The manifest is never signed directly: a ManifestProof signs a payload that binds the manifest by its SHA-256 digest, using Ed25519 over RFC 8785 canonical JSON. Change one character of the manifest and the digest no longer matches, which a verifier detects before any signature math.",
        "Because the identifier is permanent and keys that are retired or revoked stay resolvable, historical signatures remain checkable. An interaction that happened months ago can still be attributed to the agent and operator that signed for it, even if the operator has since rotated keys or moved platforms. That is what lets history and reputation accumulate on the agent rather than on the service it happened to be using.",
      ],
    },
    {
      heading: "Independent verification: you do not have to trust the registry",
      body: [
        "A registry that asks to be believed would be one more platform. AgenID is built so that the registry is not the authority. The resolution envelope carries the signed manifest, the proof and the operator's public key, and a verifier re-runs the checks itself, offline, with nothing but the envelope. The registry cannot forge an operator's signature, so it cannot fabricate what an operator said.",
        "The remaining position a registry could abuse is the key itself: it could serve a key it controls. Two-path key discovery addresses that. The operator's key can be fetched from the registry at `https://www.agenid.com/v1/keys/<key-ulid>` and from the operator's own domain at `https://<operator_domain>/.well-known/agenid/keys.json`. A verifier compares both and treats disagreement as a failure. The boundary is stated plainly: the second copy is published by the operator, and where it is missing, a verifier has one source, not two.",
        "The protocol is specified in the open. The normative [specification](https://github.com/AgenID-protocol/spec) and an independent, MIT-licensed [conformance suite](https://github.com/AgenID-protocol/conformance) are public, so implementations other than AgenID's can be checked against the same rules.",
      ],
    },
    {
      heading: "The honest limits today",
      body: [
        "An identity layer earns its place by being exact about what it has and has not established. These are the limits of the reference deployment today.",
      ],
      bullets: [
        "The issuance ceiling. " + CEILING + " L1_REGISTERED means the registry validated the schema, the digest binding and the operator's signature; it is a self-declaration and renders amber, never emerald.",
        "No revocation flow. Agent status values exist in the schema so the envelope's shape is stable, but nothing writes them. Every registered agent is active, and there is no deployed way to revoke an agent or a key.",
        "No authorization object in v1.1.1. The protocol defines no signed statement of what an agent may do; `permissions` and `authorizations` are reserved manifest keys. A v1.2 authorization layer exists only as a draft in development. Permission today stays with the operator and with the party on the other side.",
        "No request-level binding. Nothing yet ties a live request, or a live call, to a registered agent. A signature authenticates a signed object, and an object can be handed over by anyone who has seen it.",
        "Operator attestations are self-declared. Whether an agent discloses that it is an AI, or lets a human take over, is the operator's signed statement. No one, including AgenID, can verify it from an API.",
      ],
    },
    {
      heading: "Start here",
      body: [
        "If you want to check an agent, start with [how to verify an AI agent](/learn/how-to-verify-an-ai-agent), which walks through resolving an identifier and re-verifying the envelope. [Know your agent](/learn/know-your-agent-kya) explains the idea of applying know-your-customer thinking to agents, [what an AI agent registry is](/learn/ai-agent-registry) explains the role a registry plays, and [agent-to-agent authentication](/learn/agent-to-agent-authentication) covers the Agent→Agent direction.",
        "For terms, the [glossary](/glossary) defines each concept used here. For how AgenID relates to other approaches, see the [comparisons](/compare). If your agents make or take phone calls, read the [voice agents use case](/use-cases/voice-agents). To see the whole mechanism in motion, the [scenario library](/how-it-works) plays common interactions with and without an agent identity. To register an agent, go to [/issue](/issue).",
      ],
    },
  ],
  faqs: [
    {
      q: "Why isn't an API key enough to identify an AI agent?",
      a: "An API key answers for a session with one service: the caller holds a secret that service issued. It says nothing portable about which agent is acting or who operates it, and no other service can check it.",
    },
    {
      q: "Does an AgenID mean an agent is allowed to act for me?",
      a: "No. An AgenID says which agent is acting and what its operator declared. What it is allowed to do is a separate decision, and protocol v1.1.1 defines no signed authorization object.",
    },
    {
      q: "Do I need to trust AgenID to verify an agent?",
      a: "No. The envelope carries the signed manifest, proof and key, and you re-verify them yourself. The operator's key can also be fetched from the operator's own domain and compared.",
    },
    {
      q: "What happens to an agent's identity if it moves to another platform?",
      a: "It keeps the same identifier. The identity is bound to the operator's signed manifest, not to the platform the agent runs on.",
    },
    {
      q: "Which verification levels can an agent get today?",
      a: CEILING,
    },
  ],
  related: ["/learn/how-to-verify-an-ai-agent", "/glossary/declared-verified-authorized", "/how-it-works", "/use-cases/voice-agents", "/compare", "/issue"],
  sources: [
    { label: "AgenID protocol specification (public repository)", url: "https://github.com/AgenID-protocol/spec" },
    { label: "AgenID conformance suite (public repository)", url: "https://github.com/AgenID-protocol/conformance" },
  ],
  updated: "2026-09-23",
};

// -----------------------------------------------------------------------------

export const VOICE_HUB: ContentPage = {
  slug: "voice-agents",
  title: "Verify AI Voice Agent Callers",
  description:
    "When an AI voice agent calls your business, who sent it? How to resolve a calling agent's AgenID, what it establishes, and what it cannot establish yet.",
  h1: "How to verify an AI voice agent that calls your business",
  keywords: [
    "verify AI voice agent",
    "AI voice agent caller verification",
    "is this caller a bot",
    "AI phone agent identity",
    "voice agent disclosure",
    "EU AI Act Article 50",
  ],
  lead: [
    "A receptionist picks up and the voice on the line says it is calling on behalf of a customer, a clinic or a supplier. It may be a person. Increasingly it is an AI voice agent. The two questions that follow are simple to ask and hard to answer: is this a bot, and who sent it?",
    "Caller ID can be spoofed and a voice agent can say any name. This page explains how a business can resolve a calling agent's AgenID to see which operator declared it and what that operator signed, how operators attach an AgenID to the voice agents they run, how the disclosure fields relate to AI transparency rules, and, just as important, what a voice identity cannot establish yet.",
  ],
  sections: [
    {
      heading: "The problem: who is calling, and who sent it",
      body: [
        "Phone systems were designed around people. Caller ID reports a number, and the number says little about who is on the line and can be spoofed. A human caller can be asked questions, recognized over time and held accountable. A voice agent can be pleasant, fluent and confident while representing anyone, or no one.",
        "A business that takes calls from agents has two poor defaults. It can refuse every automated caller, which becomes harder to sustain as customers hand routine calls to assistants. Or it can act on claims it cannot check, which invites impersonation: a caller that says it represents a known company costs nothing to make. What is missing is a stable identifier the business can look up for itself, independent of the phone network and of the platform the agent runs on.",
        "Which agent is calling is also not the same question as what it is allowed to do. Knowing who sent a caller does not decide whether to share a record, move an appointment or accept an order. That decision stays with the business.",
      ],
    },
    {
      heading: "How a business resolves a calling agent's AgenID",
      body: [
        "An AgenID is an identifier of the form `agenid:<ULID>`; the spec's example is `agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC`. When an agent presents one, by stating it, passing it in call metadata or including it in a follow-up message, the business can check it without an account or a relationship with AgenID.",
      ],
      bullets: [
        "Resolve it. Open `https://www.agenid.com/a/<agenid>` in a browser for the Verification Card, or request it with `Accept: application/json` for the resolution envelope. The [verify page](/verify) does the same from a search box.",
        "Read the operator's manifest. It names the agent, the operating organization and its domain, the agent's purpose and channels, and the three disclosure attestations.",
        "Re-verify it rather than trusting the page. The envelope carries the signed ManifestProof and the operator's public key, so the signature and the manifest digest can be checked offline. The registry cannot forge an operator's signature.",
        "Compare the operator's key from two places: the registry at `https://www.agenid.com/v1/keys/<key-ulid>` and the operator's own domain at `https://<operator_domain>/.well-known/agenid/keys.json`. If the operator publishes no copy, you have one source, not two.",
      ],
    },
    {
      heading: "What a resolved identity tells you",
      body: [
        "A successful resolution tells you that an operator registered this identifier, what that operator declared about the agent, and that the declaration has not been altered since it was signed. It is a self-declaration. " +
          CEILING,
        "That is still useful for a phone line. A business can recognize the same agent across calls, see which organization claims to operate it, and keep a record that can be checked again later. It cannot yet conclude that the domain or organization named in the manifest has been independently checked, and it cannot conclude that the voice on this particular call is the registered agent, for reasons explained below.",
      ],
    },
    {
      heading: "How operators attach an AgenID to voice agents",
      body: [
        "An operator registers each agent at [/issue](/issue), where the signing key is generated in the browser and never sent to AgenID, or with the command-line tool described in the [onboarding guide](/docs/onboarding). The result is a permanent identifier that stays the same if the agent later moves to a different voice platform.",
        "For the major voice platforms, AgenID publishes integration patterns describing how an operator could carry the identifier alongside an agent built there. Each is a pattern, not a package: no adapter package exists for any of them, and none is an installable integration.",
      ],
      bullets: [
        "[Retell AI integration](/docs/partners/retell-ai-integration): pattern, not a package.",
        "[Vapi integration](/docs/partners/vapi-integration): pattern, not a package.",
        "[Bland AI integration](/docs/partners/bland-ai-integration): pattern, not a package.",
        "[ElevenLabs integration](/docs/partners/elevenlabs-integration): pattern, not a package.",
      ],
    },
    {
      heading: "Disclosure rules: EU AI Act Article 50 as context",
      body: [
        "Disclosure that a caller is an AI is increasingly a regulatory topic, not only a courtesy. Article 50 of the EU AI Act, on transparency obligations, provides that AI systems intended to interact directly with natural persons are to be designed and developed so that the people concerned are informed they are interacting with an AI system, unless that is obvious from the context. The article also covers other transparency duties beyond conversational systems.",
        "This is context, not legal advice. Whether and how Article 50 applies to a particular voice agent depends on the facts and on the text in force, which should be read at the source and assessed with counsel. AgenID does not make an agent compliant with any law. What it offers is a place for an operator to state, under its own signature, how its agent behaves, in a form a counterparty can resolve and re-check.",
      ],
    },
    {
      heading: "The disclosure attestations are signed self-declarations",
      body: [
        "Every manifest carries three disclosure fields: `is_ai`, `discloses_to_user` and `human_escalation`. They say whether the agent is an AI, whether it tells the people it talks to that it is one, and whether a human can take over the conversation.",
        "These are operator self-declarations made under signature. They are not verified behavior. No API can observe whether an agent actually announces itself on a call or actually transfers to a person, so no one, including AgenID, can check these claims. What the signature does establish is attribution: the operator made this statement, it has not been altered, and it stays attached to the agent's permanent identifier. If a caller's behavior contradicts its operator's signed declaration, the business has a durable record of what was promised and by whom.",
        "In the browser issuance flow the two behavioral attestations start as false, so an operator has to set them deliberately rather than sign a default.",
      ],
    },
    {
      heading: "See it in a scenario",
      body: [
        "Two scenarios show the mechanism on a phone line. In [booking an appointment](/how-it-works/dentist-appointment), a personal assistant calls a dental practice and the practice's own agent resolves the caller before opening the calendar. In [sales outreach](/how-it-works/sales-outreach), an outbound agent calls a prospect and the question runs the other way: who is selling to me, and on whose behalf. Both are illustrations of the protocol and label themselves that way.",
      ],
    },
    {
      heading: "The honest limits for voice today",
      body: [
        "The largest limit is recorded in AgenID's own security analysis as GAP-C1: nothing yet binds a live request, and therefore a live call, to a registered agent in v1.1.1. An agent can state an AgenID, and the business can confirm that the identifier resolves and that its manifest verifies. It cannot confirm from the protocol alone that the voice on the line is the agent that identifier belongs to, because a signature authenticates a signed object and an object can be repeated by anyone who has seen it.",
        "The scenarios show one way this could be closed: the business issues a fresh challenge during the call and the agent answers it with its key. Challenge-response is a proposed pattern. v1.1.1 defines the signed objects, not that exchange, and nothing in the reference deployment performs it today.",
        "Two further limits apply. There is no deployed revocation flow, so an operator cannot yet mark an agent as withdrawn. And there is no signed authorization object in v1.1.1, so an AgenID never tells a business what a caller is permitted to do.",
      ],
    },
  ],
  faqs: [
    {
      q: "How can I tell if a caller is an AI voice agent?",
      a: "Ask for its AgenID and resolve it. The operator's manifest includes a signed is_ai declaration. It is a self-declaration, and nothing yet binds the voice on the call to the registered agent.",
    },
    {
      q: "Does an AgenID prove who sent the caller?",
      a: "It shows which operator registered the identifier and signed its manifest, and that the manifest is unaltered. " + CEILING,
    },
    {
      q: "Does registering an AgenID make my voice agent compliant with Article 50?",
      a: "No. AgenID lets you sign a disclosure statement a counterparty can check. Compliance depends on how the agent actually behaves and on the law as applied to your facts. This is not legal advice.",
    },
    {
      q: "Is there a Retell, Vapi, Bland or ElevenLabs plugin for AgenID?",
      a: "No. The partner documents are integration patterns, not packages. No adapter package exists for any platform.",
    },
    {
      q: "Can a verified caller ID replace an AgenID?",
      a: "They answer different questions. A phone number identifies a line; an AgenID identifies an agent and the operator that declared it, across platforms and channels.",
    },
  ],
  related: ["/how-it-works/dentist-appointment", "/how-it-works/sales-outreach", "/docs/partners", "/glossary/eu-ai-act-article-50", "/learn/how-to-verify-an-ai-agent", "/why-agent-identity"],
  sources: [
    { label: "Regulation (EU) 2024/1689 (Artificial Intelligence Act), EUR-Lex", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj" },
    { label: "EU AI Act, Article 50: Transparency obligations (text)", url: "https://artificialintelligenceact.eu/article/50/" },
    { label: "AgenID protocol specification (public repository)", url: "https://github.com/AgenID-protocol/spec" },
  ],
  updated: "2026-09-23",
};
