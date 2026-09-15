/**
 * POST /api/retell/bind — validate client-signed ManifestProofs and persist
 * public material to the canonical protocol tables.
 *
 * SECURITY INVARIANT: this route NEVER generates, receives, or stores private
 * keys. The operator generates their Ed25519 keypair in the browser and signs
 * locally. This route only sees:
 *   - Manifest (public assertion about the agent)
 *   - ManifestProof (signed by the operator's private key)
 *   - KeyDocument (operator's public key metadata)
 *
 * It validates the proof using @agenid/core.verifyManifestProof(), then writes
 * the verified material to the canonical protocol tables (agents, keys).
 *
 * The protocol level is DECLARED — an operator self-declaration. Levels above
 * DECLARED require an authority-signed VerificationAssertion, which is a
 * separate ceremony not performed by this route.
 */
import {
  Manifest,
  ManifestProof,
  KeyDocument,
  verifyManifestProof,
  manifestDigestHex,
} from "@agenid/core";
import { getSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

interface AgentSubmission {
  manifest: unknown;
  proof: unknown;
  key_document: unknown;
  retell_agent_id: string;
  agent_name: string;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400);
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const domain = b.domain;
  const agentsRaw = b.agents;

  if (typeof domain !== "string" || domain.length === 0) {
    return json({ error: "invalid_domain", message: "`domain` is required" }, 400);
  }
  if (!Array.isArray(agentsRaw) || agentsRaw.length === 0) {
    return json({ error: "invalid_agents", message: "`agents` must be a non-empty array of signed agent submissions" }, 400);
  }

  const agents = agentsRaw as AgentSubmission[];
  const now = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // 1. Validate every agent's ManifestProof using @agenid/core
  // ---------------------------------------------------------------------------
  const verified: Array<{
    agent_id: string;
    manifest: Manifest;
    manifest_digest: string;
    proof: ManifestProof;
    key_document: KeyDocument;
    retell_agent_id: string;
    agent_name: string;
  }> = [];

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a.manifest || !a.proof || !a.key_document) {
      return json({ error: "incomplete_agent", message: `agents[${i}] must include manifest, proof, and key_document` }, 400);
    }

    // Schema-validate each piece
    const parsedManifest = Manifest.safeParse(a.manifest);
    if (!parsedManifest.success) {
      return json({ error: "invalid_manifest", index: i, issues: parsedManifest.error.issues }, 400);
    }
    const parsedProof = ManifestProof.safeParse(a.proof);
    if (!parsedProof.success) {
      return json({ error: "invalid_proof", index: i, issues: parsedProof.error.issues }, 400);
    }
    const parsedKey = KeyDocument.safeParse(a.key_document);
    if (!parsedKey.success) {
      return json({ error: "invalid_key_document", index: i, issues: parsedKey.error.issues }, 400);
    }

    // Verify the ManifestProof cryptographically (§7.1)
    const result = verifyManifestProof(parsedProof.data, parsedManifest.data, parsedKey.data, { now });
    if (!result.ok) {
      return json({
        error: "proof_verification_failed",
        index: i,
        code: result.code,
        message: result.message,
      }, 422);
    }

    verified.push({
      agent_id: parsedManifest.data.agent_id,
      manifest: parsedManifest.data,
      manifest_digest: manifestDigestHex(parsedManifest.data),
      proof: parsedProof.data,
      key_document: parsedKey.data,
      retell_agent_id: typeof a.retell_agent_id === "string" ? a.retell_agent_id : "",
      agent_name: typeof a.agent_name === "string" ? a.agent_name : "",
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Persist to canonical protocol tables (agents, keys)
  // ---------------------------------------------------------------------------
  let persisted = false;
  try {
    const supabase = getSupabaseServiceClient();

    for (const v of verified) {
      // Write to `keys` table (protocol §9 — public key only)
      const { error: keyErr } = await supabase.from("keys").upsert(
        { key_id: v.key_document.key_id, document: v.key_document },
        { onConflict: "key_id" },
      );
      if (keyErr) throw new Error(`keys upsert: ${keyErr.message}`);

      // Write to `agents` table (protocol §6.1, §6.2)
      const { error: agentErr } = await supabase.from("agents").upsert(
        {
          agent_id: v.agent_id,
          manifest: v.manifest,
          manifest_digest: v.manifest_digest,
          proof: v.proof,
          status: "ACTIVE",
          registered_at: now,
          updated_at: now,
        },
        { onConflict: "agent_id" },
      );
      if (agentErr) throw new Error(`agents upsert: ${agentErr.message}`);
    }

    persisted = true;
  } catch (e) {
    // Supabase not configured or write failed — the verified proofs are still
    // cryptographically valid and returned to the caller.
    console.error("[bind] persistence failed:", e instanceof Error ? e.message : e);
  }

  // ---------------------------------------------------------------------------
  // 3. Return results — DECLARED level only
  // ---------------------------------------------------------------------------
  return json(
    {
      ok: true,
      domain,
      level: "DECLARED",
      agents: verified.map((v) => ({
        agent_id: v.agent_id,
        retell_agent_id: v.retell_agent_id,
        agent_name: v.agent_name,
        manifest_digest: v.manifest_digest,
        key_id: v.key_document.key_id,
        proof_expires_at: v.proof.expires_at,
      })),
      persisted,
      registered_at: now,
      disclosures: [
        "DECLARED is an operator self-declaration. It attests who signed, not that any third party checked them.",
        "Levels above DECLARED require an authority-signed VerificationAssertion.",
      ],
    },
    200,
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      ...HEADERS,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}
