/**
 * POST /api/dns/detect — detect DNS provider capabilities for a domain.
 *
 * Checks:
 * 1. Domain Connect support via _domainconnect.<domain> CNAME
 * 2. Cloudflare nameservers (*.ns.cloudflare.com)
 * 3. GoDaddy nameservers (*.domaincontrol.com)
 *
 * Returns detected capabilities so the UI can offer 1-click auto-add
 * or fall back to manual TXT record instructions.
 */
import { resolveCname, resolveNs } from "node:dns/promises";
import { isValidHostname } from "@agenid/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

interface ProviderCapabilities {
  domain_connect: boolean;
  domain_connect_host: string | null;
  cloudflare: boolean;
  godaddy: boolean;
  nameservers: string[];
  recommended: "domain_connect" | "cloudflare" | "godaddy" | "manual";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400);
  }
  const { domain } = (body ?? {}) as Record<string, unknown>;
  if (typeof domain !== "string" || !isValidHostname(domain)) {
    return json({ error: "invalid_domain", message: "`domain` must be a valid hostname" }, 400);
  }

  const caps: ProviderCapabilities = {
    domain_connect: false,
    domain_connect_host: null,
    cloudflare: false,
    godaddy: false,
    nameservers: [],
    recommended: "manual",
  };

  // 1. Check Domain Connect
  try {
    const cnames = await resolveCname(`_domainconnect.${domain}`);
    if (cnames.length > 0) {
      caps.domain_connect = true;
      caps.domain_connect_host = cnames[0];
    }
  } catch {
    // ENOTFOUND / ENODATA — no Domain Connect support
  }

  // 2. Check nameservers
  try {
    const ns = await resolveNs(domain);
    caps.nameservers = ns;
    const nsLower = ns.map((n) => n.toLowerCase());
    caps.cloudflare = nsLower.some((n) => n.endsWith(".ns.cloudflare.com"));
    caps.godaddy = nsLower.some((n) => n.endsWith(".domaincontrol.com"));
  } catch {
    // No NS records — domain may not exist or DNS is unreachable
  }

  // Determine recommended method
  if (caps.domain_connect) {
    caps.recommended = "domain_connect";
  } else if (caps.cloudflare && process.env.CLOUDFLARE_API_TOKEN) {
    caps.recommended = "cloudflare";
  } else if (caps.godaddy && process.env.GODADDY_API_KEY) {
    caps.recommended = "godaddy";
  } else {
    caps.recommended = "manual";
  }

  return json({ ok: true, domain, capabilities: caps }, 200);
}
