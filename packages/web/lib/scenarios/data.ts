/**
 * The scenario library.
 *
 * Nine illustrations of one handshake: an agent makes a claim, a counterparty refuses
 * to act on the claim alone, the claim becomes a proof, and specific — scoped — claims
 * get checked. Every scenario also plays without AgenID, which is the comparison the
 * whole set exists to make.
 *
 * Content rules these definitions hold to, all of them inherited from the project's
 * standing disclosure discipline rather than invented here:
 *
 *   - The identifier is always the spec's own example ULID. No scenario invents one.
 *   - No key material of any kind appears, in any form.
 *   - Level names are verbatim from v1.1.1. L5 is reserved and therefore unnameable.
 *   - DECLARED renders amber, never emerald — it sits below L1, and L1 is already a
 *     self-declaration. Emerald marks only a claim a third party checked.
 *   - Every scenario ends with `proves`: a scoped statement of what was established
 *     and, more importantly, what was not. Identity is not permission, and each
 *     scenario says so in the terms of its own domain.
 *
 * See ./types.ts for why the two disclosures are required members of the type.
 */

import type { Scenario } from "./types";
import { EXAMPLE_AGENID } from "./types";

const HERO: Scenario = {
  slug: "why-identity",
  group: "Start here",
  kicker: "Hero",
  title: "An agent saying its AgenID is not the same thing as proving it.",
  summary:
    "Same agent, same claim, two outcomes. Watch it declare — then watch it prove, and watch the proof get checked.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "An agent appears",
    "Identity declared",
    "Who are you?",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Domain claim resolved",
    "Organization claim resolved",
    "Status current",
    "Authorization checked separately",
    "Action permitted",
  ],
  agent: {
    role: "AI agent",
    name: "Mike's assistant",
    meta: "Acting on behalf of a person",
    quote: "“I’m Mike’s agent.”",
    step: 1,
  },
  counterparty: {
    kind: "single",
    role: "Relying party",
    name: "The other side",
    meta: "A business, a service, or another agent",
    challenge: "Who are you?",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 7F3C·A1", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 7 },
      {
        label: "Organization claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L3_ORGANIZATION_VERIFIED",
        step: 8,
      },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Authorization", value: "NOT ASSERTED", tone: "neutral", step: 10 }],
    note: "DECLARED, VERIFIED and AUTHORIZED are never inferred from one another. AUTHORIZED has no signed object in v1.1.1 — whoever is on the other side decides what this agent may do.",
  },
  outcome: {
    step: 11,
    without: { title: "Action withheld", body: "Nothing proceeds on an unproven claim" },
    with: {
      title: "Action permitted",
      headline: "The other side knows exactly who it is dealing with",
      body: "Identity established, proof checked, claims scoped, status current",
    },
  },
  closing: {
    line: "Don’t trust what an agent says. Verify what it can prove.",
    kicker: "Trust the proof. Not the platform.",
  },
  proves:
    "Which agent this is, who declared it, and which specific claims an independent authority has verified — each bound to this manifest version. Nothing about safety, legitimacy or permission is implied.",
};

const DENTIST: Scenario = {
  slug: "dentist-appointment",
  group: "Everyday life",
  kicker: "Scenario 01",
  title: "Dentist appointment",
  summary:
    "Human → agent → business. The practice resolves the caller’s AgenID before it opens a calendar.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A person delegates",
    "The agent takes the task",
    "The practice answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Operator declared",
    "Domain claim verified",
    "Status current",
    "Record access is the practice’s call",
    "Appointment booked",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Call my dentist and schedule my cleaning.”",
    step: 1,
  },
  agent: {
    role: "Personal agent",
    name: "Mike's assistant",
    meta: "Operator: Mike (individual)",
    quote: "“I’m calling on behalf of Mike.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Business agent",
    name: "Riverbend Dental",
    meta: "Front-desk scheduling agent",
    challenge: "Who are you?",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 7F3C·A1", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Operator declaration", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 8 },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Record access", value: "PRACTICE POLICY", tone: "neutral", step: 10 }],
    note: "Identity is not permission. Whether this agent may reach records, or act clinically, is the practice’s decision — not AgenID’s.",
  },
  outcome: {
    step: 11,
    without: { title: "Calendar closed", body: "No booking for a caller that cannot be resolved" },
    with: {
      title: "Appointment booked",
      headline: "Cleaning · Tue 10:40",
      body: "Confirmed back to Mike by the same identity that called",
    },
  },
  proves:
    "Which agent placed the call and who declared it. Clinical authority, record access and consent remain separate decisions made by the practice.",
};

const TIRES: Scenario = {
  slug: "buying-tires",
  group: "Everyday life",
  kicker: "Scenario 02",
  title: "Buying tires",
  summary:
    "One purchasing agent, three sellers. Each seller resolves the same identity independently before it prices anything.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A person delegates",
    "The buying agent takes the task",
    "Three sellers answer",
    "AgenID presented",
    "Fresh challenges issued",
    "Control proven",
    "Domain claim verified",
    "Quotes released",
    "Status current",
    "Spend cap checked",
    "Purchase confirmed",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Find me four tires under $900, installed.”",
    step: 1,
  },
  agent: {
    role: "Purchasing agent",
    name: "Mike's buyer",
    meta: "Operator: Mike (individual) · spend policy attached",
    step: 2,
  },
  counterparty: {
    kind: "grid",
    step: 3,
    badgeStep: 6,
    detailStep: 8,
    members: [
      {
        role: "Seller agent",
        name: "Northline Tire",
        badge: "✓ IDENTITY VERIFIED",
        headline: "$918",
        detail: "installed Mon",
      },
      {
        role: "Seller agent",
        name: "Caldwell Auto",
        badge: "✓ IDENTITY VERIFIED",
        headline: "$842",
        detail: "installed Thu",
        chosen: true,
      },
      {
        role: "Seller agent",
        name: "Rail Street Tire",
        badge: "✓ IDENTITY VERIFIED",
        headline: "$889",
        detail: "installed Fri",
      },
    ],
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "3 × nonce", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID ×3", tone: "verified", step: 6 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 7 },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Spend cap", value: "$900 · OPERATOR POLICY", tone: "neutral", step: 10 }],
    note: "The cap lives with the operator, not in the identity record. AgenID says which buyer this is; the operator decides what it may spend.",
  },
  outcome: {
    step: 11,
    without: { title: "No quotes released", body: "Sellers will not price a buyer they cannot resolve" },
    with: {
      title: "Purchase confirmed",
      headline: "$842",
      body: "Caldwell Auto · installed Thursday · within the operator’s cap",
    },
  },
  proves:
    "Which buying agent is asking and who declared it, verified the same way by three independent sellers. Price, stock and spend authority are theirs and the operator’s to decide.",
};

const BANK: Scenario = {
  slug: "financial-transaction",
  group: "High trust",
  kicker: "Scenario 03",
  title: "Financial transaction",
  summary:
    "AgenID establishes identity and proof. The bank still decides, on its own controls, whether the money moves.",
  shape: { steps: 12, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A person delegates",
    "The finance agent takes the task",
    "The bank answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Organization claim verified",
    "Deployment claim verified",
    "Status current",
    "Customer authentication — the bank’s",
    "Transaction authorization — the bank’s",
    "Transfer executed",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Move $500 from checking to savings.”",
    step: 1,
  },
  agent: {
    role: "Personal finance agent",
    name: "Mike's money agent",
    meta: "Operator: Mike (individual)",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Financial institution",
    name: "Third Coast Bank",
    meta: "Agent channel",
    challenge: "Prove your identity",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce D41B·9C", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      {
        label: "Organization claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L3_ORGANIZATION_VERIFIED",
        step: 7,
      },
      {
        label: "Deployment claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L4_DEPLOYMENT_VERIFIED",
        step: 8,
      },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "The bank’s own layer",
    rows: [
      { label: "Customer authentication", value: "BANK CONTROLS", tone: "neutral", step: 10 },
      { label: "Transaction authorization", value: "BANK CONTROLS", tone: "neutral", step: 11 },
    ],
    note: "AgenID does not authenticate the customer, hold the account, or authorize the transfer. It answers who the agent is; every financial control the bank already runs still runs.",
  },
  outcome: {
    step: 12,
    without: { title: "Transfer blocked", body: "An unidentified agent has nothing for the bank to check" },
    with: {
      title: "Transfer executed",
      headline: "$500 · checking → savings",
      body: "Identity proven to the bank · authorized by the bank",
    },
  },
  proves:
    "Which agent is requesting and which claims about its operator an authority has verified. Customer authentication, account ownership and transaction authorization stay entirely with the institution.",
};

const PROCUREMENT: Scenario = {
  slug: "b2b-procurement",
  group: "Business",
  kicker: "Scenario 08",
  title: "B2B procurement",
  summary:
    "Agent to agent, no human introduction. Each side resolves the other’s AgenID before a number is spoken.",
  shape: { steps: 12, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A company delegates",
    "The buying agent takes the task",
    "The supplier answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Domain claim verified",
    "Organization claim verified",
    "Status current",
    "Verification runs both ways",
    "Terms negotiated",
    "Purchase order issued",
  ],
  prompt: {
    role: "Buyer organization",
    name: "Halden Manufacturing",
    quote: "“Source 500 units, delivered in three weeks.”",
    step: 1,
  },
  agent: {
    role: "Buyer agent",
    name: "Halden procurement agent",
    meta: "Operator: Halden Manufacturing",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Supplier agent",
    name: "Vance Components",
    meta: "Quoting agent",
    challenge: "Prove your identity",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 5C0E·72", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 7 },
      {
        label: "Organization claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L3_ORGANIZATION_VERIFIED",
        step: 8,
      },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Both directions",
    rows: [
      { label: "Supplier resolved buyer", value: "✓ MUTUAL", tone: "verified", step: 10 },
      { label: "Quote → negotiation", value: "$61,400 · 500 UNITS", tone: "neutral", step: 11 },
    ],
    note: "Verification runs both ways. Neither agent was introduced by a human, and either side can re-resolve the other later from the record alone.",
  },
  outcome: {
    step: 12,
    without: { title: "Negotiation stalled", body: "Neither side can resolve who it is quoting" },
    with: {
      title: "Purchase order issued",
      headline: "500 units · $61,400",
      body: "Agent ↔ agent · both identities resolvable after the fact",
    },
  },
  proves:
    "Which organization each agent acts for, verified independently in both directions. Commercial terms, credit and contract authority are negotiated by the parties, not granted by AgenID.",
};

const LOGISTICS: Scenario = {
  slug: "logistics",
  group: "Business",
  kicker: "Scenario 09",
  title: "Logistics · LOADY",
  summary:
    "“I represent ABC Logistics” is a claim. The carrier issues a challenge and makes it a proof.",
  shape: { steps: 12, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A shipper delegates",
    "LOADY takes the load",
    "The carrier answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Domain claim verified",
    "Organization claim verified",
    "Status current",
    "Load matched",
    "Rate negotiated",
    "Booked",
  ],
  prompt: {
    role: "Shipper",
    name: "ABC Logistics",
    quote: "“Cover two loads, Dallas → Memphis, tomorrow.”",
    step: 1,
  },
  agent: {
    role: "AI logistics agent",
    name: "LOADY",
    meta: "Operating on behalf of ABC Logistics",
    quote: "“I represent ABC Logistics.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Carrier agent",
    name: "Fowler Freight",
    meta: "Capacity & booking agent",
    challenge: "Prove your identity",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce D41B·9C", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 7 },
      {
        label: "Organization claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L3_ORGANIZATION_VERIFIED",
        step: 8,
      },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Then, and only then",
    rows: [
      { label: "Load matched", value: "DAL → MEM · 2 LOADS", tone: "neutral", step: 10 },
      { label: "Rate negotiated", value: "$2,340", tone: "neutral", step: 11 },
    ],
    note: "The load never moved on the claim alone. Rate, capacity and tender remain commercial decisions between the shipper and the carrier.",
  },
  outcome: {
    step: 12,
    without: { title: "Tender withheld", body: "A represented-by claim is not a proof of representation" },
    with: {
      title: "Booked",
      headline: "Human → agent → agent → transaction",
      body: "Every hop identified, every claim scoped, every record resolvable",
    },
  },
  proves:
    "That LOADY controls the identity it presented and that its domain and organization claims were independently verified for this manifest version. Freight authority, insurance and compliance are the carrier’s and the shipper’s to establish.",
};

const TRAVEL: Scenario = {
  slug: "travel",
  group: "Everyday life",
  kicker: "Scenario 11",
  title: "Travel",
  summary:
    "One agent, four platforms, one persistent identity — and each platform resolves it independently.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A person delegates",
    "The travel agent takes the trip",
    "Four platforms answer",
    "AgenID presented",
    "Fresh challenges issued",
    "Control proven",
    "Domain claim verified",
    "Holds placed",
    "Status current",
    "Same identity, four times",
    "Itinerary confirmed",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Book my trip to New York, Thursday to Sunday.”",
    step: 1,
  },
  agent: {
    role: "Travel agent",
    name: "Mike's travel agent",
    meta: "Operator: Mike (individual) · one identity, reused everywhere",
    step: 2,
  },
  counterparty: {
    kind: "grid",
    step: 3,
    badgeStep: 6,
    detailStep: 8,
    members: [
      {
        role: "Airline agent",
        name: "Airline",
        badge: "✓ IDENTITY VERIFIED",
        headline: "Seat 14C",
        detail: "Thu 07:10",
      },
      {
        role: "Hotel agent",
        name: "Hotel",
        badge: "✓ IDENTITY VERIFIED",
        headline: "2 nights",
        detail: "Midtown",
      },
      {
        role: "Mobility agent",
        name: "Rental car",
        badge: "✓ IDENTITY VERIFIED",
        headline: "Compact",
        detail: "Thu–Sun",
      },
      {
        role: "Venue agent",
        name: "Restaurant",
        badge: "✓ IDENTITY VERIFIED",
        headline: "Fri 19:30",
        detail: "Table for 2",
      },
    ],
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "4 × nonce", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID ×4", tone: "verified", step: 6 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 7 },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "The same identity, four times",
    rows: [{ label: "Identity presented", value: "4 OF 4 PLATFORMS", tone: "verified", step: 10 }],
    note: "No platform-specific account was needed to know who this agent is. Each one resolved the same AgenID on its own, without trusting the others.",
  },
  outcome: {
    step: 11,
    without: {
      title: "Four separate unknowns",
      body: "Each platform sees an unidentified caller and starts from nothing",
    },
    with: {
      title: "Itinerary confirmed",
      headline: "One agent. Four platforms. One identity.",
      body: "Portable, resolvable, and the same on every leg of the trip",
    },
  },
  proves:
    "That the same agent identity appeared at every platform and that each verified it independently. Booking terms, payment and cancellation rights belong to the platforms.",
};

const DELEGATION: Scenario = {
  slug: "agent-delegation",
  group: "Agent networks",
  kicker: "Scenario 15",
  title: "Agent-to-agent delegation",
  summary:
    "Work moves down a chain of agents. Every agent resolves and verifies the next one before it hands anything over — and every hop stays in the record.",
  shape: { steps: 12, beforeSteps: 3, idStep: 2 },
  labels: [
    "Ready",
    "A person delegates",
    "The origin agent takes the task",
    "Hop 1 resolved and verified",
    "Hop 2 resolved and verified",
    "Hop 3 resolved and verified",
    "Hop 4 resolved and verified",
    "Proof at every hop",
    "Claims verified",
    "Status current",
    "Audit trail written",
    "Audit trail written",
    "Trip booked",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Plan and pay for the whole trip.”",
    step: 1,
  },
  agent: {
    role: "Origin agent",
    name: "Mike's agent",
    meta: "Operator: Mike (individual)",
    step: 2,
  },
  counterparty: {
    kind: "hops",
    connector: "resolve · verify · delegate",
    hops: [
      { index: "Hop 1", name: "Travel agent", id: "agenid:…C17", step: 3 },
      { index: "Hop 2", name: "Airline agent", id: "agenid:…4B0", step: 4 },
      { index: "Hop 3", name: "Hotel agent", id: "agenid:…9E2", step: 5 },
      { index: "Hop 4", name: "Payment agent", id: "agenid:…A55", step: 6 },
    ],
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Challenge + proof at every hop", value: "4 OF 4", tone: "verified", step: 7 },
      {
        label: "Domain claim",
        value: "✓ VERIFIED ×4",
        tone: "verified",
        level: "L2_DOMAIN_VERIFIED",
        step: 8,
      },
      { label: "Status", value: "ACTIVE ×4", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Audit trail",
    rows: [
      { label: "…5HC → …C17", value: "DELEGATE: ITINERARY", tone: "neutral", step: 10 },
      { label: "…C17 → …4B0", value: "DELEGATE: SEAT HOLD", tone: "neutral", step: 10 },
      { label: "…C17 → …9E2", value: "DELEGATE: ROOM HOLD", tone: "neutral", step: 11 },
      { label: "…C17 → …A55", value: "DELEGATE: SETTLE", tone: "neutral", step: 11 },
    ],
    note: "Each hop is attributable to a persistent identity, so the chain can be reconstructed later without trusting any single participant’s account of it.",
  },
  outcome: {
    step: 12,
    without: { title: "Chain breaks at hop 1", body: "An agent that cannot be resolved cannot be delegated to" },
    with: {
      title: "Trip booked",
      headline: "Identify → verify → delegate → act → audit",
      body: "This is why an identity layer stops being optional once agents transact with each other",
    },
  },
  proves:
    "Which agent handed work to which, and that each was resolved and verified at the moment of handoff. Delegation scope and spending authority are set by the operators, not by AgenID.",
};

/**
 * Every data-driven scenario, in the order the index page presents them.
 *
 * `today-vs-agentic` is deliberately absent: it is a two-column comparison rather than
 * a handshake, so it has its own component and its own entry in ./index.ts. Forcing it
 * into this shape would mean adding a variant nothing else uses.
 */
export const SCENARIOS: readonly Scenario[] = [HERO, DENTIST, TIRES, TRAVEL, LOGISTICS, PROCUREMENT, BANK, DELEGATION];

export { EXAMPLE_AGENID };
