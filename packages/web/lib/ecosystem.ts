import fs from "node:fs";
import path from "node:path";

/**
 * The AgenID ecosystem / compatibility registry.
 *
 * File-backed on purpose: this is a small, slow-moving, human-reviewed list where a
 * bad entry is a *credibility* problem, not a data problem. Keeping it as reviewable
 * JSON in the repo means every change to a compatibility claim goes through a diff and
 * CI (see test/ecosystem.test.ts) instead of a database write nobody sees. If the list
 * ever needs to be edited by non-committers, move it behind the same RegistryStore
 * interface the agent registry uses — do not add a second, looser source of truth.
 *
 * HONESTY CONTRACT (enforced by validate() and by the ecosystem test files):
 *   - "planned"             — AgenID intends to support this and has NOT yet. Carries no
 *                             technical claim at all. Reserved; see the note below.
 *   - "compatible"          — AgenID identity can be carried through this platform
 *                             today using its existing, documented API surface. It does
 *                             NOT mean AgenID has run it, that the platform ships any
 *                             AgenID code, or that any relationship exists.
 *   - "verified-integration"— AgenID has itself executed the integration end to end and
 *                             published the result. `verified` MUST be true.
 *   - "official-partner"    — a partnership is on record. `verified` and `partner` MUST
 *                             both be true.
 *
 * As of this writing every entry is "compatible" and nothing is verified, planned, or a
 * partner. Raising an entry's status is a factual claim: it requires evidence in the
 * same commit.
 *
 * WHY "planned" EXISTS AND IS EMPTY. A roadmap status is the easiest way to pad an
 * ecosystem graphic with aspiration, so it is defined here and deliberately unoccupied:
 * a platform AgenID has actually written an integration brief for is already
 * "compatible", which is the stronger and truer claim, and a platform with neither a
 * brief nor a documented mechanism does not belong in the registry at all. The status
 * exists so that a future genuinely-committed integration has an honest place to sit
 * before it works — not so that today's list can look longer. The emptiness is
 * test-enforced, exactly like "verified-integration" and "official-partner".
 *
 * THE verified/partner FLAGS ARE DERIVED FROM STATUS, NOT ASSERTED ALONGSIDE IT. They
 * remain stored fields so every entry reads as a complete, reviewable record in its own
 * diff, but the validator requires each to equal the value this table declares for that
 * status. Writing the rule as a per-status table rather than as a boolean expression is
 * what makes adding a fourth status safe: an expression like
 * `verified === (status !== "compatible")` silently becomes wrong the moment a status is
 * added that is neither compatible nor verified, which is precisely what "planned" is.
 */

export const ECOSYSTEM_CATEGORIES = [
  { id: "voice", label: "Voice", blurb: "Voice agent platforms where the identity rides the call." },
  { id: "models", label: "Models", blurb: "Model providers. Identity sits above the model, never inside it." },
  { id: "infrastructure", label: "Infrastructure", blurb: "Where key documents, resolvers, and runtimes are hosted." },
  { id: "frameworks", label: "Frameworks", blurb: "Orchestration layers that pass identity between agents and tools." },
  { id: "enterprise", label: "Enterprise Identity", blurb: "IAM systems AgenID composes with rather than replaces." },
  // The tier the ecosystem graphic exists to argue for: where a verified agent's
  // decision stops being a message and becomes an effect someone is accountable for.
  // Deliberately last — identity is established above it, and spent here.
  { id: "action", label: "Action", blurb: "Where a verified agent's decision becomes a real-world effect." },
] as const;

export type EcosystemCategory = (typeof ECOSYSTEM_CATEGORIES)[number]["id"];

/**
 * The four statuses, each carrying the flag values an entry claiming it must have.
 * `rank` is presentation order, weakest claim first — never a sort by "importance",
 * which is how a list starts flattering itself.
 */
export const ECOSYSTEM_STATUSES = {
  planned: {
    label: "Planned",
    short: "Planned",
    definition:
      "AgenID intends to support this and does not yet. This is a statement of intent with no technical claim attached — nothing works today. Not asserted for any entry yet.",
    verified: false,
    partner: false,
    rank: 0,
  },
  compatible: {
    label: "Compatible",
    short: "Compatible",
    definition:
      "Identity can be carried through this platform today using its existing, documented API surface. No AgenID-specific code is required from the platform, and none is claimed to exist.",
    verified: false,
    partner: false,
    rank: 1,
  },
  "verified-integration": {
    label: "Verified Integration",
    short: "Connected",
    definition:
      "AgenID has executed the integration end to end and published the result. Not asserted for any entry yet.",
    verified: true,
    partner: false,
    rank: 2,
  },
  "official-partner": {
    label: "Official Partner",
    short: "Partner",
    definition:
      "A partnership is on record with the platform. Not asserted for any entry yet.",
    verified: true,
    partner: true,
    rank: 3,
  },
} as const;

export type EcosystemStatus = keyof typeof ECOSYSTEM_STATUSES;

/**
 * What AgenID's relationship with a platform actually is.
 *
 * DERIVED, never stored. A stored relationship field would be a second source of truth
 * for something `status` and `docs` already determine, and this project's own history
 * is a list of what happens when the same fact lives in two places. `relationshipOf()`
 * cannot disagree with the registry because it *is* the registry.
 *
 * The distinction the ecosystem graphic depends on: "AgenID published a written
 * integration brief" is a fact about AgenID's documentation, NOT a fact about the
 * vendor. A platform can have a brief and know nothing about AgenID. That is why the
 * middle value is named for the pattern being documented rather than for any
 * relationship existing.
 */
export const ECOSYSTEM_RELATIONSHIPS = {
  none: {
    label: "No relationship",
    definition: "Listed on technical grounds only. The platform has no involvement with AgenID.",
  },
  "pattern-documented": {
    label: "Pattern documented",
    definition:
      "AgenID has published a written integration brief describing how identity travels through this platform. The brief is AgenID's own work; the platform has no involvement with it and ships no AgenID code.",
  },
  partner: {
    label: "Partner",
    definition: "A partnership is on record with the platform.",
  },
} as const;

export type EcosystemRelationship = keyof typeof ECOSYSTEM_RELATIONSHIPS;

export type EcosystemEntry = {
  id: string;
  name: string;
  /** 1-3 character monochrome mark used in the hub network and grid tiles. */
  abbr: string;
  category: EcosystemCategory;
  description: string;
  website: string;
  status: EcosystemStatus;
  integration_type: string;
  verified: boolean;
  partner: boolean;
  /** ISO calendar date (YYYY-MM-DD) the claim in `compatibility_note` was last reviewed. */
  last_verified: string;
  compatibility_note: string;
  /**
   * Short factual phrases naming what identity actually does on this platform — each
   * one a restatement of something `compatibility_note` already establishes, never a
   * new claim. Required on `featured` entries because those are the ones the ecosystem
   * graphic renders, and a detail card with nothing concrete in it invites the reader
   * to supply their own idea of what "compatible" bought them.
   */
  capabilities?: string[];
  featured: boolean;
  /** Optional in-repo monochrome SVG, served from public/. Inlined (not <img>) so the
   *  single-color CSS treatment applies — see components/ecosystem/PlatformMark.tsx. */
  logo_svg?: string;
  /** Optional link to a written integration brief on this site. */
  docs?: string;
};

const REGISTRY_DIR = path.join(process.cwd(), "data", "ecosystem");
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_IDS = ECOSYSTEM_CATEGORIES.map((c) => c.id) as readonly string[];
const ALLOWED_KEYS = new Set([
  "id", "name", "abbr", "category", "description", "website", "status", "integration_type",
  "verified", "partner", "last_verified", "compatibility_note", "capabilities", "featured",
  "logo_svg", "docs",
]);

function fail(file: string, msg: string): never {
  throw new Error(`ecosystem registry: ${file}: ${msg}`);
}

/**
 * Strict, dependency-free validation. Deliberately not zod: the web package does not
 * otherwise depend on a validation library, the shape is fixed and small, and the
 * invariants that actually matter here (status <-> verified/partner agreement) are
 * cross-field rules a schema alone would not express anyway.
 */
export function validateEntry(raw: unknown, file = "<inline>"): EcosystemEntry {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail(file, "must be a JSON object");
  const o = raw as Record<string, unknown>;

  for (const k of Object.keys(o)) if (!ALLOWED_KEYS.has(k)) fail(file, `unknown field "${k}"`);

  const str = (k: string, re?: RegExp): string => {
    const v = o[k];
    if (typeof v !== "string" || v.trim() === "") fail(file, `"${k}" must be a non-empty string`);
    if (re && !re.test(v)) fail(file, `"${k}" has an invalid format: ${JSON.stringify(v)}`);
    return v;
  };
  const bool = (k: string): boolean => {
    const v = o[k];
    if (typeof v !== "boolean") fail(file, `"${k}" must be a boolean`);
    return v;
  };

  const id = str("id", ID_RE);
  const category = str("category");
  if (!CATEGORY_IDS.includes(category)) fail(file, `"category" must be one of ${CATEGORY_IDS.join(", ")}`);
  const status = str("status");
  if (!(status in ECOSYSTEM_STATUSES)) fail(file, `"status" must be one of ${Object.keys(ECOSYSTEM_STATUSES).join(", ")}`);

  const website = str("website");
  if (!website.startsWith("https://")) fail(file, `"website" must be an https:// URL`);

  const verified = bool("verified");
  const partner = bool("partner");

  // The honesty contract, enforced mechanically rather than by review discipline —
  // and read out of the status table, so adding a status cannot silently change what
  // the existing ones mean.
  const expected = ECOSYSTEM_STATUSES[status as EcosystemStatus];
  if (verified !== expected.verified) {
    fail(file, `"verified" must be ${expected.verified} for status "${status}"`);
  }
  if (partner !== expected.partner) {
    fail(file, `"partner" must be ${expected.partner} for status "${status}"`);
  }

  const last_verified = str("last_verified", DATE_RE);
  if (Number.isNaN(Date.parse(`${last_verified}T00:00:00Z`))) fail(file, `"last_verified" is not a real date`);

  const compatibility_note = str("compatibility_note");
  if (compatibility_note.length < 40) fail(file, `"compatibility_note" must actually say what compatible means here`);

  const abbr = str("abbr");
  if ([...abbr].length > 3) fail(file, `"abbr" must be 1-3 characters`);

  const entry: EcosystemEntry = {
    id,
    name: str("name"),
    abbr,
    category: category as EcosystemCategory,
    description: str("description"),
    website,
    status: status as EcosystemStatus,
    integration_type: str("integration_type"),
    verified,
    partner,
    last_verified,
    compatibility_note,
    featured: bool("featured"),
  };

  // Capabilities: optional in general, REQUIRED on anything the ecosystem graphic
  // renders. A featured tile with an empty detail card is the failure mode this guards
  // — the reader fills the silence with whatever "compatible" sounds like to them.
  if (o.capabilities !== undefined) {
    const caps = o.capabilities;
    if (!Array.isArray(caps) || caps.length === 0) fail(file, `"capabilities" must be a non-empty array`);
    if (caps.length > 6) fail(file, `"capabilities" must be at most 6 items — this is a summary, not a spec sheet`);
    for (const c of caps) {
      if (typeof c !== "string" || c.trim().length < 3) fail(file, `every capability must be a non-trivial string`);
      if (c.length > 80) fail(file, `capability too long to read as a tag: ${JSON.stringify(c)}`);
    }
    if (new Set(caps as string[]).size !== caps.length) fail(file, `"capabilities" contains a duplicate`);
    entry.capabilities = caps as string[];
  } else if (entry.featured) {
    fail(file, `"capabilities" is required on a featured entry — it is what the ecosystem graphic shows`);
  }

  if (o.logo_svg !== undefined) {
    const p = str("logo_svg");
    if (!p.startsWith("/assets/ecosystem/") || !p.endsWith(".svg")) {
      fail(file, `"logo_svg" must be a /assets/ecosystem/**.svg path`);
    }
    entry.logo_svg = p;
  }
  if (o.docs !== undefined) entry.docs = str("docs");

  return entry;
}

let cache: EcosystemEntry[] | null = null;

/** All registry entries, validated, sorted by category order then name. */
export function getEcosystem(): EcosystemEntry[] {
  if (cache) return cache;
  if (!fs.existsSync(REGISTRY_DIR)) return (cache = []);

  const files = fs.readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json")).sort();
  const entries: EcosystemEntry[] = [];
  const seen = new Set<string>();

  for (const f of files) {
    const entry = validateEntry(JSON.parse(fs.readFileSync(path.join(REGISTRY_DIR, f), "utf-8")), f);
    if (entry.id !== f.replace(/\.json$/, "")) fail(f, `"id" (${entry.id}) must match the filename`);
    if (seen.has(entry.id)) fail(f, `duplicate id "${entry.id}"`);
    seen.add(entry.id);
    entries.push(entry);
  }

  const order = (c: EcosystemCategory) => CATEGORY_IDS.indexOf(c);
  entries.sort((a, b) => order(a.category) - order(b.category) || a.name.localeCompare(b.name));
  return (cache = entries);
}

export function getFeatured(): EcosystemEntry[] {
  return getEcosystem().filter((e) => e.featured);
}

/**
 * AgenID's actual relationship with a platform, computed from the registry.
 *
 * Deliberately not a stored field — see ECOSYSTEM_RELATIONSHIPS. Note the ordering:
 * a partnership outranks a brief, and a brief is only ever "AgenID wrote something
 * down", never "the platform participated".
 */
export function relationshipOf(entry: EcosystemEntry): EcosystemRelationship {
  if (entry.status === "official-partner") return "partner";
  if (entry.docs) return "pattern-documented";
  return "none";
}

/**
 * Entries grouped for the ecosystem graphic, in declared category order, with empty
 * categories dropped.
 *
 * The graphic clusters by category rather than spacing every node evenly around one
 * ring, because the clustering *is* the argument: model providers, voice platforms and
 * payment rails are different kinds of thing, and a flat ring says they are
 * interchangeable neighbours of AgenID. Empty categories are dropped rather than
 * rendered as an empty arc — a labelled sector with nothing in it reads as something
 * missing rather than as something not claimed.
 */
/**
 * Clockwise placement order for the cloud, starting at the top.
 *
 * Deliberately NOT the declared category order, which exists for the compatibility
 * matrix and is grouped by how a reader browses. The cloud is read as a sentence
 * instead: the technology an agent is built from sits above it, the rails it acts
 * through sit below, and identity is the layer in between. Models therefore start at
 * twelve o'clock and Action falls in the lower half, which is the one arrangement that
 * makes the centre claim legible without a caption.
 */
const CLOUD_ORDER: readonly EcosystemCategory[] = [
  "models",
  "voice",
  "infrastructure",
  "action",
  "frameworks",
  "enterprise",
];

export function getCloudClusters(): { category: (typeof ECOSYSTEM_CATEGORIES)[number]; entries: EcosystemEntry[] }[] {
  const byId = new Map(getByCategory().map((g) => [g.category.id, g]));
  // Anything not named in CLOUD_ORDER still renders, after the ordered ones — a new
  // category must never silently vanish from the graphic just because this list is stale.
  const ids = [...CLOUD_ORDER, ...[...byId.keys()].filter((id) => !CLOUD_ORDER.includes(id))];
  return ids
    .map((id) => byId.get(id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g))
    .filter((g) => g.entries.some((e) => e.featured))
    .map((g) => ({ category: g.category, entries: g.entries.filter((e) => e.featured) }));
}

/**
 * The ecosystem cloud's render data, built once here rather than in each page.
 *
 * Every page that shows the cloud gets its props from this function. The alternative —
 * each page mapping registry entries to component props itself — is a second place
 * where a status label could be chosen, and two surfaces disagreeing about what
 * "compatible" is called is the smaller version of the defect this registry exists to
 * prevent. The component receives finished strings and picks none of them.
 */
export function buildCloudClusters() {
  return getCloudClusters().map(({ category, entries }) => ({
    id: category.id,
    label: category.label,
    blurb: category.blurb,
    nodes: entries.map((e) => {
      const rel = ECOSYSTEM_RELATIONSHIPS[relationshipOf(e)];
      return {
        id: e.id,
        name: e.name,
        abbr: e.abbr,
        status: e.status,
        statusLabel: ECOSYSTEM_STATUSES[e.status].label,
        statusDefinition: ECOSYSTEM_STATUSES[e.status].definition,
        relationshipLabel: rel.label,
        relationshipDefinition: rel.definition,
        integration_type: e.integration_type,
        compatibility_note: e.compatibility_note,
        // Non-null by construction: the validator refuses a featured entry without
        // capabilities, and only featured entries reach the cloud.
        capabilities: e.capabilities ?? [],
        ...(e.docs ? { docs: e.docs } : {}),
      };
    }),
  }));
}

export function getByCategory(): { category: (typeof ECOSYSTEM_CATEGORIES)[number]; entries: EcosystemEntry[] }[] {
  const all = getEcosystem();
  return ECOSYSTEM_CATEGORIES.map((category) => ({
    category,
    entries: all.filter((e) => e.category === category.id),
  }));
}

/**
 * Reads an entry's monochrome SVG off disk so it can be inlined into the markup.
 * Inlining (rather than <img src>) is what makes the single-color treatment possible:
 * the file uses fill="currentColor", so the surrounding CSS controls it. Returns null
 * when no licensed asset has been supplied — callers fall back to a typographic mark.
 * See public/assets/ecosystem/README.md for why most entries have no file.
 */
export function readLogoSvg(entry: EcosystemEntry): string | null {
  if (!entry.logo_svg) return null;
  const file = path.join(process.cwd(), "public", entry.logo_svg.replace(/^\//, ""));
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf-8");
}
