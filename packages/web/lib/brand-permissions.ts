import fs from "node:fs";
import path from "node:path";

/**
 * WHY THIS FILE EXISTS
 *
 * The ecosystem registry names 27 other companies. `EcosystemEntry.logo_svg` lets an
 * entry ship that company's mark, and `public/assets/ecosystem/README.md` used to
 * describe how: drop in the SVG, strip its fills, set `fill="currentColor"`.
 *
 * That procedure produces a trademark violation for every provider AgenID currently
 * names. Not most — every one. A brand-compliance audit of all sixteen candidate
 * providers (docs/brand-compliance-audit.md, Sept 20 2026, every quote pulled from the
 * company's own domain) found that not one publishes terms permitting an unaffiliated
 * company to display its logo in a marketing ecosystem graphic, and that recolouring a
 * mark to a neutral grey is specifically prohibited by the published guidelines of
 * nine of them. Anthropic's is the most quotable: "No alterations of our trademarks
 * (changes to color, font, proportion, or otherwise) are permitted."
 *
 * So the typographic default was never merely a cautious design preference. It is the
 * only compliant rendering available, and this file is what makes that mechanical.
 *
 * THE RULE: an entry may carry `logo_svg` only if this registry records an actual
 * written grant for that provider. No grant, no mark — enforced by
 * test/brand-permissions.test.ts, which fails the build rather than trusting a future
 * author to re-read a README. This project's own history is a list of rules that lived
 * only in prose and were re-broken by the next session.
 *
 * `markPolicyFor()` is DERIVED and never stored, for the same reason `relationshipOf()`
 * is: a stored policy field is a second source of truth for something the record
 * already decides, and it is exactly the field a future session would flip by hand.
 */

export const LOGO_USE_POSITIONS = {
  "requires-permission": {
    label: "Requires written permission",
    meaning:
      "The provider's published guidelines state that third-party use of its logo requires express written permission, a licence, or membership of a partner programme. AgenID holds none of these.",
  },
  "no-published-policy": {
    label: "No published policy",
    meaning:
      "The provider publishes no brand or trademark guidelines governing third-party logo use. Silence is not a grant: nothing is permitted and nothing is prohibited, so the use rests on no published authority at all.",
  },
  "permitted-with-conditions": {
    label: "Permitted, conditionally",
    meaning:
      "The provider's published guidelines affirmatively permit this use for a party in AgenID's position. Reaching this position requires a `license` record naming the grant — it is never inferred from silence.",
  },
} as const;

export type LogoUsePosition = keyof typeof LOGO_USE_POSITIONS;

export const RECOLOR_POSITIONS = {
  prohibited: "Published guidelines expressly forbid altering the mark's colour.",
  silent: "Published guidelines do not address recolouring. Not a permission.",
  permitted: "Published guidelines expressly allow a one-colour or monochrome rendering in the intended tone.",
} as const;

export type RecolorPosition = keyof typeof RECOLOR_POSITIONS;

/** What an installed mark would be rendered as. Derived, never stored. */
export const MARK_POLICIES = {
  "typographic-only": "No third-party artwork. The platform renders as its `abbr` tile in the AgenID interface type.",
  licensed: "A written grant is on record and its terms are recorded in `license`.",
} as const;

export type MarkPolicy = keyof typeof MARK_POLICIES;

export type BrandLicense = {
  /** Who granted it, by name. */
  granted_by: string;
  /** Where the grant lives — an email thread, an executed agreement, a programme id. */
  reference: string;
  /** ISO date the grant was given. */
  granted_on: string;
  /** The treatment the grant actually permits. A grant to display is not a grant to recolour. */
  permits: string;
};

export type BrandPermission = {
  /** Stable key. Matches the ecosystem registry id where one exists. */
  id: string;
  /** Display name as the provider writes it. */
  provider: string;
  /** The ecosystem registry entry this governs, or null if AgenID does not list them. */
  registry_id: string | null;
  /** The provider's own brand/trademark page. Must be on a domain the provider controls. */
  official_source: string;
  /** Date this record was checked against that page. */
  reviewed: string;
  /** Whether an official SVG is obtainable, and how. */
  svg: "public" | "gated" | "none" | "unverified";
  logo_use: LogoUsePosition;
  recolor: RecolorPosition;
  /** The single sentence that decides this record, quoted exactly. */
  controlling_quote: string;
  /** The URL that sentence came from. */
  quote_source: string;
  /** Present only where a real written grant exists. Its absence is why a mark is not shipped. */
  license?: BrandLicense;
  /** Anything a future reader needs that the fields above do not carry. */
  note?: string;
};

const DATA_FILE = path.join(process.cwd(), "data", "brand-permissions.json");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(id: string, msg: string): never {
  throw new Error(`brand permissions: ${id}: ${msg}`);
}

/**
 * The derived policy.
 *
 * A mark may be shipped only from an affirmative published permission AND a recorded
 * grant. Both, not either. A provider whose guidelines happen to permit third-party
 * display still gets a typographic mark until someone records who granted it and what
 * the grant actually covers — because "their guidelines seemed to allow it" is an
 * inference, and an inference is what this project has been burned by every time.
 */
export function markPolicyFor(p: BrandPermission): MarkPolicy {
  if (p.logo_use !== "permitted-with-conditions") return "typographic-only";
  if (!p.license) return "typographic-only";
  return "licensed";
}

/** Strict, dependency-free validation, matching lib/ecosystem.ts's approach. */
export function validatePermission(raw: unknown, id = "<inline>"): BrandPermission {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) fail(id, "must be an object");
  const o = raw as Record<string, unknown>;

  const ALLOWED = new Set([
    "id", "provider", "registry_id", "official_source", "reviewed", "svg",
    "logo_use", "recolor", "controlling_quote", "quote_source", "license", "note",
  ]);
  for (const k of Object.keys(o)) if (!ALLOWED.has(k)) fail(id, `unknown key "${k}"`);

  const str = (k: string, min = 1): string => {
    const v = o[k];
    if (typeof v !== "string" || v.trim().length < min) fail(id, `"${k}" must be a string of at least ${min} chars`);
    return v as string;
  };

  const svg = str("svg");
  if (!["public", "gated", "none", "unverified"].includes(svg)) fail(id, `"svg" is not a known value: ${svg}`);

  const logo_use = str("logo_use");
  if (!(logo_use in LOGO_USE_POSITIONS)) fail(id, `"logo_use" is not a known position: ${logo_use}`);

  const recolor = str("recolor");
  if (!(recolor in RECOLOR_POSITIONS)) fail(id, `"recolor" is not a known position: ${recolor}`);

  const reviewed = str("reviewed");
  if (!DATE_RE.test(reviewed)) fail(id, `"reviewed" must be YYYY-MM-DD`);

  // The quote is the evidence. A record without a substantive one is an assertion, and
  // an assertion about someone else's legal terms is the thing this file exists to stop.
  const controlling_quote = str("controlling_quote", 30);
  const quote_source = str("quote_source");
  const official_source = str("official_source");
  for (const [k, v] of [["official_source", official_source], ["quote_source", quote_source]] as const) {
    if (!v.startsWith("https://")) fail(id, `"${k}" must be an https URL`);
  }

  const registry_id = o.registry_id === null ? null : str("registry_id");

  const entry: BrandPermission = {
    id: str("id"),
    provider: str("provider"),
    registry_id,
    official_source,
    reviewed,
    svg: svg as BrandPermission["svg"],
    logo_use: logo_use as LogoUsePosition,
    recolor: recolor as RecolorPosition,
    controlling_quote,
    quote_source,
  };

  if (o.license !== undefined) {
    const l = o.license;
    if (typeof l !== "object" || l === null || Array.isArray(l)) fail(id, `"license" must be an object`);
    const lo = l as Record<string, unknown>;
    for (const k of Object.keys(lo)) {
      if (!["granted_by", "reference", "granted_on", "permits"].includes(k)) fail(id, `license: unknown key "${k}"`);
    }
    for (const k of ["granted_by", "reference", "granted_on", "permits"]) {
      if (typeof lo[k] !== "string" || (lo[k] as string).trim().length < 3) {
        fail(id, `license: "${k}" is required and must be substantive`);
      }
    }
    if (!DATE_RE.test(lo.granted_on as string)) fail(id, `license: "granted_on" must be YYYY-MM-DD`);
    // A licence recorded against a provider whose own guidelines we read as
    // permission-gated is a contradiction someone must resolve deliberately.
    if (logo_use === "requires-permission") {
      fail(id, `a license is recorded but logo_use is still "requires-permission" — raise the position or remove the license`);
    }
    entry.license = l as BrandLicense;
  }

  if (o.note !== undefined) entry.note = str("note");
  return entry;
}

let cache: BrandPermission[] | null = null;

export function getBrandPermissions(): BrandPermission[] {
  if (cache) return cache;
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  if (!Array.isArray(raw)) throw new Error("brand permissions: data file must be an array");
  const out = raw.map((r) => validatePermission(r, (r as { id?: string })?.id ?? "<unknown>"));

  const seen = new Set<string>();
  for (const p of out) {
    if (seen.has(p.id)) throw new Error(`brand permissions: duplicate id "${p.id}"`);
    seen.add(p.id);
  }
  cache = out;
  return out;
}

export function permissionForRegistryId(registryId: string): BrandPermission | null {
  return getBrandPermissions().find((p) => p.registry_id === registryId) ?? null;
}
