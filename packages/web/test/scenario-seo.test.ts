import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CATALOGUE, SCENARIO_SEO, findEntry, seoFor } from "../lib/scenarios";

/**
 * Guards for the search-landing copy on /how-it-works/<slug>.
 *
 * New file rather than an addition to scenarios.test.ts, per the concurrent-session rule.
 * seo.ts lives in lib/scenarios/, so every guard in scenarios.test.ts (no L5, no invented
 * identifier, no key material, no hex) already scans it. These add what is specific to
 * landing pages: every page has one, the metadata fits what search results display,
 * the prose is substantial, the copy does not overclaim, and the landing copy cannot
 * quietly drop the statement of what is issuable today.
 */

const WEB = process.cwd();
const DETAIL = fs.readFileSync(path.join(WEB, "app", "how-it-works", "[slug]", "page.tsx"), "utf-8");

const BANNED =
  /\b(production[- ]ready|generally available|enterprise[- ]grade|bank[- ]grade|SOC ?2|ISO ?27001|HIPAA|trusted by|fully (automated|integrated|supported|secure|compliant)|guarantee[sd]?|ensures? (safety|security|trust)|proves? (safety|legitimacy)|100% (private|secure))\b/i;

function allText(slug: string): string {
  const s = SCENARIO_SEO[slug]!;
  return [s.title, s.description, s.h1, ...s.lead, ...s.sections.flatMap((x) => [x.heading, ...x.body]), ...s.faqs.flatMap((f) => [f.q, f.a])].join("\n");
}

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe("scenario landing pages — coverage", () => {
  it("every catalogue entry has landing content, and nothing else does", () => {
    expect(Object.keys(SCENARIO_SEO).sort()).toEqual(CATALOGUE.map((e) => e.slug).sort());
    for (const e of CATALOGUE) expect(seoFor(e.slug), e.slug).toBeTruthy();
  });

  it("the detail page renders the landing copy, the FAQ and structured data", () => {
    expect(DETAIL).toMatch(/seoFor\(slug\)/);
    expect(DETAIL).toMatch(/application\/ld\+json/);
    expect(DETAIL).toMatch(/"FAQPage"/);
    expect(DETAIL).toMatch(/"BreadcrumbList"/);
    expect(DETAIL).toMatch(/seo\.faqs\.map/);
  });
});

describe("canonical origin", () => {
  it("metadataBase uses the same origin as the sitemap, not the redirecting apex", () => {
    const layout = fs.readFileSync(path.join(WEB, "app", "layout.tsx"), "utf-8");
    expect(layout).toMatch(/metadataBase:\s*new URL\(SITE_URL\)/);
    expect(layout).not.toMatch(/"https:\/\/agenid\.com"/);
  });
});

describe("scenario landing pages — metadata fits search results", () => {
  for (const [slug, s] of Object.entries(SCENARIO_SEO)) {
    it(`${slug}: title and description lengths`, () => {
      // The layout appends " · AgenID" (9 chars); keep the whole title under ~60.
      expect(s.title.length, s.title).toBeLessThanOrEqual(52);
      expect(s.title.length).toBeGreaterThanOrEqual(25);
      expect(s.description.length, s.description).toBeGreaterThanOrEqual(120);
      expect(s.description.length, s.description).toBeLessThanOrEqual(165);
    });
  }

  it("titles, descriptions and H1s are unique across pages", () => {
    const all = Object.values(SCENARIO_SEO);
    for (const k of ["title", "description", "h1"] as const) {
      expect(new Set(all.map((s) => s[k])).size, k).toBe(all.length);
    }
  });
});

describe("scenario landing pages — substance and honesty", () => {
  for (const [slug, s] of Object.entries(SCENARIO_SEO)) {
    it(`${slug}: substantial server-rendered copy`, () => {
      expect(s.lead.length).toBeGreaterThanOrEqual(2);
      expect(s.sections.length).toBeGreaterThanOrEqual(3);
      expect(s.faqs.length).toBeGreaterThanOrEqual(4);
      expect(s.keywords.length).toBeGreaterThanOrEqual(3);
      expect(words(allText(slug)), `${slug} word count`).toBeGreaterThanOrEqual(450);
    });

    it(`${slug}: no overclaim vocabulary`, () => {
      expect(allText(slug)).not.toMatch(BANNED);
    });

    it(`${slug}: states what is issuable today, in the landing copy itself`, () => {
      // The page also renders ISSUANCE_CEILING; this keeps the crawlable prose honest
      // even if someone later moves the disclosure panel.
      expect(allText(slug)).toMatch(/L1_REGISTERED/);
      expect(allText(slug)).toMatch(/root authority key/i);
    });

    it(`${slug}: separates identity from permission`, () => {
      expect(allText(slug)).toMatch(/allowed to do/i);
    });

    it(`${slug}: related links resolve and never point at itself`, () => {
      expect(s.related.length).toBeGreaterThanOrEqual(2);
      for (const r of s.related) {
        expect(findEntry(r), `${slug} -> ${r}`).toBeTruthy();
        expect(r).not.toBe(slug);
      }
    });
  }
});
