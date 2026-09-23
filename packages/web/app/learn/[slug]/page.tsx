import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content/ContentArticle";
import { GUIDES, findGuide } from "@/lib/content";
import { articleNode, faqPage, graph } from "@/lib/content/jsonld";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = findGuide(slug);
  if (!g) return {};
  return pageMetadata({ title: g.title, description: g.description, path: `/learn/${g.slug}`, type: "article", keywords: g.keywords });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = findGuide(slug);
  if (!g) notFound();
  const path = `/learn/${g.slug}`;
  const crumbs = [
    { label: "Guides", href: "/learn" },
    { label: g.h1 },
  ];
  return (
    <ContentArticle
      page={g}
      crumbs={crumbs}
      kicker="Guide"
      jsonLd={graph(articleNode(g, path, "TechArticle"), faqPage(g))}
    />
  );
}
