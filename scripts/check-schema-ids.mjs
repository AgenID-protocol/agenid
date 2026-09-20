#!/usr/bin/env node
/**
 * Release gate: every schema URI @agenid/core EXPORTS must resolve.
 *
 * `$schema` is inside the signing input of every signed object, so a schema id is
 * not a documentation link — it is a string this library asks people to sign. When
 * the package is published, each exported id becomes a promise to every installer.
 *
 * Two of them cannot be kept today. `GRANT_SCHEMA_ID` and `REVOCATION_SCHEMA_ID`
 * point at `/schemas/v1.2/`, which 404s: the v1.2 authorization layer is draft and
 * non-normative, and its schemas are not published. That is fine while the package
 * is unpublished and the layer is unissuable. It stops being fine the moment the
 * tarball reaches a stranger, and this is the gate that stops it — the project's own
 * "a documented endpoint that 404s" defect class, arriving through the npm door.
 *
 * This is NOT wired into the main CI job. The condition is known, undecided, and
 * harmless until publication; turning every pull request red over it would be
 * pressure, not information. It runs where it bites: immediately before a publish.
 *
 * Resolving it is a decision, not a fix, and this script takes neither side:
 * publish the v1.2 schemas first, or keep the draft layer out of the published
 * build. Either makes this pass.
 *
 *   node scripts/check-schema-ids.mjs                 # build first: pnpm -r build
 *   node scripts/check-schema-ids.mjs --allow-draft   # report, do not fail (local use)
 */
import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const ALLOW_DRAFT = process.argv.includes("--allow-draft");
const ENTRY = join(ROOT, "packages/core/dist/index.js");

if (!existsSync(ENTRY)) {
  console.error(`FAIL  ${ENTRY} not built — run \`pnpm -r build\` first.`);
  process.exit(1);
}

const core = await import(pathToFileURL(ENTRY).href);
const ids = Object.entries(core)
  .filter(([, v]) => typeof v === "string" && v.startsWith("https://"))
  .filter(([k]) => k.endsWith("_SCHEMA_ID"))
  .sort(([a], [b]) => a.localeCompare(b));

if (ids.length === 0) {
  console.error("FAIL  @agenid/core exports no *_SCHEMA_ID constant — has the export surface changed?");
  process.exit(1);
}

const unreachable = [];
for (const [name, url] of ids) {
  let status;
  try {
    // redirect:"follow" — the apex redirects to www, and an installer's fetch would follow it.
    const r = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(20000) });
    status = r.status;
  } catch (e) {
    status = `unreachable (${e.message})`;
  }
  const ok = status === 200;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name.padEnd(26)} ${String(url).padEnd(58)} ${status}`);
  if (!ok) unreachable.push([name, url, status]);
}

if (unreachable.length === 0) {
  console.log(`\nAll ${ids.length} exported schema ids resolve.`);
  process.exit(0);
}

console.error(`\n${unreachable.length} of ${ids.length} exported schema ids do not resolve:`);
for (const [name, url, status] of unreachable) console.error(`  ${name} -> ${url} (${status})`);
console.error(
  "\nPublishing @agenid/core would ship these constants to every installer. They are inside the\n" +
  "signing input of any object that carries them, so they are not links — they are promises.\n" +
  "\nTwo ways forward, and this script prefers neither:\n" +
  "  1. Publish the corresponding JSON Schemas at those URIs before releasing.\n" +
  "  2. Keep the draft layer out of the published build, so the package exports no id it cannot keep.\n",
);
process.exit(ALLOW_DRAFT ? 0 : 1);
