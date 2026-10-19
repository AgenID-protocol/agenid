/**
 * Fastify registry: POST /v1/agents/:agent_id/revocation, signed with core's own
 * signRevocation. The rules are the shared revoke.ts, also exercised end to end through
 * the deployed web route in packages/web/test/revocation.test.ts; this file proves the
 * standalone registry exposes the same behavior and the same response body.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateAgentId,
  generateKeyId,
  generateKeyPair,
  generateRevocationId,
  makeKeyDocument,
  signManifestProof,
  signRevocation,
  verifyRevocation,
  REVOCATION_SCHEMA_ID,
  type SigningKey,
} from "@agenid/core";
import { buildApp } from "../src/app.js";
import { MemoryStore } from "../src/store.js";

const NOW = "2026-10-19T12:00:00Z";
const store = new MemoryStore();
const app = buildApp({ store, now: () => NOW });

function fixture() {
  const agentId = generateAgentId();
  const op = generateKeyPair();
  const doc = makeKeyDocument({ keyId: generateKeyId(), publicKey: op.publicKey, role: "operator", controller: agentId, createdAt: "2026-10-01T00:00:00Z" });
  const key: SigningKey = { privateKey: op.privateKey, document: doc };
  const manifest = {
    manifest_version: "1.0",
    agent_id: agentId,
    identity: { name: "Desk" },
    ownership: { operator: "Acme LLC", operator_domain: "acme.example", contact: "ops@acme.example" },
    purpose: { summary: "Answers the front desk line", channels: ["voice"] },
    disclosure: { is_ai: true, discloses_to_user: false, human_escalation: false },
  };
  const proof = signManifestProof(manifest, key, { createdAt: "2026-10-19T11:59:00Z", expiresAt: "2027-01-01T00:00:00Z" });
  return { agentId, key, doc, manifest, proof };
}

const revoke = (agentId: string, key: SigningKey, revokedAt = NOW) =>
  signRevocation(
    {
      $schema: REVOCATION_SCHEMA_ID,
      revocation_id: generateRevocationId(),
      revokes: agentId,
      revokes_type: "agent",
      reason: "agent_retired",
      revoked_at: revokedAt,
      key_id: key.document.key_id,
    },
    key,
  );

beforeAll(async () => {
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe("POST /v1/agents/:agent_id/revocation", () => {
  it("revokes, and the envelope carries a revocation that verifies against its own operator key", async () => {
    const f = fixture();
    expect((await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest: f.manifest, proof: f.proof, key_document: f.doc } })).statusCode).toBe(201);

    const rev = revoke(f.agentId, f.key);
    const r = await app.inject({ method: "POST", url: `/v1/agents/${f.agentId}/revocation`, payload: rev });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe("REVOKED");

    const env = (await app.inject({ method: "GET", url: `/v1/agents/${f.agentId}` })).json();
    expect(env.status).toBe("REVOKED");
    expect(verifyRevocation(env.revocation, env.operator_key.document, { now: NOW }).ok).toBe(true);

    const events = (await app.inject({ method: "GET", url: `/v1/agents/${f.agentId}/events` })).json().events;
    expect(events.map((e: { type: string }) => e.type)).toContain("agent.revoked");
  });

  it("is permanent: a second revocation is 409 already_revoked", async () => {
    const f = fixture();
    await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest: f.manifest, proof: f.proof, key_document: f.doc } });
    expect((await app.inject({ method: "POST", url: `/v1/agents/${f.agentId}/revocation`, payload: revoke(f.agentId, f.key) })).statusCode).toBe(200);
    const again = await app.inject({ method: "POST", url: `/v1/agents/${f.agentId}/revocation`, payload: revoke(f.agentId, f.key) });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("already_revoked");
  });

  it("another agent's operator key has no standing", async () => {
    const victim = fixture();
    const attacker = fixture();
    for (const f of [victim, attacker]) {
      await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest: f.manifest, proof: f.proof, key_document: f.doc } });
    }
    const r = await app.inject({ method: "POST", url: `/v1/agents/${victim.agentId}/revocation`, payload: revoke(victim.agentId, attacker.key) });
    expect(r.statusCode).toBe(403);
    expect(r.json().error).toBe("key_not_operator");
    expect((await store.getAgent(victim.agentId))?.status).toBe("ACTIVE");
  });

  it("refuses a stale revocation", async () => {
    const f = fixture();
    await app.inject({ method: "POST", url: "/v1/agents", payload: { manifest: f.manifest, proof: f.proof, key_document: f.doc } });
    const r = await app.inject({ method: "POST", url: `/v1/agents/${f.agentId}/revocation`, payload: revoke(f.agentId, f.key, "2026-10-19T11:00:00Z") });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("revocation_expired");
  });
});
