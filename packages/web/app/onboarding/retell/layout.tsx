import type { Metadata } from "next";

/**
 * Crawl status for /onboarding/retell: NOINDEX, deliberately.
 *
 * This route had no intentional status at all. It is linked from nothing, it is absent
 * from sitemap.ts, and robots.txt is `Allow: /` — so it was indexable and shareable
 * purely by accident, which is how a partner-specific flow ends up being the first
 * AgenID page a stranger sees. It is also where every drift the first synchronization
 * pass found was concentrated.
 *
 * Every public route gets one of: public, private, internal, staging, experimental,
 * noindex, deprecated, removed. This one is internal/partner-facing until someone
 * decides otherwise, so it is noindex.
 *
 * TO MAKE IT PUBLIC: remove this file, add the route to sitemap.ts, link it from the
 * nav or the Retell partner brief, and hold it to the same review bar as the landing
 * pages. Do all four — a page in the sitemap that nothing links to is the same accident
 * in the opposite direction.
 *
 * The page is a client component, so this layout is where its metadata has to live.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RetellOnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
