/**
 * POST /api/dns/auto-add — automatically add the _agenid TXT record via
 * Cloudflare or GoDaddy direct API.
 *
 * Requires server-side API credentials:
 *   - Cloudflare: CLOUDFLARE_API_TOKEN (scoped to Zone.DNS edit)
 *   - GoDaddy:    GODADDY_API_KEY + GODADDY_API_SECRET
 *
 * If credentials are missing for the requested provider, returns 501.
 */
import { isValidHostname } from "@agenid/core";
import { POLICIES, checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

// ---------------------------------------------------------------------------
// Cloudflare: find zone, upsert TXT record
// ---------------------------------------------------------------------------

async function cloudflareAddTxt(domain: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) return { ok: false, error: "CLOUDFLARE_API_TOKEN not configured" };

  const cfHeaders = { authorization: `Bearer ${apiToken}`, "content-type": "application/json" };
  const recordName = `_agenid.${domain}`;
  const recordContent = `agenid-site-verification=${token}`;

  // Step 1: Find the zone ID for this domain
  const zonesRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&status=active`, {
    headers: cfHeaders,
  });
  if (!zonesRes.ok) return { ok: false, error: `Cloudflare zones lookup failed: ${zonesRes.status}` };
  const zonesBody = (await zonesRes.json()) as { result?: { id: string }[] };
  const zoneId = zonesBody.result?.[0]?.id;
  if (!zoneId) return { ok: false, error: `No active Cloudflare zone found for ${domain}` };

  // Step 2: Check for existing _agenid TXT record
  const existingRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?type=TXT&name=${encodeURIComponent(recordName)}`,
    { headers: cfHeaders },
  );
  const existingBody = (await existingRes.json()) as { result?: { id: string }[] };
  const existingId = existingBody.result?.[0]?.id;

  // Step 3: Create or update the TXT record
  const payload = JSON.stringify({ type: "TXT", name: recordName, content: recordContent, ttl: 300 });

  const writeRes = existingId
    ? await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existingId}`, {
        method: "PUT",
        headers: cfHeaders,
        body: payload,
      })
    : await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
        method: "POST",
        headers: cfHeaders,
        body: payload,
      });

  if (!writeRes.ok) {
    const err = await writeRes.text();
    return { ok: false, error: `Cloudflare DNS write failed: ${writeRes.status} ${err}` };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// GoDaddy: upsert TXT record
// ---------------------------------------------------------------------------

async function godaddyAddTxt(domain: string, token: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.GODADDY_API_KEY;
  const apiSecret = process.env.GODADDY_API_SECRET;
  if (!apiKey || !apiSecret) return { ok: false, error: "GODADDY_API_KEY and GODADDY_API_SECRET not configured" };

  const gdHeaders = {
    authorization: `sso-key ${apiKey}:${apiSecret}`,
    "content-type": "application/json",
  };
  const recordContent = `agenid-site-verification=${token}`;

  const res = await fetch(`https://api.godaddy.com/v1/domains/${encodeURIComponent(domain)}/records/TXT/_agenid`, {
    method: "PUT",
    headers: gdHeaders,
    body: JSON.stringify([{ data: recordContent, ttl: 600 }]),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: `GoDaddy DNS write failed: ${res.status} ${err}` };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  /**
   * Holds a provider credential and writes to a third party\u2019s DNS zone. Bounded at the\n   * relay rate for the same reason /api/retell/agents is: the abuse lands on someone\n   * else\u2019s API with AgenID as the apparent source.
   */
  const rl = await checkRateLimit(req, POLICIES.relay);
  if (!rl.allowed) return tooManyRequests(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400);
  }
  const { domain, token, provider } = (body ?? {}) as Record<string, unknown>;

  if (typeof domain !== "string" || !isValidHostname(domain)) {
    return json({ error: "invalid_domain", message: "`domain` must be a valid hostname" }, 400);
  }
  if (typeof token !== "string" || token.length < 16) {
    return json({ error: "invalid_token", message: "`token` must be >= 16 chars" }, 400);
  }
  if (provider !== "cloudflare" && provider !== "godaddy") {
    return json({ error: "invalid_provider", message: "`provider` must be 'cloudflare' or 'godaddy'" }, 400);
  }

  let result: { ok: boolean; error?: string };
  try {
    result = provider === "cloudflare" ? await cloudflareAddTxt(domain, token) : await godaddyAddTxt(domain, token);
  } catch (e) {
    return json({ error: "provider_error", message: e instanceof Error ? e.message : String(e) }, 502);
  }

  if (!result.ok) {
    return json({ ok: false, error: "dns_write_failed", message: result.error }, 502);
  }

  return json(
    {
      ok: true,
      domain,
      provider,
      record: { type: "TXT", name: `_agenid.${domain}`, value: `agenid-site-verification=${token}` },
      note: "DNS propagation may take 30-300 seconds. Verify after a brief wait.",
    },
    200,
  );
}
