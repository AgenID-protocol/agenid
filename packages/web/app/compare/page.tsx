import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { COMPARISONS } from "@/lib/content";
import { graph } from "@/lib/content/jsonld";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AgenID Compared: Agent Identity Approaches",
  description:
    "How AgenID relates to GoDaddy ANS, Microsoft Entra Agent ID, Skyfire KYAPay, Visa Trusted Agent Protocol, DIDs and A2A Agent Cards. Factual and sourced.",
  path: "/compare",
});

export default function CompareIndexPage() {
  const crumbs = [
    { label: "Comparisons", href: "/compare" },
  ];
  const jsonLd = graph(
    {
      "@type": "CollectionPage",
      name: "AgenID comparisons",
      url: `${SITE_URL}/compare`,
      hasPart: COMPARISONS.map((c) => ({ "@type": "TechArticle", headline: c.h1, url: `${SITE_URL}/compare/${c.slug}` })),
    }
  );
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={crumbs} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">How AgenID relates to other agent identity approaches</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        Several organizations are working on how AI agents identify themselves. Most of these approaches answer a
        different question from AgenID, and several fit alongside it. Each page below describes the other approach in
        its owner&rsquo;s own published terms, with sources, and states AgenID&rsquo;s current limits as plainly as its
        strengths.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {COMPARISONS.map((c) => (
          <Link key={c.slug} href={`/compare/${c.slug}`} className="card block p-5 transition card-hover">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{c.owner}</div>
            <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight">{c.h1}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{c.description}</p>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-xs leading-relaxed text-muted">
        Product names belong to their owners. These pages are independent descriptions and imply no partnership,
        endorsement or affiliation. No third-party logo is shown.
      </p>
    </main>
  );
}
