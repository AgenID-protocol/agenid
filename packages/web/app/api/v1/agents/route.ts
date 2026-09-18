/**
 * POST /api/v1/agents — register an agent (protocol level L1_REGISTERED).
 *
 * This is the public, canonical registration endpoint. The registration RULES live in
 * `lib/register.ts`, which is the single implementation shared with every other write
 * path (see that file for why). This route only shapes the request and the response.
 *
 * It mirrors packages/api/src/app.ts's POST /v1/agents and exists because production
 * has no separately-deployed Fastify registry: the web app IS the deployment, so the
 * write path has to live where the read path lives or registrations cannot happen.
 *
 * WHAT IS ACCEPTED: public material only — the manifest, the operator-signed
 * ManifestProof, and the operator KeyDocument. A private key is never a field of this
 * request. Operators generate keys in their own browser (lib/client-crypto.ts) or with
 * @agenid/cli; the registry only ever verifies what it is handed.
 *
 * LEVEL SEMANTICS: a successful registration is L1_REGISTERED, which asserts exactly
 * one thing — this agent is registered in this registry and its self-declaration
 * verifies. It is NOT a third-party verification of the operator, the domain, or the
 * organization.
 */
import { API_URL } from "@/lib/api";
import { registerAgent, L1_DISCLOSURES } from "@/lib/register";
import { POLICIES, checkRateLimit, rateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*" };
const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export async function POST(req: Request) {
  // Bounded BEFORE the body is read. Parsing an unbounded stream from a caller who is
  // already over the limit is work performed on that caller's behalf.
  const rl = await checkRateLimit(req, POLICIES.register);
  if (!rl.allowed) return tooManyRequests(rl, { "access-control-allow-origin": "*" });
  const rlHeaders = rateLimitHeaders(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400, rlHeaders);
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
      return json(await r.json(), r.status, rlHeaders);
    } catch (e) {
      console.error("registry write failed", { error: e instanceof Error ? e.message : e });
      return json({ error: "registry_unavailable", message: "upstream registry could not be reached" }, 503, rlHeaders);
    }
  }

  const result = await registerAgent(body);
  if (!result.ok) {
    return json(
      { error: result.error, message: result.message, ...(result.issues ? { issues: result.issues } : {}) },
      result.status,
      rlHeaders,
    );
  }

  const { record } = result;
  return json(
    {
      agent_id: record.agent_id,
      status: record.status,
      verification: { level: "L1_REGISTERED" },
      manifest_digest: { alg: "sha-256", value: record.manifest_digest },
      registered_at: record.registered_at,
      links: {
        card: `/a/${record.agent_id}`,
        envelope: `/api/resolve/${record.agent_id}`,
      },
      disclosures: L1_DISCLOSURES,
    },
    201,
    rlHeaders,
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...HEADERS, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" },
  });
}
