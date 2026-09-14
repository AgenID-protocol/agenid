/**
 * POST /api/verify-dns — real DNS TXT lookup for `_agenid.<domain>`.
 *
 * Proves DOMAIN CONTROL and nothing more. Domain control is evidence an authority
 * would weigh when issuing a VerificationAssertion; it is not itself a verification
 * level, and this route never returns one.
 *
 * The token must be supplied by the caller and compared here — there is no shared
 * constant. The replaced stub emitted a single hardcoded token
 * ("agenid-site-verification=aivh_7f9b8c2d1e9a3b5c7d8e") identical for every user and
 * every domain, which would have verified nothing for anyone.
 */
import { resolveTxt } from "node:dns/promises";
import { isValidHostname } from "@agenid/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

const PREFIX = "agenid-site-verification=";

export async function POST(req: Request) {
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

  const host = `_agenid.${domain}`;
  let records: string[][];
  try {
    records = await resolveTxt(host);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return json({ ok: false, domain, host, found: false, reason: "no_txt_record" }, 200);
    }
    return json({ error: "dns_error", message: e instanceof Error ? e.message : String(e), code: code ?? null }, 502);
  }

  // A TXT record can be chunked into multiple strings; join each record before matching.
  const values = records.map((chunks) => chunks.join(""));
  const expected = `${PREFIX}${token}`;
  const matched = values.some((v) => v.trim() === expected);

  return json(
    {
      ok: matched,
      domain,
      host,
      found: values.length > 0,
      matched,
      record_count: values.length,
      proves: matched ? "domain_control" : null,
      disclosures: [
        "Domain control is evidence, not a verification level. It does not by itself raise an agent above DECLARED.",
        "No verification level is issued by this endpoint under any outcome.",
      ],
    },
    200,
  );
}
