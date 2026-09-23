import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/**
 * Social preview cards (Open Graph + Twitter), rendered at build time.
 *
 * Every page used to share with no image at all. These cards carry the page's own title,
 * so a shared scenario or brief reads as that page rather than as the homepage.
 *
 * Palette: Brand Guide v1.0 values, mirrored from the tokens in app/globals.css because
 * ImageResponse cannot read CSS variables. Verified Emerald is deliberately absent — it is
 * reserved for real verified state, and a marketing card is not a trust surface.
 */
const INK = "#0b0f17";
const INK_2 = "#0f1521";
const LINE = "#1a2233";
const PAPER = "#f8fafc";
const MUTED = "#94a3b8";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

async function markDataUrl(): Promise<string> {
  // The sealed square, unmodified (Brand Guide §01: never recolored, never swapped).
  const bytes = await readFile(path.join(process.cwd(), "public", "agenid-mark.png"));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export async function renderOgCard({ eyebrow, title }: { eyebrow: string; title: string }) {
  const mark = await markDataUrl();
  const size = title.length > 70 ? 52 : title.length > 45 ? 60 : 68;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: `linear-gradient(180deg, ${INK} 0%, ${INK_2} 100%)`,
          padding: "64px 72px",
          border: `2px solid ${LINE}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} width={64} height={64} alt="" style={{ borderRadius: 12 }} />
          <div style={{ fontSize: 40, fontWeight: 700, color: PAPER }}>AgenID</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 24, color: MUTED, textTransform: "uppercase", letterSpacing: 4 }}>{eyebrow}</div>
          <div style={{ fontSize: size, fontWeight: 700, color: PAPER, lineHeight: 1.1, letterSpacing: -0.5 }}>{title}</div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: MUTED,
            borderTop: `1px solid ${LINE}`,
            paddingTop: 24,
          }}
        >
          <span>www.agenid.com</span>
          <span>Open protocol · Ed25519-signed · Independently verifiable</span>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
