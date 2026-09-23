/**
 * The eight remaining "how it works" scenarios, as data.
 *
 * Same handshake, same rules as ./scenarios/data.ts: an agent makes a claim, a
 * counterparty refuses to act on the claim alone, the claim becomes a proof, specific
 * scoped claims get checked, and whatever the counterparty decides for itself stays
 * with the counterparty. Every business named here is fictional. No identifier, key
 * material or L5 appears. DECLARED and L1 rows render amber; only a claim a third party
 * checked renders as verified; there is no failed tone.
 *
 * The SEO entries follow ./scenarios/seo.ts line for line in structure and voice, and
 * every one of them carries the issuance ceiling and the identity-is-not-permission
 * answer, inlined here as the same literal text.
 */

import type { Scenario } from "./types";
import type { ScenarioSeo } from "./seo";

const INSURANCE: Scenario = {
  slug: "insurance-claim",
  group: "High trust",
  kicker: "Scenario 04",
  title: "Insurance claim",
  summary:
    "A claims agent files for a policyholder. The insurer’s intake agent resolves who is filing before it opens a claim — and still adjudicates the claim itself.",
  shape: { steps: 12, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A policyholder delegates",
    "The claims agent takes the task",
    "The insurer answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Operator declared",
    "Organization claim verified",
    "Deployment claim verified",
    "Status current",
    "Coverage and payout — the insurer’s",
    "Claim opened",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“File a claim for the hail damage to my car.”",
    step: 1,
  },
  agent: {
    role: "Claims agent",
    name: "Brightwater claims agent",
    meta: "Operator: Brightwater Claims Services · acting for Mike",
    quote: "“I’m filing on behalf of the policyholder.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Insurer intake agent",
    name: "Ashgrove Mutual",
    meta: "First notice of loss",
    challenge: "Prove your identity",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 3E8A·52", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Operator declaration", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      {
        label: "Organization claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L3_ORGANIZATION_VERIFIED",
        step: 8,
      },
      {
        label: "Deployment claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L4_DEPLOYMENT_VERIFIED",
        step: 9,
      },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 10 },
    ],
  },
  separate: {
    title: "The insurer’s own layer",
    rows: [
      { label: "Policyholder authentication", value: "INSURER CONTROLS", tone: "neutral", step: 11 },
      { label: "Coverage and payout", value: "INSURER’S PROCESS", tone: "neutral", step: 11 },
    ],
    note: "Identity is not permission. AgenID says which agent is filing and who operates it; whether the policyholder is who they say, whether the loss is covered and what is paid are the insurer’s decisions.",
  },
  outcome: {
    step: 12,
    without: { title: "Claim not opened", body: "No file is opened for a filer the insurer cannot resolve" },
    with: {
      title: "Claim opened",
      headline: "Hail damage · first notice filed",
      body: "Filed by an identified agent · adjudicated by the insurer",
    },
  },
  proves:
    "Which agent filed, which company operates it, and which claims about that company an authority has verified for this manifest version. Policyholder authentication, coverage and payout remain the insurer’s decisions.",
};

const REAL_ESTATE: Scenario = {
  slug: "real-estate",
  group: "Business",
  kicker: "Scenario 05",
  title: "Real estate",
  summary:
    "A buyer’s agent asks a listing brokerage for a showing and the disclosure package. The brokerage resolves who is asking before it opens a calendar or a document.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A buyer delegates",
    "The buyer’s agent takes the task",
    "The listing brokerage answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Operator declared",
    "Domain claim verified",
    "Status current",
    "Disclosure release is the brokerage’s call",
    "Showing scheduled",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Book a showing at 14 Alder Lane and get the disclosures.”",
    step: 1,
  },
  agent: {
    role: "Buyer’s agent",
    name: "Crestline buyer agent",
    meta: "Operator: Crestline Realty · representing Mike",
    quote: "“I’m requesting a showing for my buyer.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Listing brokerage agent",
    name: "Maple & Stone Realty",
    meta: "Showings and disclosures agent",
    challenge: "Who are you?",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 61D0·B7", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Operator declaration", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 8 },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Disclosure package", value: "BROKERAGE POLICY", tone: "neutral", step: 10 }],
    note: "Identity is not permission. Knowing which buyer’s agent is asking does not open the property or the file — the seller’s instructions and the brokerage’s policy decide what is released, and to whom.",
  },
  outcome: {
    step: 11,
    without: { title: "Showing not scheduled", body: "No access and no documents for a requester that cannot be resolved" },
    with: {
      title: "Showing scheduled",
      headline: "Sat 11:00 · 14 Alder Lane",
      body: "Disclosure request logged against the same identity that asked",
    },
  },
  proves:
    "Which agent requested the showing and who declared it, with its brokerage’s domain claim independently verified. Property access, disclosure release and any offer remain decisions for the seller and the brokerages.",
};

const LEGAL: Scenario = {
  slug: "legal-services",
  group: "High trust",
  kicker: "Scenario 06",
  title: "Legal services",
  summary:
    "A client company’s agent asks its outside counsel for case documents. The firm resolves who is asking — then privilege, conflicts and release stay the firm’s decision.",
  shape: { steps: 12, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A company delegates",
    "The legal-ops agent takes the task",
    "The firm answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Domain claim verified",
    "Organization claim verified",
    "Status current",
    "Engagement check — the firm’s",
    "Privilege and release — the firm’s",
    "Request logged",
  ],
  prompt: {
    role: "Client organization",
    name: "Corbel Property Group",
    quote: "“Get the latest filings in the Hartley matter from outside counsel.”",
    step: 1,
  },
  agent: {
    role: "Legal operations agent",
    name: "Corbel legal-ops agent",
    meta: "Operator: Corbel Property Group",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Law firm intake agent",
    name: "Whitford & Lane",
    meta: "Client intake and records agent",
    challenge: "Prove your identity",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 9A27·E3", tone: "pending", pulse: true, step: 5 },
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
    title: "The firm’s own layer",
    rows: [
      { label: "Engagement and conflicts", value: "FIRM’S DECISION", tone: "neutral", step: 10 },
      { label: "Privilege and release", value: "FIRM’S DECISION", tone: "neutral", step: 11 },
    ],
    note: "Identity is not permission. AgenID says which agent is asking and which organization it acts for; whether that organization is a client, what is privileged and what is released are professional decisions the firm makes.",
  },
  outcome: {
    step: 12,
    without: { title: "Request not processed", body: "A firm will not release matter documents to a requester it cannot resolve" },
    with: {
      title: "Request logged",
      headline: "Filings request · Hartley matter",
      body: "Requester identified · release decided by the firm",
    },
  },
  proves:
    "Which agent asked and which organization it acts for, verified for this manifest version. The client relationship, privilege, conflicts and anything the firm releases remain the firm’s professional decisions.",
};

const RECRUITING: Scenario = {
  slug: "recruiting",
  group: "Business",
  kicker: "Scenario 07",
  title: "Recruiting",
  summary:
    "A candidate’s agent applies and an employer’s screening agent answers. Each side resolves the other before a screen is booked — and the hiring decision stays with the employer.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A candidate delegates",
    "The candidate’s agent applies",
    "The screening agent answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Candidate’s operator declared",
    "Employer’s domain verified in return",
    "Status current",
    "Screening stays with the employer",
    "Screen scheduled",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Apply to the operations manager role and set up a first call.”",
    step: 1,
  },
  agent: {
    role: "Candidate’s agent",
    name: "Mike's job-search agent",
    meta: "Operator: Mike (individual)",
    quote: "“I’m applying on behalf of Mike.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Employer screening agent",
    name: "Brennan Outdoor Co.",
    meta: "Recruiting and screening agent",
    challenge: "Who are you?",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 4C15·8F", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Operator declaration", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      {
        label: "Employer’s domain claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L2_DOMAIN_VERIFIED",
        step: 8,
      },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Qualifications and references", value: "EMPLOYER’S SCREENING", tone: "neutral", step: 10 }],
    note: "Identity is not permission, and it is not a credential. AgenID says which agent applied and who declared it; qualifications, references, eligibility and the decision to hire are assessed by the employer.",
  },
  outcome: {
    step: 11,
    without: { title: "No screen booked", body: "Neither side can tell which agent it is talking to" },
    with: {
      title: "Screen scheduled",
      headline: "First call · Wed 14:00",
      body: "Both sides identified · the hiring decision stays with the employer",
    },
  },
  proves:
    "Which agent applied and who declared it, and, in the other direction, that the employer’s agent controls the domain it names. Qualifications, references and the hiring decision are the employer’s to assess.",
};

const GOVERNMENT: Scenario = {
  slug: "government-services",
  group: "High trust",
  kicker: "Scenario 10",
  title: "Government services",
  summary:
    "A filing agent renews a license at an agency portal. The portal resolves which agent is filing; proofing the resident’s own identity stays a separate process the agency runs.",
  shape: { steps: 12, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A resident delegates",
    "The filing agent takes the task",
    "The agency portal answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Operator declared",
    "Domain claim verified",
    "Organization claim verified",
    "Status current",
    "Resident proofing — the agency’s",
    "Renewal submitted",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Renew my contractor license before it lapses.”",
    step: 1,
  },
  agent: {
    role: "Filing agent",
    name: "Permitline filing agent",
    meta: "Operator: Permitline Services · acting for Mike",
    quote: "“I’m submitting a renewal for a license holder.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Agency portal agent",
    name: "County licensing office",
    meta: "Renewals intake",
    challenge: "Prove your identity",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce B803·6D", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Operator declaration", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 8 },
      {
        label: "Organization claim",
        value: "✓ VERIFIED",
        tone: "verified",
        level: "L3_ORGANIZATION_VERIFIED",
        step: 9,
      },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 10 },
    ],
  },
  separate: {
    title: "The agency’s own layer",
    rows: [
      { label: "Resident identity proofing", value: "AGENCY PROCESS", tone: "neutral", step: 11 },
      { label: "Eligibility and fees", value: "AGENCY RULES", tone: "neutral", step: 11 },
    ],
    note: "Identity is not permission. AgenID identifies the filing agent and its operator; it does not identify the resident. Proofing the resident, checking eligibility and granting the renewal are the agency’s own processes.",
  },
  outcome: {
    step: 12,
    without: { title: "Renewal not accepted", body: "The portal cannot tell which filer submitted it or who answers for it" },
    with: {
      title: "Renewal submitted",
      headline: "Contractor license · renewal filed",
      body: "Filer identified · resident proofed and decided by the agency",
    },
  },
  proves:
    "Which filing agent submitted the renewal and which claims about its operating company an authority has verified. The resident’s own identity proofing, eligibility and the licensing decision remain entirely with the agency.",
};

const HOME: Scenario = {
  slug: "home-services",
  group: "Everyday life",
  kicker: "Scenario 12",
  title: "Home services",
  summary:
    "One household agent, three plumbers. Each provider resolves the same identity on its own before it holds an arrival window.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A person delegates",
    "The home agent takes the task",
    "Three plumbers answer",
    "AgenID presented",
    "Fresh challenges issued",
    "Control proven",
    "Operator declared",
    "Arrival windows released",
    "Status current",
    "Home access stays with Mike",
    "Plumber booked",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“The kitchen sink is leaking. Get a plumber out by tomorrow.”",
    step: 1,
  },
  agent: {
    role: "Household agent",
    name: "Mike's home agent",
    meta: "Operator: Mike (individual)",
    step: 2,
  },
  counterparty: {
    kind: "grid",
    step: 3,
    badgeStep: 6,
    detailStep: 8,
    members: [
      {
        role: "Provider agent",
        name: "Pipewell Plumbing",
        badge: "✓ IDENTITY VERIFIED",
        headline: "$189",
        detail: "call-out · today 6–8 pm",
      },
      {
        role: "Provider agent",
        name: "Hartline Plumbing",
        badge: "✓ IDENTITY VERIFIED",
        headline: "$165",
        detail: "call-out · tomorrow 8–10 am",
        chosen: true,
      },
      {
        role: "Provider agent",
        name: "Copperfield Drain",
        badge: "✓ IDENTITY VERIFIED",
        headline: "$210",
        detail: "call-out · today 4–6 pm",
      },
    ],
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "3 × nonce", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID ×3", tone: "verified", step: 6 },
      { label: "Operator declaration", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Home access and payment", value: "MIKE AND THE PLUMBER", tone: "neutral", step: 10 }],
    note: "Which agent booked the job is not the same question as who may enter the house. Access, payment, the scope of the work and the plumber’s licensing are settled between Mike and the provider.",
  },
  outcome: {
    step: 11,
    without: { title: "No windows released", body: "Providers will not hold a slot for a caller they cannot resolve" },
    with: {
      title: "Plumber booked",
      headline: "$165",
      body: "Hartline Plumbing · tomorrow 8–10 am · confirmed back to Mike",
    },
  },
  proves:
    "Which agent is booking and who declared it, resolved independently by three providers. Licensing, pricing, home access and payment are settled between the household and the plumber.",
};

const SALES: Scenario = {
  slug: "sales-outreach",
  group: "Business",
  kicker: "Scenario 13",
  title: "Sales outreach",
  summary:
    "An outbound voice agent calls a business. Before anyone engages, the business resolves who is calling, who operates the caller, and whether it declared itself an AI.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A sales team delegates",
    "The SDR agent places the call",
    "The business answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "AI disclosure declared",
    "Domain claim verified",
    "Status current",
    "Engaging is the business’s call",
    "Meeting booked",
  ],
  prompt: {
    role: "Sales organization",
    name: "Larchmont Software",
    quote: "“Book intro calls with regional distributors this week.”",
    step: 1,
  },
  agent: {
    role: "Outbound SDR agent",
    name: "Larchmont SDR agent",
    meta: "Operator: Larchmont Software · voice agent",
    quote: "“Hi, I’m an AI assistant calling for Larchmont Software.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Front-desk agent",
    name: "Pell & Carver Distribution",
    meta: "Inbound call screening",
    challenge: "Who is calling?",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 07F2·C9", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "AI disclosure", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 8 },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Take the meeting", value: "BUSINESS’S CHOICE", tone: "neutral", step: 10 }],
    note: "Identity is not permission. Knowing who is calling gives the caller no claim on the business’s time — whether to engage, share a contact or buy anything is the business’s decision.",
  },
  outcome: {
    step: 11,
    without: { title: "Call not engaged", body: "The business cannot tell who is calling or who answers for the call" },
    with: {
      title: "Meeting booked",
      headline: "Intro call · Thu 15:00",
      body: "Caller identified · the business chose to engage",
    },
  },
  proves:
    "Which agent placed the call, which company declared it operates it, and that the operator declared the caller an AI. Whether to take the call, share contacts or buy anything is entirely the business’s decision.",
};

const PERSONAL_ADMIN: Scenario = {
  slug: "personal-admin",
  group: "Everyday life",
  kicker: "Scenario 14",
  title: "Personal admin",
  summary:
    "A personal agent asks a provider’s support agent to cancel a subscription. Support resolves which agent is asking; the provider still authenticates the account holder.",
  shape: { steps: 11, beforeSteps: 4, idStep: 4 },
  labels: [
    "Ready",
    "A person delegates",
    "The personal agent takes the task",
    "Support answers",
    "AgenID presented",
    "Fresh challenge issued",
    "Control proven",
    "Operator declared",
    "Domain claim verified",
    "Status current",
    "Account authentication — the provider’s",
    "Subscription cancelled",
  ],
  prompt: {
    role: "Human",
    name: "Mike",
    quote: "“Cancel the streaming plan I never use.”",
    step: 1,
  },
  agent: {
    role: "Personal agent",
    name: "Mike's assistant",
    meta: "Operator: Mike (individual)",
    quote: "“I’m handling account changes for Mike.”",
    step: 2,
  },
  counterparty: {
    kind: "single",
    role: "Support agent",
    name: "Quillon Streaming",
    meta: "Account support agent",
    challenge: "Who are you?",
    step: 3,
  },
  flow: {
    nothingToResolve: { label: "Nothing to resolve", value: "NO IDENTITY PRESENTED" },
    rows: [
      { label: "Fresh challenge", value: "nonce 5DA9·21", tone: "pending", pulse: true, step: 5 },
      { label: "Proof of control", value: "✓ VALID", tone: "verified", step: 6 },
      { label: "Operator declaration", value: "DECLARED", tone: "declared", level: "L1_REGISTERED", step: 7 },
      { label: "Domain claim", value: "✓ VERIFIED", tone: "verified", level: "L2_DOMAIN_VERIFIED", step: 8 },
      { label: "Status", value: "ACTIVE", tone: "verified", step: 9 },
    ],
  },
  separate: {
    title: "Checked separately",
    rows: [{ label: "Account holder authentication", value: "PROVIDER PROCESS", tone: "neutral", step: 10 }],
    note: "Identity is not permission. AgenID says which agent is asking; the provider still confirms the account holder, applies its cancellation terms and decides any refund.",
  },
  outcome: {
    step: 11,
    without: { title: "Request stalled", body: "Support cannot act for an agent it cannot resolve" },
    with: {
      title: "Subscription cancelled",
      headline: "Plan ends · 30 Sep",
      body: "Confirmation returned to the same identity that asked",
    },
  },
  proves:
    "Which agent made the request and who declared it. Authenticating the account holder, cancellation terms and refunds stay with the provider.",
};

/** In kicker order. Merge into SCENARIOS in whatever order the index presents. */
export const NEW_SCENARIOS: readonly Scenario[] = [
  INSURANCE,
  REAL_ESTATE,
  LEGAL,
  RECRUITING,
  GOVERNMENT,
  HOME,
  SALES,
  PERSONAL_ADMIN,
];

/* ------------------------------------------------------------------------------------ */

/** Verbatim copy of LEVELS_TODAY in ./scenarios/seo.ts. */
const LEVELS_TODAY =
  "Today the reference registry at agenid.com issues DECLARED and L1_REGISTERED. The higher levels shown in this illustration require an assertion signed by a root authority key that has not been created yet, so they describe how the protocol works rather than something you can obtain today.";

/** Verbatim copy of IDENTITY_NOT_PERMISSION in ./scenarios/seo.ts. */
const IDENTITY_NOT_PERMISSION =
  "No. AgenID answers which agent is acting and who declared it. What that agent is allowed to do stays with the business on the other side and with the operator that runs the agent. Protocol v1.1.1 defines no signed authorization object.";

export const NEW_SCENARIO_SEO: Readonly<Record<string, ScenarioSeo>> = {
  "insurance-claim": {
    title: "AI Agents Filing Insurance Claims: Verify the Filer",
    description:
      "A claims agent files for a policyholder. See how an insurer verifies which AI agent is filing and who operates it, while coverage decisions stay with the insurer.",
    h1: "AI agents filing insurance claims: how the insurer verifies the filer",
    keywords: ["AI insurance claims agent", "verify AI agent insurance", "AI first notice of loss", "insurance agentic automation", "know your agent insurance"],
    lead: [
      "After a hailstorm, Mike asks a claims-assistance service to file for the damage to his car. The service's claims agent contacts the insurer's intake agent: \"I'm filing on behalf of the policyholder.\" The insurer is about to open a claim file, start a clock and commit adjuster time on the strength of that sentence.",
      "This is a high-trust scenario. It shows what an identity layer adds at first notice of loss, and just as clearly what it leaves with the insurer.",
    ],
    sections: [
      {
        heading: "Why insurers need to know who is filing",
        body: [
          "Claims intake is already a target for fraud, and automated filing makes volume cheap. An insurer that cannot tell one filing agent from another has two options: route every automated filing to manual review, or accept claims whose source it cannot name. Neither holds up as more policyholders hand routine paperwork to agents and services.",
        ],
      },
      {
        heading: "How the intake agent checks the claims agent",
        body: [
          "The claims agent presents its AgenID. The insurer's agent resolves it, reads the operator's signed manifest and re-verifies the Ed25519 signature itself, without an account with AgenID. In the illustrated flow it also issues a fresh challenge that only the holder of the agent's key can answer, so a recording of an earlier session cannot be replayed.",
          "The operator declaration shows as DECLARED at L1_REGISTERED. The illustration then shows L3_ORGANIZATION_VERIFIED, meaning an authority reviewed evidence of the claims company itself, and L4_DEPLOYMENT_VERIFIED, meaning the deployment was checked. Each level says exactly what was checked for one version of the manifest and nothing more.",
        ],
      },
      {
        heading: "Coverage and payout stay with the insurer",
        body: [
          "Knowing which agent filed says nothing about whether the policyholder is who they claim, whether the loss is covered or what should be paid. Policyholder authentication, adjudication, fraud review and payment remain the insurer's processes, run on its own controls. AgenID answers who is filing; the insurer decides everything that follows.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI agent file an insurance claim?", a: "Agents and claims services can already submit first notice of loss for a policyholder. The gap is that the insurer usually cannot tell which agent is submitting or who stands behind it, which is what a portable identity like AgenID addresses." },
      { q: "How does an insurer verify a claims agent?", a: "It resolves the identifier the agent presents, re-verifies the operator's signature over the manifest, and checks which specific claims about the operator have been independently verified. It does not need to trust AgenID's registry to do this." },
      { q: "Does a verified identity mean the claim should be paid?", a: IDENTITY_NOT_PERMISSION },
      { q: "Is L4 deployment verification available?", a: "Not yet. The L4 sampling methodology has not been finalised, and no level above L1_REGISTERED is issuable until the root authority key exists. The page shows L4 to explain the model." },
    ],
    related: ["financial-transaction", "legal-services", "government-services"],
  },
  "real-estate": {
    title: "AI Agents in Real Estate: Verify Buyer's Agents",
    description:
      "A buyer's AI agent asks a listing brokerage for a showing and disclosures. See how the brokerage verifies who is asking before it opens a calendar or a file.",
    h1: "AI agents in real estate: verifying the buyer's agent before a showing",
    keywords: ["AI real estate agent", "AI showing request", "verify buyer agent identity", "real estate AI automation", "listing brokerage AI agent"],
    lead: [
      "Mike wants to see a house and read the disclosures before he does. His buyer's brokerage runs an agent that contacts the listing brokerage's agent: \"I'm requesting a showing for my buyer.\" The listing side is about to put a stranger on a seller's calendar and send documents about the property.",
      "This scenario shows how a listing brokerage can check which agent is asking, and which brokerage stands behind it, before anything is released.",
    ],
    sections: [
      {
        heading: "Why showing requests are a trust decision",
        body: [
          "A showing puts someone inside a seller's home, and a disclosure package contains details the seller shared for serious buyers. Listing agents already screen callers by phone and email, and both are easy to imitate. As buyers' brokerages automate scheduling, the listing side needs a way to tell a real brokerage's agent from an agent claiming to be one.",
        ],
      },
      {
        heading: "How the listing brokerage checks the buyer's agent",
        body: [
          "The buyer's agent presents its AgenID. The listing brokerage's agent resolves it and re-verifies the operator's signature on the manifest, which names the brokerage that runs the agent. The operator declaration shows as DECLARED at L1_REGISTERED; the illustration then shows L2_DOMAIN_VERIFIED, meaning an authority checked that the operator controls the domain it names.",
          "Because the identity is persistent, the listing side can see that the same agent later asks for a second showing or submits an offer, rather than treating every message as a new unknown.",
        ],
      },
      {
        heading: "Access and disclosures stay with the seller's side",
        body: [
          "Identity does not open a door or a file. What is released, to whom and when follows the seller's instructions and the listing brokerage's policy. Offers, representation and everything a transaction requires remain with the parties and their brokerages.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI agent schedule a property showing?", a: "Many scheduling tools already do. What they usually cannot tell the listing side is which agent is asking and which brokerage stands behind it. A portable identity makes that checkable." },
      { q: "How does a listing brokerage verify an AI agent?", a: "It resolves the agent's AgenID, re-verifies the operator's signature on the manifest, and checks which claims about the operator, such as control of its domain, have been independently verified." },
      { q: "Does verification entitle the agent to the disclosure package?", a: IDENTITY_NOT_PERMISSION },
      { q: "Does the listing brokerage need an account with AgenID?", a: "No. Resolution is a public HTTPS request, and the signature check uses standard Ed25519 verification over RFC 8785 canonical JSON. No adapter package is published yet for any real estate platform." },
    ],
    related: ["legal-services", "financial-transaction", "home-services"],
  },
  "legal-services": {
    title: "AI Agents and Law Firms: Verifying Who Is Asking",
    description:
      "A client company's AI agent asks outside counsel for case documents. See how a law firm verifies the requester while privilege and engagement stay its call.",
    h1: "AI agents and law firms: verifying who is requesting case documents",
    keywords: ["AI legal intake", "law firm AI agent verification", "AI legal operations agent", "verify AI agent legal", "client intake AI agent"],
    lead: [
      "Corbel Property Group's legal-operations agent asks its outside counsel for the latest filings in a pending matter. The firm's intake agent receives a polite, well-formed request that names the client and the matter. That is exactly what an impersonator would send.",
      "This high-trust scenario shows how a firm can check which agent is asking and which organization it acts for, while every professional decision stays with the firm.",
    ],
    sections: [
      {
        heading: "Why a firm cannot act on a well-written request",
        body: [
          "Firms hold material a client expects to stay confidential, and requests that look like they come from a client are a known route to extracting it. Email domains and letterheads can be imitated. When the requester is an agent, the firm needs something it can check that does not depend on how convincing the request reads.",
        ],
      },
      {
        heading: "How the firm checks the requesting agent",
        body: [
          "The client's agent presents its AgenID. The firm's intake agent resolves it and re-verifies the operator's signature over the manifest. The illustration shows L2_DOMAIN_VERIFIED, where an authority checked control of the client's domain, and L3_ORGANIZATION_VERIFIED, where it reviewed evidence of the organization itself.",
          "Because the identifier is persistent, the firm can later confirm which agent made which request, and which operator claims were verified for that manifest version, without relying on either side's recollection.",
        ],
      },
      {
        heading: "Privilege, conflicts and engagement stay with the firm",
        body: [
          "Whether the organization is a client, whether a conflict exists, what is privileged and what may be released are professional judgments the firm makes under its own obligations. AgenID identifies the requester. It does not form an engagement, waive or protect privilege, or tell the firm what it may disclose. Nothing here is legal advice.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can a law firm work with a client's AI agent?", a: "Some firms already receive requests from client-side automation. The open question is which agent is asking and which organization it acts for, which a portable identity makes checkable." },
      { q: "How does a firm verify an AI agent's organization?", a: "It resolves the agent's AgenID, re-verifies the operator's signature, and reads which claims about the operator have been independently verified. In this illustration those are domain control at L2 and organization evidence at L3." },
      { q: "Does verification mean the firm should release the documents?", a: IDENTITY_NOT_PERMISSION },
      { q: "Does AgenID create an attorney-client relationship?", a: "No. AgenID is an identity layer. Engagement, conflicts and privilege are determined by the firm and the applicable professional rules, not by any verification level. This is not legal advice." },
    ],
    related: ["insurance-claim", "real-estate", "b2b-procurement"],
  },
  recruiting: {
    title: "AI Recruiting Agents: Verify Both Sides of a Hire",
    description:
      "A candidate's AI agent applies and an employer's screening agent answers. See how each side verifies the other before a screen, while hiring stays the employer's.",
    h1: "AI recruiting agents: verifying the candidate's agent and the employer's",
    keywords: ["AI recruiting agent", "AI job application agent", "verify recruiter identity", "AI screening agent", "fake recruiter AI"],
    lead: [
      "Mike asks his job-search agent to apply for an operations manager role and set up a first call. The employer runs a screening agent that handles applications at volume. Each side has a reason to ask who is on the other end: the employer does not know which agent sent the application, and Mike's agent does not know whether the \"employer\" is real.",
      "This scenario shows verification running in both directions, which matters in hiring because impersonation happens on both sides.",
    ],
    sections: [
      {
        heading: "Why hiring needs identity on both sides",
        body: [
          "Employers see automated applications they cannot attribute, and candidates are targeted by fake recruiters who collect personal details under a real company's name. A screening agent that cannot tell one applicant's agent from another, and a candidate's agent that cannot check the employer, both end up guessing.",
        ],
      },
      {
        heading: "Mutual verification before the screen",
        body: [
          "The candidate's agent presents its AgenID. The employer's screening agent resolves it and re-verifies the operator's signature; the operator declaration shows as DECLARED at L1_REGISTERED, which is what the candidate says about their own agent. In the other direction, Mike's agent resolves the employer's agent and sees a domain claim at L2_DOMAIN_VERIFIED, meaning an authority checked that the employer controls the domain it names.",
          "Neither side depends on a job board or a shared platform to do this. Each resolves the other's public record on its own.",
        ],
      },
      {
        heading: "Identity is not a credential",
        body: [
          "A verified agent identity says nothing about a candidate's qualifications, references or eligibility to work, and nothing about whether an offer should be made. Those are assessed by the employer through its own screening. AgenID answers who is on the other end of the conversation.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI agent apply for jobs for me?", a: "Many can fill in applications and schedule calls. What the employer usually cannot tell is which agent is applying and who stands behind it, and what the candidate cannot tell is whether the employer's agent is genuine." },
      { q: "How can a candidate's agent check a recruiter is real?", a: "By resolving the recruiter agent's AgenID, re-verifying its operator's signature, and checking whether a domain claim for the employer has been independently verified. Domain verification is part of the model; it is not issuable today." },
      { q: "Does a verified identity mean the candidate is qualified?", a: IDENTITY_NOT_PERMISSION },
      { q: "Does AgenID store résumés or candidate data?", a: "No. The registry holds the agent's signed manifest and public key. Candidate materials go wherever the candidate and employer send them, outside AgenID." },
    ],
    related: ["sales-outreach", "b2b-procurement", "why-identity"],
  },
  "government-services": {
    title: "AI Agents Renewing Permits at Government Portals",
    description:
      "A filing agent renews a license at an agency portal. See how the agency verifies which AI agent is filing, while resident identity proofing stays separate.",
    h1: "AI agents and government services: verifying the filing agent",
    keywords: ["AI agent government services", "AI permit renewal", "AI license renewal agent", "government portal AI agent", "verify filing agent identity"],
    lead: [
      "Mike's contractor license is about to lapse. He hands the renewal to a filing service, whose agent submits it at the county licensing portal. The agency now receives filings from software acting for residents, and it needs to know which filer it is dealing with.",
      "This high-trust scenario separates two questions an agency must never merge: which agent is filing, and who the resident is.",
    ],
    sections: [
      {
        heading: "Two identities, not one",
        body: [
          "Agencies already run identity proofing for residents. That process establishes who the license holder is. It says nothing about the software submitting on their behalf, which may be operated by a filing service the agency has never dealt with. Without a way to identify the filer, an agency either blocks automated filing or accepts submissions it cannot attribute.",
        ],
      },
      {
        heading: "How the portal checks the filing agent",
        body: [
          "The filing agent presents its AgenID. The portal resolves it, reads the signed manifest naming the filing service as operator, and re-verifies the signature itself. The operator declaration shows as DECLARED at L1_REGISTERED; the illustration then shows L2_DOMAIN_VERIFIED for the service's domain and L3_ORGANIZATION_VERIFIED for evidence of the organization.",
          "Because the identifier is persistent, the agency can attribute every filing to the same agent over time and see which operator stands behind it.",
        ],
      },
      {
        heading: "Resident proofing and the decision stay with the agency",
        body: [
          "AgenID does not identify the resident and does not replace the agency's own identity proofing. Eligibility, fees and the licensing decision follow the agency's rules. The filing agent's identity is one more input the agency can read; it grants nothing.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI agent renew a license or permit?", a: "Filing services and agents can already submit renewals where portals allow it. The open question for the agency is which agent is filing and who operates it, which a portable identity makes checkable." },
      { q: "Does AgenID verify the resident's identity?", a: "No. AgenID identifies the agent and its operator. Proofing the resident is a separate process the agency runs on its own terms." },
      { q: "Does a verified filing agent get the renewal approved?", a: IDENTITY_NOT_PERMISSION },
      { q: "What does an agency need to verify an agent?", a: "An HTTPS request to resolve the identifier and standard Ed25519 signature verification over RFC 8785 canonical JSON. It does not need an account or a contract with AgenID." },
    ],
    related: ["financial-transaction", "insurance-claim", "personal-admin"],
  },
  "home-services": {
    title: "Booking Home Services With an AI Agent",
    description:
      "One household AI agent, three plumbers. See how each provider verifies the same booking agent on its own before it holds an arrival window for the job.",
    h1: "Booking a plumber with an AI agent: how providers verify the caller",
    keywords: ["AI agent home services", "book a plumber with AI", "AI home services booking", "verify AI booking agent", "home services agentic commerce"],
    lead: [
      "The kitchen sink is leaking. Mike asks his home agent to get a plumber out by tomorrow. The agent contacts three local providers at once, and each is about to hold an arrival window, and a truck, for a caller it has never heard from.",
      "Like buying tires, this scenario shows one identity presented to several businesses, each of which checks it on its own.",
    ],
    sections: [
      {
        heading: "Why providers hesitate to hold a slot for an agent",
        body: [
          "An arrival window is a real cost for a small provider. Automated requests that never turn into jobs, or that come from nobody in particular, waste a day's schedule. Refusing all of them loses customers who now book through assistants.",
        ],
      },
      {
        heading: "Three providers, one identity, three independent checks",
        body: [
          "The household agent presents the same AgenID to each provider. Each resolves it and re-verifies the operator's signature itself; none relies on another provider's check or on a marketplace in the middle. The operator declaration shows as DECLARED at L1_REGISTERED, which is what Mike says about his own agent, and that is also what the reference registry can issue today.",
          "Because the identity is persistent, a provider can recognize the same household agent next time instead of starting from nothing.",
        ],
      },
      {
        heading: "Access, payment and licensing stay between the parties",
        body: [
          "Which agent booked the job is a different question from who may enter the house. Access, price, the scope of the work and payment are settled between Mike and the plumber, and whether the plumber is licensed is a matter for local licensing, not for AgenID.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI agent book a plumber for me?", a: "Agents can already contact providers and request a slot. What the provider usually cannot tell is which agent is asking and who stands behind it, which is what a portable identity adds." },
      { q: "How does a provider verify a booking agent?", a: "It resolves the agent's AgenID and re-verifies the operator's signature on the manifest, then checks which claims have been independently verified. Each provider does this on its own." },
      { q: "Does verification let the agent authorize entry to the home?", a: IDENTITY_NOT_PERMISSION },
      { q: "Does AgenID verify the plumber?", a: "Only if the plumber's own agent presents an AgenID, and then only its identity and verified claims. Trade licensing, insurance and reviews stay outside AgenID." },
    ],
    related: ["buying-tires", "dentist-appointment", "personal-admin"],
  },
  "sales-outreach": {
    title: "AI SDR Calls: Verify Who Is Calling Your Business",
    description:
      "An outbound AI voice agent calls a business. See how the business verifies who is calling and who operates the caller before it decides whether to engage.",
    h1: "AI sales calls: how a business verifies the voice agent on the line",
    keywords: ["AI SDR agent", "AI outbound calling", "verify AI caller", "AI voice agent identity", "AI cold call disclosure"],
    lead: [
      "Larchmont Software's outbound SDR agent calls a regional distributor: \"Hi, I'm an AI assistant calling for Larchmont Software.\" The distributor's front-desk agent has heard that sentence from many callers, and nothing in the call itself tells it whether it is true.",
      "This scenario is the voice-agent case turned around: the business receiving the call resolves who is calling before anyone engages.",
    ],
    sections: [
      {
        heading: "Why caller names and caller ID are not enough",
        body: [
          "A voice agent can say any company name, and caller ID can be spoofed. Businesses respond by screening out automated calls altogether, which also blocks legitimate outreach. What the receiving side lacks is a way to check who is calling and who answers for the call.",
        ],
      },
      {
        heading: "How the business checks the SDR agent",
        body: [
          "The SDR agent presents its AgenID. The business's agent resolves it, reads the operator's signed manifest and re-verifies the signature. The manifest carries the operator's own disclosure fields, including whether the agent is an AI, and those show as DECLARED at L1_REGISTERED because they are the operator's statement. The illustration then shows L2_DOMAIN_VERIFIED, meaning an authority checked that the operator controls the domain it names.",
          "For voice platforms, the Retell and Vapi partner docs (/docs/partners/retell-ai-integration and /docs/partners/vapi-integration) describe how an agent could present its identity: each is an integration pattern, not a package, and no adapter exists for either yet.",
        ],
      },
      {
        heading: "Disclosure and the decision to engage",
        body: [
          "Transparency rules such as Article 50 of the EU AI Act address when people must be told they are interacting with an AI system. That is context, not legal advice: a declared AI flag is the operator's statement, not a determination about any law. Whether to take the meeting, share a contact or buy anything stays entirely with the business.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "How can a business tell who an AI caller is?", a: "By asking the caller for its AgenID, resolving it, and re-verifying the operator's signature on the manifest. The business then sees which company declared it operates the agent and which claims about that company have been independently verified." },
      { q: "Does AgenID show whether the caller is an AI?", a: "The manifest includes the operator's own disclosure fields, including whether the agent is an AI. They are self-declared by the operator, which is why they render as DECLARED rather than verified." },
      { q: "Does a verified caller have permission to sell to us?", a: IDENTITY_NOT_PERMISSION },
      { q: "Is there a Retell or Vapi package for AgenID?", a: "No. The partner docs describe an integration pattern, not a package. No adapter package exists for any voice platform yet, and nothing is published to npm." },
    ],
    related: ["dentist-appointment", "recruiting", "why-identity"],
  },
  "personal-admin": {
    title: "AI Agents Canceling Subscriptions: Who Is Asking?",
    description:
      "A personal AI agent asks a provider's support agent to cancel a subscription. See how support verifies which agent is asking before it acts on the account.",
    h1: "AI agents handling subscriptions: how support verifies the agent",
    keywords: ["AI agent cancel subscription", "AI personal assistant admin", "customer support AI agent verification", "verify AI agent account request", "AI agent customer service"],
    lead: [
      "\"Cancel the streaming plan I never use.\" Mike's personal agent contacts the provider's support agent: \"I'm handling account changes for Mike.\" Support is about to change an account on the word of software it has never seen before.",
      "This everyday scenario shows the same handshake as the dentist call, applied to the account changes people increasingly hand to agents.",
    ],
    sections: [
      {
        heading: "Why support desks are wary of agent requests",
        body: [
          "Account changes are a common route for takeover and abuse, so support teams follow strict scripts. An agent that cannot be identified either gets stuck in those scripts or gets refused outright. Neither helps the customer who delegated a routine task.",
        ],
      },
      {
        heading: "How support checks the personal agent",
        body: [
          "The personal agent presents its AgenID. The support agent resolves it and re-verifies the operator's signature on the manifest. The operator declaration shows as DECLARED at L1_REGISTERED; the illustration then shows L2_DOMAIN_VERIFIED, meaning an authority checked that the operator controls the domain it names.",
          "Because the identifier is persistent, the provider can see the same agent return for the next request, and the confirmation goes back to the same identity that asked.",
        ],
      },
      {
        heading: "The account holder is still the provider's to confirm",
        body: [
          "Identifying the agent is not the same as authenticating the account holder. The provider still confirms that the request comes from its customer, applies its cancellation terms and decides any refund, using the controls it already runs.",
          LEVELS_TODAY,
        ],
      },
    ],
    faqs: [
      { q: "Can an AI agent cancel subscriptions for me?", a: "Agents can already contact support and make requests. What the provider usually cannot tell is which agent is asking and who stands behind it, which a portable identity makes checkable." },
      { q: "How does a support team verify an AI agent?", a: "It resolves the agent's AgenID, re-verifies the operator's signature over the manifest, and reads which claims have been independently verified, without an account with AgenID." },
      { q: "Does verification let the agent change my account?", a: IDENTITY_NOT_PERMISSION },
      { q: "Does AgenID hold my account credentials?", a: "No. AgenID never holds account passwords, payment details or an operator's signing key. The signing key is generated in the browser at /issue and never sent to AgenID." },
    ],
    related: ["dentist-appointment", "home-services", "travel"],
  },
};
