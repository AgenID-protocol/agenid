#!/usr/bin/env node
/**
 * Documentation consistency check.
 *
 * Documentation is testable output. This asserts the claims in the repository's
 * five core documents against the repository and, with --live, against production.
 * It exists because the previous documentation pass shipped six claims that a
 * senior engineer could have disproved in five minutes — a fabricated response
 * shape, a status code that does not exist, a request body for the wrong endpoint,
 * and an error-code table that conflated three separate namespaces.
 *
 *   node scripts/check-docs.mjs          # offline checks
 *   node scripts/check-docs.mjs --live   # also verify every endpoint claim against production
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LIVE = process.argv.includes("--live");
const BASE = "https://www.agenid.com";

const DOCS = [
  "README.md",
  "PROJECT_STATE.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "docs/architecture.md",
  "docs/trust-model.md",
  "docs/threat-model.md",
  "docs/api.md",
];

const failures = [];
const checks = [];
const fail = (what, detail) => failures.push(`${what}: ${detail}`);
const pass = (what) => checks.push(what);

// ---------------------------------------------------------------------------
// 1. Every relative markdown link resolves to a real path.
// ---------------------------------------------------------------------------
let links = 0;
for (const doc of DOCS) {
  const file = join(ROOT, doc);
  if (!existsSync(file)) { fail("missing document", doc); continue; }
  const src = readFileSync(file, "utf-8");
  for (const m of src.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [path] = target.split("#");
    if (!path) continue;
    links++;
    if (!existsSync(resolve(ROOT, dirname(doc), path))) fail("broken link", `${doc} -> ${target}`);
  }
}
pass(`${links} relative links resolve`);

// ---------------------------------------------------------------------------
// 2. Package names claimed in the README match the workspace.
// ---------------------------------------------------------------------------
const pkgDirs = readdirSync(join(ROOT, "packages"));
const realPkgs = pkgDirs.map((d) => JSON.parse(readFileSync(join(ROOT, "packages", d, "package.json"), "utf-8")).name);
const readme = readFileSync(join(ROOT, "README.md"), "utf-8");
for (const name of realPkgs) if (!readme.includes(name)) fail("README omits a package", name);
for (const m of readme.matchAll(/`(@agenid\/[a-z-]+)`/g)) {
  if (!realPkgs.includes(m[1]) && !/adapter-/.test(m[1])) fail("README names a package that does not exist", m[1]);
}
pass(`${realPkgs.length} packages match README (${realPkgs.join(", ")})`);

// ---------------------------------------------------------------------------
// 3. Hosts that must never appear in documentation as live.
// ---------------------------------------------------------------------------
// These hostnames are forbidden outright, with no negation escape hatch, matching
// `packages/web/test/public-surface.test.ts`. Two of them actually reached the live
// site. A checker laxer than the repository's own guard is worse than no checker,
// so documents describe these hostnames rather than writing them out.
// CHANGELOG.md and SECURITY.md are historical records and are excluded, exactly as
// they are from the repository test's PUBLIC_FILES.
const HOST_SCANNED = DOCS.filter((d) => !["CHANGELOG.md", "SECURITY.md"].includes(d));
for (const doc of HOST_SCANNED) {
  const src = readFileSync(join(ROOT, doc), "utf-8");
  for (const [i, line] of src.split("\n").entries()) {
    for (const host of ["agenid.org", "agenid.ai", "api.agenid.com"]) {
      if (line.includes(host)) fail("forbidden host", `${doc}:${i + 1} ${host}`);
    }
  }
}
pass(`no forbidden host in ${HOST_SCANNED.length} scanned documents`);

// ---------------------------------------------------------------------------
// 4. Banned overclaim vocabulary.
// ---------------------------------------------------------------------------
// "not trusted by verifiers" is the opposite of the marketing claim "trusted by
// Fortune 500", so the negated form is explicitly allowed. Same for "never".
const BANNED = [/\bproduction[- ]ready\b/i, /\bgenerally available\b/i, /\benterprise[- ]grade\b/i, /\bSOC ?2\b/, /\bISO ?27001\b/, /(?<!\b(?:not|never|no one is|nobody is) )\btrusted by\b/i, /\bfully (secure|compliant|automated)\b/i, /\b100% (private|secure)\b/i, /\bguaranteed\b/i, /\bbank[- ]grade\b/i];
for (const doc of DOCS) {
  const src = readFileSync(join(ROOT, doc), "utf-8");
  for (const [i, line] of src.split("\n").entries()) {
    if (/never (use|write)|banned|do not use|avoid/i.test(line)) continue;
    for (const re of BANNED) if (re.test(line)) fail("overclaim vocabulary", `${doc}:${i + 1} ${line.trim().slice(0, 90)}`);
  }
}
pass("no overclaim vocabulary");

// ---------------------------------------------------------------------------
// 5. Verification levels documented match the enum that can actually be issued.
// ---------------------------------------------------------------------------
const schemas = readFileSync(join(ROOT, "packages/core/src/schemas.ts"), "utf-8");
const enumBlock = schemas.slice(schemas.indexOf("export const VerificationLevel"), schemas.indexOf("export type VerificationLevel"));
const issuable = [...enumBlock.matchAll(/"(L\d_[A-Z_]+)"/g)].map((m) => m[1]);
if (issuable.includes("L5_CONTINUOUSLY_MONITORED")) fail("L5 is issuable", "it must stay out of the VerificationLevel enum");
for (const doc of ["docs/trust-model.md", "PROJECT_STATE.md"]) {
  const src = readFileSync(join(ROOT, doc), "utf-8");
  if (src.includes("L5") && !/reserved/i.test(src)) fail("L5 mentioned without 'reserved'", doc);
}
pass(`${issuable.length} issuable levels; L5 correctly absent from the enum`);

// ---------------------------------------------------------------------------
// 6. Live endpoint claims (--live).
// ---------------------------------------------------------------------------
// Each entry is a claim this documentation makes. If production disagrees,
// the documentation is the defect.
const CLAIMS = [
  ["GET", "/api/v1/openapi.json", 200, "OpenAPI document is served"],
  ["GET", "/badge.js", 200, "live badge embed"],
  ["GET", "/badge/agenid:01JZZZZZZZZZZZZZZZZZZZZZZZ/shield.svg", 200, "unknown badge renders rather than erroring"],
  ["GET", "/a/agenid:01JZZZZZZZZZZZZZZZZZZZZZZZ", 200, "unknown identifier renders a neutral HTML card"],
  ["GET", "/api/resolve/agenid:01JZZZZZZZZZZZZZZZZZZZZZZZ", 404, "unknown identifier is agent_not_found in JSON"],
  // The registry half of two-path key discovery. A bare 404 would pass here both when the
  // route is deployed and when it does not exist at all, so these assert the error CODE:
  // key_not_found can only come from a route that ran.
  ["GET", "/v1/keys/01JZZZZZZZZZZZZZZZZZZZZZZZ", 404, "key discovery is deployed; unknown key is key_not_found", "key_not_found"],
  ["GET", "/v1/keys?key_id=agenid%3Akey%3A01JZZZZZZZZZZZZZZZZZZZZZZZ", 404, "the query form resolves through the same route", "key_not_found"],
  ["GET", "/v1/keys/not-a-ulid", 400, "a malformed key reference is invalid_key_id", "invalid_key_id"],
  ["GET", "/v1/keys/01JZZZZZZZZZZZZZZZZZZZZZZZ%23z1", 400, "a URI fragment is rejected, never truncated", "invalid_key_id"],
  ["GET", "/v1/keys", 400, "the collection form requires key_id", "invalid_key_id"],
  ["GET", "/.well-known/agenid/authorities.json", 404, "no root key, so no authorities document"],
  ["POST", "/v1/agents/agenid:01JZZZZZZZZZZZZZZZZZZZZZZZ/assertions", 404, "assertion write path is NOT deployed"],
  ["POST", "/api/v1/agents", 400, "registration validates and rejects an empty body"],
  ["POST", "/api/v1/verify", 400, "stateless verify rejects an empty body"],
  ["POST", "/api/dns/verify", 400, "dns verify rejects an empty body"],
  ["POST", "/api/retell/declare", 400, "retell declare rejects an empty body"],
];

if (LIVE) {
  for (const [method, path, expect, why, expectError] of CLAIMS) {
    const init = method === "POST" ? { method, headers: { "content-type": "application/json" }, body: "{}" } : {};
    let status, body;
    try {
      const r = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(20000) });
      status = r.status;
      body = expectError ? await r.text() : null;
    } catch (e) {
      fail("unreachable", `${method} ${path} (${e.message})`);
      continue;
    }
    if (status !== expect) fail("production contradicts documentation", `${method} ${path} expected ${expect} (${why}) got ${status}`);
    // A status code alone cannot distinguish "the documented behaviour" from "no such
    // route". Where the documentation names an error code, assert the code.
    if (expectError) {
      let got;
      try { got = JSON.parse(body).error; } catch { got = `<non-JSON: ${String(body).slice(0, 40)}>`; }
      if (got !== expectError) fail("production contradicts documentation", `${method} ${path} expected error ${expectError} (${why}) got ${got}`);
    }
  }
  pass(`${CLAIMS.length} documented endpoint claims verified against production`);

  // OpenAPI version and paths must match what docs/api.md states.
  try {
    const oa = await (await fetch(BASE + "/api/v1/openapi.json", { signal: AbortSignal.timeout(20000) })).json();
    const api = readFileSync(join(ROOT, "docs/api.md"), "utf-8");
    if (!api.includes(`OpenAPI ${oa.openapi}`)) fail("OpenAPI version mismatch", `live is ${oa.openapi}; docs/api.md does not say so`);
    for (const p of Object.keys(oa.paths)) if (!api.includes(p)) fail("OpenAPI path undocumented", p);
    const n = Object.keys(oa.paths).length;
    if (!api.includes(`${n} of the 13 deployed routes`) && !api.includes(`documents four paths`)) {
      fail("OpenAPI coverage claim", `live document has ${n} paths; docs/api.md does not state the coverage gap`);
    }
    pass(`OpenAPI ${oa.openapi}, ${n} paths, all documented`);
  } catch (e) {
    fail("OpenAPI check failed", e.message);
  }
}

// ---------------------------------------------------------------------------
console.log(checks.map((c) => `  ok  ${c}`).join("\n"));
if (failures.length) {
  console.error(`\n${failures.length} documentation failure(s):`);
  for (const f of failures) console.error(`  FAIL  ${f}`);
  process.exit(1);
}
console.log(`\nDocumentation consistent${LIVE ? " with production" : " (offline checks only; re-run with --live)"}.`);
