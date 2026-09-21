/**
 * POST /api/verify-dns — the one standalone `_agenid.<domain>` TXT check.
 *
 * Proves DOMAIN CONTROL and nothing more. Domain control is evidence an authority
 * would weigh when issuing a VerificationAssertion; it is not itself a verification
 * level, and this route never returns one.
 *
 * The token must be supplied by the caller and compared here — there is no shared
 * constant. The replaced stub emitted a single hardcoded token
 * ("agenid-site-verification=aivh_7f9b8c2d1e9a3b5c7d8e") identical for every user and
 * every domain, which would have verified nothing for anyone.
 *
 * This route no longer performs the check itself. `POST /api/dns/verify` was a
 * byte-for-byte copy of the handler that used to live here, and the two had already
 * drifted — only this one carried the domain-control disclosure. Both now delegate to
 * one probe, and that route is gone. See `lib/dns-probe.ts`.
 */
import { isValidHostname } from "@agenid/core";
import { DOMAIN_CONTROL_DISCLOSURES, probeTxtRecord } from "@/lib/dns-probe";
import { POLICIES, checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export async function POST(req: Request) {
  /** Outbound DNS against a caller-supplied hostname — an amplifier, same class as /api/domain/status. */
  const rl = await checkRateLimit(req, POLICIES.probe);
  if (!rl.allowed) return tooManyRequests(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400);
  }
  const { domain, token } = (body ?? {}) as Record<string, unknown>;

  if (typeof domain !== "string" || !isValidHostname(domain)) {
    return json({ error: "invalid_domain", message: "`domain` must be a valid hostname" }, 400);
  }
  if (typeof token !== "string" || token.length < 16) {
    return json(
      { error: "invalid_token", message: "`token` must be the per-domain value you generated (>= 16 chars)" },
      400,
    );
  }

  const probe = await probeTxtRecord(domain, token);

  // A resolver failure that is not simple absence is a 502 here, deliberately: a caller
  // asking this route a direct question deserves to know the answer is unknown rather
  // than be told "no record". /api/domain/status makes the opposite call, because a
  // polled status surface renders "pending" and will ask again in six seconds.
  if (probe.error) {
    // Fixed text, never the resolver's own message: Node's DNS errors interpolate the
    // queried name (`queryTxt ESERVFAIL _agenid.<caller input>`), and this route does not
    // echo caller input back — the same policy as the key route. The code alone
    // (ESERVFAIL, ETIMEOUT, …) is a fixed vocabulary and is all a caller needs.
    const code = typeof probe.error.code === "string" && /^E[A-Z]+$/.test(probe.error.code) ? probe.error.code : null;
    return json(
      {
        error: "dns_error",
        message: "The DNS lookup failed before an answer was returned. The record's state is unknown, not absent — try again.",
        code,
      },
      502,
    );
  }

  if (!probe.found) {
    return json({ ok: false, domain, host: probe.host, found: false, reason: "no_txt_record" }, 200);
  }

  return json(
    {
      ok: probe.matched,
      domain,
      host: probe.host,
      found: true,
      matched: probe.matched,
      record_count: probe.count,
      proves: probe.matched ? "domain_control" : null,
      disclosures: DOMAIN_CONTROL_DISCLOSURES,
    },
    200,
  );
}
