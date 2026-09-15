/**
 * Registry API integration tests (Phase 2 §3): register → resolve keys → assertions → envelope.
 * Uses @agenid/core to generate real keys and real signatures; nothing is mocked.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateAgentId,
  generateKeyId,
  generateAssertionId,
  generateKeyPair,
  makeKeyDocument,
  signManifestProof,
  signVerificationAssertion,
  manifestDigestHex,
  keyIdToWire,
  ASSERTION_SCHEMA_ID,
  type SigningKey,
} from "@agenid/core";
import { buildApp } from "../src/app.js";

const NOW = "2026-09-20T00:00:00Z";
const TOKEN = "test-authority-token";
const app = buildApp({ authorityToken: TOKEN, now: () => NOW });

const agentId = generateAgentId();
const op = generateKeyPair();
const opDoc = makeKeyDocument({ keyId: generateKeyId(), publicKey: op.publicKey, role: "operator", controller: agentId, createdAt: "2026-09-01T00:00:00Z" });
const opKey: SigningKey = { privateKey: op.privateKey, document: opDoc };

const au = generateKeyPair();
const auDoc = makeKeyDocument({ keyId: generateKeyId(), publicKey: au.publicKey, role: "authority", controller: "agenid:authority:node-01", createdAt: "2026-09-01T00:00:00Z" });
const auKey: SigningKey = { privateKey: au.privateKey, document: auDoc };

const manifest = {
  manifest_version: "1.0",
  agent_id: agentId,
  identity: { name: "Sarah", description: "Inbound appointment scheduling assistant" },
  ownership: { operator: "Acme Medical LLC", operator_domain: "acmemedical.com", contact: "trust@acmemedical.com" },
  purpose: { summary: "Schedules and reschedules patient appointments", channels: ["voice", "sms"] },
  disclosure: { is_ai: true, discloses_to_user: true, human_escalation: true },
};
const proof = signManifestProof(manifest, opKey, { createdAt: "2026-09-13T00:00:00Z", expiresAt: "2026-12-12T00:00:00Z" });

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("1. Register agent via API → receive agenid:<ULID>", () => {
  it("POST /v1/agents returns 201 with the agent_id and L1", async () => {
    const r = await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest, proof, key_document: opDoc } });
    expect(r.statusCode).toBe(201);
    const body = r.json();
    expect(body.agent_id).toBe(agentId);
    expect(body.verification.level).toBe("L1_REGISTERED");
    expect(body.status).toBe("ACTIVE");
  });
  it("re-registering the same agent_id is a 409 (uniqueness check)", async () => {
    const r = await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest, proof, key_document: opDoc } });
    expect(r.statusCode).toBe(409);
    expect(r.json().error).toBe("agent_exists");
  });
  it("a tampered manifest is rejected with manifest_digest_mismatch (no registration happens)", async () => {
    const m2 = structuredClone(manifest);
    m2.agent_id = generateAgentId();
    m2.disclosure.human_escalation = false;
    const doc2 = { ...opDoc, controller: m2.agent_id };
    const r = await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest: m2, proof, key_document: doc2 } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("manifest_digest_mismatch");
  });
  it("an authority-role key cannot register an agent", async () => {
    const m3 = { ...structuredClone(manifest), agent_id: generateAgentId() };
    const r = await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest: m3, proof: { ...proof, agent_id: m3.agent_id }, key_document: { ...auDoc, key_id: proof.key_id } } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("key_role_mismatch");
  });
  it("a manifest with a reserved key is rejected by strict schema", async () => {
    const r = await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest: { ...manifest, permissions: [] }, proof, key_document: opDoc } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("schema_validation_failed");
  });
});

describe("2. Query /v1/keys/{key-ULID} → resolve public key without fragment truncation", () => {
  it("path form returns the operator key document", async () => {
    const r = await app.inject({ method: "GET", url: `/v1/keys/${keyIdToWire(opDoc.key_id)}` });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual(opDoc);
  });
  it("percent-encoded query form returns the identical document", async () => {
    const r = await app.inject({ method: "GET", url: `/v1/keys?key_id=${encodeURIComponent(opDoc.key_id)}` });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual(opDoc);
  });
  it("a percent-encoded fragment is a hard 400 invalid_key_id, never truncated", async () => {
    const r1 = await app.inject({ method: "GET", url: `/v1/keys/${keyIdToWire(opDoc.key_id)}%23z1` });
    expect(r1.statusCode).toBe(400);
    expect(r1.json().error).toBe("invalid_key_id");
    const r2 = await app.inject({ method: "GET", url: `/v1/keys?key_id=${encodeURIComponent(opDoc.key_id + "#z1")}` });
    expect(r2.statusCode).toBe(400);
    expect(r2.json().error).toBe("invalid_key_id");
  });
  it("unknown key is 404", async () => {
    const r = await app.inject({ method: "GET", url: `/v1/keys/${keyIdToWire(generateKeyId())}` });
    expect(r.statusCode).toBe(404);
  });
});

describe("3. Proof, envelope, assertions", () => {
  it("GET /v1/agents/:id/proof returns the operator-signed ManifestProof", async () => {
    const r = await app.inject({ method: "GET", url: `/v1/agents/${agentId}/proof` });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual(proof);
  });
  it("GET /v1/agents/:id returns the envelope with a passing proof check and L1", async () => {
    const r = await app.inject({ method: "GET", url: `/v1/agents/${agentId}` });
    expect(r.statusCode).toBe(200);
    const env = r.json();
    expect(env.proof_check).toEqual({ ok: true });
    expect(env.manifest_digest.value).toBe(manifestDigestHex(manifest));
    expect(env.verification.level).toBe("L1_REGISTERED");
    expect(env.operator_key.discovery.registry_path).toBe(`/v1/keys/${keyIdToWire(opDoc.key_id)}`);
    expect(env.operator_key.discovery.well_known_url).toBe("https://acmemedical.com/.well-known/agenid/keys.json");
  });
  it("authority routes are 401 without the bearer token", async () => {
    const r = await app.inject({ method: "POST", url: "/v1/authority/keys", payload: auDoc });
    expect(r.statusCode).toBe(401);
  });
  it("authority publishes its key, then issues an L2 assertion; envelope level becomes L2", async () => {
    const k = await app.inject({ method: "POST", url: "/v1/authority/keys", headers: { authorization: `Bearer ${TOKEN}` }, payload: auDoc });
    expect(k.statusCode).toBe(201);

    const assertion = signVerificationAssertion(
      {
        $schema: ASSERTION_SCHEMA_ID,
        assertion_id: generateAssertionId(),
        subject: agentId,
        subject_type: "agent",
        level: "L2_DOMAIN_VERIFIED",
        claim: { type: "domain_control", domain: "acmemedical.com" },
        authority: "agenid:authority:node-01",
        evidence: { type: "dns_txt_challenge", reference: "_agenid-challenge.acmemedical.com" },
        verified_at: "2026-09-13T06:00:00Z",
        expires_at: "2026-10-13T06:00:00Z",
        scope: "domain_control_only",
        manifest_digest: { alg: "sha-256", value: manifestDigestHex(manifest) },
        key_id: auDoc.key_id,
      },
      auKey,
    );
    const a = await app.inject({ method: "POST", url: `/v1/agents/${agentId}/assertions`, headers: { authorization: `Bearer ${TOKEN}` }, payload: { assertion } });
    expect(a.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: `/v1/agents/${agentId}/assertions` });
    expect(list.json().verification.level).toBe("L2_DOMAIN_VERIFIED");
    expect(list.json().assertions[0].check).toEqual({ ok: true });

    const one = await app.inject({ method: "GET", url: `/v1/assertions/${assertion.assertion_id.slice("assertion:".length)}` });
    expect(one.statusCode).toBe(200);
    expect(one.json().assertion).toEqual(assertion);

    const env = await app.inject({ method: "GET", url: `/v1/agents/${agentId}` });
    expect(env.json().verification).toEqual({ level: "L2_DOMAIN_VERIFIED", valid_assertions: 1, total_assertions: 1 });
  });
  it("an assertion signed by the OPERATOR key is refused (role enforced server-side)", async () => {
    const forged = signVerificationAssertion.bind(null);
    // Build a payload naming the operator key as if it were an authority key; core refuses at signing time,
    // so simulate a hostile client by signing raw bytes ourselves.
    const { signBytes, signingInputOf, b64uEncode } = await import("@agenid/core");
    const payload = {
      $schema: ASSERTION_SCHEMA_ID,
      assertion_id: generateAssertionId(),
      subject: agentId,
      subject_type: "agent",
      level: "L3_ORGANIZATION_VERIFIED",
      claim: { type: "organization_identity", legal_name: "Acme Medical LLC" },
      authority: "agenid:authority:node-01",
      evidence: { type: "business_registry_match", reference: "utah:1234567" },
      verified_at: "2026-09-13T06:00:00Z",
      expires_at: "2026-10-13T06:00:00Z",
      scope: "org_identity_only",
      manifest_digest: { alg: "sha-256", value: manifestDigestHex(manifest) },
      key_id: opDoc.key_id,
    };
    const sig = signBytes(op.privateKey, signingInputOf(payload));
    const r = await app.inject({ method: "POST", url: `/v1/agents/${agentId}/assertions`, headers: { authorization: `Bearer ${TOKEN}` }, payload: { assertion: { ...payload, signature: b64uEncode(sig) } } });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("key_role_mismatch");
    void forged;
  });
  it("the event ledger records registration, key publication, and the assertion", async () => {
    const r = await app.inject({ method: "GET", url: `/v1/agents/${agentId}/events` });
    const types = r.json().events.map((e: { type: string }) => e.type);
    expect(types).toEqual(["key.published", "agent.registered", "assertion.issued"]);
  });
});
