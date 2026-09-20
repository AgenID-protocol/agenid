import type { Metadata } from "next";
import Link from "next/link";
import { getAllPartnerDocs } from "@/lib/partners";
import { SITE_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Partner Integration Briefs",
  description:
    "How to attach a verifiable agenid:<ULID> identity to an agent built on Retell, Vapi, ElevenLabs, Bland, LangChain/LangGraph, MCP servers, Grok Bot, or OpenClaw — using each platform's existing, documented APIs plus @agenid/core.",
  alternates: { canonical: "/docs/partners" },
};

export default function PartnersIndexPage() {
  const docs = getAllPartnerDocs();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AgenID Partner Integration Briefs",
    url: `${SITE_URL}/docs/partners`,
    description: metadata.description,
    hasPart: docs.map((d) => ({
      "@type": "TechArticle",
      headline: d.title,
      description: d.description,
      url: `${SITE_URL}/docs/partners/${d.slug}`,
    })),
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mb-2 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">AgenID</Link> / Partner integration briefs
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Partner Integration Briefs</h1>
      <p className="mt-4 max-w-2xl text-muted">
        Integration <em>patterns</em>, not shipped adapter packages — how to carry an{" "}
        <span className="font-mono">agenid:&lt;ULID&gt;</span> identity through each platform&rsquo;s existing,
        documented API surface and verify it with <span className="font-mono">@agenid/core</span>. Every brief is
        explicit about what&rsquo;s actually shipped versus illustrative.{" "}
        {/* This linked @agenid/core to AgenID-protocol/agenid, a private repository — a 404
            for every logged-out reader. The package is not published to npm either, so
            there is no public destination to link to; saying so is more useful than a link
            that fails. */}
        <span className="text-muted">
          <span className="font-mono">@agenid/core</span> is not published to npm and its repository is not public
          yet, so the briefs describe the pattern rather than a package you can install today.
        </span>
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {docs.map((d) => (
          <Link key={d.slug} href={`/docs/partners/${d.slug}`} className="card block p-5 transition hover:border-muted">
            <span className="pill !py-1 !text-[10px]">{d.category}</span>
            <h2 className="mt-3 text-base font-semibold">{d.title.replace(/^Attaching AgenID Identity to /, "")}</h2>
            <p className="mt-2 text-sm text-muted">{d.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
