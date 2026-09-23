import { OG_CONTENT_TYPE, OG_SIZE, renderOgCard } from "@/lib/og";

// Same card as opengraph-image.tsx; X/Twitter reads twitter:image, not og:image.
export const alt = "AgenID — verifiable identity for AI agents";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return renderOgCard({ eyebrow: "Open protocol", title: "Verifiable identity for AI agents" });
}
