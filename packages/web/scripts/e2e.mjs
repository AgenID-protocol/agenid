/**
 * Phase 2 §3 end-to-end: real Registry API (in-process) + built Next.js app.
 *   1. Register agent via API → receive agenid:<ULID>
 *   2. GET /v1/keys/{key-ULID} → key document, no fragment truncation
 *   3. GET /a/{agenid} → browser gets the Verification Card HTML; Accept: application/json gets the envelope
 *   plus: /badge.js is served with CORS and references the resolver.
 * Run after `next build`:  node scripts/e2e.mjs
 */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { buildApp } from "@agenid/api";
import {
  generateAgentId, generateKeyId, generateKeyPair, makeKeyDocument, signManifestProof, keyIdToWire,
} from "@agenid/core";

const API_PORT = 3901;
const WEB_PORT = 3900;
const NOW = "2026-09-20T00:00:00Z";
const fail = (m) => { console.error("✗ " + m); process.exitCode = 1; };
const ok = (m) => console.log("✓ " + m);

// --- 1. Registry API
const api = buildApp({ now: () => NOW });
await api.listen({ port: API_PORT, host: "127.0.0.1" });
process.env.AGENID_API_URL = `http://127.0.0.1:${API_PORT}`;
process.env.NEXT_PUBLIC_SITE_URL = `http://127.0.0.1:${WEB_PORT}`;

const agentId = generateAgentId();
const op = generateKeyPair();
const opDoc = makeKeyDocument({ keyId: generateKeyId(), publicKey: op.publicKey, role: "operator", controller: agentId, createdAt: "2026-09-01T00:00:00Z" });
const manifest = {
  manifest_version: "1.0", agent_id: agentId,
  identity: { name: "Sarah", description: "Inbound appointment scheduling assistant" },
  ownership: { operator: "Acme Medical LLC", operator_domain: "acmemedical.com", contact: "trust@acmemedical.com" },
  purpose: { summary: "Schedules and reschedules patient appointments", channels: ["voice", "sms"] },
  disclosure: { is_ai: true, discloses_to_user: true, human_escalation: true },
};
const proof = signManifestProof(manifest, { privateKey: op.privateKey, document: opDoc }, { createdAt: "2026-09-13T00:00:00Z", expiresAt: "2026-12-12T00:00:00Z" });

let r = await fetch(`http://127.0.0.1:${API_PORT}/v1/agents`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ manifest, proof, key_document: opDoc }) });
let j = await r.json();
r.status === 201 && j.agent_id === agentId ? ok(`1. registered ${agentId}`) : fail(`1. register: ${r.status} ${JSON.stringify(j)}`);

// --- 2. Key resolver
r = await fetch(`http://127.0.0.1:${API_PORT}/v1/keys/${keyIdToWire(opDoc.key_id)}`);
j = await r.json();
r.status === 200 && j.public_key_b64u === opDoc.public_key_b64u ? ok(`2. key resolved via /v1/keys/${keyIdToWire(opDoc.key_id)}`) : fail(`2. keys: ${r.status}`);
r = await fetch(`http://127.0.0.1:${API_PORT}/v1/keys/${keyIdToWire(opDoc.key_id)}%23z1`);
r.status === 400 ? ok("2b. percent-encoded fragment → 400 invalid_key_id") : fail(`2b. fragment not rejected: ${r.status}`);

// --- 3. Next.js resolver
const app = next({ dev: false, dir: new URL("..", import.meta.url).pathname });
await app.prepare();
const handle = app.getRequestHandler();
const web = createServer((req, res) => handle(req, res, parse(req.url, true)));
await new Promise((res) => web.listen(WEB_PORT, "127.0.0.1", res));
const W = `http://127.0.0.1:${WEB_PORT}`;

r = await fetch(`${W}/a/${agentId}`, { headers: { accept: "text/html,application/xhtml+xml" } });
const html = await r.text();
const hasCard = r.status === 200 && html.includes("Agent Identity Record") && html.includes("Sarah") && html.includes("acmemedical.com") && html.includes("signature valid");
hasCard ? ok("3a. /a/<agenid> renders the Verification Card (name, domain, Ed25519 status present)") : fail(`3a. card HTML missing expected content (status ${r.status})`);

r = await fetch(`${W}/a/${agentId}`, { headers: { accept: "application/json" } });
const ct = r.headers.get("content-type") ?? "";
j = ct.includes("application/json") ? await r.json() : null;
j && j.agent_id === agentId && j.proof_check?.ok === true && j.verification?.level === "L1_REGISTERED"
  ? ok("3b. /a/<agenid> with Accept: application/json returns the canonical envelope")
  : fail(`3b. JSON negotiation failed (status ${r.status}, content-type ${ct})`);

r = await fetch(`${W}/a/agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y`, { headers: { accept: "text/html" } });
(await r.text()).includes("Not registered") ? ok("3c. unknown id renders the not-registered state") : fail("3c. not-registered state missing");

r = await fetch(`${W}/badge.js`);
const js = await r.text();
r.status === 200 && r.headers.get("access-control-allow-origin") === "*" && js.includes("/api/resolve/") ? ok("3d. /badge.js served with CORS and points at the resolver") : fail("3d. badge.js");

r = await fetch(`${W}/`, { headers: { accept: "text/html" } });
const home = await r.text();
// Asserted on structure, not marketing copy: the previous check pinned an exact H1
// string and went red the moment the hero was rewritten, which says nothing about
// whether the page works. These three are load-bearing — the resolver entry point,
// the identifier format, and the ecosystem entry point.
r.status === 200 && home.includes("agenid-search") && home.includes("agenid:") && home.includes('href="/ecosystem"')
  ? ok("3e. landing page renders (resolver input, identifier, ecosystem link)")
  : fail(`3e. landing page (status ${r.status})`);

r = await fetch(`${W}/ecosystem`, { headers: { accept: "text/html" } });
const eco = await r.text();
// The page must ship the status *definitions* (so "Compatible" can never be read as
// "integrated"), and must carry the no-endorsement line. Both are honesty requirements,
// not decoration — if a redesign drops them, this goes red.
r.status === 200 &&
eco.includes("The Agent Ecosystem") &&
eco.includes("Compatible") &&
eco.includes("Verified Integration") &&
eco.includes("Official Partner") &&
eco.includes("not an endorsement")
  ? ok("3f. /ecosystem renders the matrix with its status definitions and no-endorsement notice")
  : fail(`3f. /ecosystem (status ${r.status})`);

// The web app's own key-discovery route. In this harness AGENID_API_URL is set, so this
// exercises the HTTP-registry resolution mode that the in-process unit tests cannot reach,
// and proves the envelope's registry_path pointer resolves on the same origin that served it.
const wire = keyIdToWire(opDoc.key_id);
r = await fetch(`${W}/v1/keys/${wire}`);
const keyBody = await r.text();
const keyJson = r.status === 200 ? JSON.parse(keyBody) : null;
r.status === 200 && keyJson?.key_id === opDoc.key_id && keyJson?.public_key_b64u === opDoc.public_key_b64u && r.headers.get("access-control-allow-origin") === "*"
  ? ok(`3g. /v1/keys/${wire} serves the key document with CORS`)
  : fail(`3g. web key discovery (status ${r.status})`);

r = await fetch(`${W}/v1/keys?key_id=${encodeURIComponent(opDoc.key_id)}`);
(await r.text()) === keyBody && r.status === 200
  ? ok("3h. the ?key_id= query form returns a byte-identical document (spec §9.2)")
  : fail(`3h. query form disagrees with path form (status ${r.status})`);

r = await fetch(`${W}/v1/keys/${wire}%23z1`);
j = await r.json().catch(() => ({}));
r.status === 400 && j.error === "invalid_key_id" ? ok("3i. percent-encoded fragment → 400 invalid_key_id") : fail(`3i. fragment not rejected: ${r.status}`);

r = await fetch(`${W}/v1/keys/01J8Z3M9Q4XK2P7VBN6TDR8HWE`);
j = await r.json().catch(() => ({}));
r.status === 404 && j.error === "key_not_found" ? ok("3j. unknown key is key_not_found, not agent_not_found") : fail(`3j. unknown key: ${r.status} ${JSON.stringify(j)}`);

// Over real HTTP, so Next.js's own path decoding is in the loop — which is the half a
// unit test can only simulate.
//
// THE PREVIOUS VERSION OF 3l ASSERTED ONLY `status === 400 && error === "invalid_key_id"`,
// AND THAT WAS NOT ENOUGH. Remove the double-encoding protection entirely and this target
// still fails — on the wire-form rule instead — so the check passed while the thing it
// was named after was absent. It now asserts the REASON, which only the raw-target rule
// can produce, and fails if that specific protection disappears.
const doubleEncoded = [...wire].map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`).join("");
r = await fetch(`${W}/v1/keys/agenid%253Akey%253A${wire}`);
j = await r.json().catch(() => ({}));
r.status === 400 && j.error === "invalid_key_id" && /literal wire form/.test(j.message ?? "")
  ? ok("3l. a double-encoded key reference is refused for the right reason, not decoded twice")
  : fail(`3l. double-encoded reference resolved or misreported: ${r.status} ${JSON.stringify(j)}`);

// The defect exactly as production exhibited it: the ULID itself encoded twice. Nothing
// about it resembles a malformed identifier after decoding, so only the raw-target rule
// refuses it. `check:docs --live` asserts the same target against www.agenid.com, which
// is the assertion that actually matters — a check that passes under `next start` while
// production still resolves the attack is not evidence.
r = await fetch(`${W}/v1/keys/${[...doubleEncoded].map((c) => (c === "%" ? "%25" : c)).join("")}`);
j = await r.json().catch(() => ({}));
r.status === 400 && /literal wire form/.test(j.message ?? "")
  ? ok("3o. a twice-encoded key ULID is refused (the exact production defect)")
  : fail(`3o. twice-encoded ULID: ${r.status} ${JSON.stringify(j)}`);

// The platform boundary, asserted rather than assumed: where this app sees the wire
// target, a singly-encoded segment still carries its percent signs and is refused.
r = await fetch(`${W}/v1/keys/${doubleEncoded}`);
j = await r.json().catch(() => ({}));
r.status === 400 && /literal wire form/.test(j.message ?? "")
  ? ok("3p. a singly-encoded path segment is refused where the wire target is visible")
  : fail(`3p. singly-encoded segment: ${r.status} ${JSON.stringify(j)}`);

// No error body on this surface carries the caller's own input back (R-2's rule, checked
// on the Next side of the same protocol surface).
//
// A MALFORMED ESCAPE IS DELIBERATELY ABSENT FROM THIS LIST, and that absence is a
// recorded finding rather than an oversight. `/v1/keys/%ZZ` and `/v1/keys/%` make Next's
// own parameter decoding throw before this route's handler runs, so a self-hosted
// `next start` answers them with an opaque 500. Vercel's edge refuses the same targets
// with its own plain `400 Bad Request` before Next sees them, so production is not
// affected — confirmed by sending the raw target directly. Fixing it belongs to R-6 and
// is out of this round's scope; asserting it here would make a green check contingent on
// work nobody has done.
for (const hostile of ["%3Cscript%3ECANARY918273%3C%2Fscript%3E", "%2523CANARY918273", "%25", "%252F"]) {
  r = await fetch(`${W}/v1/keys/${hostile}`);
  const t = await r.text();
  if (r.status !== 400 || t.includes("CANARY") || t.includes("script")) {
    fail(`3q. ${hostile} reflected or misreported: ${r.status} ${t.slice(0, 120)}`);
  }
}
if (!process.exitCode) ok("3q. hostile targets are 400 and echo nothing back");

// R-3: the collection resource is read-only and says so, on this framework too.
r = await fetch(`${W}/v1/keys`, { method: "POST" });
r.status === 405 && r.headers.get("allow") === "GET, OPTIONS"
  ? ok("3r. POST /v1/keys is 405 with Allow on the collection resource")
  : fail(`3r. collection method semantics: ${r.status} allow=${r.headers.get("allow")}`);

r = await fetch(`${W}/v1/keys`, { method: "OPTIONS" });
r.status === 204 && r.headers.get("access-control-allow-methods") === "GET, OPTIONS"
  ? ok("3s. the preflight advertises exactly the methods the resource supports")
  : fail(`3s. preflight: ${r.status} methods=${r.headers.get("access-control-allow-methods")}`);

r = await fetch(`${W}/v1/keys?key_id=${encodeURIComponent(opDoc.key_id)}&key_id=${encodeURIComponent(opDoc.key_id)}`);
j = await r.json().catch(() => ({}));
r.status === 400 && j.error === "invalid_key_id"
  ? ok("3m. a repeated key_id is refused as ambiguous, never first-won")
  : fail(`3m. duplicate key_id was resolved: ${r.status} ${JSON.stringify(j)}`);

r = await fetch(`${W}/v1/keys/${wire}`, { method: "POST" });
r.status === 405 && r.headers.get("allow") === "GET, OPTIONS" && r.headers.get("access-control-allow-origin") === "*"
  ? ok("3n. POST is 405 with Allow and CORS, and reaches no business logic")
  : fail(`3n. 405 semantics: ${r.status} allow=${r.headers.get("allow")} cors=${r.headers.get("access-control-allow-origin")}`);

r = await fetch(`${W}/a/${agentId}`, { headers: { accept: "application/json" } });
const env = await r.json();
env.operator_key?.discovery?.registry_path === `/v1/keys/${wire}` && !/not (served|deployed)/i.test(env.verify_instructions ?? "")
  ? ok("3k. the envelope advertises the registry path and no longer disclaims it")
  : fail("3k. envelope key-discovery pointer or verify_instructions is stale");

await new Promise((res) => web.close(res));
await api.close();
await app.close();
console.log(process.exitCode ? "\nE2E FAILED" : "\nE2E PASSED");
process.exit(process.exitCode ?? 0);
