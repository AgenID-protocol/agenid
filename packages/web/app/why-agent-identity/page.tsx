import type { Metadata } from "next";
import Link from "next/link";
import { ContentArticle } from "@/components/content/ContentArticle";
import { COMPARISONS, GUIDES, WHY_HUB } from "@/lib/content";
import { articleNode, faqPage, graph } from "@/lib/content/jsonld";
import { pageMetadata } from "@/lib/seo";

/**
 * The pillar hub. Its copy lives in lib/content/hubs.ts with the rest of the long-form
 * library so the same guards apply; this route adds the hub's link grid. The original
 * page's substance — the five directions, "a claim about incentives and architecture,
 * not a claim about law", and what AgenID adds — is preserved in that copy.
 */
export const metadata: Metadata = pageMetadata({
  title: "Why AI Agents Need an Identity",
  description:
    "AI agents now call, book, buy and act for organizations. Why a portable, independently verifiable identity becomes infrastructure once that is true.",
  path: "/why-agent-identity",
  type: "article",
  keywords: WHY_HUB.keywords,
});

export default function WhyAgentIdentityPage() {
  const path = "/why-agent-identity";
  const crumbs = [
    { label: "Why agent identity" },
  ];
  return (
    <ContentArticle
      page={WHY_HUB}
      crumbs={crumbs}
      kicker="Start here"
      jsonLd={graph(articleNode(WHY_HUB, path, "Article"), faqPage(WHY_HUB))}
    >
      <section className="mt-14" aria-labelledby="go-deeper">
        <h2 id="go-deeper" className="text-2xl font-semibold leading-tight tracking-tight">
          Go deeper
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link key={g.slug} href={`/learn/${g.slug}`} className="card block p-4 transition card-hover">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Guide</div>
              <div className="mt-1.5 text-sm font-medium leading-snug tracking-tight">{g.h1}</div>
            </Link>
          ))}
          <Link href="/use-cases/voice-agents" className="card block p-4 transition card-hover">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Use case</div>
            <div className="mt-1.5 text-sm font-medium leading-snug tracking-tight">Voice agents calling businesses</div>
          </Link>
          <Link href="/glossary" className="card block p-4 transition card-hover">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Reference</div>
            <div className="mt-1.5 text-sm font-medium leading-snug tracking-tight">Glossary of agent identity terms</div>
          </Link>
          <Link href="/compare" className="card block p-4 transition card-hover">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Comparisons</div>
            <div className="mt-1.5 text-sm font-medium leading-snug tracking-tight">AgenID and {COMPARISONS.length} other approaches</div>
          </Link>
          <Link href="/how-it-works" className="card block p-4 transition card-hover">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Scenarios</div>
            <div className="mt-1.5 text-sm font-medium leading-snug tracking-tight">The same handshake, with and without AgenID</div>
          </Link>
        </div>
      </section>
    </ContentArticle>
  );
}
