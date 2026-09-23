import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { COMPARISONS, GUIDES } from "@/lib/content";
import { graph } from "@/lib/content/jsonld";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Guides: Verifying and Trusting AI Agents",
  description:
    "In-depth guides to AI agent identity: how to verify an AI agent, Know Your Agent (KYA), agent registries and agent-to-agent authentication.",
  path: "/learn",
});

export default function LearnIndexPage() {
  const crumbs = [
    { label: "Guides", href: "/learn" },
  ];
  const jsonLd = graph(
    {
      "@type": "CollectionPage",
      name: "AgenID Guides",
      url: `${SITE_URL}/learn`,
      hasPart: GUIDES.map((g) => ({ "@type": "TechArticle", headline: g.h1, url: `${SITE_URL}/learn/${g.slug}` })),
    }
  );
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={crumbs} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">Guides to AI agent identity</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        Long-form answers to the questions people ask before they trust an AI agent: how to check one, what Know Your
        Agent means, what a registry should and should not decide, and how agents authenticate to each other. Each guide
        states what agenid.com can do today and where the protocol goes further than the deployment.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <Link key={g.slug} href={`/learn/${g.slug}`} className="card block p-5 transition card-hover">
            <h2 className="text-lg font-semibold leading-snug tracking-tight">{g.h1}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{g.description}</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-14 text-xl font-semibold tracking-tight">Also useful</h2>
      <ul className="mt-4 space-y-2 text-sm">
        <li><Link href="/glossary" className="underline underline-offset-2 hover:no-underline">Glossary of agent identity terms</Link></li>
        <li><Link href="/compare" className="underline underline-offset-2 hover:no-underline">How AgenID relates to {COMPARISONS.length} other approaches</Link></li>
        <li><Link href="/state-of-agent-identity" className="underline underline-offset-2 hover:no-underline">The State of AI Agent Identity 2026 (research report)</Link></li>
        <li><Link href="/how-it-works" className="underline underline-offset-2 hover:no-underline">Scenarios: the same handshake with and without AgenID</Link></li>
      </ul>
    </main>
  );
}
