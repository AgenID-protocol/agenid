/**
 * AgenID Registry API — Fastify application factory (spec §13, §9.2, §14).
 * No storage assumptions: pass any RegistryStore. Exported for in-process tests.
 */
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import {
  Manifest,
  ManifestProof,
  VerificationAssertion,
  KeyDocument,
  verifyManifestProof,
  verifyVerificationAssertion,
  manifestDigestHex,
  parseKeyReference,
  isValidAgentId,
  isValidUlid,
  generateUlid,
  InvalidKeyIdError,
  PROTOCOL_VERSION,
} from "@agenid/core";
import { MemoryStore, type RegistryStore, type AgentRecord } from "./store.js";
import { buildEnvelope } from "./envelope.js";

export interface AppOptions {
  store?: RegistryStore;
  /** Bearer token required for authority-only writes (publishing authority keys, issuing assertions). If unset, those routes return 503. */
  authorityToken?: string | undefined;
  /** Clock injection for deterministic tests. */
  now?: () => string;
  logger?: boolean;
}

const RegisterBody = z
  .object({
    manifest: Manifest,
    proof: ManifestProof,
    /** The operator's key document — stored so GET /v1/keys can serve the AgenID-hosted discovery path. */
    key_document: KeyDocument,
  })
  .strict();

const IssueAssertionBody = z.object({ assertion: VerificationAssertion }).strict();

function err(reply: FastifyReply, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return reply.code(status).send({ error: code, message, ...(extra ?? {}) });
}

function zodMessage(e: z.ZodError): string {
  return e.issues.map((i) => `${i.path.join(".") || "$"}: ${i.message}`).join("; ");
}

export function buildApp(opts: AppOptions = {}): FastifyInstance {
  const store = opts.store ?? new MemoryStore();
  const now = opts.now ?? (() => new Date().toISOString().replace(/\.\d{3}Z$/, "Z"));
  const app = Fastify({ logger: opts.logger ?? false });
  app.register(cors, { origin: true, methods: ["GET", "POST", "OPTIONS"] });

  const requireAuthority = (req: FastifyRequest, reply: FastifyReply): boolean => {
    if (!opts.authorityToken) {
      err(reply, 503, "authority_writes_disabled", "No authority token configured on this registry");
      return false;
    }
    const h = req.headers.authorization ?? "";
    if (h !== `Bearer ${opts.authorityToken}`) {
      err(reply, 401, "unauthorized", "Authority bearer token required");
      return false;
    }
    return true;
  };

  app.get("/", async () => ({ name: "AgenID Registry", protocol_version: PROTOCOL_VERSION, spec: "https://github.com/AgenID-protocol/spec" }));
  app.get("/healthz", async () => ({ ok: true }));

  // ---------------------------------------------------------------- agents
  app.post("/v1/agents", async (req, reply) => {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) return err(reply, 400, "schema_validation_failed", zodMessage(parsed.error));
    const { manifest, proof, key_document } = parsed.data;

    // The proof binds agent_id + digest; the key document must be the operator key named by the proof.
    if (key_document.key_id !== proof.key_id) return err(reply, 400, "key_id_mismatch", "key_document.key_id must equal proof.key_id");
    if (key_document.role !== "operator") return err(reply, 400, "key_role_mismatch", "registration key must have role=operator");
    if (key_document.controller !== manifest.agent_id) return err(reply, 400, "key_controller_mismatch", "operator key controller must equal manifest.agent_id");

    const check = verifyManifestProof(proof, manifest, key_document, { now: now() });
    if (!check.ok) return err(reply, 400, check.code, check.message);

    // If this key_id is already published, it must be byte-identical (no silent key substitution via re-registration).
    const existingKey = await store.getKey(key_document.key_id);
    if (existingKey && JSON.stringify(existingKey) !== JSON.stringify(key_document)) {
      return err(reply, 409, "key_conflict", "a different key document is already published under this key_id");
    }

    const ts = now();
    const record: AgentRecord = {
      agent_id: manifest.agent_id,
      manifest,
      manifest_digest: manifestDigestHex(manifest),
      proof,
      status: "ACTIVE",
      registered_at: ts,
      updated_at: ts,
    };
    const created = await store.createAgent(record);
    if (!created) return err(reply, 409, "agent_exists", "agent_id is already registered");
    await store.putKey(key_document);
    await store.appendEvent({ event_id: `evt_${generateUlid()}`, agent_id: record.agent_id, type: "key.published", occurred_at: ts, detail_ref: { key_id: key_document.key_id } });
    await store.appendEvent({ event_id: `evt_${generateUlid()}`, agent_id: record.agent_id, type: "agent.registered", occurred_at: ts, detail_ref: { manifest_digest: record.manifest_digest } });

    return reply.code(201).send({
      agent_id: record.agent_id,
      status: record.status,
      verification: { level: "L1_REGISTERED" },
      registered_at: ts,
      links: { self: `/v1/agents/${record.agent_id}`, proof: `/v1/agents/${record.agent_id}/proof`, key: `/v1/keys/${key_document.key_id.slice("agenid:key:".length)}` },
    });
  });

  app.get<{ Params: { agent_id: string } }>("/v1/agents/:agent_id", async (req, reply) => {
    const id = req.params.agent_id;
    if (!isValidAgentId(id)) return err(reply, 400, "invalid_agent_id", "expected agenid:<ULID>");
    const rec = await store.getAgent(id);
    if (!rec) return err(reply, 404, "agent_not_found", "no such agent");
    return buildEnvelope(store, rec, now());
  });

  app.get<{ Params: { agent_id: string } }>("/v1/agents/:agent_id/proof", async (req, reply) => {
    const rec = isValidAgentId(req.params.agent_id) ? await store.getAgent(req.params.agent_id) : null;
    if (!rec) return err(reply, 404, "agent_not_found", "no such agent");
    return rec.proof;
  });

  app.get<{ Params: { agent_id: string } }>("/v1/agents/:agent_id/assertions", async (req, reply) => {
    const rec = isValidAgentId(req.params.agent_id) ? await store.getAgent(req.params.agent_id) : null;
    if (!rec) return err(reply, 404, "agent_not_found", "no such agent");
    const env = await buildEnvelope(store, rec, now());
    return { agent_id: rec.agent_id, verification: env.verification, assertions: env.assertions };
  });

  app.get<{ Params: { agent_id: string } }>("/v1/agents/:agent_id/events", async (req, reply) => {
    const rec = isValidAgentId(req.params.agent_id) ? await store.getAgent(req.params.agent_id) : null;
    if (!rec) return err(reply, 404, "agent_not_found", "no such agent");
    return { agent_id: rec.agent_id, events: await store.listEvents(rec.agent_id) };
  });

  // Authority-only: issue a VerificationAssertion for an agent. The assertion is verified against the
  // authority key ALREADY published in this registry — the caller cannot smuggle a key in with the assertion.
  app.post<{ Params: { agent_id: string } }>("/v1/agents/:agent_id/assertions", async (req, reply) => {
    if (!requireAuthority(req, reply)) return;
    const rec = isValidAgentId(req.params.agent_id) ? await store.getAgent(req.params.agent_id) : null;
    if (!rec) return err(reply, 404, "agent_not_found", "no such agent");
    const parsed = IssueAssertionBody.safeParse(req.body);
    if (!parsed.success) return err(reply, 400, "schema_validation_failed", zodMessage(parsed.error));
    const { assertion } = parsed.data;
    if (assertion.subject !== rec.agent_id) return err(reply, 400, "subject_mismatch", "assertion.subject must equal the agent_id in the path");
    const auKey = await store.getKey(assertion.key_id);
    if (!auKey) return err(reply, 400, "authority_key_unknown", "assertion.key_id is not published in this registry");
    const check = verifyVerificationAssertion(assertion, auKey, { now: now(), currentManifest: rec.manifest });
    if (!check.ok) return err(reply, 400, check.code, check.message);
    if (await store.getAssertion(assertion.assertion_id)) return err(reply, 409, "assertion_exists", "assertion_id already issued");
    await store.putAssertion(assertion);
    await store.appendEvent({
      event_id: `evt_${generateUlid()}`,
      agent_id: rec.agent_id,
      type: "assertion.issued",
      occurred_at: now(),
      detail_ref: { assertion_id: assertion.assertion_id, level: assertion.level, manifest_digest: assertion.manifest_digest.value },
    });
    return reply.code(201).send({ assertion_id: assertion.assertion_id, level: assertion.level, links: { self: `/v1/assertions/${assertion.assertion_id.slice("assertion:".length)}` } });
  });

  // ---------------------------------------------------------------- assertions
  app.get<{ Params: { assertion_ulid: string } }>("/v1/assertions/:assertion_ulid", async (req, reply) => {
    const u = req.params.assertion_ulid;
    if (!isValidUlid(u)) return err(reply, 400, "invalid_assertion_id", "expected a bare assertion ULID in the path");
    const a = await store.getAssertion(`assertion:${u}`);
    if (!a) return err(reply, 404, "assertion_not_found", "no such assertion");
    const auKey = await store.getKey(a.key_id);
    const check = auKey ? verifyVerificationAssertion(a, auKey, { now: now() }) : ({ ok: false, code: "key_unavailable" } as const);
    return { assertion: a, check: check.ok ? { ok: true } : { ok: false, code: check.code } };
  });

  // ---------------------------------------------------------------- keys (spec §9.2)
  const serveKey = async (ref: string, reply: FastifyReply) => {
    let keyId: string;
    try {
      keyId = parseKeyReference(ref);
    } catch (e) {
      if (e instanceof InvalidKeyIdError) return err(reply, 400, "invalid_key_id", e.message);
      throw e;
    }
    const doc = await store.getKey(keyId);
    if (!doc) return err(reply, 404, "key_not_found", "no such key");
    return doc;
  };

  app.get<{ Params: { key_ulid: string } }>("/v1/keys/:key_ulid", async (req, reply) => serveKey(req.params.key_ulid, reply));

  app.get<{ Querystring: { key_id?: string } }>("/v1/keys", async (req, reply) => {
    const q = req.query.key_id;
    if (!q) return err(reply, 400, "invalid_key_id", "key_id query parameter required (percent-encoded logical form)");
    return serveKey(q, reply);
  });

  // Authority-only: publish an authority key document (the AgenID-hosted discovery path for authority keys).
  app.post("/v1/keys", async (req, reply) => {
    if (!requireAuthority(req, reply)) return;
    const parsed = KeyDocument.safeParse(req.body);
    if (!parsed.success) return err(reply, 400, "schema_validation_failed", zodMessage(parsed.error));
    if (parsed.data.role !== "authority") return err(reply, 400, "key_role_mismatch", "only authority keys are published via this route; operator keys are published at registration");
    const existing = await store.getKey(parsed.data.key_id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(parsed.data)) return err(reply, 409, "key_conflict", "a different document exists under this key_id");
    await store.putKey(parsed.data);
    return reply.code(201).send({ key_id: parsed.data.key_id, links: { self: `/v1/keys/${parsed.data.key_id.slice("agenid:key:".length)}` } });
  });

  // A stray fragment can only reach us percent-encoded; Fastify routes with a literal '#' never match. Make the intent explicit anyway.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.includes("%23")) return err(reply, 400, "invalid_key_id", "URI fragments (#) are not resolvable");
    return err(reply, 404, "not_found", "no such route");
  });

  return app;
}
