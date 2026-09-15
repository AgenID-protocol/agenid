import type { MetadataRoute } from "next";
import { getPartnerSlugs } from "@/lib/partners";
import { SITE_URL } from "@/lib/api";

/**
 * Static + partner-doc routes only. `/a/<agenid>` resolver pages are deliberately
 * NOT listed here: there is no public registry-listing API yet (Phase 2, not built —
 * see the project queue), so there is no way to enumerate real registered identities
 * without fabricating a list. Add that section once such an API exists.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/issue`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/verify`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/verify/domain`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/ecosystem`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/trust`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/why-agent-identity`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/docs/partners`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/docs/onboarding`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];

  for (const slug of getPartnerSlugs()) {
    entries.push({
      url: `${SITE_URL}/docs/partners/${slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return entries;
}
