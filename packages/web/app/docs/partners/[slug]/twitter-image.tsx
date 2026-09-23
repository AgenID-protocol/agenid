import { getPartnerDoc, getPartnerSlugs } from "@/lib/partners";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/og";

// Per-brief social card. The eyebrow carries the briefs' own disclaimer, so the card
// cannot be shared as though it announced a shipped integration.
export const alt = "AgenID integration pattern";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return getPartnerSlugs().map((slug) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = getPartnerDoc(slug)?.title ?? "AgenID integration pattern";
  return renderOgCard({ eyebrow: "Integration pattern · not a shipped package", title });
}
