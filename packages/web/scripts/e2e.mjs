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
