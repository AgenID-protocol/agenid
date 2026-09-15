/**
 * GET /badge/<agenid>/shield.svg — the README badge.
 *
 * public/badge.js covers pages that can run a script. A README on GitHub, npm, or PyPI
 * cannot: those render Markdown with scripts stripped, so the only badge that works there
 * is an <img>. This route is that image, rendered server-side from the same live envelope
 * badge.js fetches.
 *
 * STATE MAPPING COMES FROM lib/trust-presentation.ts, which /badge.js is also generated
 * from. This route used to carry its own copy of the table, and that copy ended in
 * `else -> emerald VERIFIED` — so an unrecognized, empty, or absent level rendered as the
 * strongest claim the product can make. Presentation now fails closed: anything not
 * enumerated in the canonical module is neutral slate and reads "UNVERIFIED".
 *
 * The neutral case is a product rule, not an oversight: an identifier with no record is
 * not evidence of wrongdoing, so an unknown agent renders grey and says "not registered",
 * never red and never "invalid".
 *
 * CACHING: 60s s-maxage. A revocation must be able to turn a badge red quickly, which
 * rules out a long TTL; a README hit by a crawler on every page view rules out no-store.
 */
import { fetchEnvelope } from "@/lib/api";
import { isValidAgentId } from "@agenid/core";
import {
  presentEnvelopeTrust,
  trustSummary,
  MALFORMED_ID_TRUST,
  NOT_REGISTERED_TRUST,
} from "@/lib/trust-presentation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Advance width for the badge's 11px semibold sans text. Real font metrics are not
 * available server-side, so this approximates them per character class — using a single
 * average width would push a wide label 20% past the pill and look broken next to other
 * README badges.
 */
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (ch === " ") w += 3.1;
    else if ("ilj|!.,:;'".includes(ch)) w += 2.9;
    else if ("ft()[]/\\".includes(ch)) w += 4.0;
    else if ("MW".includes(ch)) w += 9.8;
    else if (ch >= "A" && ch <= "Z") w += 7.7;
    else if (ch >= "0" && ch <= "9") w += 6.6;
    else w += 6.4;
  }
  return w;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderBadgeSvg(label: string, color: string, title: string): string {
  const LEFT = "AGENID";
  const padX = 10;
  const gap = 7;
  const dot = 7;
  const sepGap = 9;
  const leftW = textWidth(LEFT);
  const rightW = textWidth(label);
  const w = Math.round(padX + dot + gap + leftW + sepGap + rightW + padX);
  const h = 22;
  const dotCx = padX + dot / 2;
  const leftX = padX + dot + gap;
  const rightX = leftX + leftW + sepGap;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${(h - 1) / 2}" fill="#0b0f17" stroke="#1a2233"/>
  <circle cx="${dotCx}" cy="${h / 2}" r="${dot / 2}" fill="${color}"/>
  <g font-family="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif" font-size="11" font-weight="600">
    <text x="${leftX}" y="${h / 2}" dominant-baseline="central" fill="#f8fafc">${esc(LEFT)}</text>
    <text x="${rightX}" y="${h / 2}" dominant-baseline="central" fill="${color}">${esc(label)}</text>
  </g>
</svg>`;
}

function respond(body: string, maxAge: number): Response {
  return new Response(body, {
    status: 200, // Always 200: a non-200 renders as a broken-image icon, not as a badge.
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=300`,
      "access-control-allow-origin": "*",
    },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ agenid: string }> }) {
  const { agenid } = await ctx.params;
  const id = decodeURIComponent(agenid);

  if (!isValidAgentId(id)) {
    const p = MALFORMED_ID_TRUST;
    return respond(renderBadgeSvg(p.badgeLabel, p.color, trustSummary(p, id)), 3600);
  }

  const { envelope } = await fetchEnvelope(id);
  if (!envelope) {
    const p = NOT_REGISTERED_TRUST;
    return respond(renderBadgeSvg(p.badgeLabel, p.color, trustSummary(p, id)), 60);
  }

  const env = envelope as {
    status?: string;
    proof_check?: { ok?: boolean };
    verification?: { level?: string };
    manifest?: { identity?: { name?: string }; ownership?: { operator?: string } };
  };

  const name = env.manifest?.identity?.name ?? id;
  const operator = env.manifest?.ownership?.operator;

  // One call decides everything: lifecycle status, then proof, then the level — and an
  // unenumerated level resolves to the neutral UNKNOWN presentation, not to VERIFIED.
  const p = presentEnvelopeTrust(env);
  return respond(renderBadgeSvg(p.badgeLabel, p.color, trustSummary(p, name, operator)), 60);
}
