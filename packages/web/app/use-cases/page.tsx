import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { USE_CASES } from "@/lib/content";
import { graph } from "@/lib/content/jsonld";
import { groupedCatalogue } from "@/lib/scenarios";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AI Agent Identity Use Cases",
  description:
    "Where a verifiable AI agent identity matters: voice agents calling businesses, agents buying, booking and filing for someone, and agents delegating to agents.",
  path: "/use-cases",
});

export default function UseCasesIndexPage() {
  const crumbs = [
    { label: "Use cases", href: "/use-cases" },
  ];
  const groups = groupedCatalogue();
  const jsonLd = graph(
    {
      "@type": "CollectionPage",
      name: "AgenID use cases",
      url: `${SITE_URL}/use-cases`,
      hasPart: USE_CASES.map((u) => ({ "@type": "Article", headline: u.h1, url: `${SITE_URL}/use-cases/${u.slug}` })),
    }
  );
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={crumbs} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">Use cases for AI agent identity</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        An identity layer matters wherever the party on the other end of a conversation or transaction is software
        acting for someone else. Start with the use-case hubs, or walk through a specific scenario played with and
        without AgenID.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {USE_CASES.map((u) => (
          <Link key={u.slug} href={`/use-cases/${u.slug}`} className="card block p-5 transition card-hover">
            <h2 className="text-lg font-semibold leading-snug tracking-tight">{u.h1}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{u.description}</p>
          </Link>
        ))}
      </div>
      {groups.map((g) => (
        <section key={g.group} className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">{g.group}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {g.entries.map((e) => (
              <li key={e.slug}>
                <Link href={`/how-it-works/${e.slug}`} className="text-sm underline underline-offset-2 hover:no-underline">
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
