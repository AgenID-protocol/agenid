import { SITE_URL } from "@/lib/api";
import type { ContentPage } from "./types";
import { plain } from "./markup";

/**
 * Structured data for content pages, built only from what the page visibly renders, so
 * the JSON-LD never says anything the reader cannot see.
 */
export function faqPage(page: ContentPage) {
  if (page.faqs.length === 0) return undefined;
  return {
    "@type": "FAQPage",
    mainEntity: page.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: plain(f.a) },
    })),
  };
}

export function articleNode(
  page: ContentPage,
  path: string,
  type: "TechArticle" | "Article" | "BlogPosting" | "Report" = "TechArticle",
  extra: Record<string, unknown> = {},
) {
  const url = `${SITE_URL}${path}`;
  return {
    "@type": type,
    "@id": `${url}#article`,
    headline: page.h1,
    description: page.description,
    url,
    inLanguage: "en",
    dateModified: page.updated,
    keywords: page.keywords.join(", "),
    isPartOf: { "@type": "WebSite", name: "AgenID", url: SITE_URL },
    publisher: { "@id": `${SITE_URL}/#organization`, "@type": "Organization", name: "AgenID", url: SITE_URL },
    ...(page.sources && page.sources.length > 0
      ? { citation: page.sources.map((s) => ({ "@type": "CreativeWork", name: s.label, url: s.url })) }
      : {}),
    ...extra,
  };
}

export function graph(...nodes: (Record<string, unknown> | undefined)[]) {
  return { "@context": "https://schema.org", "@graph": nodes.filter(Boolean) };
}
