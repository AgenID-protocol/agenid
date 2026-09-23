import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, HOME_DESCRIPTION, HOME_TITLE, TITLE_MAX, pageMetadata } from "../lib/seo";
import { PARTNER_DESCRIPTIONS, SCENARIO_BRIEFS, getPartnerDoc, getPartnerSlugs } from "../lib/partners";
import { scenarioSlugs } from "../lib/scenarios";

/**
 * Guards for the sitewide search/social metadata layer (SEO audit, Sept 23 2026).
 *
 * Every assertion here corresponds to a defect that was live on www.agenid.com:
 * og:url pointing twenty pages at the homepage, 300-character partner descriptions cut
 * mid-word with raw markdown in two of them, an indexable page for every made-up
 * identifier under /a/, a 404 favicon served by a 359 KB PNG, and a sitemap whose
 * lastmod was always the build time. New file, per the concurrent-session rule.
 */

const WEB = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(WEB, ...p), "utf-8");
/** Comments may explain what was removed and why; guards match code only. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SUFFIX = " · AgenID";

function pages(dir = path.join(WEB, "app")): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "api") continue;
      out.push(...pages(full));
    } else if (e.name === "page.tsx") out.push(full);
  }
  return out;
}

/** Title/description literals passed to pageMetadata() in a source file. */
function literals(src: string): { title?: string; description?: string } {
  const call = src.match(/pageMetadata\(\{([\s\S]*?)\n\s*\}\)/);
  if (!call) return {};
  const title = call[1]!.match(/\btitle:\s*"([^"]+)"/)?.[1];
  const description = call[1]!.match(/\bdescription:\s*"([^"]+)"/)?.[1];
  return { title, description };
}

describe("pageMetadata()", () => {
  it("makes og:url, twitter and canonical agree with the path", () => {
    const m = pageMetadata({ title: "X page", description: "d".repeat(120), path: "/x" });
    expect(m.alternates?.canonical).toBe("/x");
    expect((m.openGraph as { url?: string }).url).toBe("/x");
    expect((m.twitter as { card?: string }).card).toBe("summary_large_image");
    expect((m.openGraph as { title?: string }).title).toBe(`X page${SUFFIX}`);
  });

  it("always carries a card image — a child openGraph object drops the parent's", () => {
    const m = pageMetadata({ title: "X page", description: "d".repeat(120), path: "/x" });
    const og = m.openGraph as { images?: { url: string }[] };
    const tw = m.twitter as { images?: { url: string }[] };
    expect(og.images?.[0]?.url).toBe("/opengraph-image");
    expect(tw.images?.[0]?.url).toBe("/twitter-image");
    const own = pageMetadata({ title: "X", description: "d".repeat(120), path: "/docs/partners/x", ownImage: true });
    expect((own.openGraph as { images?: { url: string }[] }).images?.[0]?.url).toBe("/docs/partners/x/opengraph-image");
    expect((own.twitter as { images?: { url: string }[] }).images?.[0]?.url).toBe("/docs/partners/x/twitter-image");
  });

  it("every route that ships its own card declares it, so config cannot mask it", () => {
    for (const dir of [["how-it-works", "[slug]"], ["docs", "partners", "[slug]"]]) {
      expect(fs.existsSync(path.join(WEB, "app", ...dir, "opengraph-image.tsx"))).toBe(true);
      expect(read("app", ...dir, "page.tsx")).toMatch(/ownImage:\s*true/);
    }
  });

  it("does not suffix an absolute (homepage) title", () => {
    const m = pageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, path: "/", absoluteTitle: true });
    expect(m.title).toEqual({ absolute: HOME_TITLE });
    expect(HOME_TITLE.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(HOME_DESCRIPTION.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});

describe("root layout", () => {
  const layout = code(read("app", "layout.tsx"));
  const og = layout.match(/openGraph:\s*\{([^}]*)\}/)?.[1] ?? "";

  it("never sets a sitewide og:url (children inherit it)", () => {
    expect(og).not.toBe("");
    expect(og).not.toMatch(/\burl\s*:/);
  });

  it("uses the icon file conventions, not the full-size brand PNG", () => {
    expect(layout).not.toMatch(/icons\s*:/);
    expect(fs.existsSync(path.join(WEB, "app", "favicon.ico"))).toBe(true);
    expect(fs.statSync(path.join(WEB, "app", "icon.png")).size).toBeLessThan(32 * 1024);
    expect(fs.existsSync(path.join(WEB, "app", "apple-icon.png"))).toBe(true);
  });

  it("commits no search-engine verification token", () => {
    expect(layout).toMatch(/process\.env\.GOOGLE_SITE_VERIFICATION/);
    expect(layout).not.toMatch(/google:\s*"[^"]+"/);
  });
});

describe("every public page", () => {
  const ALLOW_WITHOUT_HELPER = new Set([
    // Client component; its metadata (noindex) lives in the route layout.
    path.join(WEB, "app", "onboarding", "retell", "page.tsx"),
  ]);

  it("builds its metadata through pageMetadata()", () => {
    for (const p of pages()) {
      if (ALLOW_WITHOUT_HELPER.has(p)) continue;
      expect(read(path.relative(WEB, p)), path.relative(WEB, p)).toMatch(/pageMetadata\(/);
    }
  });

  it("keeps literal titles and descriptions within search-result limits", () => {
    let checked = 0;
    for (const p of pages()) {
      const { title, description } = literals(fs.readFileSync(p, "utf-8"));
      const rel = path.relative(WEB, p);
      if (title && !/HOME_TITLE/.test(title)) {
        expect(`${title}${SUFFIX}`.length, `${rel} title`).toBeLessThanOrEqual(TITLE_MAX);
        checked++;
      }
      if (description) {
        expect(description.length, `${rel} description`).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
        expect(description.length, `${rel} description`).toBeLessThanOrEqual(DESCRIPTION_MAX);
      }
    }
    expect(checked).toBeGreaterThanOrEqual(9);
  });

  it("no page reintroduces a small twitter card", () => {
    for (const p of pages()) expect(fs.readFileSync(p, "utf-8")).not.toMatch(/card:\s*"summary"/);
  });
});

describe("partner brief descriptions", () => {
  it("one per brief, plain text, snippet-length, and carrying the brief's own disclaimer", () => {
    expect(Object.keys(PARTNER_DESCRIPTIONS).sort()).toEqual(getPartnerSlugs());
    for (const [slug, d] of Object.entries(PARTNER_DESCRIPTIONS)) {
      expect(d.length, slug).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
      expect(d.length, slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
      expect(d, slug).not.toMatch(/\]\(|\*\*|`|https?:\/\//);
      expect(d, slug).toMatch(/pattern, not a/i);
      expect(getPartnerDoc(slug)?.description).toBe(d);
    }
  });

  it("search titles fit, while the H1 keeps its full phrasing", () => {
    const page = read("app", "docs", "partners", "[slug]", "page.tsx");
    const rewrite = (t: string) => t.replace(/^Attaching AgenID Identity to /, "AgenID Identity for ");
    expect(page).toMatch(/searchTitle\(doc\.title\)/);
    for (const slug of getPartnerSlugs()) {
      expect(`${rewrite(getPartnerDoc(slug)!.title)}${SUFFIX}`.length, slug).toBeLessThanOrEqual(TITLE_MAX + 2);
    }
  });

  it("scenario→brief links point only at briefs that exist, from scenarios that exist", () => {
    const scen = new Set(scenarioSlugs());
    const briefs = new Set(getPartnerSlugs());
    for (const [s, list] of Object.entries(SCENARIO_BRIEFS)) {
      expect(scen.has(s), s).toBe(true);
      for (const b of list) expect(briefs.has(b), `${s} → ${b}`).toBe(true);
    }
    for (const b of briefs) {
      expect(Object.values(SCENARIO_BRIEFS).some((l) => l.includes(b)), `${b} has a scenario inbound link`).toBe(true);
    }
  });
});

describe("resolver and sitemap", () => {
  it("an unregistered identifier renders but is not indexable; an outage is not deindexed", () => {
    const src = read("app", "a", "[agenid]", "page.tsx");
    expect(src).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
    expect(src).toMatch(/status >= 500/);
    const outage = src.slice(src.indexOf("status >= 500"), src.indexOf("if (!envelope) {"));
    expect(code(outage)).not.toMatch(/robots\s*:/);
  });

  it("the sitemap claims no lastmod it cannot know", () => {
    const src = read("app", "sitemap.ts").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/lastModified/);
    expect(src).toMatch(/\/docs`/);
  });
});

describe("social cards and llms.txt", () => {
  it("OG cards never use Verified Emerald (reserved for real verified state)", () => {
    const og = read("lib", "og.tsx").toLowerCase();
    expect(og).not.toMatch(/#10b981|mint/);
    for (const f of ["app/opengraph-image.tsx", "app/twitter-image.tsx"]) expect(fs.existsSync(path.join(WEB, f)), f).toBe(true);
  });

  it("brief cards carry the not-a-package disclaimer", () => {
    expect(read("app", "docs", "partners", "[slug]", "opengraph-image.tsx")).toMatch(/not a shipped package/);
    expect(read("app", "docs", "partners", "[slug]", "twitter-image.tsx")).toMatch(/not a shipped package/);
  });

  it("llms.txt states the issuance ceiling and names no dead or unowned host", () => {
    const t = read("public", "llms.txt");
    expect(t).toMatch(/L1_REGISTERED/);
    expect(t).toMatch(/root authority key has not been created/);
    expect(t).not.toMatch(/agenid\.org|agenid\.ai|api\.agenid\.com|github\.com\/AgenID-protocol\/agenid\b/);
  });
});
