/**
 * The one DNS probe implementation.
 *
 * WHY THIS MODULE EXISTS: the `_agenid` TXT check was implemented three times —
 * `/api/verify-dns`, `/api/dns/verify`, and inline in `/api/domain/status` — and
 * provider detection twice. They had already drifted in three separate ways, and every
 * one of those drifts is the reason this file is a module rather than a convention:
 *
 *   1. Two of the three built the record value from their own local `PREFIX` constant
 *      instead of calling `verificationRecord()`. A change to the record's shape would
 *      have left two endpoints checking DNS for a value AgenID no longer asks for, and
 *      reporting `matched: false` forever with no error anywhere.
 *   2. `/api/verify-dns` carried the "domain control is evidence, not a level"
 *      disclosure; its byte-for-byte twin `/api/dns/verify` did not. The honesty rule
 *      was enforced on one copy of the same endpoint.
 *   3. `/api/dns/detect` did spec-literal Domain Connect discovery, which dead-ends at
 *      GoDaddy (their published CNAME target has no A record). `/api/domain/status`
 *      had the fallback. So the two routes disagreed about whether the same domain
 *      supported Domain Connect.
 *
 * This module decides nothing about trust. It reports what DNS says. Routes shape the
 * response — including whether a resolver failure is a 502 or a "not yet" — because
 * that is a route's job and not a probe's.
 */
import { resolveCname, resolveNs, resolveTxt } from "node:dns/promises";
import { verificationRecord } from "@/lib/domain-connect";

/** Bound every outbound probe: these routes are polled, and a hung resolver must not hang them. */
export const PROBE_TIMEOUT_MS = 4000;

export interface TxtProbe {
  /** The host actually queried, always `_agenid.<domain>`. */
  host: string;
  /** The exact record AgenID asks for, from the single authoritative builder. */
  record: ReturnType<typeof verificationRecord>;
  /** Any TXT record present at the host. */
  found: boolean;
  /** Our exact value present at the host. */
  matched: boolean;
  /** How many TXT records were observed. */
  count: number;
  /**
   * A resolver failure that is NOT simple absence. NXDOMAIN/ENODATA are reported as
   * `found: false` with no error, because an unpublished record is "not yet", never a
   * failure — the rule the whole domain flow follows.
   */
  error: { code: string | null; message: string } | null;
}

export async function probeTxtRecord(domain: string, token: string): Promise<TxtProbe> {
  const record = verificationRecord(domain, token);
  const host = record.name;
  const base = { host, record, found: false, matched: false, count: 0, error: null } as const;

  let records: string[][];
  try {
    records = await resolveTxt(host);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? null;
    if (code === "ENOTFOUND" || code === "ENODATA") return { ...base };
    return { ...base, error: { code, message: e instanceof Error ? e.message : String(e) } };
  }

  // A TXT record can be chunked into multiple strings; join each record before matching.
  const values = records.map((chunks) => chunks.join(""));
  return {
    host,
    record,
    found: values.length > 0,
    matched: values.some((v) => v.trim() === record.value),
    count: values.length,
    error: null,
  };
}

export interface ProviderProbe {
  /** Recognised operator-facing provider name, or null when we do not recognise the NS set. */
  name: "Cloudflare" | "GoDaddy" | null;
  nameservers: string[];
  domainConnect: boolean;
  domainConnectHost: string | null;
}

export async function probeProvider(domain: string): Promise<ProviderProbe> {
  let domainConnectHost: string | null = null;
  try {
    const cnames = await resolveCname(`_domainconnect.${domain}`);
    domainConnectHost = cnames[0] ?? null;
  } catch {
    // ENOTFOUND / ENODATA — provider does not publish Domain Connect discovery.
  }

  let nameservers: string[] = [];
  try {
    nameservers = await resolveNs(domain);
  } catch {
    // No NS records reachable — the domain may not exist yet.
  }

  const nsLower = nameservers.map((n) => n.toLowerCase());
  const name = nsLower.some((n) => n.endsWith(".ns.cloudflare.com"))
    ? "Cloudflare"
    : nsLower.some((n) => n.endsWith(".domaincontrol.com"))
      ? "GoDaddy"
      : null;

  return { name, nameservers, domainConnect: Boolean(domainConnectHost), domainConnectHost };
}

/**
 * The disclosure that must accompany any domain-control result, on every surface that
 * reports one. It lives here rather than in each route because the previous arrangement
 * — the same check behind two addresses, disclosed on one of them — is exactly how a
 * copy of an endpoint ends up quietly less honest than its twin.
 */
export const DOMAIN_CONTROL_DISCLOSURES = [
  "Domain control is evidence, not a verification level. It does not by itself raise an agent above L1.",
  "No verification level is issued by this endpoint under any outcome.",
  "L2_DOMAIN_VERIFIED requires an assertion signed by the root authority key, which does not exist yet.",
] as const;
