/**
 * The single registration implementation for this deployment.
 *
 * WHY THIS FILE EXISTS: registration was implemented twice — once in
 * `app/api/v1/agents/route.ts` (canonical: RegistryStore seam, bounded clock-skew
 * policy, event ledger, key-substitution check) and once in
 * `app/api/retell/bind/route.ts` (raw Supabase upserts, raw clock, no ledger, no
 * store seam, no key-conflict check). Two implementations of one security-critical
 * business rule will always drift, and these already had: the same signed manifest
 * registered through two different doors got two different clock semantics and two
 * different audit trails.
 *
 * Every write path MUST go through `registerAgent`. A route's job is to shape the
 * request and the response — never to decide what registration means.
 *
 * WHAT IS ACCEPTED: public material only — manifest, operator-signed ManifestProof,
 * operator KeyDocument. A private key is never a field of a registration request.
 *
 * LEVEL SEMANTICS: success is L1_REGISTERED and nothing above it. Levels above L1
 * come only from authority-signed VerificationAssertions, which `buildEnvelope`
 * derives at resolution time — never from an act of registration.
 */
import {
  Manifest,
  ManifestProof,
  KeyDocument,
  verifyManifestProof,
  manifestDigestHex,
  generateUlid,
  isValidAgentId,
  type Manifest as ManifestType,
  type KeyDocument as KeyDocumentType,
} from "@agenid/core";
import { registrationTime, type AgentRecord } from "@agenid/api";
import { getStore } from "@/lib/api";

export const REGISTER_MEMBERS = ["manifest", "proof", "key_document"] as const;

export type RegisterResult =
  | { ok: true; record: AgentRecord; keyDocument: KeyDocumentType; manifest: ManifestType }
  | { ok: false; status: number; error: string; message: string; issues?: unknown[] };

const fail = (status: number, error: string, message: string, issues?: unknown[]): RegisterResult => ({
  ok: false,
  status,
  error,
  message,
  ...(issues ? { issues } : {}),
});

/**
 * Deliberately NOT truncated to whole seconds: truncation only ever moves the
 * registry's clock backward (by up to 999ms), which made a browser that signs and
 * POSTs within the same second fail `not_yet_valid` on its own fresh proof. See
 * @agenid/api's registration-time.ts for the policy.
 */
const nowIso = () => new Date().toISOString();

export async function registerAgent(body: unknown): Promise<RegisterResult> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(400, "schema_validation_failed", "registration payload must be a JSON object");
  }

  const unknown = Object.keys(body).filter((k) => !(REGISTER_MEMBERS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    return fail(
      400,
      "schema_validation_failed",
      "registration payload has unrecognized members",
      unknown.map((k) => ({ code: "unrecognized_keys", path: [k], message: `unrecognized key: ${k}` })),
    );
  }

  const raw = body as Record<string, unknown>;

  const parsedManifest = Manifest.safeParse(raw.manifest);
  if (!parsedManifest.success) {
    return fail(400, "schema_validation_failed", "manifest failed schema validation", parsedManifest.error.issues);
  }
  const parsedProof = ManifestProof.safeParse(raw.proof);
  if (!parsedProof.success) {
    return fail(400, "schema_validation_failed", "proof failed schema validation", parsedProof.error.issues);
  }
  const parsedKey = KeyDocument.safeParse(raw.key_document);
  if (!parsedKey.success) {
    return fail(400, "schema_validation_failed", "key_document failed schema validation", parsedKey.error.issues);
  }

  const manifest = parsedManifest.data;
  const proof = parsedProof.data;
  const keyDocument = parsedKey.data;

  // The proof binds agent_id + digest; the key document must be the operator key it names.
  if (keyDocument.key_id !== proof.key_id) {
    return fail(400, "key_id_mismatch", "key_document.key_id must equal proof.key_id");
  }
  if (keyDocument.role !== "operator") {
    return fail(400, "key_role_mismatch", "registration key must have role=operator");
  }
  if (keyDocument.controller !== manifest.agent_id) {
    return fail(400, "key_controller_mismatch", "operator key controller must equal manifest.agent_id");
  }
  if (!isValidAgentId(manifest.agent_id)) {
    return fail(400, "invalid_agent_id", "expected agenid:<ULID>");
  }

  // Signer and registry are different machines milliseconds apart. registrationTime()
  // applies one explicit, bounded forward-skew policy shared with the Fastify registry.
  // It weakens nothing: signature, digest binding and expiry are all still checked.
  const rt = registrationTime(proof.created_at, new Date(nowIso()));
  if (!rt.ok) return fail(400, rt.code, rt.message);
  const now = rt.registeredAt;

  const check = verifyManifestProof(proof, manifest, keyDocument, { now: rt.now });
  if (!check.ok) return fail(400, check.code, check.message);

  try {
    const store = getStore();

    // A re-registration must not silently substitute a different key under a known key_id.
    const existingKey = await store.getKey(keyDocument.key_id);
    if (existingKey && JSON.stringify(existingKey) !== JSON.stringify(keyDocument)) {
      return fail(409, "key_conflict", "a different key document is already published under this key_id");
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
    if (!created) return fail(409, "agent_exists", "agent_id is already registered");

    await store.putKey(keyDocument);
    await store.appendEvent({
      event_id: `evt_${generateUlid()}`,
      agent_id: record.agent_id,
      type: "key.published",
      occurred_at: now,
      detail_ref: { key_id: keyDocument.key_id },
    });
    await store.appendEvent({
      event_id: `evt_${generateUlid()}`,
      agent_id: record.agent_id,
      type: "agent.registered",
      occurred_at: now,
      detail_ref: { manifest_digest: record.manifest_digest },
    });

    return { ok: true, record, keyDocument, manifest };
  } catch (e) {
    console.error("registration failed", { error: e instanceof Error ? e.message : e });
    return fail(503, "registry_unavailable", "the registry could not be written to");
  }
}

/** The disclosures every registration response carries, in one place so they cannot diverge. */
export const L1_DISCLOSURES = [
  "L1_REGISTERED means this agent is registered here and its operator self-declaration verifies. It is not a third-party verification of the operator, the domain, or the organization.",
  "Levels above L1 require an authority-signed VerificationAssertion. AgenID's root authority key ceremony has not been performed, so none can be issued yet.",
];
