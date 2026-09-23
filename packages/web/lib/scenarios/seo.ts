/**
 * Search-landing content for every /how-it-works page.
 *
 * Each scenario page is also the site's landing page for one search intent ("how does a
 * business verify an AI agent that calls it", "agent-to-agent delegation audit trail",
 * ...). The animation carries the argument; this module carries the server-rendered
 * prose a crawler and a skimming reader both need: a keyword-bearing title and H1, a
 * meta description, explanatory sections, an FAQ (also emitted as FAQPage JSON-LD) and
 * related-scenario links.
 *
 * It lives in lib/scenarios/ on purpose, so every guard in test/scenarios.test.ts —
 * no L5, no invented identifier, no key material, no hex colour — applies to this copy
 * too. test/scenario-seo.test.ts adds the SEO-specific guards (lengths, coverage,
 * overclaim vocabulary, and that every page still states what cannot be issued).
 *
 * Content rule, same as the rest of the site: explain the protocol, never claim the
 * reference deployment does more than it does. Anything above L1_REGISTERED is
 * described as the model, and the page renders ISSUANCE_CEILING beside it.
 */

import { NEW_SCENARIO_SEO } from "./more";

export interface SeoSection {
  readonly heading: string;
  readonly body: readonly string[];
}

export interface SeoFaq {
  readonly q: string;
  readonly a: string;
}

export interface ScenarioSeo {
  /** <title> text before the " · AgenID" template suffix. */
  readonly title: string;
  /** Meta description, 120–165 characters. */
  readonly description: string;
  /** The page's single H1. */
  readonly h1: string;
  readonly keywords: readonly string[];
  /** Opening paragraphs, rendered above the animation. */
  readonly lead: readonly string[];
  readonly sections: readonly SeoSection[];
  readonly faqs: readonly SeoFaq[];
  /** Other catalogue slugs to link to. */
  readonly related: readonly string[];
}

const LEVELS_TODAY =
  "Today the reference registry at agenid.com issues DECLARED and L1_REGISTERED. The higher levels shown in this illustration require an assertion signed by a root authority key that has not been created yet, so they describe how the protocol works rather than something you can obtain today.";

const IDENTITY_NOT_PERMISSION =
  "No. AgenID answers which agent is acting and who declared it. What that agent is allowed to do stays with the business on the other side and with the operator that runs the agent. Protocol v1.1.1 defines no signed authorization object.";

const BASE_SEO: Readonly<Record<string, ScenarioSeo>> = {
  "why-identity": {
    title: "AI Agent Identity Verification: Claim vs. Proof",
    description:
      "An AI agent saying who it is proves nothing. See how AgenID turns an agent's claim into a signed identity any business can independently re-verify.",
    h1: "AI agent identity verification: why a claim is not a proof",
    keywords: ["AI agent identity verification", "verify AI agent identity", "AI agent authentication", "agent identity protocol", "cryptographic agent identity"],
    lead: [
      "Every AI agent that calls a business, places an order or negotiates on someone's behalf opens with the same sentence: \"I'm acting for this person.\" Without a portable identity layer, the other side has no way to check it. The name, the voice and the confidence are all things any agent can produce.",
      "AgenID gives an agent a permanent identifier and a signed record behind it, so the question \"who are you?\" gets an answer the other side can check for itself instead of taking on faith. The animation below plays the same moment twice: once without AgenID, once with it.",
    ],
    sections: [
      {
        heading: "What changes when an agent presents an AgenID",
        body: [
          "Without an identity layer the conversation stops at the claim. The relying party can refuse, or it can take a risk it cannot measure. With AgenID the agent presents an identifier of the form agenid:<ULID>. The relying party resolves it, reads the operator's signed manifest, and re-verifies the Ed25519 signature over RFC 8785 canonical JSON itself. It does not need to trust AgenID's registry to do that, because the registry cannot forge an operator's signature.",
          "The identifier stays the same across every platform the agent uses, which means history and reputation attach to the agent rather than to whichever service it happens to be calling through.",
        ],
      },
      {
        heading: "Declared, verified and authorized are three different things",
        body: [
          "AgenID keeps three states strictly separate. DECLARED is what the operator says about its own agent. VERIFIED means a specific claim, such as control of a domain, was checked against evidence by an authority and bound to one version of the manifest. AUTHORIZED is what the agent may do, and that decision belongs to whoever is on the other side. None of these is ever inferred from another.",
          "That separation is the point. A verification level tells you exactly what was checked and nothing more, so a business can decide how much weight to give it rather than reading a green badge as a blanket endorsement.",
        ],
      },
      {
        heading: "What you can do today",
        body: [
          LEVELS_TODAY,
          "You can register an agent in about a minute at /issue, where the signing key is generated in your browser and never sent to AgenID, and anyone can resolve it at /verify.",
        ],
      },
    ],
    faqs: [
      { q: "What is AI agent identity verification?", a: "It is the process of checking that an AI agent is the agent it claims to be and that a specific party stands behind it. AgenID does this with a permanent identifier, an operator-signed manifest and independently re-verifiable signatures, rather than with a name or a voice the agent asserts about itself." },
      { q: "Do I have to trust AgenID's registry?", a: "No. The registry returns the signed manifest and the operator's public key, and you re-verify the signature yourself. The operator's key can also be fetched from the operator's own domain, so a verifier can compare two independent sources." },
      { q: "Does a verified identity mean the agent is allowed to act?", a: IDENTITY_NOT_PERMISSION },
      { q: "Which verification levels can I get today?", a: LEVELS_TODAY },
    ],
    related: ["today-vs-agentic", "dentist-appointment", "agent-delegation"],
  },
  "today-vs-agentic": {
    title: "The Agentic Internet: Who Is on the Other End?",
    description:
      "Today a person sits at one end of every transaction. In the agentic internet an AI agent often sits at both. Here is the identity question that creates.",
    h1: "The agentic internet: when an AI agent is on the other end",
    keywords: ["agentic internet", "agentic commerce identity", "AI agents transacting", "agent-to-agent transactions", "AI agent accountability"],
    lead: [
      "The web was built around a person on one end of every transaction: someone who logs in, clicks buy and answers for what happens next. AI agents change that. More and more often the party calling, ordering or negotiating is software acting for a person or a company, and sometimes both sides are agents.",
      "Accounts, passwords and payment cards all assume a human is present. This comparison shows what breaks when one isn't, and what a portable agent identity puts back.",
    ],
    sections: [
      {
        heading: "Why existing logins don't answer the question",
        body: [
          "A login proves someone knew a password for one account on one service. It says nothing portable about the agent using it, and nothing a third service can check. When an agent moves between an airline, a hotel and a payment processor, each of them starts from zero.",
          "Platform-issued identities have the same limit in a different shape: they are only as good as your relationship with that platform, and they don't travel with the agent.",
        ],
      },
      {
        heading: "What a portable agent identity adds",
        body: [
          "AgenID gives each agent one identifier that works everywhere and is backed by its operator's signature. Any counterparty can resolve it and re-check the signature without an account, an API key or a business relationship with AgenID. Specific claims about the operator can then be verified by an authority and scoped to exactly what was checked.",
          "The result is a stable answer to \"who is this agent, and who answers for it?\" that holds across platforms and over time.",
        ],
      },
      {
        heading: "What it deliberately does not do",
        body: [
          "AgenID is not a login system, a payment rail or a permissions engine. It does not decide what an agent may do and it never holds an operator's signing key. It is the identity layer those systems can read from.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "What is the agentic internet?", a: "It is the version of the web in which AI agents browse, buy, book and negotiate on behalf of people and companies, often transacting with other agents rather than with humans." },
      { q: "Why can't agents just use their owner's login?", a: "A shared login proves knowledge of a password, not which agent is acting or who is accountable for it. It also can't be checked by any service other than the one that issued it." },
      { q: "Is AgenID tied to one AI platform?", a: "No. The identifier and the signed manifest are platform independent, and verification uses open standards: Ed25519 signatures over RFC 8785 canonical JSON." },
      { q: "Does AgenID decide what an agent is allowed to do?", a: IDENTITY_NOT_PERMISSION },
    ],
    related: ["why-identity", "travel", "agent-delegation"],
  },
  "dentist-appointment": {
    title: "Verify an AI Agent Booking an Appointment",
    description:
      "When an AI assistant calls to book an appointment, how does the practice know who sent it? See how AgenID lets a business verify the caller before it books.",
    h1: "How a business verifies the AI agent booking an appointment",
    keywords: ["AI agent booking appointments", "verify AI agent caller", "AI receptionist verification", "AI voice agent identity", "AI scheduling agent"],
    lead: [
      "A personal AI assistant calls a dental office: \"I'm calling on behalf of Mike to schedule his cleaning.\" The office's own scheduling agent answers. Before it opens the calendar it has one reasonable question, and today almost no way to answer it: who is actually calling?",
      "Watch the same call play out with and without a portable agent identity. Booking an appointment is low stakes, which makes it the clearest place to see the mechanism.",
    ],
    sections: [
      {
        heading: "The problem with voice and caller ID",
        body: [
          "A voice agent can say any name, and caller ID can be spoofed. A practice that wants to act on an agent's request has two bad options: refuse every automated caller, or accept claims it cannot check. Neither scales as more patients hand routine calls to assistants.",
        ],
      },
      {
        heading: "How the practice checks the caller with AgenID",
        body: [
          "The assistant presents its AgenID. The practice's agent resolves it and gets the operator's signed manifest, meaning who runs the agent and what it says it is for. It then re-verifies the signature itself. In the illustrated flow the practice also issues a fresh challenge that the agent answers with its key, so a recording of an earlier call can't be replayed.",
          "The operator declaration shows as DECLARED at L1_REGISTERED, which is what the operator says about itself. A domain claim at L2_DOMAIN_VERIFIED would mean an authority checked that the operator controls the domain it names.",
        ],
      },
      {
        heading: "Identity is not access to records",
        body: [
          "Knowing which agent called does not give it access to anything. Whether it may see records, change a booking or act clinically stays entirely the practice's decision, under its own policies and the privacy rules it already follows. AgenID answers who; the practice decides what.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI assistant book appointments for me?", a: "Many can place the call. The open question is whether the business can tell which assistant is calling and who stands behind it. That is the gap a portable identity like AgenID fills." },
      { q: "How does a practice verify an AI caller?", a: "It resolves the identifier the agent presents, re-verifies the operator's signature over the manifest, and checks which specific claims have been independently verified. It can do all of this without an account with AgenID." },
      { q: "Does verification give the agent access to patient records?", a: IDENTITY_NOT_PERMISSION },
      { q: "What does the practice need to install?", a: "Resolution is an HTTPS request plus standard Ed25519 signature verification. No adapter package is published yet for any scheduling or voice platform; the partner docs describe the integration pattern." },
    ],
    related: ["buying-tires", "travel", "why-identity"],
  },
  "buying-tires": {
    title: "AI Shopping Agent Verification for Sellers",
    description:
      "One AI shopping agent, three sellers. See how each merchant verifies the same buying agent independently before it releases a quote or takes an order.",
    h1: "AI shopping agents: how sellers verify the buyer before quoting",
    keywords: ["AI shopping agent", "agentic commerce", "verify AI buyer agent", "AI purchasing agent identity", "merchant AI agent verification"],
    lead: [
      "Mike asks his assistant for four tires under $900, installed. The assistant contacts three shops at once. Each shop's agent is about to release pricing and hold inventory for a buyer it has never met and cannot see.",
      "This scenario shows why one portable identity matters in agentic commerce: each seller checks the same buying agent on its own, without coordinating with the others or with a marketplace in the middle.",
    ],
    sections: [
      {
        heading: "Why merchants hesitate to deal with AI buyers",
        body: [
          "Pricing, stock holds and install slots are real costs. A merchant that answers every automated request invites scraping, fake holds and orders nobody stands behind. Refusing all of them loses real customers who now shop through assistants.",
        ],
      },
      {
        heading: "Three sellers, one identity, three independent checks",
        body: [
          "The buying agent presents the same AgenID to Northline Tire, Caldwell Auto and Rail Street Tire. Each resolves it and re-verifies the operator's signature itself. None of them relies on another seller's check, and none needs a relationship with a marketplace or with AgenID.",
          "Because the identity is persistent, a seller can recognise the same buyer next time and connect its history across visits, instead of treating every session as a stranger.",
        ],
      },
      {
        heading: "Spending limits stay with the operator",
        body: [
          "The $900 cap belongs to the agent's operator, not to the identity record. AgenID says which buyer this is; the operator decides what it may spend, and the merchant decides whether to sell. Price, stock and terms remain entirely the seller's.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "What is agentic commerce?", a: "Agentic commerce is shopping in which an AI agent searches, compares and buys on a person's behalf, often talking directly to a merchant's own agent." },
      { q: "How can a merchant verify an AI shopping agent?", a: "By resolving the agent's AgenID, re-verifying the operator's signature on its manifest, and checking which claims about the operator have been independently verified. Each merchant does this on its own." },
      { q: "Does AgenID process the payment?", a: "No. AgenID never holds funds or payment credentials and never sits in the payment path. It identifies the agent; payment runs on whatever rails the merchant already uses." },
      { q: "Does verification set the agent's spending limit?", a: IDENTITY_NOT_PERMISSION },
    ],
    related: ["travel", "financial-transaction", "dentist-appointment"],
  },
  "financial-transaction": {
    title: "AI Agents and Banking: Verifying Agent Identity",
    description:
      "An AI finance agent asks a bank to move money. AgenID tells the bank which agent is asking and who runs it. Authentication and authorization stay with the bank.",
    h1: "AI agents in banking: verifying the agent before money moves",
    keywords: ["AI agent banking", "AI agent financial transactions", "verify AI agent bank", "agentic payments identity", "know your agent"],
    lead: [
      "\"Move $500 from checking to savings.\" A personal finance agent carries that instruction to the bank's agent channel. The bank has decades of controls for authenticating customers, and none of them tell it which piece of software is making the request or who is accountable for it.",
      "This is the high-trust case. It shows the limits of what an identity layer should claim just as clearly as what it adds.",
    ],
    sections: [
      {
        heading: "Why banks need to know the agent as well as the customer",
        body: [
          "A bank authenticates the account holder. When an agent acts for that holder, the bank also needs to know which agent it is, which company operates it and whether that is the same agent it dealt with last week. Without that, every agent channel is either closed or an open door.",
        ],
      },
      {
        heading: "What AgenID contributes and what it leaves alone",
        body: [
          "The finance agent presents its AgenID. The bank resolves it, re-verifies the operator's signature, and reads which claims about the operator have been checked. The illustration shows L3_ORGANIZATION_VERIFIED, meaning an authority reviewed evidence of the operating organization, and L4_DEPLOYMENT_VERIFIED, meaning the deployment itself was checked.",
          "Everything else stays with the bank: customer authentication, account ownership, transaction authorization, fraud controls and its regulatory obligations. AgenID does not hold accounts, move money or approve transfers.",
        ],
      },
      {
        heading: "Why the boundary matters",
        body: [
          "An identity layer that started approving transactions would have a stake in saying yes. Keeping AgenID to identity, and keeping every financial decision with the institution, is what lets a bank use it as one input among its existing controls.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can AI agents make bank transfers?", a: "Some banks are opening agent channels. In every case the bank still authenticates the customer and authorizes the transfer. AgenID adds a checkable answer to which agent is making the request." },
      { q: "What is \"know your agent\"?", a: "It is the agent-side counterpart to know your customer: establishing which AI agent is acting, who operates it and which facts about that operator have been independently verified." },
      { q: "Does AgenID authorize payments?", a: IDENTITY_NOT_PERMISSION },
      { q: "Is L4 deployment verification available?", a: "Not yet. The L4 sampling methodology has not been finalised, and no level above L1_REGISTERED is issuable until the root authority key exists. The page shows L4 to explain the model." },
    ],
    related: ["buying-tires", "b2b-procurement", "agent-delegation"],
  },
  "b2b-procurement": {
    title: "B2B Procurement Agents: Mutual Agent Verification",
    description:
      "A buyer's procurement agent and a supplier's quoting agent meet with no human introduction. See how each verifies the other before a price is quoted.",
    h1: "B2B procurement agents: verifying both sides before a quote",
    keywords: ["AI procurement agent", "B2B AI agents", "agent-to-agent negotiation", "supplier AI agent verification", "autonomous procurement"],
    lead: [
      "Halden Manufacturing's procurement agent needs 500 units delivered in three weeks. Vance Components' quoting agent can supply them. No person introduced the two, and no one is on the call. Before either side names a number, each needs to know who it is actually dealing with.",
      "This scenario shows verification running in both directions, which is what agent-to-agent commerce needs.",
    ],
    sections: [
      {
        heading: "Why agent-to-agent deals need identity on both sides",
        body: [
          "In human procurement, trust comes from introductions, vendor onboarding and email domains people recognise. Agents skip all of that. A supplier quoting a fake buyer wastes capacity and leaks pricing; a buyer ordering from an impersonated supplier loses money. Both risks grow as agents take over routine sourcing.",
        ],
      },
      {
        heading: "Mutual verification in practice",
        body: [
          "Each agent presents its AgenID and each side resolves the other's. The illustration shows L2_DOMAIN_VERIFIED, where an authority checked control of the company's domain, and L3_ORGANIZATION_VERIFIED, where it reviewed evidence of the organization itself.",
          "Because both identities are persistent and resolvable, either company can re-check the other later from the record alone, for an audit or a dispute, without relying on either agent's account of what happened.",
        ],
      },
      {
        heading: "Commercial terms stay commercial",
        body: [
          "Credit, contract authority, pricing and payment terms are still negotiated by the parties and governed by their agreements. AgenID establishes which organization each agent acts for, and nothing about whether the deal is a good one.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "What is a B2B procurement agent?", a: "It is an AI agent that sources, requests quotes for and orders goods or services on behalf of a company, increasingly by talking directly to suppliers' agents." },
      { q: "How do two AI agents verify each other?", a: "Each resolves the other's AgenID, re-verifies the operator signature on the manifest, and checks which organization-level claims have been independently verified. Neither depends on the other's word or on a shared platform." },
      { q: "Does AgenID give an agent contract authority?", a: IDENTITY_NOT_PERMISSION },
      { q: "Can we audit an agent-negotiated deal later?", a: "Yes, at the identity level. Both identifiers stay resolvable, so either party can later confirm which agents were involved and which operator claims were verified for that manifest version." },
    ],
    related: ["logistics", "agent-delegation", "financial-transaction"],
  },
  logistics: {
    title: "AI Freight Agents: Verify Who a Broker Represents",
    description:
      "\"I represent ABC Logistics\" is a claim. See how a carrier verifies an AI logistics agent's identity and organization before it books a load.",
    h1: "AI logistics agents: how a carrier verifies who is booking the load",
    keywords: ["AI logistics agent", "AI freight broker verification", "freight impersonation", "verify shipper identity", "AI dispatch agent"],
    lead: [
      "LOADY, an AI logistics agent, contacts a carrier: \"I represent ABC Logistics. Cover two loads, Dallas to Memphis, tomorrow.\" In freight, a claim of representation is exactly what an impersonator makes. The carrier's booking agent has to decide whether to commit a truck on that sentence.",
      "This scenario shows a represented-by claim becoming something the carrier can check before capacity is committed.",
    ],
    sections: [
      {
        heading: "Why impersonation hurts freight",
        body: [
          "Brokers and shippers are routinely impersonated, and every load tendered to the wrong party costs a carrier time, fuel and sometimes the cargo. Automated booking makes this easier to attempt at scale unless the carrier can check who stands behind the agent.",
        ],
      },
      {
        heading: "Turning \"I represent ABC Logistics\" into a checkable claim",
        body: [
          "LOADY presents its AgenID. The carrier resolves it, re-verifies the operator's signature and sees which claims about ABC Logistics have been verified: control of its domain at L2_DOMAIN_VERIFIED and evidence of the organization at L3_ORGANIZATION_VERIFIED. In the illustrated flow the carrier also sends a fresh challenge that only the holder of LOADY's key can answer.",
          "Only then does the conversation move on to lanes, capacity and rate. The load never moves on the claim alone.",
        ],
      },
      {
        heading: "What the carrier still checks itself",
        body: [
          "Operating authority, insurance, safety records and contract terms remain the carrier's and shipper's to establish through the checks they already run. AgenID identifies the agent and the organization it acts for; it does not certify freight compliance.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "What is an AI logistics agent?", a: "It is an AI agent that finds capacity, tenders loads and negotiates rates on behalf of a shipper or broker, often by talking to carriers' own booking agents." },
      { q: "How does AgenID help against freight impersonation?", a: "It replaces an unverifiable \"I represent\" claim with an identifier backed by the operator's signature and independently verified claims about the organization, which a carrier can check before committing capacity." },
      { q: "Does AgenID replace carrier vetting?", a: "No. Operating authority, insurance and compliance checks stay with the carrier and shipper. AgenID adds the missing link between an agent and the organization it says it represents." },
      { q: "Does a verified identity authorize the booking?", a: IDENTITY_NOT_PERMISSION },
    ],
    related: ["b2b-procurement", "agent-delegation", "buying-tires"],
  },
  travel: {
    title: "AI Travel Agent Identity Across Every Platform",
    description:
      "One AI travel agent books a flight, hotel, car and dinner. See how a single portable AgenID is verified independently by all four platforms.",
    h1: "AI travel agents: one portable identity across every booking",
    keywords: ["AI travel agent", "AI travel booking agent", "portable AI agent identity", "cross-platform agent identity", "AI agent booking verification"],
    lead: [
      "\"Book my trip to New York, Thursday to Sunday.\" Mike's travel agent now has to deal with an airline, a hotel, a rental car company and a restaurant. Each has its own systems, and none has any reason to trust the others' view of who this agent is.",
      "This scenario shows what portability means in practice: one identity, presented four times, verified four times independently.",
    ],
    sections: [
      {
        heading: "Why per-platform accounts don't scale for agents",
        body: [
          "If every airline, hotel and venue issues its own agent account, identity fragments. The same agent is four strangers, its history can't follow it, and each platform carries the full cost of vetting it from scratch.",
        ],
      },
      {
        heading: "One AgenID, four independent checks",
        body: [
          "The travel agent presents the same AgenID everywhere. Each platform resolves it and re-verifies the operator's signature on its own, and none of them needs to trust another platform or a central account provider. The illustration shows each one confirming a domain claim at L2_DOMAIN_VERIFIED before releasing a seat, a room, a car or a table.",
          "Because the identifier is permanent, the relationship each platform builds with the agent carries over to the next trip.",
        ],
      },
      {
        heading: "Bookings and payment stay with the platforms",
        body: [
          "Fares, room rates, cancellation rights and payment belong to each provider and its terms. AgenID only answers which agent is booking and who stands behind it.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI agent book a whole trip?", a: "Agents can already search and book across providers. What is missing is a way for each provider to know which agent it is dealing with, which is the gap a portable identity fills." },
      { q: "What does a portable AI agent identity mean?", a: "It means one identifier and one signed record that any platform can resolve and verify, instead of a separate account per service." },
      { q: "Do platforms need to integrate with each other?", a: "No. Each resolves the identity independently. Verification needs only the public record and standard Ed25519 signature checking." },
      { q: "Does verification entitle the agent to book?", a: IDENTITY_NOT_PERMISSION },
    ],
    related: ["buying-tires", "dentist-appointment", "agent-delegation"],
  },
  "agent-delegation": {
    title: "Agent-to-Agent Delegation and Audit Trails",
    description:
      "When one AI agent hands work to another, and that one hands it on, who did what? See how persistent agent identity makes every hop attributable.",
    h1: "Agent-to-agent delegation: an identity at every hop",
    keywords: ["agent-to-agent delegation", "multi-agent systems identity", "AI agent audit trail", "agent chain of custody", "multi-agent orchestration security"],
    lead: [
      "\"Plan and pay for the whole trip.\" Mike's agent hands the itinerary to a travel agent, which hands a seat hold to an airline agent, a room hold to a hotel agent and settlement to a payment agent. Four hops, five agents, and one question that gets harder at every step: who actually did this?",
      "This scenario shows why an identity layer stops being optional once agents start delegating to other agents.",
    ],
    sections: [
      {
        heading: "Why delegation chains break without identity",
        body: [
          "In a multi-agent system each hop is a trust decision. If an agent can't check who it is handing work to, a single impersonated link can redirect the whole chain. After the fact, reconstructing what happened depends on the logs of whichever participant you ask, and each has a reason to tell it their way.",
        ],
      },
      {
        heading: "Resolve, verify, delegate at every hop",
        body: [
          "Before handing anything over, each agent resolves the next agent's AgenID and re-verifies its operator's signature. Every hop is attributable to a persistent identifier, so the chain can later be reconstructed from the public records rather than from any one participant's account of it.",
          "That gives the pattern this scenario ends on: identify, verify, delegate, act, audit.",
        ],
      },
      {
        heading: "What the protocol does and does not define today",
        body: [
          "Protocol v1.1.1 defines identity, the signed manifest and verification assertions. It does not yet define a signed object for what an agent is permitted to do or how far a delegation reaches; that scope is set by each operator. Signed authorization is being designed for a later protocol version and is not available today.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "What is agent-to-agent delegation?", a: "It is when one AI agent hands a task, or part of one, to another agent, which may hand it on again. Multi-agent systems depend on it." },
      { q: "How do you audit a chain of AI agents?", a: "Give every agent a persistent, resolvable identity and have each one verify the next before delegating. The chain can then be reconstructed from identities that anyone can re-check, not from one party's logs." },
      { q: "Does AgenID limit what a delegated agent can do?", a: IDENTITY_NOT_PERMISSION },
      { q: "Does this work across different agent frameworks?", a: "Yes. Verification uses the public record and standard Ed25519 signatures, so it doesn't depend on the framework or platform each agent runs on. No framework adapter packages are published yet." },
    ],
    related: ["travel", "b2b-procurement", "why-identity"],
  },
};

/** Every scenario's landing copy: the original nine plus the eight in ./more.ts. */
export const SCENARIO_SEO: Readonly<Record<string, ScenarioSeo>> = { ...BASE_SEO, ...NEW_SCENARIO_SEO };

/** SEO content for a catalogue slug, if it has any. */
export function seoFor(slug: string): ScenarioSeo | undefined {
  return SCENARIO_SEO[slug];
}
