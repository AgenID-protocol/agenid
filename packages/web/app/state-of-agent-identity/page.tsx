import type { Metadata } from "next";
import { ContentArticle } from "@/components/content/ContentArticle";
import { REPORT } from "@/lib/content";
import { articleNode, faqPage, graph } from "@/lib/content/jsonld";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: REPORT.title,
  description: REPORT.description,
  path: `/${REPORT.slug}`,
  type: "article",
  keywords: REPORT.keywords,
});

/**
 * The research report. Every figure in it comes from a cited source (test-enforced:
 * every URL in the copy appears in `sources`). No statistic is AgenID's own.
 */
export default function StateOfAgentIdentityPage() {
  const path = `/${REPORT.slug}`;
  const crumbs = [
    { label: "Research" },
  ];
  return (
    <ContentArticle
      page={REPORT}
      crumbs={crumbs}
      kicker={`Research report · desk review · ${REPORT.sources?.length ?? 0} sources`}
      jsonLd={graph(articleNode(REPORT, path, "Report", { datePublished: REPORT.updated, author: { "@type": "Organization", name: "AgenID" } }), faqPage(REPORT))}
    />
  );
}
