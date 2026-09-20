import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getEcosystem } from "../lib/ecosystem";
import {
  getBrandPermissions,
  markPolicyFor,
  permissionForRegistryId,
  validatePermission,
  type BrandPermission,
} from "../lib/brand-permissions";

/**
 * Third-party marks: the admission guard.
 *
 * ecosystem-registry-integrity.test.ts already checks the HYGIENE of an installed mark —
 * that its file exists, that its fills are currentColor, that it has a viewBox. Those
 * are the right checks for an asset that is allowed to be here. This file checks
 * something upstream of that, and the ordering matters: whether the asset is allowed to
 * be here at all.
 *
 * Without this, the two documents a future author would follow — the asset README and
 * that hygiene test — read as an invitation. Drop in the SVG, strip its fills, make the
 * test green. Every one of those steps is a trademark violation for every provider this
 * registry currently names, and all of them would pass CI.
 *
 * The audit is docs/brand-compliance-audit.md. Its result: sixteen providers reviewed,
 * zero permit it.
 *
 * In its own file per the standing concurrent-session rule.
 */

const WEB = process.cwd();
const ASSET_DIR = path.join(WEB, "public", "assets", "ecosystem");

/** Aggregators that redistribute marks they have no right to license. The brief's own
 *  source rule, enforced: an asset's provenance must trace to the owner, not to a site
 *  that scraped it. */
const NOT_A_SOURCE = [
  "brandfetch", "worldvectorlogo", "seeklogo", "svgporn", "vectorlogo",
  "logotyp", "logos-download", "freebiesupply", "iconduck", "simpleicons",
];

describe("brand permissions — a downloadable asset is not a grant", () => {
  it("loads and validates every record", () => {
    const all = getBrandPermissions();
    expect(all.length).toBeGreaterThanOrEqual(16);
  });

  it("points every registry_id at a real ecosystem entry", () => {
    const ids = new Set(getEcosystem().map((e) => e.id));
    for (const p of getBrandPermissions()) {
      if (p.registry_id === null) continue;
      expect(ids.has(p.registry_id), `${p.id}: registry_id "${p.registry_id}" matches no entry`).toBe(true);
    }
  });

  it("sources every controlling quote from the owner, never from a logo aggregator", () => {
    for (const p of getBrandPermissions()) {
      for (const url of [p.official_source, p.quote_source]) {
        const host = new URL(url).hostname.toLowerCase();
        for (const bad of NOT_A_SOURCE) {
          expect(host.includes(bad), `${p.id}: ${host} is an aggregator, not the owner`).toBe(false);
        }
      }
    }
  });
});

describe("brand permissions — the policy is derived, and silence never becomes permission", () => {
  const base: BrandPermission = {
    id: "example",
    provider: "Example",
    registry_id: null,
    official_source: "https://example.com/brand",
    reviewed: "2026-01-01",
    svg: "public",
    logo_use: "requires-permission",
    recolor: "prohibited",
    controlling_quote: "You may not use our logo without our express written permission.",
    quote_source: "https://example.com/brand",
  };
  const LICENSE = {
    granted_by: "Example Inc, brand team",
    reference: "written grant, thread 2026-01-01",
    granted_on: "2026-01-01",
    permits: "display of the monochrome wordmark at small size on a compatibility page",
  };

  it("never reaches 'licensed' without BOTH an affirmative position and a recorded grant", () => {
    // Four combinations, only one of which may ship a mark. This is the whole rule.
    expect(markPolicyFor({ ...base })).toBe("typographic-only");
    expect(markPolicyFor({ ...base, license: LICENSE })).toBe("typographic-only");
    expect(markPolicyFor({ ...base, logo_use: "permitted-with-conditions" })).toBe("typographic-only");
    expect(markPolicyFor({ ...base, logo_use: "permitted-with-conditions", license: LICENSE })).toBe("licensed");
  });

  it("treats an absent published policy as no permission, not as freedom", () => {
    expect(markPolicyFor({ ...base, logo_use: "no-published-policy", recolor: "silent" })).toBe("typographic-only");
    expect(markPolicyFor({ ...base, logo_use: "no-published-policy", license: LICENSE })).toBe("typographic-only");
  });

  it("refuses a record that records a grant while still claiming permission is required", () => {
    // A contradiction someone must resolve deliberately, rather than a field that
    // quietly wins over the position beside it.
    expect(() =>
      validatePermission({ ...base, license: LICENSE }, "example"),
    ).toThrow(/logo_use is still "requires-permission"/);
  });

  it("refuses a licence whose grant is not actually named", () => {
    for (const missing of ["granted_by", "reference", "granted_on", "permits"]) {
      const l: Record<string, string> = { ...LICENSE };
      delete l[missing];
      expect(() =>
        validatePermission({ ...base, logo_use: "permitted-with-conditions", license: l }, "example"),
        `license without ${missing} was accepted`,
      ).toThrow();
    }
  });

  it("refuses a record whose controlling quote is not substantive", () => {
    expect(() => validatePermission({ ...base, controlling_quote: "no" }, "example")).toThrow(/controlling_quote/);
  });
});

describe("brand permissions — no mark ships without a grant on record", () => {
  it("records the audit's actual finding: not one provider currently permits it", () => {
    // Pinned deliberately. If a real licence is ever negotiated, this assertion is the
    // thing that forces the change to be conscious rather than incidental.
    const licensed = getBrandPermissions().filter((p) => markPolicyFor(p) === "licensed");
    expect(licensed.map((p) => p.id)).toEqual([]);
  });

  it("allows logo_svg only on an entry whose provider has granted a licence", () => {
    // THE guard. Everything else in this file supports it.
    for (const e of getEcosystem()) {
      if (!e.logo_svg) continue;
      const p = permissionForRegistryId(e.id);
      expect(p, `${e.id} ships a mark with no brand-permission record at all`).not.toBeNull();
      expect(
        markPolicyFor(p as BrandPermission),
        `${e.id} ships a mark but its provider's policy is "${p?.logo_use}" — see docs/brand-compliance-audit.md`,
      ).toBe("licensed");
    }
  });

  it("holds no third-party artwork on disk", () => {
    // Blast radius: catches an asset dropped into the tree before anyone wires it to an
    // entry. A file committed here is redistribution whether or not a page renders it,
    // and the entry-level guard above would never see it.
    if (!fs.existsSync(ASSET_DIR)) return;
    const stray: string[] = [];
    const walk = (dir: string) => {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (/\.(svg|png|jpg|jpeg|webp|ai|eps|pdf)$/i.test(name)) stray.push(path.relative(ASSET_DIR, full));
      }
    };
    walk(ASSET_DIR);
    expect(stray, `unlicensed artwork in public/assets/ecosystem: ${stray.join(", ")}`).toEqual([]);
  });

  it("keeps the asset README from teaching the violation it used to teach", () => {
    // The README's install procedure said: drop in the SVG, strip its fills, set
    // currentColor. That procedure IS the prohibited modification, and it was the only
    // instruction a future author had. Documentation that walks someone into a
    // violation is a defect in the documentation.
    const readme = fs.readFileSync(path.join(ASSET_DIR, "README.md"), "utf-8");
    expect(readme).toMatch(/brand-permissions/);
    expect(readme).toMatch(/docs\/brand-compliance-audit\.md/);
  });
});
