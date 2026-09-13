import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartnerDoc, getPartnerSlugs } from "@/lib/partners";
import { SITE_URL } from "@/lib/api";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPartnerSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = getPartnerDoc(slug);
  if (!doc) return { title: "Not found" };
  return {
    title: doc.title,
    description: doc.description,
    alternates: { canonical: `/docs/partners/${slug}` },
  };
}

export default async function PartnerDocPage({ params }: Params) {
  const { slug } = await params;
  const doc = getPartnerDoc(slug);
  if (!doc) return notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.title,
    description: doc.description,
    url: `${SITE_URL}/docs/partners/${slug}`,
    isPartOf: { "@type": "CollectionPage", url: `${SITE_URL}/docs/partners`, name: "AgenID Partner Integration Briefs" },
    about: { "@type": "DefinedTerm", name: "agenid:<ULID>", url: `${SITE_URL}/#identity` },
    license: "https://github.com/AgenID-protocol/spec/blob/main/LICENSE",
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mb-6 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">AgenID</Link> /{" "}
        <Link href="/docs/partners" className="hover:text-paper">Partner integration briefs</Link>
      </div>

      {/* eslint-disable-next-line react/no-danger */}
      <article className="prose-agenid" dangerouslySetInnerHTML={{ __html: doc.html }} />

      <div className="mt-10 border-t border-line/70 pt-6 text-sm">
        <Link href="/docs/partners" className="underline hover:text-paper">
          ← All partner integration briefs
        </Link>
      </div>
    </main>
  );
}
