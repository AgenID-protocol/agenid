/**
 * The opt-in agent directory: consent verification, the route, and the honesty rules
 * around it. Real Ed25519 and a real MemoryStore throughout — no mocked crypto.
 *
 * New file, per the concurrent-session rule.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { MemoryStore } from "@agenid/api";
import { generateKeyPair, signAgent, signDirectoryConsent, keyPairFromPrivateHex, hexEncode } from "../lib/client-crypto";
import {
  applyDirectoryConsent,
  CONSENT_WINDOW_MS,
  DIRECTORY_CONSENT_TYPE,
  MemoryDirectoryStore,
  __setDirectoryStore,
} from "../lib/directory";
import { registerAgent } from "../lib/register";
import { __resetMemoryLimiter } from "../lib/rate-limit";

const store = new MemoryStore();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, API_URL: undefined, SITE_URL: "https://www.agenid.com", getStore: () => store };
});

const INPUT = {
  operator: "Example Operator LLC",
  operatorDomain: "example.com",
  purposeSummary: "Answers scheduling calls.",
  disclosesToUser: false,
  humanEscalation: false,
  channels: ["voice" as const],
};

let directory: MemoryDirectoryStore;

async function registered() {
  const keyPair = generateKeyPair();
  const signed = await signAgent(keyPair, "Directory Test Agent", INPUT);
  const r = await registerAgent({ manifest: signed.manifest, proof: signed.proof, key_document: signed.keyDocument });
  expect(r.ok).toBe(true);
  return { keyPair, agentId: signed.agentId, keyId: signed.keyId };
}

const WEB = new URL("..", import.meta.url);
const code = (rel: string) =>
  readFileSync(new URL(rel, WEB), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

beforeEach(() => {
  Object.assign(store, new MemoryStore());
  directory = new MemoryDirectoryStore();
  __setDirectoryStore(directory);
  __resetMemoryLimiter();
});

describe("directory consent — verification", () => {
  it("the browser signer and the registry agree on the consent type", () => {
    const kp = generateKeyPair();
    const c = signDirectoryConsent(kp, "agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC", "agenid:key:01J8Z3P2K8VW4RN7XTQ6MYD5HC", true);
    expect(c.type).toBe(DIRECTORY_CONSENT_TYPE);
  });

  it("lists an agent when its operator key signs a fresh consent, then delists it", async () => {
    const { keyPair, agentId, keyId } = await registered();
    const listed = await applyDirectoryConsent(signDirectoryConsent(keyPair, agentId, keyId, true), { store, directory });
    expect(listed.ok).toBe(true);
    expect((await directory.listListed(10)).map((r) => r.agent_id)).toEqual([agentId]);

    const later = new Date(Date.now() + 1000);
    const removed = await applyDirectoryConsent(signDirectoryConsent(keyPair, agentId, keyId, false, later), { store, directory, now: later });
    expect(removed.ok).toBe(true);
    expect(await directory.listListed(10)).toEqual([]);
  });

  it("keeps the signed consent verbatim, so it can be re-verified", async () => {
    const { keyPair, agentId, keyId } = await registered();
    const consent = signDirectoryConsent(keyPair, agentId, keyId, true);
    await applyDirectoryConsent(consent, { store, directory });
    expect((await directory.get(agentId))?.consent).toEqual(consent);
  });

  it("refuses a consent signed by any other key — nobody can list someone else's agent", async () => {
    const { agentId, keyId } = await registered();
    const stranger = generateKeyPair();
    const r = await applyDirectoryConsent(signDirectoryConsent(stranger, agentId, keyId, true), { store, directory });
    expect(r).toMatchObject({ ok: false, status: 403, error: "signature_invalid" });
    expect(await directory.listListed(10)).toEqual([]);
  });

  it("refuses another agent's operator key even when its signature is valid", async () => {
    const a = await registered();
    const b = await registered();
    const r = await applyDirectoryConsent(signDirectoryConsent(b.keyPair, a.agentId, b.keyId, true), { store, directory });
    expect(r).toMatchObject({ ok: false, status: 403, error: "key_not_operator" });
  });

  it("refuses a tampered consent", async () => {
    const { keyPair, agentId, keyId } = await registered();
    const c = signDirectoryConsent(keyPair, agentId, keyId, false);
    const r = await applyDirectoryConsent({ ...c, listed: true }, { store, directory });
    expect(r).toMatchObject({ ok: false, error: "signature_invalid" });
  });

  it("refuses a stale consent and a replayed one", async () => {
    const { keyPair, agentId, keyId } = await registered();
    const old = new Date(Date.now() - CONSENT_WINDOW_MS - 60_000);
    expect(await applyDirectoryConsent(signDirectoryConsent(keyPair, agentId, keyId, true, old), { store, directory })).toMatchObject({
      ok: false,
      error: "consent_expired",
    });

    const t0 = new Date();
    const listIt = signDirectoryConsent(keyPair, agentId, keyId, true, t0);
    expect((await applyDirectoryConsent(listIt, { store, directory, now: t0 })).ok).toBe(true);
    const t1 = new Date(t0.getTime() + 2000);
    expect((await applyDirectoryConsent(signDirectoryConsent(keyPair, agentId, keyId, false, t1), { store, directory, now: t1 })).ok).toBe(true);
    // Replaying the captured "list it" after the operator delisted must not relist.
    const replay = await applyDirectoryConsent(listIt, { store, directory, now: new Date(t1.getTime() + 1000) });
    expect(replay).toMatchObject({ ok: false, status: 409, error: "consent_superseded" });
    expect(await directory.listListed(10)).toEqual([]);
  });

  it("refuses an unregistered agent and unknown members", async () => {
    const kp = generateKeyPair();
    const r = await applyDirectoryConsent(
      signDirectoryConsent(kp, "agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC", "agenid:key:01J8Z3P2K8VW4RN7XTQ6MYD5HC", true),
      { store, directory },
    );
    expect(r).toMatchObject({ ok: false, status: 404, error: "agent_not_found" });
    const { keyPair, agentId, keyId } = await registered();
    const extra = { ...signDirectoryConsent(keyPair, agentId, keyId, true), level: "L2_DOMAIN_VERIFIED" };
    expect(await applyDirectoryConsent(extra, { store, directory })).toMatchObject({ ok: false, status: 400 });
  });

  it("a key file round-trips to the same signer", () => {
    const kp = generateKeyPair();
    const again = keyPairFromPrivateHex(hexEncode(kp.privateKey));
    expect(again.publicKeyB64u).toBe(kp.publicKeyB64u);
  });
});

describe("POST /api/v1/directory", () => {
  async function post(body: unknown) {
    const { POST } = await import("../app/api/v1/directory/route");
    const res = await POST(new Request("https://www.agenid.com/api/v1/directory", { method: "POST", body: JSON.stringify(body) }));
    return { res, json: (await res.json()) as Record<string, unknown> };
  }

  it("lists through the route and the GET reflects it, with no level claimed by the listing", async () => {
    const { keyPair, agentId, keyId } = await registered();
    const { res, json } = await post(signDirectoryConsent(keyPair, agentId, keyId, true));
    expect(res.status).toBe(200);
    expect(json.listed).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/L[1-5]_[A-Z_]+/);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");

    const { GET } = await import("../app/api/v1/directory/route");
    const list = (await (await GET()).json()) as { agents: { agent_id: string }[] };
    expect(list.agents.map((a) => a.agent_id)).toEqual([agentId]);
  });

  it("400s on a malformed body without echoing it", async () => {
    const { res, json } = await post({ type: "nope", agent_id: "<script>" });
    expect(res.status).toBe(400);
    expect(JSON.stringify(json)).not.toMatch(/<script>/);
  });
});

describe("directory — honesty and safety", () => {
  it("the migration enables RLS and exposes only listed rows to the public", () => {
    const sql = readFileSync(new URL("../../api/supabase/migrations/0005_directory_listings.sql", import.meta.url), "utf8");
    expect(sql).toMatch(/alter table directory_listings enable row level security/);
    expect(sql).toMatch(/for select\s+using \(listed = true\)/);
    expect(sql).not.toMatch(/for (insert|update|delete|all)/i);
  });

  it("registration never lists an agent by itself", () => {
    expect(code("lib/register.ts")).not.toMatch(/directory/i);
  });

  it("nothing in the UI consents on the operator's behalf", () => {
    for (const f of ["components/DirectoryConsent.tsx", "components/IssueWizard.tsx"]) {
      // No effect may sign or submit a consent: listing happens only on a click.
      const effects = [...code(f).matchAll(/useEffect\(([\s\S]*?)\}\s*,\s*\[/g)].map((m) => m[1]!);
      for (const e of effects) expect(e, f).not.toMatch(/signDirectoryConsent|\/api\/v1\/directory|submit\(/);
    }
    // The only calls that list an agent are behind an explicit click.
    const consent = code("components/DirectoryConsent.tsx");
    expect((consent.match(/submit\(keyPair, agentId, keyId, true\)/g) ?? []).length).toBe(1);
    expect(consent).toMatch(/onClick=\{async \(\) => \{\s*setState\(\{ kind: "busy" \}\);\s*setState\(await submit\(keyPair, agentId, keyId, true\)\)/);
  });

  it("the private key never leaves the browser — only the signed consent is posted", () => {
    const src = code("components/DirectoryConsent.tsx");
    const body = src.match(/body:\s*JSON\.stringify\((\w+)\)/);
    expect(body?.[1]).toBe("consent");
    expect(src).not.toMatch(/private_key_hex[^\n]*fetch|fetch[^\n]*private/);
  });

  it("the directory page states that listing is not endorsement and decides no trust state itself", () => {
    const page = code("app/agents/page.tsx");
    expect(page).toMatch(/DIRECTORY_DISCLOSURES/);
    expect(page).toMatch(/presentEnvelopeTrust\(envelope\)/);
    expect(page).not.toMatch(/\b(mint|emerald|text-amber|pill-ok|pill-warn)\b/);
    expect(page).toMatch(/not an empty directory/);
  });
});
