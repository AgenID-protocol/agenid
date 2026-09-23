import type { Metadata } from "next";

/**
 * One metadata builder for every public page.
 *
 * Why this exists: `app/layout.tsx` used to set `openGraph.url: "/"`, and Next merges a
 * parent's `openGraph` object into any child that does not define its own. Twenty pages
 * therefore told every social crawler they were the homepage (og:url = https://www.agenid.com)
 * while their canonical said otherwise. Building title, description, canonical, Open Graph
 * and Twitter from one call makes those five values agree by construction.
 *
 * Every page gets the sitewide card from app/opengraph-image.tsx by default; a route with
 * its own `opengraph-image.tsx` / `twitter-image.tsx` overrides it, because file-based
 * metadata takes precedence over config-based metadata.
 */
export const SITE_NAME = "AgenID";

export const HOME_TITLE = "AgenID — Verifiable Identity for AI Agents · Open Protocol";
export const HOME_DESCRIPTION =
  "Give every AI agent a permanent, portable identity that people, businesses and other agents can verify independently. Open protocol, Ed25519-signed.";

/** Served by app/opengraph-image.tsx and app/twitter-image.tsx. */
export const DEFAULT_OG_IMAGE = "/opengraph-image";
export const DEFAULT_TWITTER_IMAGE = "/twitter-image";
export const DEFAULT_OG_ALT = "AgenID — verifiable identity for AI agents";

/** Search results truncate around these lengths; the guard test enforces them. */
export const TITLE_MAX = 65;
export const DESCRIPTION_MIN = 110;
export const DESCRIPTION_MAX = 165;

export type PageSeo = {
  /** Page title without the " · AgenID" suffix (the layout template adds it). */
  title: string;
  description: string;
  /** Root-relative path, e.g. "/trust". Becomes the canonical and og:url. */
  path: string;
  type?: "website" | "article";
  keywords?: readonly string[];
  /** Use for the homepage, whose title must not receive the template suffix. */
  absoluteTitle?: boolean;
  /** Social-card title when it should differ from the document title. */
  socialTitle?: string;
  robots?: Metadata["robots"];
  /**
   * The route has its own opengraph-image.tsx / twitter-image.tsx next to its page.
   * Must be declared: once config sets `images`, Next uses the config value rather than
   * a nested file-convention image (verified against a production build).
   */
  ownImage?: boolean;
};

export function pageMetadata(p: PageSeo): Metadata {
  const base = p.path === "/" ? "" : p.path;
  const ogImage = p.ownImage ? `${base}/opengraph-image` : DEFAULT_OG_IMAGE;
  const twImage = p.ownImage ? `${base}/twitter-image` : DEFAULT_TWITTER_IMAGE;
  const fullTitle = p.absoluteTitle ? p.title : `${p.title} · ${SITE_NAME}`;
  const social = p.socialTitle ?? fullTitle;
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    ...(p.keywords ? { keywords: [...p.keywords] } : {}),
    alternates: { canonical: p.path },
    openGraph: {
      title: social,
      description: p.description,
      url: p.path,
      siteName: SITE_NAME,
      type: p.type ?? "website",
      locale: "en_US",
      // Needed, not decorative: a child page that defines its own openGraph object
      // replaces the parent's wholesale, including the image Next derives from the root
      // app/opengraph-image.tsx. Without this, /trust, /docs and every other page built
      // here shipped with no og:image even after the card existed. Routes with their own
      // card pass `ownImage`.
      images: [{ url: ogImage, width: 1200, height: 630, alt: p.ownImage ? fullTitle : DEFAULT_OG_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title: social,
      description: p.description,
      images: [{ url: twImage, alt: p.ownImage ? fullTitle : DEFAULT_OG_ALT }],
    },
    ...(p.robots ? { robots: p.robots } : {}),
  };
}

/**
 * JSON-LD for an in-browser tool page (/issue, /verify). Free, no account — both facts
 * the page itself states, so the structured data says nothing the page does not.
 */
export function webApplicationJsonLd(p: { name: string; path: string; description: string; siteUrl: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: p.name,
    url: `${p.siteUrl}${p.path}`,
    description: p.description,
    applicationCategory: "SecurityApplication",
    operatingSystem: "Any (runs in the browser)",
    isAccessibleForFree: true,
    publisher: { "@id": `${p.siteUrl}/#organization` },
  };
}
