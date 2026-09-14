/**
 * POST /api/retell/agents — list the caller's Retell agents.
 *
 * Salvaged from a generated stub; the original assumed `list-agents` returns a bare
 * array and would 500 on the object-wrapped shape. It also claimed to "validate" the
 * key — it does not validate anything beyond what Retell itself accepts. Renamed and
 * rescoped accordingly: this is a read-only proxy, nothing more.
 *
 * The API key is used for exactly one upstream call and is never logged or stored.
 */
import { normalizeRetellList } from "../../../../lib/retell-manifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400);
  }
  const { api_key: apiKey } = (body ?? {}) as Record<string, unknown>;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return json({ error: "missing_api_key", message: "`api_key` is required" }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.retellai.com/list-agents", {
      headers: { authorization: `Bearer ${apiKey}` },
    });
  } catch (e) {
    return json({ error: "upstream_unreachable", message: e instanceof Error ? e.message : String(e) }, 502);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return json({ error: "retell_unauthorized", message: "Retell rejected this API key" }, 401);
  }
  if (!upstream.ok) {
    return json({ error: "retell_error", message: `Retell returned ${upstream.status}`, status: upstream.status }, 502);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "retell_bad_response", message: "Retell response was not JSON" }, 502);
  }

  const agents = normalizeRetellList(payload).map((a) => ({
    agent_id: typeof a.agent_id === "string" ? a.agent_id : null,
    agent_name: typeof a.agent_name === "string" ? a.agent_name : null,
  }));

  return json({ ok: true, count: agents.length, agents }, 200);
}
