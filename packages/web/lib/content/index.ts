/**
 * The long-form content library: glossary, guides, comparisons, hubs, blog and the
 * research report. Data only — rendering lives in components/content/, guards in
 * test/content.test.ts.
 *
 * Everything here is static and enumerable from data, so every page can be prerendered
 * and listed in the sitemap without fabricating anything (unlike /a/<agenid>, which is
 * only ever listed from the registry).
 */

import type { BlogPost, ComparisonPage, ContentPage, GlossaryTerm } from "./types";
import { GLOSSARY_A } from "./glossary-a";
import { GLOSSARY_B } from "./glossary-b";
import { GUIDES } from "./guides";
import { COMPARISONS } from "./compare";
import { POSTS } from "./blog";
import { REPORT } from "./report";
import { VOICE_HUB, WHY_HUB } from "./hubs";

export type * from "./types";
export { REPORT, VOICE_HUB, WHY_HUB };

/** Alphabetical by term — the order a glossary is read in. */
export const GLOSSARY: readonly GlossaryTerm[] = [...GLOSSARY_A, ...GLOSSARY_B].sort((a, b) =>
  a.term.localeCompare(b.term, "en", { sensitivity: "base" }),
);
export { GUIDES, COMPARISONS };
/** Newest first. */
export const BLOG: readonly BlogPost[] = [...POSTS].sort((a, b) => b.published.localeCompare(a.published));

/** Use-case hubs under /use-cases/<slug>. */
export const USE_CASES: readonly ContentPage[] = [VOICE_HUB];

export const GLOSSARY_CATEGORIES = [
  "Identity",
  "Verification",
  "Cryptography",
  "Keys and discovery",
  "Agents and ecosystems",
  "Policy and regulation",
] as const;

export const findTerm = (slug: string): GlossaryTerm | undefined => GLOSSARY.find((t) => t.slug === slug);
export const findGuide = (slug: string): ContentPage | undefined => GUIDES.find((g) => g.slug === slug);
export const findComparison = (slug: string): ComparisonPage | undefined => COMPARISONS.find((c) => c.slug === slug);
export const findPost = (slug: string): BlogPost | undefined => BLOG.find((p) => p.slug === slug);
export const findUseCase = (slug: string): ContentPage | undefined => USE_CASES.find((u) => u.slug === slug);

/** Every content route this library owns, as root-relative paths. */
export function contentRoutes(): string[] {
  return [
    "/glossary",
    ...GLOSSARY.map((t) => `/glossary/${t.slug}`),
    "/learn",
    ...GUIDES.map((g) => `/learn/${g.slug}`),
    "/compare",
    ...COMPARISONS.map((c) => `/compare/${c.slug}`),
    "/use-cases",
    ...USE_CASES.map((u) => `/use-cases/${u.slug}`),
    "/blog",
    ...BLOG.map((p) => `/blog/${p.slug}`),
    `/${REPORT.slug}`,
  ];
}

/** Human label for an internal path, used by "Related" link lists. */
export function labelFor(path: string): string {
  const [, section, slug] = path.split("/");
  const lookup: Record<string, (s: string) => { title: string } | undefined> = {
    glossary: (s) => {
      const t = findTerm(s);
      return t ? { title: t.term } : undefined;
    },
    learn: (s) => {
      const g = findGuide(s);
      return g ? { title: g.h1 } : undefined;
    },
    compare: (s) => {
      const c = findComparison(s);
      return c ? { title: c.h1 } : undefined;
    },
    blog: (s) => {
      const p = findPost(s);
      return p ? { title: p.h1 } : undefined;
    },
    "use-cases": (s) => {
      const u = findUseCase(s);
      return u ? { title: u.h1 } : undefined;
    },
  };
  if (section && slug && lookup[section]) {
    const hit = lookup[section]!(slug);
    if (hit) return hit.title;
  }
  return STATIC_LABELS[path] ?? path;
}

const STATIC_LABELS: Record<string, string> = {
  "/": "AgenID home",
  "/issue": "Register an agent",
  "/verify": "Verify an AgenID",
  "/verify/domain": "Prove domain control",
  "/trust": "Trust Center",
  "/ecosystem": "Ecosystem",
  "/why-agent-identity": "Why AI agents need an identity",
  "/how-it-works": "How it works: scenarios",
  "/docs": "Documentation",
  "/docs/onboarding": "Operator onboarding guide",
  "/docs/partners": "Integration patterns",
  "/badge": "Verification badge",
  "/glossary": "Glossary",
  "/learn": "Guides",
  "/compare": "Comparisons",
  "/use-cases": "Use cases",
  "/blog": "Blog",
  "/state-of-agent-identity": "The State of AI Agent Identity 2026",
};
