/**
 * Agent revocation, end to end, against the real route handler, the real registration
 * implementation and a real MemoryStore. No mocked crypto, no mocked verification.
 *
 * The properties that matter, in the order a reviewer should check them:
 *   1. only the agent's own operator key can revoke it — not another agent's key, not an
 *      authority key, not a tampered signature;
 *   2. a refused request changes nothing — status, ledger and stored revocation are
 *      untouched;
 *   3. revocation is permanent — a second revocation, a re-registration and a directory
 *      listing are all refused afterwards;
 *   4. a third party can check it without trusting the registry — the envelope carries
 *      the signed object, and it verifies offline against the envelope's operator key;
 *   5. every surface renders it — the shared trust module returns REVOKED.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryStore, revocationDigestHex, buildEnvelope } from "@agenid/api";
import {
  verifyRevocation,
  REVOCATION_SCHEMA_ID,
  RevocationReason,
  generateGrantId,
  type Revocation,
} from "@agenid/core";
import {
  generateKeyPair,
  signAgent,
  signAgentRevocation,
  signDirectoryConsent,
  REVOCATION_REASONS,
  type ClientKeyPair,
} from "../lib/client-crypto";
import { __resetMemoryLimiter } from "../lib/rate-limit";
import { presentEnvelopeTrust } from "../lib/trust-presentation";
import { registerAgent } from "../lib/register";
import { applyDirectoryConsent, MemoryDirectoryStore } from "../lib/directory";
import { revokeAgent } from "../lib/revoke";

let store = new MemoryStore();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, API_URL: undefined, SITE_URL: "https://www.agenid.com", getStore: () => store };
});

const INPUT = {
  operator: "Acme Health, Inc.",
  operatorDomain: "acmehealth.com",
  purposeSummary: "Books and reschedules patient appointments.",
  contact: "ops@acmehealth.com",
  disclosesToUser: false,
  humanEscalation: false,
};

interface Registered {
  keyPair: ClientKeyPair;
  agentId: string;
  keyId: string;
}

async function register(name = "Front desk"): Promise<Registered> {
  const keyPair = generateKeyPair();
  const s = await signAgent(keyPair, name, INPUT);
  const r = await registerAgent({ manifest: s.manifest, proof: s.proof, key_document: s.keyDocument });
  if (!r.ok) throw new Error(`fixture registration failed: ${r.error}`);
  return { keyPair, agentId: s.agentId, keyId: s.keyId };
}

async function post(agentId: string, body: unknown) {
  const { POST } = await import("../app/api/v1/agents/[agenid]/revocation/route");
  const res = await POST(
    new Request(`https://www.agenid.com/api/v1/agents/${agentId}/revocation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ agenid: agentId }) },
  );
  return { res, json: (await res.json()) as Record<string, unknown> };
}

async function snapshot(agentId: string) {
  return {
    status: (await store.getAgent(agentId))?.status,
    events: (await store.listEvents(agentId)).map((e) => e.type),
    revocation: await store.getAgentRevocation(agentId),
  };
}

beforeEach(() => {
  __resetMemoryLimiter();
  store = new MemoryStore();
});

describe("the operator revokes their own agent", () => {
  it("200, REVOKED, and one agent.revoked event pointing at the signed object by digest", async () => {
    const a = await register();
    const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired");
    const { res, json } = await post(a.agentId, rev);

    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(json.status).toBe("REVOKED");
    expect(json.revocation_id).toBe(rev.revocation_id);
    expect(json.reason).toBe("agent_retired");

    const after = await snapshot(a.agentId);
    expect(after.status).toBe("REVOKED");
    expect(after.events).toEqual(["key.published", "agent.registered", "agent.revoked"]);
    const ev = (await store.listEvents(a.agentId)).at(-1)!;
    expect(ev.detail_ref.revocation_id).toBe(rev.revocation_id);
    expect(ev.detail_ref.revocation_digest).toBe(revocationDigestHex(rev as unknown as Revocation));
    expect((json.revocation_digest as { value: string }).value).toBe(ev.detail_ref.revocation_digest);
    // The ledger holds references, never the object itself (spec §13).
    expect(JSON.stringify(ev.detail_ref)).not.toContain(rev.signature);
  });

  it("the envelope carries the revocation, and it verifies offline against the envelope's own operator key", async () => {
    const a = await register();
    const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "key_compromise");
    expect((await post(a.agentId, rev)).res.status).toBe(200);

    const rec = (await store.getAgent(a.agentId))!;
    const env = await buildEnvelope(store, rec, new Date().toISOString());
    expect(env.status).toBe("REVOKED");
    expect(env.revocation).toEqual(rev);

    // A verifier holding only the envelope:
    const check = verifyRevocation(env.revocation, env.operator_key.document, { now: new Date().toISOString() });
    expect(check.ok).toBe(true);
    expect(env.revocation!.revokes).toBe(env.agent_id);
    expect(env.operator_key.document!.controller).toBe(env.agent_id);
    expect(env.verify_instructions).toMatch(/REVOKED/);

    // The operator proof still verifies — revocation retires the identity, it does not
    // pretend the historical signature was never valid.
    expect(env.proof_check.ok).toBe(true);
  });

  it("every badge and card renders it as REVOKED through the one trust module", async () => {
    const a = await register();
    await post(a.agentId, signAgentRevocation(a.keyPair, a.agentId, a.keyId, "operator_request"));
    const env = await buildEnvelope(store, (await store.getAgent(a.agentId))!, new Date().toISOString());
    const t = presentEnvelopeTrust(env);
    expect(t.badgeLabel).toBe("REVOKED");
    expect(t.verified).toBe(false);
    expect(t.tone).toBe("alert");
  });

  it("an ACTIVE agent's envelope carries revocation: null, so the shape does not depend on status", async () => {
    const a = await register();
    const env = await buildEnvelope(store, (await store.getAgent(a.agentId))!, new Date().toISOString());
    expect(env).toHaveProperty("revocation", null);
  });
});

describe("only the agent's own operator key has standing", () => {
  it("another agent's operator key is refused, even with a valid signature", async () => {
    const victim = await register("Victim");
    const attacker = await register("Attacker");
    // Correctly signed by the attacker's key, naming the attacker's key, targeting the victim.
    const rev = signAgentRevocation(attacker.keyPair, victim.agentId, attacker.keyId, "operator_request");
    const before = await snapshot(victim.agentId);
    const { res, json } = await post(victim.agentId, rev);
    expect(res.status).toBe(403);
    expect(json.error).toBe("key_not_operator");
    expect(await snapshot(victim.agentId)).toEqual(before);
  });

  it("naming the victim's key id but signing with a different key fails the signature check", async () => {
    const victim = await register();
    const rev = signAgentRevocation(generateKeyPair(), victim.agentId, victim.keyId, "operator_request");
    const before = await snapshot(victim.agentId);
    const { res, json } = await post(victim.agentId, rev);
    expect(res.status).toBe(403);
    expect(json.error).toBe("signature_invalid");
    expect(await snapshot(victim.agentId)).toEqual(before);
  });

  it("a one-character change to a signed revocation is refused", async () => {
    const a = await register();
    const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired");
    const tampered = { ...rev, reason: "issued_in_error" };
    const { res, json } = await post(a.agentId, tampered);
    expect(res.status).toBe(403);
    expect(json.error).toBe("signature_invalid");
    expect((await snapshot(a.agentId)).status).toBe("ACTIVE");
  });

  it("an authority-role key cannot revoke an agent", async () => {
    const a = await register();
    const authority = generateKeyPair();
    const authorityKeyId = "agenid:key:01JZZZZZZZZZZZZZZZZZZZZZZZ";
    await store.putKey({
      key_id: authorityKeyId,
      key_type: "Ed25519",
      public_key_b64u: authority.publicKeyB64u,
      role: "authority",
      controller: "agenid:authority:agenid",
      created_at: new Date(Date.now() - 60_000).toISOString(),
      status: "active",
      retired_at: null,
      revoked_at: null,
    } as never);
    const rev = signAgentRevocation(authority, a.agentId, authorityKeyId, "operator_request");
    const { res, json } = await post(a.agentId, rev);
    expect(res.status).toBe(403);
    expect(json.error).toBe("key_not_operator");
    expect((await snapshot(a.agentId)).status).toBe("ACTIVE");
  });
});

describe("validation, replay and permanence", () => {
  it("a revocation signed more than five minutes ago, or ahead, is refused", async () => {
    const a = await register();
    for (const offset of [-10 * 60_000, 10 * 60_000]) {
      const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired", new Date(Date.now() + offset));
      const { res, json } = await post(a.agentId, rev);
      expect(res.status).toBe(400);
      expect(json.error).toBe("revocation_expired");
    }
    expect((await snapshot(a.agentId)).status).toBe("ACTIVE");
  });

  it("the path and the signed target must agree", async () => {
    const a = await register("A");
    const b = await register("B");
    const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired");
    const { res, json } = await post(b.agentId, rev);
    expect(res.status).toBe(400);
    expect(json.error).toBe("agent_id_mismatch");
    expect((await snapshot(a.agentId)).status).toBe("ACTIVE");
  });

  it("unknown members, wrong $schema and non-agent targets are refused before any lookup", async () => {
    const a = await register();
    const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired");
    expect((await post(a.agentId, { ...rev, level: "L4_DEPLOYMENT_VERIFIED" })).json.error).toBe("invalid_revocation");
    expect((await post(a.agentId, { ...rev, $schema: "https://example.com/x.json" })).json.error).toBe("invalid_revocation");
    expect((await post(a.agentId, { ...rev, reason: "because" })).json.error).toBe("invalid_revocation");
    const grantTarget = { ...rev, revokes: generateGrantId(), revokes_type: "grant" };
    expect((await post(a.agentId, grantTarget)).json.error).toBe("unsupported_revocation_target");
    expect((await post(a.agentId, "not an object")).json.error).toBe("invalid_revocation");
    expect((await snapshot(a.agentId)).status).toBe("ACTIVE");
  });

  it("an unknown agent is 404", async () => {
    const rev = signAgentRevocation(generateKeyPair(), "agenid:01JZZZZZZZZZZZZZZZZZZZZZZZ", "agenid:key:01JZZZZZZZZZZZZZZZZZZZZZZZ", "unspecified");
    const { res, json } = await post("agenid:01JZZZZZZZZZZZZZZZZZZZZZZZ", rev);
    expect(res.status).toBe(404);
    expect(json.error).toBe("agent_not_found");
  });

  it("revocation is permanent: a second revocation, a replay and re-registration are all refused", async () => {
    const keyPair = generateKeyPair();
    const s = await signAgent(keyPair, "Once", INPUT);
    const regBody = { manifest: s.manifest, proof: s.proof, key_document: s.keyDocument };
    expect((await registerAgent(regBody)).ok).toBe(true);

    const first = signAgentRevocation(keyPair, s.agentId, s.keyId, "agent_retired");
    expect((await post(s.agentId, first)).res.status).toBe(200);

    const replay = await post(s.agentId, first);
    expect(replay.res.status).toBe(409);
    expect(replay.json.error).toBe("already_revoked");

    const second = await post(s.agentId, signAgentRevocation(keyPair, s.agentId, s.keyId, "issued_in_error"));
    expect(second.json.error).toBe("already_revoked");

    // The first revocation stands; nothing replaced it, nothing was appended.
    expect((await store.getAgentRevocation(s.agentId))?.revocation_id).toBe(first.revocation_id);
    expect((await snapshot(s.agentId)).events.filter((t) => t === "agent.revoked")).toHaveLength(1);

    const rereg = await registerAgent(regBody);
    expect(rereg.ok).toBe(false);
    if (!rereg.ok) expect(rereg.error).toBe("agent_exists");
  });

  it("a revoked agent cannot be listed in the directory", async () => {
    const a = await register();
    await post(a.agentId, signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired"));
    const consent = signDirectoryConsent(a.keyPair, a.agentId, a.keyId, true);
    const r = await applyDirectoryConsent(consent, { store, directory: new MemoryDirectoryStore() });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("agent_not_active");
  });

  it("a store failure is 503 and reports nothing as revoked", async () => {
    const a = await register();
    const failing = Object.create(store) as MemoryStore;
    failing.revokeAgent = async () => {
      throw new Error("connection refused");
    };
    const r = await revokeAgent(signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired"), { store: failing });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
    expect((await snapshot(a.agentId)).status).toBe("ACTIVE");
  });

  it("refusals never echo submitted values back", async () => {
    const a = await register();
    const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "agent_retired");
    const { json } = await post(a.agentId, { ...rev, injected: "<script>alert(1)</script>" });
    expect(JSON.stringify(json)).not.toContain("<script>");
  });
});

describe("the browser signer agrees with @agenid/core", () => {
  it("$schema and the reason enum are pinned to core", () => {
    const a = generateKeyPair();
    const rev = signAgentRevocation(a, "agenid:01JZZZZZZZZZZZZZZZZZZZZZZZ", "agenid:key:01JZZZZZZZZZZZZZZZZZZZZZZZ", "unspecified");
    expect(rev.$schema).toBe(REVOCATION_SCHEMA_ID);
    expect([...REVOCATION_REASONS]).toEqual([...RevocationReason.options]);
  });

  it("core accepts a revocation produced by the browser signer", async () => {
    const a = await register();
    const rev = signAgentRevocation(a.keyPair, a.agentId, a.keyId, "superseded");
    const key = await store.getKey(a.keyId);
    expect(verifyRevocation(rev, key, { now: new Date().toISOString() }).ok).toBe(true);
  });
});

describe("OPTIONS", () => {
  it("answers preflight with the same origin header as the response", async () => {
    const { OPTIONS } = await import("../app/api/v1/agents/[agenid]/revocation/route");
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("one implementation", () => {
  // Write the guard wider than the search: every source file in every package.
  const { readdirSync, readFileSync, statSync } = require("node:fs") as typeof import("node:fs");
  const { join, relative } = require("node:path") as typeof import("node:path");
  const ROOT = join(__dirname, "..", "..");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      if (["node_modules", "dist", ".next", "test", "tests"].includes(f)) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|js)$/.test(f)) files.push(p);
    }
  };
  for (const pkg of ["web", "api", "cli", "mcp-server", "core"]) walk(join(ROOT, pkg));
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("only @agenid/api's revoke.ts calls store.revokeAgent", () => {
    const allowed = new Set(["api/src/revoke.ts", "api/src/store.ts", "api/src/supabase-store.ts"]);
    const callers = files
      .filter((f) => /\.revokeAgent\(/.test(strip(readFileSync(f, "utf8"))))
      .map((f) => relative(ROOT, f))
      .filter((f) => !allowed.has(f));
    expect(callers).toEqual([]);
  });

  it("no source file sets an agent's status to REVOKED except the stores' revokeAgent", () => {
    // revoke.ts appears only for its response body's `status: "REVOKED"`, which reports
    // the store's result after revokeAgent succeeded; it writes nothing itself.
    const allowed = new Set(["api/src/store.ts", "api/src/revoke.ts"]);
    const writers = files
      .filter((f) => /status:\s*["']REVOKED["']/.test(strip(readFileSync(f, "utf8"))))
      .map((f) => relative(ROOT, f))
      .filter((f) => !allowed.has(f));
    expect(writers).toEqual([]);
  });
});
