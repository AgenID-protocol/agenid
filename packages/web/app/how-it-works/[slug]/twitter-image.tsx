import { findEntry, scenarioSlugs, seoFor } from "@/lib/scenarios";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/og";

// Per-scenario social card: the page's own H1, so a shared scenario reads as itself.
export const alt = "AgenID scenario: how an AI agent's identity is verified";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return scenarioSlugs().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = findEntry(slug);
  const title = seoFor(slug)?.h1 ?? entry?.title ?? "How AI agent identity verification works";
  return renderOgCard({ eyebrow: "How it works", title });
}
