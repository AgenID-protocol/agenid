import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/content";
import { graph } from "@/lib/content/jsonld";
import { plain } from "@/lib/content/markup";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AI Agent Identity Glossary: Terms & Definitions",
  description:
    "Plain-language definitions of AI agent identity terms: Know Your Agent, agent manifests, Ed25519, key discovery, verification levels, A2A Agent Cards and more.",
  path: "/glossary",
});

export default function GlossaryIndexPage() {
  const crumbs = [
    { label: "Glossary", href: "/glossary" },
  ];
  const jsonLd = graph(
    {
      "@type": "DefinedTermSet",
      "@id": `${SITE_URL}/glossary#set`,
      name: "AgenID Glossary",
      url: `${SITE_URL}/glossary`,
      hasDefinedTerm: GLOSSARY.map((t) => ({
        "@type": "DefinedTerm",
        name: t.term,
        description: plain(t.definition),
        url: `${SITE_URL}/glossary/${t.slug}`,
      })),
    }
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={crumbs} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">AI agent identity glossary</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        {GLOSSARY.length} terms used when people talk about identifying, verifying and trusting AI agents — defined
        precisely, with the boundary of what each one does and does not mean. Where a term describes something the
        AgenID specification defines but agenid.com does not yet issue, the entry says so.
      </p>

      <nav aria-label="Glossary categories" className="mt-6 flex flex-wrap gap-2">
        {GLOSSARY_CATEGORIES.map((c) => (
          <a key={c} href={`#${c.toLowerCase().replace(/\s+/g, "-")}`} className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:text-paper">
            {c}
          </a>
        ))}
      </nav>

      {GLOSSARY_CATEGORIES.map((c) => {
        const terms = GLOSSARY.filter((t) => t.category === c);
        if (terms.length === 0) return null;
        return (
          <section key={c} id={c.toLowerCase().replace(/\s+/g, "-")} className="mt-12 scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">{c}</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {terms.map((t) => (
                <Link key={t.slug} href={`/glossary/${t.slug}`} className="card block p-4 transition card-hover">
                  <dt className="text-base font-medium tracking-tight text-paper">{t.term}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">{plain(t.definition)}</dd>
                </Link>
              ))}
            </dl>
          </section>
        );
      })}
    </main>
  );
}
