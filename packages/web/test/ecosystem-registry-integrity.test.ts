import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ECOSYSTEM_STATUSES,
  buildCloudClusters,
  getEcosystem,
  readLogoSvg,
  resolvePlatformName,
  validateEntry,
} from "../lib/ecosystem";

/**
 * Master-registry integrity guards.
 *
 * The ecosystem registry is the single source of truth for which other companies AgenID
 * names in public. ecosystem.test.ts checks that the registry loads and that the
 * status/flag contract holds; ecosystem-cloud.test.ts checks that the homepage graphic
 * asserts nothing of its own. This file closes the three gaps neither covered:
 *
 *   1. EVIDENCE — a status that claims something happened must say what.
 *   2. ASSETS   — a logo path that points at nothing degrades silently to a
 *                 typographic mark, so a typo is invisible rather than loud.
 *   3. SOURCE   — a vendor name rendered anywhere in the ecosystem UI must come from
 *                 the registry. A name in a component is a name no registry entry
 *                 governs, and every honesty rule in this project attaches to entries.
 *
 * In its own file per the standing concurrent-session rule.
 */

const WEB = process.cwd();
const REGISTRY_DIR = path.join(WEB, "data", "ecosystem");
const COMPONENT_DIR = path.join(WEB, "components", "ecosystem");
const read = (f: string) => fs.readFileSync(f, "utf-8");

describe("ecosystem registry — evidence is required by the status, not by the reviewer", () => {
  const base = {
    id: "example",
    name: "Example",
    abbr: "Ex",
    category: "action",
    description: "test",
    website: "https://example.com",
    integration_type: "test",
    last_verified: "2026-01-01",
    compatibility_note: "This entry exists only to exercise the validator's evidence requirement.",
    featured: false,
  };
  const EVIDENCE = "AgenID executed the end-to-end flow on 2026-01-01; result published at docs/example.md";

  it("requires evidence on exactly the statuses that claim something happened", () => {
    // Read out of the table rather than restated, so a fifth status cannot arrive
    // without someone deciding what evidence means for it.
    const requiring = Object.entries(ECOSYSTEM_STATUSES)
      .filter(([, d]) => d.requiresEvidence)
      .map(([id]) => id)
      .sort();
    expect(requiring).toEqual(["official-partner", "verified-integration"]);
    // Anything claiming verification claims a fact about the world, so the two sets
    // must be the same set.
    for (const [id, d] of Object.entries(ECOSYSTEM_STATUSES)) {
      expect(d.requiresEvidence, `${id}`).toBe(d.verified);
    }
  });

  it("refuses a verified integration with no evidence", () => {
    expect(() =>
      validateEntry({ ...base, status: "verified-integration", verified: true, partner: false }, "x.json"),
    ).toThrow(/evidence/);
  });

  it("refuses a partnership with no evidence", () => {
    expect(() =>
      validateEntry({ ...base, status: "official-partner", verified: true, partner: true }, "x.json"),
    ).toThrow(/evidence/);
  });

  it("refuses evidence that is a token gesture rather than a citation", () => {
    expect(() =>
      validateEntry(
        { ...base, status: "official-partner", verified: true, partner: true, evidence: "yes" },
        "x.json",
      ),
    ).toThrow(/evidence/);
  });

  it("accepts a raised status once it cites what makes the claim true", () => {
    const e = validateEntry(
      { ...base, status: "verified-integration", verified: true, partner: false, evidence: EVIDENCE },
      "x.json",
    );
    expect(e.evidence).toBe(EVIDENCE);
  });

  it("refuses evidence on a status that claims nothing", () => {
    // Otherwise a compatible entry could carry a paragraph that reads like proof of an
    // integration while the status still says none exists — a claim in the record that
    // no status governs.
    expect(() =>
      validateEntry({ ...base, status: "compatible", verified: false, partner: false, evidence: EVIDENCE }, "x.json"),
    ).toThrow(/evidence/);
  });

  it("carries no evidence field today, because nothing is claimed above compatible", () => {
    expect(getEcosystem().filter((e) => e.evidence).map((e) => e.id)).toEqual([]);
  });
});

describe("ecosystem registry — a roadmap entry never reaches the graphic", () => {
  it("refuses a planned entry that is featured", () => {
    expect(() =>
      validateEntry(
        {
          id: "example",
          name: "Example",
          abbr: "Ex",
          category: "action",
          description: "test",
          website: "https://example.com",
          status: "planned",
          verified: false,
          partner: false,
          integration_type: "test",
          last_verified: "2026-01-01",
          compatibility_note: "This entry exists only to exercise the planned/featured exclusion.",
          capabilities: ["placeholder capability"],
          featured: true,
        },
        "x.json",
      ),
    ).toThrow(/planned/);
  });

  it("has no planned entry featured, and none in the cloud", () => {
    for (const e of getEcosystem()) {
      if (e.status === "planned") expect(e.featured, `${e.id}`).toBe(false);
    }
    for (const c of buildCloudClusters()) {
      for (const n of c.nodes) expect(n.status, `${n.id}`).not.toBe("planned");
    }
  });
});

describe("ecosystem registry — a logo path that points at nothing is a silent lie", () => {
  const withLogos = () => getEcosystem().filter((e) => e.logo_svg);

  it("resolves every declared logo_svg to a file that exists on disk", () => {
    // readLogoSvg() returns null for a missing file so the page degrades to the
    // typographic mark rather than rendering a hole. That is right at runtime and wrong
    // at review time: a typo looks identical to a deliberate absence. This is the only
    // place the difference is visible.
    for (const e of withLogos()) {
      const file = path.join(WEB, "public", e.logo_svg!.replace(/^\//, ""));
      expect(fs.existsSync(file), `${e.id}: ${e.logo_svg} does not exist`).toBe(true);
      expect(readLogoSvg(e), `${e.id}: declared a logo that could not be read`).toBeTruthy();
    }
  });

  it("keeps every shipped mark monochrome and sizeable", () => {
    // The asset contract from public/assets/ecosystem/README.md, enforced rather than
    // requested. A hard-coded fill renders as a coloured box in a deliberately neutral
    // row, and a fixed width/height defeats the size prop.
    for (const e of withLogos()) {
      // A missing file is the test above's failure, not this one's.
      const svg = readLogoSvg(e);
      if (!svg) continue;
      expect(svg, `${e.id}: fill must be currentColor`).not.toMatch(/fill="(?!currentColor|none)[^"]+"/);
      expect(svg, `${e.id}: stroke must be currentColor`).not.toMatch(/stroke="(?!currentColor|none)[^"]+"/);
      expect(svg, `${e.id}: strip width/height, keep the viewBox`).not.toMatch(/<svg[^>]*\s(width|height)=/);
      expect(svg, `${e.id}: needs a viewBox`).toMatch(/viewBox="/);
    }
  });

  it("ships no duplicate mark under two filenames", () => {
    const seen = new Map<string, string>();
    for (const e of withLogos()) {
      const svg = readLogoSvg(e);
      if (!svg) continue;
      const body = svg.replace(/\s+/g, "");
      const prior = seen.get(body);
      expect(prior, `${e.id} ships the same SVG as ${prior}`).toBeUndefined();
      seen.set(body, e.id);
    }
  });

  it("falls back to the typographic mark wherever no licensed asset exists", () => {
    // The default, and today the only, rendering. Stated as an assertion so that
    // "most entries have no file" stays a decision rather than an oversight.
    for (const e of getEcosystem()) {
      if (!e.logo_svg) expect(readLogoSvg(e), `${e.id}`).toBeNull();
      expect(e.abbr.length, `${e.id} must have a typographic fallback`).toBeGreaterThan(0);
    }
  });
});

/**
 * The audit vocabulary: brand names this project treats as third-party marks.
 *
 * Deliberately external to the registry — that is the whole point. The registry answers
 * "which platforms does AgenID govern claims for"; this list answers "which words are a
 * company's name". A guard built only from the registry can never notice a vendor that
 * was added to a page and not to the registry, which is the drift that matters.
 *
 * Adding a company here is free. Adding one to a page without adding it here or to the
 * registry is the thing that must not be quiet.
 */
const VENDOR_VOCABULARY = [
  "OpenAI", "Anthropic", "Claude", "Gemini", "Grok", "xAI", "Mistral", "Llama",
  "ElevenLabs", "Retell", "Vapi", "Bland", "Synthflow",
  "Cloudflare", "AWS", "Azure", "Google Cloud", "Vercel",
  "LangChain", "CrewAI", "AutoGen", "OpenClaw",
  "Okta", "Auth0", "Entra",
  "Twilio", "Stripe", "Coinbase", "PayPal", "Plaid", "Shopify",
];

/** Sources whose rendered text a reader reads as AgenID's ecosystem claim. */
const PUBLIC_SOURCES = [
  ...fs.readdirSync(COMPONENT_DIR).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(COMPONENT_DIR, f)),
  path.join(WEB, "app", "ecosystem", "page.tsx"),
  path.join(WEB, "app", "page.tsx"),
];

/** Comments may name a vendor to explain a rule; only rendered text is scanned. */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("ecosystem registry — every vendor named in public is governed by an entry", () => {
  it("scans a non-trivial number of public sources", () => {
    expect(PUBLIC_SOURCES.length).toBeGreaterThan(4);
    for (const f of PUBLIC_SOURCES) expect(fs.existsSync(f), f).toBe(true);
  });

  it("resolves every vendor name rendered on an ecosystem surface to a registry entry", () => {
    // The defect this catches, stated plainly: a company name typed into a component is
    // a company name no status, no relationship and no evidence rule applies to. Every
    // honesty guard in this project attaches to a registry entry, so a name outside the
    // registry is a name outside all of them.
    const unresolved: string[] = [];
    for (const file of PUBLIC_SOURCES) {
      const src = stripComments(read(file));
      for (const vendor of VENDOR_VOCABULARY) {
        const word = new RegExp(`(^|[^A-Za-z0-9])${vendor}([^A-Za-z0-9]|$)`);
        if (!word.test(src)) continue;
        if (!resolvePlatformName(vendor)) unresolved.push(`${path.basename(file)}: ${vendor}`);
      }
    }
    expect(unresolved, "named in public, absent from the registry").toEqual([]);
  });

  it("pins the identity-flow illustration's platforms to registry entries", () => {
    // IdentityFlow names three specific platforms to show one identifier surviving three
    // hops. They were typed into the component, not read from the registry, so a renamed
    // or removed entry would leave the illustration naming a platform the registry no
    // longer covers.
    const src = read(path.join(COMPONENT_DIR, "IdentityFlow.tsx"));
    const stages = [...src.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(stages.length, "IdentityFlow must still declare its stages").toBeGreaterThan(0);
    for (const name of stages) {
      expect(resolvePlatformName(name), `${name} is illustrated but not in the registry`).toBeTruthy();
    }
  });

  it("resolves a product name to the company entry that governs it", () => {
    expect(resolvePlatformName("Claude")?.id).toBe("anthropic");
    // Whole-word containment, so a display name needs no alias to resolve.
    expect(resolvePlatformName("Grok")?.id).toBe("xai-grok");
    expect(resolvePlatformName("Azure")?.id).toBe("azure");
    // And a vendor nobody has decided about resolves to nothing, rather than to
    // something adjacent.
    expect(resolvePlatformName("Coinbase")).toBeNull();
  });

  it("never lets one brand name resolve two ways", () => {
    const seen = new Map<string, string>();
    for (const e of getEcosystem()) {
      for (const n of [e.name, ...(e.aliases ?? [])]) {
        const key = n.toLowerCase();
        expect(seen.has(key), `"${n}" resolves to both ${seen.get(key)} and ${e.id}`).toBe(false);
        seen.set(key, e.id);
      }
    }
  });
});

describe("ecosystem registry — the public surfaces assert no relationship", () => {
  /**
   * Affirmative claims only. A prose guard that bans the word "partnership" rejects the
   * sentence "this is not an endorsement, a partnership, or a relationship of any kind"
   * — which is the copy that makes the page honest. Point the guard at the overclaim,
   * never at the vocabulary.
   */
  const AFFIRMATIVE = [
    /\bour partners\b/i,
    /\bin partnership with\b/i,
    /\bofficial partners?\b(?!["'\s]*[:=])/i,
    /\bintegrates? with\b/i,
    /\bpowered by\b/i,
    /(?<!\b(?:not|never|no one is|nobody is) )\btrusted by\b/i,
    /\bendorsed by\b/i,
    /\bcertified\b/i,
  ];

  for (const file of PUBLIC_SOURCES) {
    it(`asserts no relationship in ${path.basename(path.dirname(file))}/${path.basename(file)}`, () => {
      const src = stripComments(read(file));
      for (const re of AFFIRMATIVE) {
        const hit = src.split("\n").find((l) => re.test(l));
        expect(hit, `${file}: ${re.source}`).toBeUndefined();
      }
    });
  }
});
