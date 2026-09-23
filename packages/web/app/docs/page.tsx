import type { Metadata } from "next";
import Link from "next/link";
import { getAllPartnerDocs } from "@/lib/partners";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

/**
 * /docs used to 404 while /docs/onboarding and /docs/partners lived beneath it, so every
 * breadcrumb on a brief had a hole in the middle. This is the parent those pages imply.
 * It lists only destinations that resolve for a logged-out reader: the private monorepo
 * is deliberately not linked (see the note on /docs/partners).
 */
export const metadata: Metadata = pageMetadata({
  title: "Docs: Operator Guide, Verification API & Integrations",
  description:
    "Everything needed to register and verify an AI agent with AgenID: the operator onboarding guide, the verification API, the protocol spec and integration patterns.",
  path: "/docs",
});

const CORE = [
  {
    href: "/docs/onboarding",
    title: "Operator Onboarding Guide",
    body: "Generate an Ed25519 keypair, sign an operator manifest, register it, and embed the live verification badge.",
  },
  {
    href: "/api/v1/openapi.json",
    title: "Verification API (OpenAPI 3.0.3)",
    body: "Machine-readable contract for every deployed route: registration, resolution, key discovery and domain checks.",
  },
  {
    href: "/docs/partners",
    title: "Partner Integration Briefs",
    body: "Patterns for carrying an agenid:<ULID> through eight agent platforms. Patterns, not shipped packages.",
  },
  {
    href: "/trust",
    title: "Trust Center",
    body: "Cryptography, key management and verification methodology, including what is not complete yet.",
  },
];

const EXTERNAL = [
  { href: "https://github.com/AgenID-protocol/spec", title: "Protocol specification", body: "The normative spec, versioned with an errata log. MIT." },
  { href: "https://github.com/AgenID-protocol/conformance", title: "Conformance suite", body: "Independent test vectors that do not depend on AgenID's own code. MIT." },
];

export default function DocsIndexPage() {
  const briefs = getAllPartnerDocs();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AgenID Documentation",
    url: `${SITE_URL}/docs`,
    hasPart: [...CORE.filter((c) => c.href.startsWith("/docs")), ...briefs.map((b) => ({ href: `/docs/partners/${b.slug}`, title: b.title }))].map((d) => ({
      "@type": "TechArticle",
      headline: d.title,
      url: `${SITE_URL}${d.href}`,
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      <div className="max-w-4xl">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ label: "Docs" }]} className="mb-6" />
      <h1 className="display !text-4xl md:!text-5xl">AgenID documentation</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-paper-dim">
        How to give an AI agent a permanent <span className="font-mono">agenid:&lt;ULID&gt;</span>, how a third party
        verifies it without trusting this registry, and how the identity travels through the platforms agents already
        run on. Everything below describes what is deployed today; anything not yet deployed says so on the page.
      </p>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">Start here</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {CORE.map((c) => (
          <Link key={c.href} href={c.href} className="card block p-5 transition hover:border-muted">
            <h3 className="text-base font-semibold">{c.title}</h3>
            <p className="mt-2 text-sm text-muted">{c.body}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">Integration patterns by platform</h2>
      <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        {briefs.map((b) => (
          <li key={b.slug}>
            <Link href={`/docs/partners/${b.slug}`} className="text-paper underline underline-offset-2 hover:no-underline">
              {b.title.replace(/^Attaching AgenID Identity to /, "")}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">Specification and conformance</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {EXTERNAL.map((e) => (
          <a key={e.href} href={e.href} className="card block p-5 transition hover:border-muted" rel="noopener">
            <h3 className="text-base font-semibold">{e.title}</h3>
            <p className="mt-2 text-sm text-muted">{e.body}</p>
          </a>
        ))}
      </div>
    </div>
    </main>
  );
}
