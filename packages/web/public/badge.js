/* AgenID badge — https://agenid.org/badge.js
 * Usage: <script src="https://agenid.org/badge.js" data-agent="agenid:01J..."></script>
 * Renders a live badge (current verification level, fetched at load — never a cached image)
 * linking to the agent's public Verification Card. Re-checks nothing itself: the card is
 * where humans verify, and the JSON envelope at the same URL is where machines verify.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var agent = script.getAttribute("data-agent");
  var origin;
  try { origin = new URL(script.src).origin; } catch (e) { origin = "https://agenid.org"; }
  var re = /^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
  if (!agent || !re.test(agent)) return;

  var el = document.createElement("a");
  el.href = origin + "/a/" + agent;
  el.target = "_blank";
  el.rel = "noopener";
  el.setAttribute("data-agenid-badge", agent);
  el.style.cssText =
    "display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;" +
    "font:600 12px/1 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;" +
    "text-decoration:none;color:#f3f5f8;background:#0b0f16;border:1px solid #232b38;letter-spacing:.01em";
  var dot = document.createElement("span");
  dot.style.cssText = "width:8px;height:8px;border-radius:50%;background:#8b95a7;flex:none";
  var txt = document.createElement("span");
  txt.textContent = "AgenID · checking…";
  el.appendChild(dot);
  el.appendChild(txt);
  script.parentNode.insertBefore(el, script.nextSibling);

  var labels = {
    L1_REGISTERED: "AGENID REGISTERED",
    L2_DOMAIN_VERIFIED: "AGENID VERIFIED · L2",
    L3_ORGANIZATION_VERIFIED: "AGENID VERIFIED · L3",
    L4_DEPLOYMENT_VERIFIED: "AGENID VERIFIED · L4"
  };

  fetch(origin + "/api/resolve/" + encodeURIComponent(agent), { headers: { accept: "application/json" } })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (env) {
      var bad = env.status === "SUSPENDED" || env.status === "REVOKED";
      var level = env.verification && env.verification.level;
      if (bad) {
        dot.style.background = "#ef5a5a";
        txt.textContent = "AGENID " + env.status;
        el.title = "This identity is " + env.status.toLowerCase() + ". Click to see the record.";
      } else if (!env.proof_check || !env.proof_check.ok) {
        dot.style.background = "#ef5a5a";
        txt.textContent = "AGENID PROOF INVALID";
      } else if (level === "L1_REGISTERED") {
        dot.style.background = "#f5b342";
        txt.textContent = labels[level];
        el.title = "Registered (declared by operator), not yet independently verified.";
      } else {
        dot.style.background = "#31d298";
        txt.textContent = labels[level] || "AGENID VERIFIED";
        el.title = (env.manifest.identity.name + " — operated by " + env.manifest.ownership.operator);
      }
    })
    .catch(function () {
      dot.style.background = "#8b95a7";
      txt.textContent = "AGENID · unavailable";
    });
})();
