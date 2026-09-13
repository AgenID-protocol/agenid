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
 * HONESTY CONTRACT (enforced by validate() and by test/ecosystem.test.ts):
 *   - "compatible"          — AgenID identity can be carried through this platform
 *                             today using its existing, documented API surface. It does
 *                             NOT mean AgenID has run it, that the platform ships any
 *                             AgenID code, or that any relationship exists.
 *   - "verified-integration"— AgenID has itself executed the integration end to end and
 *                             published the result. `verified` MUST be true.
 *   - "official-partner"    — a partnership is on record. `verified` and `partner` MUST
 *                             both be true.
 * As of this writing every entry is "compatible" and nothing is verified or a partner.
 * Raising an entry's status is a factual claim: it requires evidence in the same commit.
 */

export const ECOSYSTEM_CATEGORIES = [
  { id: "voice", label: "Voice", blurb: "Voice agent platforms where the identity rides the call." },
  { id: "models", label: "Models", blurb: "Model providers. Identity sits above the model, never inside it." },
  { id: "infrastructure", label: "Infrastructure", blurb: "Where key documents, resolvers, and runtimes are hosted." },
  { id: "frameworks", label: "Frameworks", blurb: "Orchestration layers that pass identity between agents and tools." },
  { id: "enterprise", label: "Enterprise Identity", blurb: "IAM systems AgenID composes with rather than replaces." },
] as const;

export type EcosystemCategory = (typeof ECOSYSTEM_CATEGORIES)[number]["id"];

export const ECOSYSTEM_STATUSES = {
  compatible: {
    label: "Compatible",
    definition:
      "Identity can be carried through this platform today using its existing, documented API surface. No AgenID-specific code is required from the platform, and none is claimed to exist.",
  },
  "verified-integration": {
    label: "Verified Integration",
    definition:
      "AgenID has executed the integration end to end and published the result. Not asserted for any entry yet.",
  },
  "official-partner": {
    label: "Official Partner",
    definition:
      "A partnership is on record with the platform. Not asserted for any entry yet.",
  },
} as const;

export type EcosystemStatus = keyof typeof ECOSYSTEM_STATUSES;

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
  "verified", "partner", "last_verified", "compatibility_note", "featured", "logo_svg", "docs",
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

  // The honesty contract, enforced mechanically rather than by review discipline.
  if (verified !== (status !== "compatible")) {
    fail(file, `"verified" must be ${status !== "compatible"} for status "${status}"`);
  }
  if (partner !== (status === "official-partner")) {
    fail(file, `"partner" must be ${status === "official-partner"} for status "${status}"`);
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
