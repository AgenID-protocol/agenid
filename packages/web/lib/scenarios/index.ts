/**
 * Scenario catalogue — the routing and navigation view of the library.
 *
 * Two kinds of entry share one list, because a reader does not care which of them is
 * data-driven:
 *
 *   - `kind: "scenario"` carries a full Scenario and renders through ScenarioPlayer.
 *   - `kind: "custom"`   is a bespoke component. Only `today-vs-agentic` is one: it is
 *     a two-column comparison of the old model and the new, not a handshake, and
 *     bending it into the Scenario shape would add a variant nothing else uses.
 *
 * Slugs are permanent once shipped — they appear in the sitemap and in anything anyone
 * links to.
 */

import type { Scenario } from "./types";
import { SCENARIOS } from "./data";

export type { Scenario } from "./types";
export {
  EXAMPLE_AGENID,
  EXAMPLE_FLOW_LABEL,
  ISSUANCE_CEILING,
  WHAT_WAS_VERIFIED,
  CHALLENGE_IS_PROPOSED,
} from "./types";
export * from "./timeline";
export { SCENARIOS } from "./data";
export { SCENARIO_SEO, seoFor } from "./seo";
export type { ScenarioSeo, SeoFaq, SeoSection } from "./seo";

export interface CatalogueEntry {
  readonly slug: string;
  readonly group: string;
  readonly kicker: string;
  readonly title: string;
  readonly summary: string;
  readonly kind: "scenario" | "custom";
}

const CUSTOM: readonly CatalogueEntry[] = [
  {
    slug: "today-vs-agentic",
    group: "Start here",
    kicker: "Transition",
    title: "The internet gets one more participant",
    summary:
      "Today a person is on one end of every transaction. Next, an agent is — often on both ends. Which raises a question the old model never had to answer.",
    kind: "custom",
  },
];

/** Presentation order: the two openers first, then the scenarios in their own order. */
export const CATALOGUE: readonly CatalogueEntry[] = [
  ...SCENARIOS.filter((s) => s.group === "Start here").map(toEntry),
  ...CUSTOM,
  ...SCENARIOS.filter((s) => s.group !== "Start here").map(toEntry),
];

function toEntry(s: Scenario): CatalogueEntry {
  return {
    slug: s.slug,
    group: s.group,
    kicker: s.kicker,
    title: s.title,
    summary: s.summary,
    kind: "scenario",
  };
}

/** Section order on the index page. A group not listed here sorts last, alphabetically. */
const GROUP_ORDER = ["Start here", "Everyday life", "Business", "High trust", "Agent networks"];

export function groupedCatalogue(): { group: string; entries: readonly CatalogueEntry[] }[] {
  const groups = [...new Set(CATALOGUE.map((e) => e.group))].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return groups.map((group) => ({ group, entries: CATALOGUE.filter((e) => e.group === group) }));
}

export function scenarioSlugs(): string[] {
  return CATALOGUE.map((e) => e.slug);
}

export function findEntry(slug: string): CatalogueEntry | undefined {
  return CATALOGUE.find((e) => e.slug === slug);
}

export function findScenario(slug: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.slug === slug);
}

/** The next entry in catalogue order, for the footer link. Wraps to the first. */
export function nextEntry(slug: string): CatalogueEntry | undefined {
  const i = CATALOGUE.findIndex((e) => e.slug === slug);
  if (i === -1) return undefined;
  return CATALOGUE[(i + 1) % CATALOGUE.length];
}

/**
 * The scenarios this set does NOT include.
 *
 * Empty since the eight remaining scenarios shipped (lib/scenarios/more.ts). Kept, and still
 * rendered when non-empty, so a future gap is named rather than omitted. Originally: the prototype covered nine of a sketched sixteen, and a
 * reader who came looking for insurance or recruiting should find out that it is
 * missing, not that it does not exist.
 */
export const NOT_BUILT: readonly string[] = [];
