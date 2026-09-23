import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content/ContentArticle";
import { USE_CASES, findUseCase } from "@/lib/content";
import { articleNode, faqPage, graph } from "@/lib/content/jsonld";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const u = findUseCase(slug);
  if (!u) return {};
  return pageMetadata({ title: u.title, description: u.description, path: `/use-cases/${u.slug}`, type: "article", keywords: u.keywords });
}

export default async function UseCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = findUseCase(slug);
  if (!u) notFound();
  const path = `/use-cases/${u.slug}`;
  const crumbs = [
    { label: "Use cases", href: "/use-cases" },
    { label: u.h1 },
  ];
  return (
    <ContentArticle page={u} crumbs={crumbs} kicker="Use case" jsonLd={graph(articleNode(u, path, "Article"), faqPage(u))} />
  );
}
