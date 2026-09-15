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
  keyResolverPath,
  isValidAgentId,
  isValidUlid,
  generateUlid,
  PROTOCOL_VERSION,
} from "@agenid/core";
import { MemoryStore, type RegistryStore, type AgentRecord } from "./store.js";
import { buildEnvelope } from "./envelope.js";
import { registrationTime } from "./registration-time.js";
import {
  resolveKeyFromRawPath,
  resolveKeyFromRawQuery,
  KEY_ALLOWED_METHODS,
  KEY_RESPONSE_HEADERS,
  KEY_ERROR_MESSAGES,
  type KeyResolution,
} from "./serve-key.js";
import { originForm, rawKeyTargetFailure } from "./raw-key-target.js";

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
  // Full precision. Truncating to whole seconds only ever moves the registry's clock
  // BACKWARD (by up to 999ms), which made same-second registrations fail `not_yet_valid`.
  // See registration-time.ts.
  const now = opts.now ?? (() => new Date().toISOString());
  // `frameworkErrors` catches the failures find-my-way raises BEFORE routing — chiefly
  // `FST_ERR_BAD_URL`, whose default body is `Invalid URL: <the caller's own request
  // target>`. On an unauthenticated public surface that is a reflection primitive: a
  // request for `/v1/keys/<script>CANARY%ZZ` came back carrying `<script>CANARY%ZZ`.
  // Nothing the caller sent is echoed; the status is preserved; the shape is AgenID's.
  const app = Fastify({
    logger: opts.logger ?? false,
    frameworkErrors: (error: unknown, req, reply) => {
      const statusCode = (error as { statusCode?: unknown })?.statusCode;
      const status = typeof statusCode === "number" && statusCode >= 400 ? statusCode : 400;
      // A malformed target aimed at key discovery is answered in key discovery's own
      // vocabulary — and with the SAME sentence the handler would have produced, which
      // is what `rawKeyTargetFailure` is for. Agreeing on the status and the code while
      // disagreeing on the reason is still two registries.
      const target = originForm(req.raw.url ?? "");
      if (target.startsWith("/v1/keys")) {
        reply.header("cache-control", "no-store");
        return err(reply, 400, "invalid_key_id", rawKeyTargetFailure(target) ?? KEY_ERROR_MESSAGES.malformed_escape);
      }
      return err(reply, status, "bad_request", "the request target could not be parsed");
    },
  });
  // ONE explicit policy for a public, unauthenticated, credential-free read surface.
  // `origin: true` reflected whatever Origin the caller sent and added a `Vary`; the
  // Next registry sends a literal `*`, so the same protocol surface answered two
  // different CORS policies depending on the framework in front of it. Preflight is
  // handled by explicit per-route OPTIONS handlers below rather than by the plugin's
  // wildcard, so that a route's preflight advertises that route's real methods — and so
  // that key discovery stops advertising POST, which it does not support.
  app.register(cors, { origin: "*", credentials: false, preflight: false });

  // Anything thrown out of a handler, and any framework error raised after routing.
  // Fixed text only: an exception message is written for an operator reading a log, not
  // for an unauthenticated stranger reading a response body.
  app.setErrorHandler((error: unknown, req, reply) => {
    const statusCode = (error as { statusCode?: unknown })?.statusCode;
    const status = typeof statusCode === "number" && statusCode >= 400 ? statusCode : 500;
    req.log?.error?.({ err: error }, "unhandled error");
    if (status >= 500) return err(reply, 500, "internal_error", "the registry failed to handle this request");
    const target = originForm(req.raw.url ?? "");
    if (target.startsWith("/v1/keys")) {
      reply.header("cache-control", "no-store");
      return err(reply, 400, "invalid_key_id", rawKeyTargetFailure(target) ?? KEY_ERROR_MESSAGES.malformed_escape);
    }
    return err(reply, status, "bad_request", "the request could not be handled as sent");
  });

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

    // Signer and registry are different machines milliseconds apart. registrationTime()
    // decides the evaluation instant under an explicit, bounded forward-skew policy; it
    // weakens no check, and every check below still runs against whatever it returns.
    const rt = registrationTime(proof.created_at, new Date(now()));
    if (!rt.ok) return err(reply, 400, rt.code, rt.message);

    const check = verifyManifestProof(proof, manifest, key_document, { now: rt.now });
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
      links: { self: `/v1/agents/${record.agent_id}`, proof: `/v1/agents/${record.agent_id}/proof`, key: keyResolverPath(key_document.key_id) },
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
  // Both wire forms delegate to the SAME canonical implementation the Next.js registry
  // in packages/web uses (serve-key.ts). This route is a transport adapter: it reads the
  // reference out of the request, hands it to resolveKeyDocument, and writes the result.
  // It does not parse identifiers, validate documents, or choose error text of its own —
  // those decisions belong to one place, or the two registries drift apart.
  const sendKey = (reply: FastifyReply, r: KeyResolution) => {
    // The same three transport conventions the Next registry sends, from the same
    // constant, so the two cannot drift: JSON, cross-origin readable, never cached.
    for (const [k, v] of Object.entries(KEY_RESPONSE_HEADERS)) reply.header(k, v);
    if (r.document) return reply.code(200).send(r.document);
    return err(reply, r.status, r.error, r.message, r.key_id ? { key_id: r.key_id } : undefined);
  };

  // `req.raw.url` is the raw request target as Node read it off the socket — no
  // normalization, no decode. `req.params.key_ulid` has been decoded by find-my-way and
  // is passed only as the tripwire described in serve-key.ts.
  app.get<{ Params: { key_ulid: string } }>("/v1/keys/:key_ulid", async (req, reply) =>
    sendKey(reply, await resolveKeyFromRawPath(store, req.raw.url ?? "", req.params.key_ulid)),
  );

  // Also from the raw target, so the one-occurrence rule and the decode count are this
  // registry's own decisions rather than the querystring parser's.
  app.get("/v1/keys", async (req, reply) =>
    sendKey(reply, await resolveKeyFromRawQuery(store, req.raw.url ?? "")),
  );

  // Preflight, stated per route rather than left to the CORS plugin's wildcard. A
  // preflight that advertises methods the resource does not support is a false claim
  // about the surface, and it was how `/v1/keys` came to advertise POST.
  const keyPreflight = async (_req: FastifyRequest, reply: FastifyReply) =>
    reply
      .code(204)
      .header("access-control-allow-origin", KEY_RESPONSE_HEADERS["access-control-allow-origin"] as string)
      .header("access-control-allow-methods", KEY_ALLOWED_METHODS)
      .header("access-control-max-age", "86400")
      .send();
  app.options("/v1/keys", keyPreflight);
  app.options("/v1/keys/:key_ulid", keyPreflight);

  // An unsupported method on a resource that exists is 405 with Allow, not Fastify's
  // default 404 — the resource exists, the method does not. Both the item AND the
  // collection: the collection previously answered POST with the authority write path
  // below, so one signed request meant different things depending on which door it
  // entered, and `Allow: GET, OPTIONS` was false on this framework while true on the
  // other. Key discovery is read-only on both now; see /v1/authority/keys.
  app.route({
    method: ["POST", "PUT", "PATCH", "DELETE"],
    url: "/v1/keys/:key_ulid",
    handler: async (_req, reply) => {
      reply.header("allow", KEY_ALLOWED_METHODS).header("cache-control", "no-store");
      return err(reply, 405, "method_not_allowed", "key discovery is read-only: use GET or OPTIONS");
    },
  });
  app.route({
    method: ["POST", "PUT", "PATCH", "DELETE"],
    url: "/v1/keys",
    handler: async (_req, reply) => {
      reply.header("allow", KEY_ALLOWED_METHODS).header("cache-control", "no-store");
      return err(reply, 405, "method_not_allowed", "key discovery is read-only: use GET or OPTIONS");
    },
  });

  // Authority-only: publish an authority key document.
  //
  // MOVED off `POST /v1/keys`. Spec §9.2 defines `/v1/keys` as key DISCOVERY and defines
  // only GET on it; publication is a capability of this reference registry, not a
  // protocol method, and it was sitting on the public collection resource behind a
  // bearer check. A public discovery URL that gates on a token is an authority surface
  // wearing a public address: it made the two registries disagree about what `/v1/keys`
  // is, and it meant the reference deployment either had to advertise a method it does
  // not implement or advertise `Allow` that was false. Scope is now in the path.
  app.post("/v1/authority/keys", async (req, reply) => {
    if (!requireAuthority(req, reply)) return;
    const parsed = KeyDocument.safeParse(req.body);
    if (!parsed.success) return err(reply, 400, "schema_validation_failed", zodMessage(parsed.error));
    if (parsed.data.role !== "authority") return err(reply, 400, "key_role_mismatch", "only authority keys are published via this route; operator keys are published at registration");
    const existing = await store.getKey(parsed.data.key_id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(parsed.data)) return err(reply, 409, "key_conflict", "a different document exists under this key_id");
    await store.putKey(parsed.data);
    return reply.code(201).send({ key_id: parsed.data.key_id, links: { self: keyResolverPath(parsed.data.key_id) } });
  });

  // A stray fragment can only reach us percent-encoded; Fastify routes with a literal '#' never match. Make the intent explicit anyway.
  app.setNotFoundHandler((req, reply) => {
    const target = originForm(req.raw.url ?? req.url);
    // A target aimed at key discovery that matched no route is still key discovery's
    // error language — and never carries the target back to the caller.
    if (target.startsWith("/v1/keys")) {
      return err(reply, 400, "invalid_key_id", rawKeyTargetFailure(target) ?? KEY_ERROR_MESSAGES.bad_wire_form);
    }
    if (/%23/i.test(target)) return err(reply, 400, "invalid_key_id", KEY_ERROR_MESSAGES.fragment);
    return err(reply, 404, "not_found", "no such route");
  });

  return app;
}
