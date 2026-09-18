/**
 * POST /api/retell/bind — the fleet batch wrapper, against the real route handler and a
 * real MemoryStore. No mocked crypto, no mocked verification.
 *
 * This endpoint used to be a SECOND registry: raw Supabase upserts, its own clock, no
 * event ledger, no key-substitution check. It now delegates every agent to
 * lib/register.ts, so these tests assert two things — that a batch really registers, and
 * that the adversarial cases the canonical route rejects are rejected here identically.
 * A wrapper that is laxer than the thing it wraps is the same defect as a second registry.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryStore } from "@agenid/api";
import { generateKeyPair, signAgentFleet } from "../lib/client-crypto";
import { __resetMemoryLimiter } from "../lib/rate-limit";

const store = new MemoryStore();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, API_URL: undefined, SITE_URL: "https://www.agenid.com", getStore: () => store };
});

const ATTESTATIONS = {
  operator: "Acme Health, Inc.",
  operatorDomain: "acmehealth.com",
  purposeSummary: "Books and reschedules patient appointments.",
  contact: "ops@acmehealth.com",
  // Explicitly false: these are behavioral claims, and a fixture that defaults them true
  // is how a defaulted attestation stops looking wrong in review.
  disclosesToUser: false,
  humanEscalation: false,
};

async function post(body: unknown) {
  const { POST } = await import("../app/api/retell/bind/route");
  const res = await POST(
    new Request("https://www.agenid.com/api/retell/bind", { method: "POST", body: JSON.stringify(body) }),
  );
  return { res, json: (await res.json()) as Record<string, unknown> };
}

async function fleet(names: string[]) {
  const keyPair = generateKeyPair();
  const signed = await signAgentFleet(
    keyPair,
    names.map((n, i) => ({ agent_id: `retell_${i}`, agent_name: n })),
    ATTESTATIONS,
  );
  return {
    keyPair,
    signed,
    agents: signed.map((b) => ({
      manifest: b.manifest,
      proof: b.proof,
      key_document: b.keyDocument,
      retell_agent_id: b.retellAgentId,
      agent_name: b.agentName,
    })),
  };
}

beforeEach(() => {
  // This route is rate limited now. Without resetting the limiter between tests the
  // suite accumulates hits under a single client key and later tests get a 429 for
  // reasons that have nothing to do with what they assert.
  __resetMemoryLimiter();
  (store as unknown as { agents: Map<string, unknown> }).agents?.clear?.();
  (store as unknown as { keys: Map<string, unknown> }).keys?.clear?.();
  (store as unknown as { events: unknown[] }).events?.splice?.(0);
});

describe("POST /api/retell/bind", () => {
  it("registers a whole fleet and reports the protocol level, not a made-up one", async () => {
    const { agents } = await fleet(["Sunny", "Rory"]);
    const { res, json } = await post({ domain: "acmehealth.com", agents });

    expect(res.status).toBe(201);
    expect(json.level).toBe("L1_REGISTERED");
    expect((json.agents as unknown[]).length).toBe(2);
    expect(json.persisted).toBe(true);
  });

  it("never reports a level above L1", async () => {
    const { agents } = await fleet(["Sunny"]);
    const { json } = await post({ domain: "acmehealth.com", agents });
    expect(String(json.level)).not.toMatch(/L[2-5]_|VERIFIED|AUTHORIZED/);
  });

  it("persists each agent where the resolver can read it back", async () => {
    const { agents } = await fleet(["Sunny", "Rory"]);
    const { json } = await post({ domain: "acmehealth.com", agents });

    for (const a of json.agents as Array<{ agent_id: string }>) {
      const rec = await store.getAgent(a.agent_id);
      expect(rec, `${a.agent_id} should be stored`).toBeTruthy();
    }
  });

  it("writes the ledger events the canonical route writes", async () => {
    const { agents } = await fleet(["Sunny"]);
    const { json } = await post({ domain: "acmehealth.com", agents });
    const id = (json.agents as Array<{ agent_id: string }>)[0].agent_id;

    const events = await store.listEvents(id);
    expect(events.map((e) => e.type).sort()).toEqual(["agent.registered", "key.published"]);
  });

  it("stores no private key material anywhere in the record", async () => {
    const { agents } = await fleet(["Sunny"]);
    const { json } = await post({ domain: "acmehealth.com", agents });
    const id = (json.agents as Array<{ agent_id: string }>)[0].agent_id;

    const dump = JSON.stringify(await store.getAgent(id));
    expect(dump).not.toMatch(/private/i);
  });

  it("rejects a manifest tampered with after signing", async () => {
    const { agents } = await fleet(["Sunny"]);
    const tampered = structuredClone(agents) as unknown as Array<{ manifest: { identity: { name: string } } }>;
    tampered[0].manifest.identity.name = "Definitely Not Sunny";

    const { res, json } = await post({ domain: "acmehealth.com", agents: tampered });
    expect(res.status).toBe(400);
    expect(json.error).toBe("manifest_digest_mismatch");
  });

  it("refuses an authority-role key, exactly as the canonical route does", async () => {
    const { agents } = await fleet(["Sunny"]);
    const swapped = structuredClone(agents);
    swapped[0].key_document.role = "authority";

    const { res, json } = await post({ domain: "acmehealth.com", agents: swapped });
    expect(res.status).toBe(400);
    // Refused at the schema layer (the KeyDocument for an authority role does not
    // validate as written here) rather than at the explicit role check. Either is a
    // correct refusal; what matters is that an authority-role key cannot register an
    // agent through the batch wrapper, so the assertion is on the outcome.
    expect(["key_role_mismatch", "schema_validation_failed"]).toContain(json.error);
  });

  it("fails the batch rather than reporting a partial success", async () => {
    const { agents } = await fleet(["Sunny", "Rory"]);
    const mixed = structuredClone(agents) as unknown as Array<{ manifest: { identity: { name: string } } }>;
    mixed[1].manifest.identity.name = "Tampered";

    const { res, json } = await post({ domain: "acmehealth.com", agents: mixed });
    expect(res.status).toBe(400);
    expect(json.index).toBe(1);
    expect(json).toHaveProperty("registered_before_failure");
  });

  it("requires a domain and a non-empty agent list", async () => {
    expect((await post({ agents: [] })).res.status).toBe(400);
    expect((await post({ domain: "acmehealth.com", agents: [] })).res.status).toBe(400);
  });

  it("rejects an agent submission missing any of the three canonical members", async () => {
    const { agents } = await fleet(["Sunny"]);
    const incomplete = [{ manifest: agents[0].manifest, proof: agents[0].proof }];

    const { res, json } = await post({ domain: "acmehealth.com", agents: incomplete });
    expect(res.status).toBe(400);
    expect(json.error).toBe("incomplete_agent");
  });
});

/**
 * Regression: the batch write path must send CORS on its RESPONSES, not only on the
 * OPTIONS preflight. It answered preflight with `access-control-allow-origin: *` while
 * its actual responses carried none, so a cross-origin browser POST cleared preflight
 * and was then rejected at the response stage — and the two public write endpoints
 * disagreed with each other about whether they were browser-callable.
 */
describe("retell/bind CORS", () => {
  it("sends access-control-allow-origin on a response, not only on the preflight", async () => {
    const { res } = await post({});
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("the preflight and the response agree", async () => {
    const { OPTIONS } = await import("../app/api/retell/bind/route");
    const pre = await OPTIONS();
    const { res } = await post({});
    expect(res.headers.get("access-control-allow-origin")).toBe(pre.headers.get("access-control-allow-origin"));
  });
});
