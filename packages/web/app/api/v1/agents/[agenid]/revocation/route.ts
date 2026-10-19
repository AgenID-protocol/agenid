/**
 * POST /api/v1/agents/{agenid}/revocation — permanently revoke an agent identity.
 *
 * The body is an operator-signed `Revocation` (v1.2-draft object, `revokes_type:
 * "agent"`). The rules live in `@agenid/api`'s revoke.ts, the single implementation
 * shared with the Fastify registry; this route only shapes the request and response.
 *
 * WHAT IS ACCEPTED: public material only — the signed revocation. The operator signs it
 * where the key lives (the browser tab at /revoke, or their own tooling); the registry
 * checks it against the operator key it already holds. No private key, and no AgenID
 * credential, can revoke an agent.
 *
 * Cross-origin callable, like registration: operator tooling must be able to reach it.
 * The signature is the authorization, so origin is irrelevant to who may revoke.
 */
import { API_URL } from "@/lib/api";
import { revokeAgent } from "@/lib/revoke";
import { revocationResponseBody } from "@agenid/api";
import { POLICIES, checkRateLimit, rateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" };
const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export async function POST(req: Request, ctx: { params: Promise<{ agenid: string }> }) {
  const rl = await checkRateLimit(req, POLICIES.register);
  if (!rl.allowed) return tooManyRequests(rl, { "access-control-allow-origin": "*" });
  const rlHeaders = rateLimitHeaders(rl);

  const { agenid } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400, rlHeaders);
  }

  // Same precedence as registration: a configured standalone registry is the writer.
  if (API_URL) {
    try {
      const r = await fetch(`${API_URL}/v1/agents/${encodeURIComponent(agenid)}/revocation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return json(await r.json(), r.status, rlHeaders);
    } catch (e) {
      console.error("registry revocation failed", { error: e instanceof Error ? e.message : e });
      return json({ error: "registry_unavailable", message: "upstream registry could not be reached" }, 503, rlHeaders);
    }
  }

  const result = await revokeAgent(body, { agentIdFromPath: agenid });
  if (!result.ok) {
    return json(
      { error: result.error, message: result.message, ...(result.issues ? { issues: result.issues } : {}) },
      result.status,
      rlHeaders,
    );
  }
  return json(revocationResponseBody(result), 200, rlHeaders);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...HEADERS, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" },
  });
}
