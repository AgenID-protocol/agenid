import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  BLOG,
  COMPARISONS,
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  GUIDES,
  REPORT,
  USE_CASES,
  VOICE_HUB,
  WHY_HUB,
  contentRoutes,
  type ContentPage,
} from "../lib/content";
import { linksIn, plain } from "../lib/content/markup";
import { DEPLOYMENT_CEILING } from "../lib/content/disclosures";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX } from "../lib/seo";
import { EXAMPLE_AGENID, SCENARIO_SEO, scenarioSlugs } from "../lib/scenarios";
import { getPartnerSlugs } from "../lib/partners";
import sitemap from "../app/sitemap";

/**
 * Guards for the long-form content library (glossary, guides, comparisons, hubs, blog,
 * research report). New file, per the concurrent-session rule.
 *
 * These pages explain the whole protocol — including levels nobody can obtain today and
 * other organizations' products — so every honesty rule the scenario library carries
 * applies here too, plus two that are specific to this surface: a claim about a third
 * party needs a source, and an internal link must resolve.
 */

const WEB = process.cwd();
const SUFFIX = " · AgenID";

type Named = { kind: string; page: ContentPage };
const ALL: Named[] = [
  ...GLOSSARY.map((page) => ({ kind: "glossary", page })),
  ...GUIDES.map((page) => ({ kind: "guide", page })),
  ...COMPARISONS.map((page) => ({ kind: "compare", page })),
  ...USE_CASES.map((page) => ({ kind: "use-case", page })),
  ...BLOG.map((page) => ({ kind: "blog", page })),
  { kind: "report", page: REPORT },
  { kind: "hub", page: WHY_HUB },
];

/** Every reader-visible string on a page, markup included. */
function strings(p: ContentPage): string[] {
  const extra: string[] = [];
  const any = p as unknown as Record<string, unknown>;
  for (const k of ["definition", "subjectSummary", "complementary"]) if (typeof any[k] === "string") extra.push(any[k] as string);
  const matrix = any.matrix as { rows: string[][] } | undefined;
  if (matrix) for (const r of matrix.rows) extra.push(...r);
  return [
    p.title,
    p.description,
    p.h1,
    ...p.lead,
    ...extra,
    ...p.sections.flatMap((s) => [s.heading, ...s.body, ...(s.bullets ?? []), ...(s.table ? [...s.table.columns, ...s.table.rows.flat()] : [])]),
    ...p.faqs.flatMap((f) => [f.q, f.a]),
  ];
}
const text = (p: ContentPage) => strings(p).join("\n");
const words = (p: ContentPage) => plain(text(p)).split(/\s+/).filter(Boolean).length;

const BANNED =
  /\b(production[- ]ready|generally available|enterprise[- ]grade|bank[- ]grade|SOC ?2|ISO ?27001|HIPAA|trusted by|fully (automated|integrated|supported|secure|compliant)|guarantee[sd]?|ensures? (safety|security|trust)|proves? (safety|legitimacy)|100% (private|secure)|issuable in v1\.1\.1)\b/i;
const DEAD_HOSTS = /agenid\.org|agenid\.ai|api\.agenid\.com|github\.com\/AgenID-protocol\/agenid\b/i;

const STATIC_ROUTES = [
  "/", "/issue", "/verify", "/verify/domain", "/trust", "/ecosystem", "/why-agent-identity", "/how-it-works",
  "/docs", "/docs/onboarding", "/docs/partners", "/badge",
];
const KNOWN = new Set<string>([
  ...STATIC_ROUTES,
  ...contentRoutes(),
  ...scenarioSlugs().map((s) => `/how-it-works/${s}`),
  ...getPartnerSlugs().map((s) => `/docs/partners/${s}`),
]);

describe("content library — coverage", () => {
  it("has the planned surface", () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30);
    expect(GUIDES.map((g) => g.slug).sort()).toEqual(
      ["agent-to-agent-authentication", "ai-agent-registry", "how-to-verify-an-ai-agent", "know-your-agent-kya"].sort(),
    );
    expect(COMPARISONS.length).toBe(6);
    expect(BLOG.length).toBeGreaterThanOrEqual(8);
    expect(USE_CASES.map((u) => u.slug)).toContain("voice-agents");
    expect(VOICE_HUB.slug).toBe("voice-agents");
  });

  it("routes are unique and each has a page on disk", () => {
    const routes = contentRoutes();
    expect(new Set(routes).size).toBe(routes.length);
    for (const dir of ["glossary/[term]", "learn/[slug]", "compare/[slug]", "use-cases/[slug]", "blog/[slug]", "state-of-agent-identity", "glossary", "learn", "compare", "use-cases", "blog", "badge", "why-agent-identity"]) {
      expect(fs.existsSync(path.join(WEB, "app", dir, "page.tsx")), dir).toBe(true);
    }
  });

  it("every content route, every scenario and /badge is in the sitemap", () => {
    const urls = new Set(sitemap().map((e) => new URL(e.url).pathname.replace(/\/$/, "") || "/"));
    for (const r of [...contentRoutes(), "/badge", ...scenarioSlugs().map((s) => `/how-it-works/${s}`)]) {
      expect(urls.has(r), r).toBe(true);
    }
  });

  it("glossary terms carry a definition and a known category", () => {
    for (const t of GLOSSARY) {
      expect(plain(t.definition).length, t.slug).toBeGreaterThan(40);
      expect(GLOSSARY_CATEGORIES as readonly string[], t.slug).toContain(t.category);
    }
  });
});

describe("content library — metadata fits search results", () => {
  for (const { kind, page } of ALL) {
    it(`${kind}/${page.slug}: title and description`, () => {
      expect(`${page.title}${SUFFIX}`.length, page.title).toBeLessThanOrEqual(TITLE_MAX);
      expect(page.title.length).toBeGreaterThanOrEqual(20);
      expect(page.description.length, page.description).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(page.description.length, page.description).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(page.description, "descriptions are plain text").not.toMatch(/\]\(|`|\*\*|<[a-z]/i);
      expect(page.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }

  it("titles and H1s are unique across content and scenario pages", () => {
    const titles = [...ALL.map((a) => a.page.title), ...Object.values(SCENARIO_SEO).map((s) => s.title)];
    const h1s = [...ALL.map((a) => a.page.h1), ...Object.values(SCENARIO_SEO).map((s) => s.h1)];
    expect(new Set(titles).size, "titles").toBe(titles.length);
    expect(new Set(h1s).size, "h1s").toBe(h1s.length);
  });
});

describe("content library — substance", () => {
  const FLOOR: Record<string, number> = { glossary: 300, guide: 1800, compare: 1000, "use-case": 1200, blog: 500, report: 2500, hub: 1200 };
  for (const { kind, page } of ALL) {
    it(`${kind}/${page.slug}: substantial, structured copy`, () => {
      expect(words(page), `${page.slug} words`).toBeGreaterThanOrEqual(FLOOR[kind]!);
      expect(page.lead.length).toBeGreaterThanOrEqual(1);
      expect(page.sections.length).toBeGreaterThanOrEqual(3);
      expect(page.faqs.length).toBeGreaterThanOrEqual(3);
      expect(page.related.length).toBeGreaterThanOrEqual(3);
    });
  }
});

describe("content library — honesty", () => {
  for (const { kind, page } of ALL) {
    const t = text(page);
    it(`${kind}/${page.slug}: no overclaim vocabulary, dead host or private repository`, () => {
      expect(plain(t)).not.toMatch(BANNED);
      expect(t).not.toMatch(DEAD_HOSTS);
      expect(t, "raw markup is not part of the inline grammar").not.toMatch(/\*\*/);
    });

    it(`${kind}/${page.slug}: never names L5 as a level, never shows an unissuable level as a result`, () => {
      expect(t).not.toMatch(/L5_[A-Z_]+/);
      expect(t).not.toMatch(/"level":\s*"L[2-5]_/);
    });

    it(`${kind}/${page.slug}: names a level above L1 only alongside the ceiling`, () => {
      if (/\bL[234](_[A-Z_]+)?\b/.test(t)) {
        expect(t).toMatch(/root authority key/i);
        expect(t).toMatch(/L1_REGISTERED/);
      }
    });

    it(`${kind}/${page.slug}: separates identity from permission`, () => {
      expect(t).toMatch(/allowed to do|permission/i);
    });

    it(`${kind}/${page.slug}: prints no identifier but the spec's own example`, () => {
      for (const m of t.matchAll(/agenid:[0-9A-HJKMNP-TV-Z]{26}\b/g)) expect(m[0]).toBe(EXAMPLE_AGENID);
    });

    it(`${kind}/${page.slug}: never presents an @agenid package as installable`, () => {
      expect(t).not.toMatch(/npm\s+install\s+@agenid\/|npx[^\n]{0,80}@agenid\//);
    });

    it(`${kind}/${page.slug}: every internal link resolves, every external one is https`, () => {
      const targets = [...strings(page).flatMap(linksIn), ...page.related];
      for (const href of targets) {
        if (/^https?:\/\//.test(href)) {
          expect(href, "external links are https").toMatch(/^https:\/\//);
          continue;
        }
        expect(KNOWN.has(href.split("#")[0]!), `${page.slug} → ${href}`).toBe(true);
      }
      for (const r of page.related) expect(r).not.toBe(`/${page.slug}`);
    });

    it(`${kind}/${page.slug}: an integration pattern is never presented as a package`, () => {
      if (/\/docs\/partners\/[a-z]/.test(t)) expect(t).toMatch(/not a (shipped )?package/i);
    });
  }
});

describe("content library — claims about third parties are sourced", () => {
  for (const c of [...COMPARISONS, REPORT]) {
    it(`${c.slug}: at least three https sources, and every cited URL is listed`, () => {
      const sources = c.sources ?? [];
      expect(sources.length).toBeGreaterThanOrEqual(3);
      for (const s of sources) expect(s.url).toMatch(/^https:\/\//);
      const listed = new Set(sources.map((s) => s.url));
      for (const href of strings(c).flatMap(linksIn).filter((h) => /^https:\/\//.test(h))) {
        expect(listed.has(href), `${c.slug} cites ${href} without listing it`).toBe(true);
      }
    });
  }

  it("comparisons describe the other approach in text only, and state where they fit together", () => {
    for (const c of COMPARISONS) {
      expect(c.matrix.columns[1]).toBe("AgenID");
      expect(c.matrix.rows.length).toBeGreaterThanOrEqual(5);
      expect(c.complementary.length).toBeGreaterThan(40);
      expect(text(c)).not.toMatch(/\bcompetitor/i);
    }
    const page = fs.readFileSync(path.join(WEB, "app", "compare", "[slug]", "page.tsx"), "utf-8");
    expect(page, "no third-party mark on a comparison page").not.toMatch(/<img|PlatformMark|logo_svg/);
  });
});

describe("content renderer", () => {
  const src = fs.readFileSync(path.join(WEB, "components", "content", "ContentArticle.tsx"), "utf-8");

  it("renders the deployment ceiling and the permission boundary on every page, unconditionally", () => {
    expect(src).toMatch(/\{DEPLOYMENT_CEILING\}/);
    expect(src).toMatch(/\{IDENTITY_IS_NOT_PERMISSION\}/);
    const at = src.indexOf("{DEPLOYMENT_CEILING}");
    const before = src.slice(Math.max(0, at - 400), at);
    expect(before, "the ceiling must not sit behind a condition").not.toMatch(/&&\s*\(\s*<div[^>]*>\s*<div[^>]*>What agenid/);
    expect(DEPLOYMENT_CEILING).toMatch(/root authority key/);
    expect(DEPLOYMENT_CEILING).toMatch(/L1_REGISTERED/);
  });

  it("interprets no HTML from content", () => {
    for (const f of ["components/content/ContentArticle.tsx", "components/content/Inline.tsx"]) {
      const s = fs.readFileSync(path.join(WEB, f), "utf-8");
      const unsafe = [...s.matchAll(/dangerouslySetInnerHTML=\{\{\s*__html:\s*([^}]+)\}\}/g)].map((m) => m[1]!.trim());
      for (const u of unsafe) expect(u, f).toMatch(/^JSON\.stringify\(jsonLd\)/);
    }
  });
});
