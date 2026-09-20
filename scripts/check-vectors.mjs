#!/usr/bin/env node
/**
 * Spec-sync check: the normative artifacts in this repository must be byte-identical
 * to the ones published by AgenID-protocol/spec.
 *
 * The specification is the source of truth. This repository holds two copies of
 * normative material for practical reasons — the §8 conformance vectors, so the core
 * suite can run offline, and the five JSON Schemas, so agenid.com can serve the
 * `$id` URLs the signed objects point at. A copy is a place drift hides.
 *
 * It hid there once already: the fixture was a stale snapshot missing the spec's
 * `rejections` block, and nothing failed, because the five rejection cases had been
 * hand-written into the suite instead of driven from the fixture. The cases are now
 * driven from the fixture, and this check keeps the fixture honest.
 *
 * Network-dependent by design: it reads the spec repository, so it runs as its own
 * CI job rather than inside the offline documentation check.
 *
 *   node scripts/check-vectors.mjs
 *   node scripts/check-vectors.mjs --ref <git-ref>    # default: main
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const refFlag = process.argv.indexOf("--ref");
const REF = refFlag !== -1 ? process.argv[refFlag + 1] : "main";
const RAW = `https://raw.githubusercontent.com/AgenID-protocol/spec/${REF}`;

/** local path in this repository  ->  path inside AgenID-protocol/spec */
const MIRRORED = [
  ["packages/core/tests/fixtures/v1_1_1_vectors.json", "vectors/v1.1.1-vectors.json"],
  ["packages/web/public/schemas/v1.1.1/manifest.json", "schemas/manifest.json"],
  ["packages/web/public/schemas/v1.1.1/manifest-proof.json", "schemas/manifest-proof.json"],
  ["packages/web/public/schemas/v1.1.1/assertion.json", "schemas/assertion.json"],
  ["packages/web/public/schemas/v1.1.1/keys.json", "schemas/keys.json"],
  ["packages/web/public/schemas/v1.1.1/authorities.json", "schemas/authorities.json"],
];

const failures = [];
const checks = [];

for (const [local, upstream] of MIRRORED) {
  const file = join(ROOT, local);
  if (!existsSync(file)) {
    failures.push(`missing local copy: ${local}`);
    continue;
  }
  const url = `${RAW}/${upstream}`;
  let canonical;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) { failures.push(`spec unreachable: ${url} -> HTTP ${r.status}`); continue; }
    canonical = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    failures.push(`spec unreachable: ${url} (${e.message})`);
    continue;
  }
  const mine = readFileSync(file);
  if (!mine.equals(canonical)) {
    // Say WHICH keys drifted, so the failure is actionable rather than "bytes differ".
    let detail = `${mine.length} bytes here, ${canonical.length} upstream`;
    try {
      const a = JSON.parse(mine.toString("utf-8"));
      const b = JSON.parse(canonical.toString("utf-8"));
      const differing = [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      if (differing.length) detail += `; differing top-level keys: ${differing.join(", ")}`;
    } catch { /* not JSON, or unparseable: the byte counts are the detail */ }
    failures.push(`drifted from the specification: ${local} vs ${upstream} (${detail})`);
    continue;
  }
  checks.push(`${local} is byte-identical to spec@${REF}:${upstream}`);
}

console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
if (failures.length) {
  console.error(`\n${failures.length} spec-sync failure(s):`);
  for (const f of failures) console.error(`  FAIL  ${f}`);
  console.error(
    "\nThe specification is the source of truth. Update the copy in this repository to match it;\n" +
    "never edit the specification to satisfy this repository.",
  );
  process.exit(1);
}
console.log(`\n${checks.length} normative artifacts match AgenID-protocol/spec@${REF}.`);
