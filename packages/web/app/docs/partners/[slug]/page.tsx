import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartnerDoc, getPartnerSlugs } from "@/lib/partners";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Toc } from "@/components/ui/Toc";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPartnerSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const doc = getPartnerDoc(slug);
  if (!doc) return { title: "Not found" };
  return pageMetadata({
    // "Attaching AgenID Identity to an ElevenLabs Conversational AI Agent · AgenID" ran to
    // 76 characters and truncated in results. The H1 keeps the full phrasing.
    title: searchTitle(doc.title),
    description: doc.description,
    path: `/docs/partners/${slug}`,
    type: "article",
    ownImage: true,
  });
}

function searchTitle(title: string): string {
  return title.replace(/^Attaching AgenID Identity to /, "AgenID Identity for ");
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
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "AgenID", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Docs", item: `${SITE_URL}/docs` },
      { "@type": "ListItem", position: 3, name: "Partner integration briefs", item: `${SITE_URL}/docs/partners` },
      { "@type": "ListItem", position: 4, name: doc.title, item: `${SITE_URL}/docs/partners/${slug}` },
    ],
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:px-8">
      <div className="max-w-3xl">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <Breadcrumbs
        items={[{ label: "Docs", href: "/docs" }, { label: "Partner integration briefs", href: "/docs/partners" }, { label: doc.title }]}
        jsonLd={false}
        className="mb-6"
      />

      {/* eslint-disable-next-line react/no-danger */}
      <article className="prose-agenid" dangerouslySetInnerHTML={{ __html: doc.html }} />

      <div className="mt-10 border-t border-line/70 pt-6 text-sm">
        <Link href="/docs/partners" className="underline hover:text-paper">
          ← All partner integration briefs
        </Link>
      </div>
    </div>
      <aside className="hidden lg:block">
        <Toc selector=".prose-agenid h2" />
      </aside>
    </main>
  );
}
