import type { MetadataRoute } from "next";
import { getPartnerSlugs } from "@/lib/partners";
import { scenarioSlugs } from "@/lib/scenarios";
import { SITE_URL } from "@/lib/api";
import { contentRoutes } from "@/lib/content";
import { getDirectoryStore } from "@/lib/directory";

/**
 * Static routes, partner docs, the content library, and — only for agents whose
 * operators opted in to the directory — their `/a/<agenid>` Verification Cards.
 * Registered agents that did not opt in are never listed.
 */
/*
 * No `lastModified`. Every entry used to carry `new Date()` — the build time — so all 27
 * URLs claimed to change on every deploy. Search engines learn to ignore a lastmod that
 * is always "now", and it cannot be replaced with a git date here: Vercel builds from a
 * shallow clone, so `git log` would report the oldest commit it happens to have. An
 * absent lastmod is honest; a wrong one is not.
 */
/** Rebuilt hourly so an opted-in agent's card is listed without a deploy. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/issue`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/verify`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/verify/domain`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/ecosystem`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/trust`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/why-agent-identity`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/how-it-works`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/docs`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/docs/partners`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/docs/onboarding`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/badge`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/agents`, changeFrequency: "daily", priority: 0.7 },
  ];

  // The long-form library (glossary, guides, comparisons, use cases, blog, report). Static
  // data, so listing it fabricates nothing.
  for (const path of contentRoutes()) {
    const hub = !path.slice(1).includes("/");
    entries.push({ url: `${SITE_URL}${path}`, changeFrequency: hub ? "weekly" : "monthly", priority: hub ? 0.7 : 0.6 });
  }

  // Every scenario is a static, self-contained page with its own metadata. Unlike the
  // resolver routes below, these enumerate from data rather than from the registry, so
  // listing them fabricates nothing.
  for (const slug of scenarioSlugs()) {
    entries.push({
      url: `${SITE_URL}/how-it-works/${slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  for (const slug of getPartnerSlugs()) {
    entries.push({
      url: `${SITE_URL}/docs/partners/${slug}`,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  // Verification Cards for agents whose operators opted in to the directory — and only
  // those. An unlisted registered agent is never enumerated, here or anywhere. If the
  // directory cannot be read, the sitemap is served without these entries rather than
  // failing: a missing optional section is honest, an error page is not a sitemap.
  try {
    for (const r of await getDirectoryStore().listListed(1000)) {
      entries.push({ url: `${SITE_URL}/a/${r.agent_id}`, changeFrequency: "weekly", priority: 0.5 });
    }
  } catch {
    /* directory unavailable: omit the optional section */
  }

  return entries;
}
