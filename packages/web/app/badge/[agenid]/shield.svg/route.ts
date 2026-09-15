/**
 * GET /badge/<agenid>/shield.svg — the README badge.
 *
 * public/badge.js covers pages that can run a script. A README on GitHub, npm, or PyPI
 * cannot: those render Markdown with scripts stripped, so the only badge that works there
 * is an <img>. This route is that image, rendered server-side from the same live envelope
 * badge.js fetches.
 *
 * STATE MAPPING IS COPIED FROM badge.js ON PURPOSE. Two badges for the same protocol that
 * disagree about what a level looks like would be worse than having one badge:
 *   revoked/suspended or failed proof -> red
 *   L1_REGISTERED                     -> amber   (registered, NOT independently verified)
 *   L2/L3/L4                          -> emerald
 *   unknown / unresolvable            -> slate, neutral wording
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLATE = "#94a3b8";
const AMBER = "#f59e0b";
const MINT = "#10b981";
const RED = "#ef4444";

const LABELS: Record<string, string> = {
  L1_REGISTERED: "REGISTERED",
  L2_DOMAIN_VERIFIED: "VERIFIED L2",
  L3_ORGANIZATION_VERIFIED: "VERIFIED L3",
  L4_DEPLOYMENT_VERIFIED: "VERIFIED L4",
};

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
    return respond(renderBadgeSvg("NOT AN AGENID", SLATE, "Not a well-formed agenid:<ULID>."), 3600);
  }

  const { envelope } = await fetchEnvelope(id);
  if (!envelope) {
    return respond(renderBadgeSvg("NOT REGISTERED", SLATE, `${id} has no record in this registry.`), 60);
  }

  const env = envelope as {
    status?: string;
    proof_check?: { ok?: boolean };
    verification?: { level?: string };
    manifest?: { identity?: { name?: string }; ownership?: { operator?: string } };
  };

  if (env.status === "SUSPENDED" || env.status === "REVOKED") {
    return respond(renderBadgeSvg(env.status, RED, `This identity is ${env.status.toLowerCase()}.`), 60);
  }
  if (env.proof_check?.ok !== true) {
    return respond(renderBadgeSvg("PROOF INVALID", RED, "The operator proof for this agent does not verify."), 60);
  }

  const level = env.verification?.level ?? "";
  const name = env.manifest?.identity?.name ?? id;
  const operator = env.manifest?.ownership?.operator;

  if (level === "L1_REGISTERED") {
    return respond(
      renderBadgeSvg(
        LABELS[level],
        AMBER,
        `${name} — registered by ${operator ?? "its operator"}. Self-declared, not independently verified.`,
      ),
      60,
    );
  }

  return respond(
    renderBadgeSvg(LABELS[level] ?? "VERIFIED", MINT, `${name} — operated by ${operator ?? "an identified operator"}.`),
    60,
  );
}
