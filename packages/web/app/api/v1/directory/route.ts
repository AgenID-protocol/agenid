/**
 * /api/v1/directory — the opt-in public agent directory.
 *
 *   GET   the listed agents (bounded page), for machine readers of /agents.
 *   POST  an operator-signed directory consent: list or delist one agent.
 *
 * The consent rules live in lib/directory.ts, the single implementation; this route only
 * shapes the request and the response. A consent carries public material only — the
 * operator signs it where the key lives (the browser tab that issued it, or their own
 * tooling) and the registry verifies it against the operator key it already holds.
 *
 * A listing is not a verification and changes no level. The level of each listed agent
 * is whatever its resolution envelope says, read at /a/<agenid>.
 */
import { applyDirectoryConsent, DIRECTORY_DISCLOSURES, DIRECTORY_PAGE_MAX, getDirectoryStore } from "@/lib/directory";
import { getStore } from "@/lib/api";
import { POLICIES, checkRateLimit, rateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" };
const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

export async function GET() {
  try {
    const rows = await getDirectoryStore().listListed(DIRECTORY_PAGE_MAX);
    const store = getStore();
    const agents = [];
    for (const r of rows) {
      const a = await store.getAgent(r.agent_id);
      if (!a || a.status !== "ACTIVE") continue;
      agents.push({
        agent_id: a.agent_id,
        name: a.manifest.identity.name,
        operator: a.manifest.ownership.operator,
        operator_domain: a.manifest.ownership.operator_domain,
        listed_at: r.updated_at,
        card: `/a/${a.agent_id}`,
      });
    }
    return json({ agents, count: agents.length, disclosures: DIRECTORY_DISCLOSURES }, 200);
  } catch {
    return json({ error: "registry_unavailable", message: "the directory could not be read" }, 503);
  }
}

export async function POST(req: Request) {
  // Bounded before the body is read, like every other public write path.
  const rl = await checkRateLimit(req, POLICIES.register);
  if (!rl.allowed) return tooManyRequests(rl, { "access-control-allow-origin": "*" });
  const rlHeaders = rateLimitHeaders(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400, rlHeaders);
  }

  const result = await applyDirectoryConsent(body);
  if (!result.ok) return json({ error: result.error, message: result.message }, result.status, rlHeaders);

  const { record } = result;
  return json(
    {
      agent_id: record.agent_id,
      listed: record.listed,
      updated_at: record.updated_at,
      links: { directory: "/agents", card: `/a/${record.agent_id}` },
      disclosures: DIRECTORY_DISCLOSURES,
    },
    200,
    rlHeaders,
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...HEADERS, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" },
  });
}
