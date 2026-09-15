/**
 * The 60-second issuance path, end to end, against the real route handler and a real
 * MemoryStore — no mocked crypto and no mocked verification anywhere in this file.
 *
 * The point of these tests is the class of bug this repo has actually shipped before: a
 * route that reports a verification outcome it never computed. So the assertions are
 * mostly adversarial — tamper with the manifest, swap the key, claim the wrong role — and
 * the passing case asserts the level is exactly L1_REGISTERED and nothing above it.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { MemoryStore } from "@agenid/api";
import { generateKeyPair, signAgent } from "../lib/client-crypto";

// The route resolves its store through lib/api's getStore(). Pin it to one MemoryStore
// per test so registrations are real writes that a later read can actually observe.
const store = new MemoryStore();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, API_URL: undefined, SITE_URL: "https://www.agenid.com", getStore: () => store };
});

const INPUT = {
  operator: "Acme Health, Inc.",
  operatorDomain: "acmehealth.com",
  purposeSummary: "Books and reschedules patient appointments.",
  disclosesToUser: true,
  humanEscalation: true,
  channels: ["voice" as const],
};

async function post(body: unknown) {
  const { POST } = await import("../app/api/v1/agents/route");
  const res = await POST(new Request("https://www.agenid.com/api/v1/agents", { method: "POST", body: JSON.stringify(body) }));
  return { res, json: (await res.json()) as Record<string, unknown> };
}

async function freshRegistration() {
  const keyPair = generateKeyPair();
  const signed = await signAgent(keyPair, "Sunny — Front Desk Scheduler", INPUT);
  return {
    keyPair,
    signed,
    body: { manifest: signed.manifest, proof: signed.proof, key_document: signed.keyDocument },
  };
}

/** Source with comments stripped: the honesty contract must hold over executable code,
 *  not over a docblock that happens to quote the thing it forbids. */
function code(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("POST /api/v1/agents", () => {
  beforeEach(() => {
    // MemoryStore has no reset; swap its backing maps between tests.
    Object.assign(store, new MemoryStore());
  });

  it("registers a browser-signed agent at exactly L1_REGISTERED", async () => {
    const { body, signed } = await freshRegistration();
    const { res, json } = await post(body);

    expect(res.status).toBe(201);
    expect(json.agent_id).toBe(signed.agentId);
    expect((json.verification as { level: string }).level).toBe("L1_REGISTERED");
    expect((json.manifest_digest as { value: string }).value).toBe(signed.manifestDigest);
    expect(json.links).toMatchObject({ card: `/a/${signed.agentId}`, envelope: `/api/resolve/${signed.agentId}` });
  });

  it("the 201 carries the disclosure that L1 is not a third-party check", async () => {
    const { body } = await freshRegistration();
    const { json } = await post(body);
    const disclosures = (json.disclosures as string[]).join(" ");
    expect(disclosures).toMatch(/not a third-party verification/i);
    expect(disclosures).toMatch(/root authority key ceremony has not been performed/i);
  });

  it("persists public material the resolver can read back", async () => {
    const { body, signed } = await freshRegistration();
    await post(body);

    const record = await store.getAgent(signed.agentId);
    expect(record?.manifest_digest).toBe(signed.manifestDigest);
    const key = await store.getKey(signed.keyId);
    expect(key?.role).toBe("operator");
    expect(key?.controller).toBe(signed.agentId);
  });

  it("stores no private key material anywhere in the record", async () => {
    const { body, signed, keyPair } = await freshRegistration();
    await post(body);

    const seedHex = Buffer.from(keyPair.privateKey).toString("hex");
    const dumped = JSON.stringify([await store.getAgent(signed.agentId), await store.getKey(signed.keyId)]);
    expect(dumped).not.toContain(seedHex);
    expect(dumped).not.toContain(Buffer.from(keyPair.privateKey).toString("base64"));
    expect(dumped.toLowerCase()).not.toMatch(/private_key|"seed"|secret_key/);
  });

  it("rejects a manifest tampered with after signing", async () => {
    const { body } = await freshRegistration();
    (body.manifest as { ownership: { operator: string } }).ownership.operator = "Someone Else, Inc.";

    const { res, json } = await post(body);
    expect(res.status).toBe(400);
    // The digest in the proof no longer matches the manifest presented.
    expect(String(json.error)).toMatch(/digest|proof|signature/i);
  });

  it("rejects a proof signed by a different key than the one published", async () => {
    const { body } = await freshRegistration();
    const attacker = generateKeyPair();
    (body.key_document as { public_key_b64u: string }).public_key_b64u = attacker.publicKeyB64u;

    const { res } = await post(body);
    expect(res.status).toBe(400);
  });

  it("refuses an authority-role key at registration", async () => {
    const { body } = await freshRegistration();
    // A well-formed authority KeyDocument, so this gets past schema validation and is
    // actually tested against the role rule rather than being caught as malformed.
    const kd = body.key_document as Record<string, unknown>;
    kd.role = "authority";
    kd.controller = "agenid:authority:agenid";

    const { res, json } = await post(body);
    expect(res.status).toBe(400);
    expect(json.error).toBe("key_role_mismatch");
  });

  it("refuses a key that controls a different agent", async () => {
    const { body } = await freshRegistration();
    (body.key_document as { controller: string }).controller = "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y";

    const { res, json } = await post(body);
    expect(res.status).toBe(400);
    expect(json.error).toBe("key_controller_mismatch");
  });

  it("refuses unknown top-level members instead of ignoring them", async () => {
    const { body } = await freshRegistration();
    const { res, json } = await post({ ...body, verification: { level: "L4_DEPLOYMENT_VERIFIED" } });

    expect(res.status).toBe(400);
    expect(json.error).toBe("schema_validation_failed");
  });

  it("refuses a reserved manifest key (strict schema, v1.1.1)", async () => {
    const { body } = await freshRegistration();
    (body.manifest as Record<string, unknown>).permissions = ["send_email"];

    const { res, json } = await post(body);
    expect(res.status).toBe(400);
    expect(json.error).toBe("schema_validation_failed");
  });

  it("is idempotent-safe: a replayed registration is a 409, not a silent overwrite", async () => {
    const { body } = await freshRegistration();
    expect((await post(body)).res.status).toBe(201);

    const { res, json } = await post(body);
    expect(res.status).toBe(409);
    expect(json.error).toBe("agent_exists");
  });
});

/**
 * Regression guard for the bug that made the first version of this flow fail every time:
 * the registry truncated its own clock to whole seconds, so a proof signed and posted in
 * the same second was always "from the future" and rejected as not_yet_valid.
 */
describe("registration clock policy", () => {
  beforeEach(() => {
    Object.assign(store, new MemoryStore());
  });

  it("accepts a proof signed milliseconds ago (the same-second case that used to fail)", async () => {
    const keyPair = generateKeyPair();
    // .999 in the second: truncating the server clock would put `now` 999ms behind this.
    const signedAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 999);
    const signed = await signAgent(keyPair, "Edge Of Second", INPUT, { now: signedAt });

    const { res } = await post({ manifest: signed.manifest, proof: signed.proof, key_document: signed.keyDocument });
    expect(res.status).toBe(201);
  });

  it("records registered_at from the registry's clock, never the client's", async () => {
    const keyPair = generateKeyPair();
    const signedAt = new Date(Date.now() + 60_000); // inside the skew window, but ahead
    const signed = await signAgent(keyPair, "Slightly Fast Clock", INPUT, { now: signedAt });

    const { res, json } = await post({ manifest: signed.manifest, proof: signed.proof, key_document: signed.keyDocument });
    expect(res.status).toBe(201);
    expect(Date.parse(String(json.registered_at))).toBeLessThan(signedAt.getTime());
  });

  it("refuses a clock far enough ahead to be a real problem, and says so", async () => {
    const keyPair = generateKeyPair();
    const signed = await signAgent(keyPair, "Very Fast Clock", INPUT, { now: new Date(Date.now() + 60 * 60_000) });

    const { res, json } = await post({ manifest: signed.manifest, proof: signed.proof, key_document: signed.keyDocument });
    expect(res.status).toBe(400);
    expect(json.error).toBe("clock_skew_too_large");
    expect(String(json.message)).toMatch(/system time/i);
  });

  it("a proof from the past is still evaluated against the registry's own clock", async () => {
    const keyPair = generateKeyPair();
    // Signed 91 days ago: past its 90-day expires_at, so it must be refused as expired.
    const signed = await signAgent(keyPair, "Stale Proof", INPUT, { now: new Date(Date.now() - 91 * 86_400_000) });

    const { res, json } = await post({ manifest: signed.manifest, proof: signed.proof, key_document: signed.keyDocument });
    expect(res.status).toBe(400);
    expect(String(json.error)).toMatch(/expired/i);
  });
});

describe("issuance surfaces make no claim above L1", () => {
  const FILES = [
    "../app/api/v1/agents/route.ts",
    "../components/IssueWizard.tsx",
    "../app/issue/page.tsx",
    "../app/badge/[agenid]/shield.svg/route.ts",
  ];

  it("no issuance surface asserts L2/L3/L4/L5 as an outcome it produces", () => {
    for (const f of FILES) {
      const src = code(f);
      // Mapping tables and rejection paths may NAME higher levels; none may be assigned
      // as this flow's own result.
      expect(src, f).not.toMatch(/level:\s*["']L[2-5]_/);
      expect(src, f).not.toMatch(/L5_CONTINUOUSLY_MONITORED/);
    }
  });

  it("the wizard never puts the private key in a request body or browser storage", () => {
    const src = code("../components/IssueWizard.tsx");
    expect(src).not.toMatch(/localStorage|sessionStorage|indexedDB/);
    // The only fetch in the component sends exactly the three public members.
    expect(src).toMatch(/body: JSON\.stringify\(\{\s*manifest[\s\S]{0,200}?key_document: signed\.keyDocument,/);
    expect(src).not.toMatch(/privateKey[\s\S]{0,80}(fetch|JSON\.stringify\(\{[\s\S]{0,40}proof)/);
  });

  it("the client never imports a server-side key generator", () => {
    const src = code("../components/IssueWizard.tsx");
    expect(src).toMatch(/from "@\/lib\/client-crypto"/);
    expect(src).not.toMatch(/node:crypto|key-encryption/);
  });
});
