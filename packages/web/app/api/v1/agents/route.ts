/**
 * POST /api/v1/agents — register an agent (protocol level L1_REGISTERED).
 *
 * This is the SAME registration logic as packages/api/src/app.ts's POST /v1/agents,
 * running in-process against the same storage-independent RegistryStore seam that
 * lib/api.ts already uses for the read path. It exists here because production has no
 * separately-deployed Fastify registry: the web app IS the deployment, so the write
 * path has to live where the read path lives or registrations cannot happen at all.
 *
 * WHAT IS ACCEPTED: public material only — the manifest, the operator-signed
 * ManifestProof, and the operator KeyDocument. A private key is never a field of this
 * request. Operators generate keys in their own browser (lib/client-crypto.ts) or with
 * @agenid/cli; the registry only ever verifies what it is handed.
 *
 * LEVEL SEMANTICS: a successful registration is L1_REGISTERED, which asserts exactly
 * one thing — this agent is registered in this registry and its self-declaration
 * verifies. It is NOT a third-party verification of the operator, the domain, or the
 * organization. Levels above L1 come only from authority-signed VerificationAssertions
 * (buildEnvelope raises the level from stored assertions, never from registration),
 * and AgenID's root authority key ceremony has not been performed, so none can exist yet.
 */
import {
  Manifest,
  ManifestProof,
  KeyDocument,
  verifyManifestProof,
  manifestDigestHex,
  generateUlid,
  isValidAgentId,
} from "@agenid/core";
import { getStore, API_URL } from "@/lib/api";
import { registrationTime, type AgentRecord } from "@agenid/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const err = (status: number, error: string, message: string) => json({ error, message }, status);

/**
 * Same acceptance criteria as packages/api's `RegisterBody`: exactly the three canonical
 * schemas, and no unknown top-level members.
 *
 * Composed from each schema's own `.safeParse` rather than wrapped in a new `z.object()`
 * because `zod` is a dependency of @agenid/core, NOT of @agenid/web -- pnpm's strict
 * node_modules makes `import { z } from "zod"` here an unresolvable phantom dependency
 * that fails `next build`. Adding zod to this package would also risk a second zod
 * instance disagreeing with core's at an `instanceof` boundary. The schemas themselves
 * are already strict, so per-field parsing loses nothing except the top-level
 * unknown-key rejection, which is done explicitly below.
 */
const REGISTER_MEMBERS = ["manifest", "proof", "key_document"] as const;

// Deliberately NOT truncated to whole seconds: truncation only ever moves the registry's
// clock backward (by up to 999ms), which made a browser that signs and POSTs within the
// same second fail `not_yet_valid` on its own fresh proof. See @agenid/api's
// registration-time.ts for the full policy.
const nowIso = () => new Date().toISOString();

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_json", "request body must be JSON");
  }

  // When a standalone registry is configured, it remains the writer — same precedence
  // as the read path, so local dev against `@agenid/api` keeps a single source of truth.
  if (API_URL) {
    try {
      const r = await fetch(`${API_URL}/v1/agents`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return json(await r.json(), r.status);
    } catch (e) {
      console.error("registry write failed", { error: e instanceof Error ? e.message : e });
      return err(503, "registry_unavailable", "upstream registry could not be reached");
    }
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return err(400, "schema_validation_failed", "registration payload must be a JSON object");
  }
  const unknown = Object.keys(body).filter((k) => !(REGISTER_MEMBERS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    return json(
      {
        error: "schema_validation_failed",
        message: "registration payload has unrecognized members",
        issues: unknown.map((k) => ({ code: "unrecognized_keys", path: [k], message: `unrecognized key: ${k}` })),
      },
      400,
    );
  }
  const raw = body as Record<string, unknown>;

  const parsedManifest = Manifest.safeParse(raw.manifest);
  if (!parsedManifest.success) {
    return json({ error: "schema_validation_failed", message: "manifest failed schema validation", issues: parsedManifest.error.issues }, 400);
  }
  const parsedProof = ManifestProof.safeParse(raw.proof);
  if (!parsedProof.success) {
    return json({ error: "schema_validation_failed", message: "proof failed schema validation", issues: parsedProof.error.issues }, 400);
  }
  const parsedKey = KeyDocument.safeParse(raw.key_document);
  if (!parsedKey.success) {
    return json({ error: "schema_validation_failed", message: "key_document failed schema validation", issues: parsedKey.error.issues }, 400);
  }
  const manifest = parsedManifest.data;
  const proof = parsedProof.data;
  const keyDocument = parsedKey.data;

  // The proof binds agent_id + digest; the key document must be the operator key it names.
  if (keyDocument.key_id !== proof.key_id) return err(400, "key_id_mismatch", "key_document.key_id must equal proof.key_id");
  if (keyDocument.role !== "operator") return err(400, "key_role_mismatch", "registration key must have role=operator");
  if (keyDocument.controller !== manifest.agent_id) {
    return err(400, "key_controller_mismatch", "operator key controller must equal manifest.agent_id");
  }
  if (!isValidAgentId(manifest.agent_id)) return err(400, "invalid_agent_id", "expected agenid:<ULID>");

  // Signer and registry are different machines milliseconds apart. registrationTime()
  // applies one explicit, bounded forward-skew policy shared with the Fastify registry.
  // It weakens nothing: the signature, digest binding, and expiry are all still checked
  // against whatever instant it returns.
  const rt = registrationTime(proof.created_at, new Date(nowIso()));
  if (!rt.ok) return err(400, rt.code, rt.message);
  const now = rt.registeredAt;

  const check = verifyManifestProof(proof, manifest, keyDocument, { now: rt.now });
  if (!check.ok) return err(400, check.code, check.message);

  try {
    const store = getStore();

    // A re-registration must not silently substitute a different key under a known key_id.
    const existingKey = await store.getKey(keyDocument.key_id);
    if (existingKey && JSON.stringify(existingKey) !== JSON.stringify(keyDocument)) {
      return err(409, "key_conflict", "a different key document is already published under this key_id");
    }

    const record: AgentRecord = {
      agent_id: manifest.agent_id,
      manifest,
      manifest_digest: manifestDigestHex(manifest),
      proof,
      status: "ACTIVE",
      registered_at: now,
      updated_at: now,
    };
    const created = await store.createAgent(record);
    if (!created) return err(409, "agent_exists", "agent_id is already registered");

    await store.putKey(keyDocument);
    await store.appendEvent({
      event_id: `evt_${generateUlid()}`, agent_id: record.agent_id, type: "key.published",
      occurred_at: now, detail_ref: { key_id: keyDocument.key_id },
    });
    await store.appendEvent({
      event_id: `evt_${generateUlid()}`, agent_id: record.agent_id, type: "agent.registered",
      occurred_at: now, detail_ref: { manifest_digest: record.manifest_digest },
    });

    return json(
      {
        agent_id: record.agent_id,
        status: record.status,
        verification: { level: "L1_REGISTERED" },
        manifest_digest: { alg: "sha-256", value: record.manifest_digest },
        registered_at: now,
        links: {
          card: `/a/${record.agent_id}`,
          envelope: `/api/resolve/${record.agent_id}`,
        },
        disclosures: [
          "L1_REGISTERED means this agent is registered here and its operator self-declaration verifies. It is not a third-party verification of the operator, the domain, or the organization.",
          "Levels above L1 require an authority-signed VerificationAssertion. AgenID's root authority key ceremony has not been performed, so none can be issued yet.",
        ],
      },
      201,
    );
  } catch (e) {
    console.error("registration failed", { error: e instanceof Error ? e.message : e });
    return err(503, "registry_unavailable", "the registry could not be written to");
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...HEADERS, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" },
  });
}
