/**
 * POST /api/domain/status — the single endpoint the domain flow polls.
 *
 * One request returns everything the UI needs to render a live status: provider
 * detection, whether a one-click Domain Connect URL is available, the DNS record's
 * current state, and the state of the operator's `.well-known` key document.
 *
 * WHY ONE ENDPOINT: the alternative shape was three (detect, verify, and a well-known
 * probe), polled on three intervals, each able to disagree with the others about what
 * the operator's domain looks like right now. A status surface assembled from three
 * independently-timed reads can display a combination of states that never actually
 * coexisted. One read, one instant, one answer.
 *
 * WHAT THIS PROVES: domain control, and the presence of a published key document. Both
 * are EVIDENCE an authority would weigh. Neither is a verification level, and this
 * route never returns one — there is no root authority key in existence, so no level
 * above L1 is issuable by anything in this system today.
 */
import { resolveCname, resolveNs, resolveTxt } from "node:dns/promises";
import { isValidHostname } from "@agenid/core";
import {
  applyUrlFor,
  fallbackSettingsHost,
  templateIsRegistered,
  usableSyncUx,
  verificationRecord,
  type DomainConnectSettings,
} from "@/lib/domain-connect";
import { SITE_URL } from "@/lib/api";
import { POLICIES, checkRateLimit, rateLimitHeaders, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...HEADERS, ...extra } });

/** Bound every outbound probe: this route is polled, and a hung provider must not hang it. */
const PROBE_TIMEOUT_MS = 4000;

async function fetchSettings(host: string, domain: string): Promise<DomainConnectSettings | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${host}/v2/${encodeURIComponent(domain)}/settings`, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as DomainConnectSettings;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Probe the operator's own copy of their key document — the operator half of two-path key
 * discovery. The registry half is `GET /v1/keys/<key-ulid>`, served by this deployment; a
 * verifier fetches both and requires they agree.
 */
async function probeWellKnown(domain: string): Promise<{ present: boolean; url: string; status: number | null }> {
  const url = `https://${domain}/.well-known/agenid/keys.json`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    return { present: res.ok, url, status: res.status };
  } catch {
    return { present: false, url, status: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  /**
   * This route is an UNAUTHENTICATED AMPLIFIER and that, not load, is why it is bounded.
   *
   * One call makes up to four outbound probes (CNAME, NS, a Domain Connect settings
   * fetch, and an HTTPS request to the operator's `.well-known`) against a hostname the
   * CALLER chooses. Each probe is individually capped at 4s, but nothing capped the
   * number of probes — so an attacker could name a victim host and have agenid.com
   * generate traffic against it at whatever rate they liked.
   *
   * The limit clears the legitimate case with room to spare: /verify/domain polls this
   * every 6s, or ~10/min, against a 40/min bound.
   */
  const rl = await checkRateLimit(req, POLICIES.probe);
  if (!rl.allowed) return tooManyRequests(rl);
  const rlh = rateLimitHeaders(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400, rlh);
  }
  const { domain, token } = (body ?? {}) as Record<string, unknown>;

  if (typeof domain !== "string" || !isValidHostname(domain)) {
    return json({ error: "invalid_domain", message: "`domain` must be a valid hostname" }, 400, rlh);
  }
  if (typeof token !== "string" || token.length < 16) {
    return json({ error: "invalid_token", message: "`token` must be >= 16 characters" }, 400, rlh);
  }

  const record = verificationRecord(domain, token);

  // --- provider detection -------------------------------------------------
  let dcHost: string | null = null;
  try {
    const cnames = await resolveCname(`_domainconnect.${domain}`);
    dcHost = cnames[0] ?? null;
  } catch {
    // ENOTFOUND / ENODATA — provider does not support Domain Connect.
  }

  let nameservers: string[] = [];
  try {
    nameservers = await resolveNs(domain);
  } catch {
    // No NS records reachable — the domain may not exist yet.
  }
  const nsLower = nameservers.map((n) => n.toLowerCase());
  const providerName = nsLower.some((n) => n.endsWith(".ns.cloudflare.com"))
    ? "Cloudflare"
    : nsLower.some((n) => n.endsWith(".domaincontrol.com"))
      ? "GoDaddy"
      : null;

  let settings = dcHost ? await fetchSettings(dcHost, domain) : null;
  if (dcHost && !settings) {
    // The published CNAME target is not always a resolvable host — see fallbackSettingsHost.
    const alt = fallbackSettingsHost(dcHost);
    if (alt) settings = await fetchSettings(alt, domain);
  }
  const syncUx = usableSyncUx(settings);
  const applyUrl = syncUx
    ? applyUrlFor({
        syncUx,
        domain,
        token,
        redirectUri: `${SITE_URL}/verify/domain?domain=${encodeURIComponent(domain)}`,
      })
    : null;

  const reason: "no_domain_connect" | "no_sync_ux" | "template_unregistered" | null = !dcHost
    ? "no_domain_connect"
    : !syncUx
      ? "no_sync_ux"
      : !templateIsRegistered()
        ? "template_unregistered"
        : null;

  // --- DNS record state ---------------------------------------------------
  let txtFound = false;
  let txtMatched = false;
  let txtCount = 0;
  try {
    const records = await resolveTxt(`_agenid.${domain}`);
    const values = records.map((chunks) => chunks.join(""));
    txtCount = values.length;
    txtFound = values.length > 0;
    txtMatched = values.some((v) => v.trim() === record.value);
  } catch {
    // ENOTFOUND / ENODATA — not published yet. This is the normal starting state and is
    // never an error: an absent record means "not yet", not "failed".
  }

  const wellKnown = await probeWellKnown(domain);

  return json(
    {
      ok: true,
      domain,
      checked_at: new Date().toISOString(),
      provider: {
        name: providerName,
        nameservers,
        domain_connect: Boolean(dcHost),
        domain_connect_host: dcHost,
        provider_name: settings?.providerName ?? providerName,
        /** Non-null only when the operator can actually complete a one-click flow. */
        apply_url: applyUrl,
        reason,
      },
      records: [
        {
          ...record,
          /** "pending" until observed. Never "failed" — an unpublished record is not a failure. */
          status: txtMatched ? "verified" : "pending",
          observed_count: txtCount,
          /** A record exists at this host but does not carry our value — worth saying plainly. */
          other_records_present: txtFound && !txtMatched,
        },
      ],
      key_discovery: {
        url: wellKnown.url,
        status: wellKnown.present ? "verified" : "pending",
        http_status: wellKnown.status,
        note: "Optional. Publishing your key document here lets a verifier compare the registry's copy against your own.",
      },
      domain_control: txtMatched,
      proves: txtMatched ? "domain_control" : null,
      disclosures: [
        "Domain control is evidence, not a verification level. It does not by itself raise an agent above L1.",
        "No verification level is issued by this endpoint under any outcome.",
        "L2_DOMAIN_VERIFIED requires an assertion signed by the root authority key, which does not exist yet.",
      ],
    },
    200,
    rlh,
  );
}
