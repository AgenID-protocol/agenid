/**
 * Scenario data model.
 *
 * These scenarios are ILLUSTRATIONS OF THE PROTOCOL, not resolutions of real agents.
 * That distinction is the whole reason this file exists as a typed data model rather
 * than as nine hand-written pages:
 *
 *   - A surface that presents a REAL agent's state must read its level from the
 *     authoritative response and route it through lib/trust-presentation.ts. The
 *     Verification Card, both badges and /issue all do.
 *   - A surface that ILLUSTRATES the protocol may name a level it is explaining —
 *     but only while saying, unmissably, that it is an illustration, and only while
 *     the page states what the reference deployment can actually issue today.
 *
 * Those two disclosures are therefore not optional fields on a scenario. They are
 * required members of the type, and test/scenarios.test.ts asserts every scenario
 * carries them and that each one reaches the rendered page. A disclosure that a
 * future author can forget is a disclosure that a future author will forget — this
 * project has the commit history to prove it.
 */

import type { TimelineShape } from "./timeline";

/**
 * Verification level names, verbatim from spec v1.1.1's enum.
 *
 * `L5_CONTINUOUSLY_MONITORED` is deliberately absent: it is a reserved name that the
 * spec does not make issuable, so it must not be nameable here either. Anything an
 * illustration can render is something a reader can reasonably believe exists.
 */
export type IllustratedLevel =
  | "L1_REGISTERED"
  | "L2_DOMAIN_VERIFIED"
  | "L3_ORGANIZATION_VERIFIED"
  | "L4_DEPLOYMENT_VERIFIED";

/**
 * How a row reads.
 *
 *   verified — a third party checked a specific claim against evidence. Emerald.
 *   declared — asserted by the operator and nothing more. Amber, exactly as L1 and
 *              DECLARED render everywhere else in the product.
 *   pending  — in flight. Amber. Never red: an unfinished check is not a failure.
 *   neutral  — outside AgenID's scope entirely. Muted.
 *
 * There is no `failed` tone, and that is deliberate. Absence of verification is not a
 * negative finding, and nothing in this product renders it as one.
 */
export type RowTone = "verified" | "declared" | "pending" | "neutral";

export interface FlowRow {
  readonly label: string;
  readonly value: string;
  readonly tone: RowTone;
  /** The step at which this row reveals. */
  readonly step: number;
  /** Optional spec level chip shown beside the label. */
  readonly level?: IllustratedLevel;
  /** A slow pulse on the status dot, for a check that is genuinely in flight. */
  readonly pulse?: boolean;
}

export interface PlainRow {
  readonly label: string;
  readonly value: string;
  readonly tone: RowTone;
  readonly step: number;
}

/** The human or organization that delegated the task. Absent in the hero, which starts at the agent. */
export interface PromptCard {
  readonly role: string;
  readonly name: string;
  readonly quote: string;
  readonly step: number;
}

export interface AgentCard {
  readonly role: string;
  readonly name: string;
  readonly meta: string;
  readonly quote?: string;
  readonly step: number;
}

/** One counterparty that asks the question. */
export interface SingleCounterparty {
  readonly kind: "single";
  readonly role: string;
  readonly name: string;
  readonly meta?: string;
  readonly challenge: string;
  readonly step: number;
}

/**
 * Several counterparties that each resolve the same identity independently.
 *
 * Three steps rather than one, because the sequence is the argument: the cards arrive,
 * then each card's own verification lands, and only then does anyone release a number.
 * Revealing the detail with the card would show sellers pricing a buyer they have not
 * yet resolved, which is precisely the behavior these scenarios exist to contrast with.
 */
export interface GridCounterparty {
  readonly kind: "grid";
  /** Cards appear. */
  readonly step: number;
  /** Each card's independent verification badge lands. */
  readonly badgeStep: number;
  /** The commercial detail each one then releases. */
  readonly detailStep: number;
  readonly members: readonly {
    readonly role: string;
    readonly name: string;
    readonly badge: string;
    readonly headline: string;
    readonly detail: string;
    /** Marks the one that won the comparison, where a scenario has one. */
    readonly chosen?: boolean;
  }[];
}

/** A delegation chain, each hop resolved and verified before work is handed over. */
export interface HopsCounterparty {
  readonly kind: "hops";
  readonly connector: string;
  readonly hops: readonly {
    readonly index: string;
    readonly name: string;
    readonly id: string;
    readonly step: number;
  }[];
}

export type Counterparty = SingleCounterparty | GridCounterparty | HopsCounterparty;

/** The two endings: what happens without a resolvable identity, and what happens with one. */
export interface Outcome {
  readonly step: number;
  readonly without: { readonly title: string; readonly body: string };
  readonly with: { readonly title: string; readonly headline: string; readonly body: string };
}

export interface Scenario {
  readonly slug: string;
  /** Section heading on the index page. */
  readonly group: string;
  /** "Scenario 01", "Hero", "Transition" — the prototype's own numbering, preserved. */
  readonly kicker: string;
  readonly title: string;
  readonly summary: string;
  readonly shape: TimelineShape;
  /** One caption per step, plus an idle caption at index 0. */
  readonly labels: readonly string[];

  readonly prompt?: PromptCard;
  readonly agent: AgentCard;
  readonly counterparty: Counterparty;

  readonly flow: {
    /** Shown only in `without` mode, where there is nothing to resolve. */
    readonly nothingToResolve: { readonly label: string; readonly value: string };
    readonly rows: readonly FlowRow[];
  };

  /** Everything AgenID deliberately does not decide. Every scenario has one. */
  readonly separate: {
    readonly title: string;
    readonly rows: readonly PlainRow[];
    readonly note: string;
  };

  readonly outcome: Outcome;
  readonly closing?: { readonly line: string; readonly kicker: string };

  /** Scoped statement of what this scenario's verification does and does not establish. */
  readonly proves: string;
}

/**
 * Required on every page that renders a scenario.
 *
 * Challenge–response is a proposed interaction pattern; v1.1.1 defines the signed
 * objects, not this exchange. Any scenario showing a nonce is showing something the
 * protocol does not specify, and must say so.
 */
export const EXAMPLE_FLOW_LABEL = "Example verification flow";

/**
 * The ceiling statement.
 *
 * Several scenarios illustrate L2, L3 and L4. The reference deployment at agenid.com
 * issues none of them: `L2_DOMAIN_VERIFIED` and above require a VerificationAssertion
 * signed by the root authority key, and that key does not exist yet. Showing the model
 * without stating the ceiling would be the same defect as a documented endpoint that
 * 404s, one layer of abstraction up.
 */
export const ISSUANCE_CEILING =
  "These scenarios illustrate the protocol's verification model. The reference deployment at agenid.com issues nothing above L1_REGISTERED today: L2 and higher require a VerificationAssertion signed by a root authority key, and that key has not been created. L5 is reserved by the spec and is not issuable at all.";

/** What every scenario says about the boundary of a verified claim. */
export const WHAT_WAS_VERIFIED =
  "A specific claim was independently checked against evidence by an authority-role key, scoped to one level and one validity window, and bound to this manifest version by digest. Nothing broader is asserted.";

export const CHALLENGE_IS_PROPOSED =
  "Challenge–response is a proposed interaction pattern. v1.1.1 defines the signed objects, not this exchange.";

/** The spec's own example ULID. No scenario invents an identifier. */
export const EXAMPLE_AGENID = "agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC";
