#!/usr/bin/env node
/**
 * Accessibility gate: axe-core, WCAG 2.2 AA, every URL in the sitemap.
 *
 * Fails on any `serious` or `critical` violation. Runs with `prefers-reduced-motion:
 * reduce`, which makes the scenario players render their final frame rather than a
 * mid-animation state whose dimmed, not-yet-revealed steps would read as contrast
 * failures — the rule is evaluated against the page a reader who asked for no motion
 * sees, not excluded.
 *
 * Deliberately NOT a workspace dependency: Playwright and axe are installed by the CI job
 * into a scratch directory at pinned versions, and this file is copied there to run, so
 * `pnpm-lock.yaml` (which must keep its darwin entries for local builds) is untouched.
 *
 *   node a11y.mjs http://127.0.0.1:3000
 */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const paths = [...new Set([...sitemap.matchAll(/<loc>(?:https?:\/\/[^/<]+)?([^<]*)<\/loc>/g)].map((m) => m[1] || "/"))];
if (paths.length < 20) {
  console.error(`sitemap returned only ${paths.length} URLs — refusing to report a pass on a partial site`);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ reducedMotion: "reduce" })).newPage();
const failures = [];
for (const p of paths) {
  try {
    await page.goto(base + p, { waitUntil: "load", timeout: 45000 });
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    for (const v of r.violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
      failures.push(`${p}  ${v.id} (${v.impact}, ${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}) — ${v.nodes[0]?.target.join(" ")}`);
    }
  } catch (e) {
    failures.push(`${p}  could not be audited: ${String(e.message).split("\n")[0]}`);
  }
}
await browser.close();

if (failures.length) {
  console.error(`${failures.length} serious/critical accessibility finding(s) across ${paths.length} pages:`);
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log(`axe WCAG 2.2 AA: 0 serious or critical violations across ${paths.length} pages.`);
