import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content/ContentArticle";
import { Inline } from "@/components/content/Inline";
import { GLOSSARY, findTerm } from "@/lib/content";
import { articleNode, faqPage, graph } from "@/lib/content/jsonld";
import { plain } from "@/lib/content/markup";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ term: string }> }): Promise<Metadata> {
  const { term } = await params;
  const t = findTerm(term);
  if (!t) return {};
  return pageMetadata({ title: t.title, description: t.description, path: `/glossary/${t.slug}`, type: "article", keywords: t.keywords });
}

export default async function GlossaryTermPage({ params }: { params: Promise<{ term: string }> }) {
  const { term } = await params;
  const t = findTerm(term);
  if (!t) notFound();
  const path = `/glossary/${t.slug}`;
  const crumbs = [
    { label: "Glossary", href: "/glossary" },
    { label: t.term },
  ];
  const definedTerm = {
    "@type": "DefinedTerm",
    "@id": `${SITE_URL}${path}#term`,
    name: t.term,
    description: plain(t.definition),
    url: `${SITE_URL}${path}`,
    ...(t.alsoKnownAs && t.alsoKnownAs.length > 0 ? { alternateName: [...t.alsoKnownAs] } : {}),
    inDefinedTermSet: { "@type": "DefinedTermSet", "@id": `${SITE_URL}/glossary#set`, name: "AgenID Glossary", url: `${SITE_URL}/glossary` },
  };
  const jsonLd = graph(definedTerm, articleNode(t, path, "TechArticle", { about: { "@id": `${SITE_URL}${path}#term` } }), faqPage(t));

  return (
    <ContentArticle
      page={t}
      crumbs={crumbs}
      kicker={`Glossary · ${t.category}`}
      jsonLd={jsonLd}
      intro={
        <div className="rounded-2xl border border-line bg-ink-2 p-5">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Definition</div>
          <p className="mt-2.5 text-base leading-relaxed text-paper text-pretty">
            <Inline text={t.definition} />
          </p>
          {t.alsoKnownAs && t.alsoKnownAs.length > 0 && (
            <p className="mt-3 text-xs text-muted">Also known as: {t.alsoKnownAs.join(", ")}</p>
          )}
        </div>
      }
    />
  );
}
