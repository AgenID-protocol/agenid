/**
 * POST /api/retell/bind — register a fleet of Retell-hosted agents in one call.
 *
 * This route is a BATCH WRAPPER, not a second registry. Every agent goes through
 * `lib/register.ts` — the same implementation `POST /api/v1/agents` uses. It used to
 * reimplement registration with raw Supabase upserts, its own clock, no event ledger
 * and no key-substitution check, which meant the same signed manifest got different
 * security semantics depending on which door it came through. See lib/register.ts.
 *
 * SECURITY INVARIANT: this route NEVER generates, receives, or stores private keys.
 * The operator generates their Ed25519 keypair in the browser and signs locally. This
 * route only ever sees the manifest, the proof, and the public key document.
 *
 * LEVEL SEMANTICS: registration yields L1_REGISTERED — an operator self-declaration.
 * Nothing here can produce a level above it; levels above L1 require an
 * authority-signed VerificationAssertion, which is a separate ceremony.
 *
 * `domain` is accepted because the wizard collects it and it appears in each
 * manifest's `ownership.operator_domain`. It is NOT independently checked here and
 * confers nothing — domain control is evidence an authority would weigh, not a level.
 */
import { registerAgent, L1_DISCLOSURES } from "@/lib/register";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * This route already answers an OPTIONS preflight with `access-control-allow-origin: *`,
 * but its actual responses carried no such header — so a cross-origin browser POST passed
 * preflight and was then rejected at the response stage. The sibling write path
 * (`/api/v1/agents`) sends it on responses, so the two public write endpoints disagreed
 * about whether they were browser-callable. Verified live before and after.
 */
const HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

interface AgentSubmission {
  manifest: unknown;
  proof: unknown;
  key_document: unknown;
  retell_agent_id?: unknown;
  agent_name?: unknown;
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
    return json(
      { error: "invalid_agents", message: "`agents` must be a non-empty array of signed agent submissions" },
      400,
    );
  }

  const agents = agentsRaw as AgentSubmission[];
  const registered: Array<Record<string, unknown>> = [];

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a || !a.manifest || !a.proof || !a.key_document) {
      return json(
        { error: "incomplete_agent", index: i, message: `agents[${i}] must include manifest, proof, and key_document` },
        400,
      );
    }

    // Exactly the three canonical members — registerAgent rejects anything else, so the
    // Retell-specific fields are carried alongside the call rather than inside it.
    const result = await registerAgent({
      manifest: a.manifest,
      proof: a.proof,
      key_document: a.key_document,
    });

    if (!result.ok) {
      // Fail the whole batch on the first bad agent rather than reporting a partial
      // success: a fleet half-registered under one operator key is a state nobody asked
      // for, and the agents already written are individually valid and re-resolvable.
      return json(
        {
          error: result.error,
          message: result.message,
          index: i,
          registered_before_failure: registered.map((r) => r.agent_id),
          ...(result.issues ? { issues: result.issues } : {}),
        },
        result.status,
      );
    }

    registered.push({
      agent_id: result.record.agent_id,
      retell_agent_id: typeof a.retell_agent_id === "string" ? a.retell_agent_id : "",
      agent_name: typeof a.agent_name === "string" ? a.agent_name : "",
      manifest_digest: result.record.manifest_digest,
      key_id: result.keyDocument.key_id,
      proof_expires_at: result.record.proof.expires_at,
      registered_at: result.record.registered_at,
      links: {
        card: `/a/${result.record.agent_id}`,
        envelope: `/api/resolve/${result.record.agent_id}`,
      },
    });
  }

  return json(
    {
      ok: true,
      domain,
      level: "L1_REGISTERED",
      agents: registered,
      // Persistence is no longer conditional: registerAgent returns 503 rather than
      // reporting success on an unwritten record, so reaching here means every agent
      // above is durably stored and resolvable.
      persisted: true,
      disclosures: L1_DISCLOSURES,
    },
    201,
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
