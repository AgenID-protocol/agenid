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
import { POLICIES, checkRateLimit, rateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";
import { checkSameOrigin, isJsonContentType } from "@/lib/same-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export async function POST(req: Request) {
  /**
   * Who may ask, before how often. Only AgenID's own onboarding page calls this route,
   * so a cross-site or headerless request is refused before it consumes rate-limit
   * budget and before the body — and the credential inside it — is read. A JSON content
   * type is required too: a `text/plain` body is a CORS "simple request" that skips the
   * preflight, and it is the only way a third-party page could have reached the upstream
   * call at all. See lib/same-origin.ts for what this does and does not prove.
   */
  const so = checkSameOrigin(req);
  if (!so.allowed) {
    return json({ error: "cross_origin_refused", message: "this endpoint only accepts requests from agenid.com pages" }, 403);
  }
  if (!isJsonContentType(req)) {
    return json({ error: "unsupported_media_type", message: "`content-type` must be application/json" }, 415);
  }

  /**
   * The tightest limit in the table, and the risk is not load on AgenID.
   *
   * This route forwards a caller-supplied bearer token to a third party FROM AgenID's
   * own domain and IP range. Unbounded, it is an open relay: an attacker can use it to
   * probe Retell credentials at volume while every request Retell sees originates from
   * agenid.com. The reputational damage lands here and the abuse lands there.
   *
   * Bounded before the body is read, so the token is not even parsed when the caller is
   * already over the limit.
   */
  const rl = await checkRateLimit(req, POLICIES.relay);
  if (!rl.allowed) return tooManyRequests(rl);
  const rlh = rateLimitHeaders(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400, rlh);
  }
  const { api_key: apiKey } = (body ?? {}) as Record<string, unknown>;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    return json({ error: "missing_api_key", message: "`api_key` is required" }, 400, rlh);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.retellai.com/list-agents", {
      headers: { authorization: `Bearer ${apiKey}` },
    });
  } catch (e) {
    return json({ error: "upstream_unreachable", message: e instanceof Error ? e.message : String(e) }, 502, rlh);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return json({ error: "retell_unauthorized", message: "Retell rejected this API key" }, 401, rlh);
  }
  if (!upstream.ok) {
    return json({ error: "retell_error", message: `Retell returned ${upstream.status}`, status: upstream.status }, 502, rlh);
  }

  let payload: unknown;
  try {
    payload = await upstream.json();
  } catch {
    return json({ error: "retell_bad_response", message: "Retell response was not JSON" }, 502, rlh);
  }

  const agents = normalizeRetellList(payload).map((a) => ({
    agent_id: typeof a.agent_id === "string" ? a.agent_id : null,
    agent_name: typeof a.agent_name === "string" ? a.agent_name : null,
  }));

  return json({ ok: true, count: agents.length, agents }, 200, rlh);
}
