/**
 * GET /badge.js — the embeddable live badge.
 *
 * This was a hand-written static file in `public/`. It is a route now for one reason:
 * a static file cannot import the canonical trust-presentation module, so it carried
 * its own copy of the level→label→colour table. Two tables are two chances to
 * disagree, and the copy in `public/badge.js` was the one that rendered an unknown
 * level as emerald VERIFIED.
 *
 * The script below is generated from `lib/trust-presentation.ts` at request time. The
 * table is serialized into it, so there is exactly one place in this repository that
 * decides what a level looks like, and the browser badge is a projection of it rather
 * than a second opinion. The URL is unchanged: `/badge.js` still serves JavaScript.
 *
 * FAIL CLOSED. The generated script looks the level up in the serialized table and
 * falls back to the UNKNOWN presentation — slate, "UNVERIFIED" — for anything absent,
 * empty, malformed, or newer than this build. There is no `else -> verified` branch.
 *
 * CACHING: 300s s-maxage. Longer than the shield (a page embedding this re-fetches the
 * envelope on every load anyway, so the script itself is not the freshness path), short
 * enough that a presentation fix reaches embedders the same day.
 */
import {
  presentTrustLevel,
  supportedTrustLevels,
  recognizedStatuses,
  UNKNOWN_TRUST,
  PROOF_INVALID_TRUST,
  UNAVAILABLE_TRUST,
  revokedTrust,
  type TrustPresentation,
} from "@/lib/trust-presentation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Only what the browser needs: the colour and the text. No tones, no card labels. */
function wire(p: TrustPresentation) {
  return { color: p.color, label: p.embedLabel };
}

function buildScript(): string {
  const levels = Object.fromEntries(supportedTrustLevels().map((l) => [l, wire(presentTrustLevel(l))]));
  const table = JSON.stringify({
    levels,
    statuses: recognizedStatuses(),
    unknown: wire(UNKNOWN_TRUST),
    proofInvalid: wire(PROOF_INVALID_TRUST),
    unavailable: wire(UNAVAILABLE_TRUST),
    revokedColor: revokedTrust("REVOKED").color,
  });

  return `/* AgenID badge — https://agenid.com/badge.js
 * Usage: <script src="https://agenid.com/badge.js" data-agent="agenid:01J..."></script>
 * Renders a live badge (current verification level, fetched at load — never a cached image)
 * linking to the agent's public Verification Card. Re-checks nothing itself: the card is
 * where humans verify, and the JSON envelope at the same URL is where machines verify.
 *
 * GENERATED from lib/trust-presentation.ts. Do not hand-edit: the level table below is
 * serialized from the one module that decides what a trust state looks like. An
 * unrecognized level renders neutral, never verified.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var agent = script.getAttribute("data-agent");
  var origin;
  try { origin = new URL(script.src).origin; } catch (e) { origin = "https://agenid.com"; }
  var re = /^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
  if (!agent || !re.test(agent)) return;

  var T = ${table};

  var el = document.createElement("a");
  el.href = origin + "/a/" + agent;
  el.target = "_blank";
  el.rel = "noopener";
  el.setAttribute("data-agenid-badge", agent);
  el.style.cssText =
    "display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;" +
    "font:600 12px/1 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
    "text-decoration:none;color:#f8fafc;background:#0b0f17;border:1px solid #1a2233;letter-spacing:.01em";
  var dot = document.createElement("span");
  dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:" + T.unknown.color + ";flex:none";
  var txt = document.createElement("span");
  txt.textContent = "AgenID · checking…";
  el.appendChild(dot);
  el.appendChild(txt);
  script.parentNode.insertBefore(el, script.nextSibling);

  function paint(p, title) {
    dot.style.background = p.color;
    txt.textContent = p.label;
    if (title) el.title = title;
  }

  fetch(origin + "/api/resolve/" + encodeURIComponent(agent), { headers: { accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (env) {
      // Status fails closed exactly as the level does. The allowlist is serialized from
      // the same module, so a lifecycle state this build does not recognize — including a
      // lowercase one — renders neutral instead of falling through to the level branch.
      var status = env && env.status;
      if (typeof status !== "string") {
        paint(T.unavailable, "This registry returned no lifecycle status for this identity.");
        return;
      }
      if (T.statuses.alert.indexOf(status) !== -1) {
        paint({ color: T.revokedColor, label: "AGENID " + status }, "This identity is " + status.toLowerCase() + ". Click to see the record.");
        return;
      }
      if (T.statuses.healthy.indexOf(status) === -1) {
        paint(T.unavailable, "This registry reports a lifecycle state this badge does not recognize. Treat it as unverified.");
        return;
      }
      if (!env.proof_check || env.proof_check.ok !== true) {
        paint(T.proofInvalid, "The operator proof for this agent does not verify.");
        return;
      }
      // Fail closed: an own-property lookup in the generated table, or the neutral
      // UNKNOWN state. Never an else-branch that assumes verified.
      var level = env.verification && env.verification.level;
      var p = (typeof level === "string" && Object.prototype.hasOwnProperty.call(T.levels, level)) ? T.levels[level] : T.unknown;
      var name = env.manifest && env.manifest.identity && env.manifest.identity.name;
      var operator = env.manifest && env.manifest.ownership && env.manifest.ownership.operator;
      paint(p, (name || agent) + (operator ? " — operated by " + operator : ""));
    })
    .catch(function () {
      paint(T.unavailable, "This registry could not be reached. The identity's status is unknown, not disproven.");
    });
})();
`;
}

export function GET(): Response {
  return new Response(buildScript(), {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      "access-control-allow-origin": "*",
    },
  });
}
