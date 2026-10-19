/**
 * Same-origin gate for routes that only AgenID's own pages may call.
 *
 * Today that is exactly one route: POST /api/retell/agents, which forwards a
 * caller-supplied Retell API key to Retell from agenid.com. Rate limiting bounds HOW
 * MUCH it can be used; this decides WHO may ask. Without it, any web page could make a
 * visitor's browser call the relay with a `text/plain` body — a "simple" request that
 * never triggers a CORS preflight — so the upstream call would happen even though the
 * attacking page could never read the answer.
 *
 * What this does NOT do, stated so nobody mistakes it for authentication: a non-browser
 * client can set any `Origin` or `Sec-Fetch-Site` header it likes. This closes the
 * cross-site browser path and forces a deliberate, forged request for everything else;
 * the residual risk is recorded in docs/threat-model.md (T-12 / relay).
 *
 * Decision rule, in order:
 *   1. `Sec-Fetch-Site: same-origin`            -> allowed (every current browser sends it)
 *   2. `Sec-Fetch-Site` present, any other value -> refused (cross-site, same-site, none)
 *   3. `Origin` whose host equals the request host -> allowed (older browsers)
 *   4. otherwise                                 -> refused, including no headers at all
 *
 * "Same-site" is refused on purpose: a sibling subdomain is not this application.
 */
export type SameOriginDecision = { allowed: true } | { allowed: false; reason: string };

function requestHost(req: Request): string | null {
  // Platform-set on Vercel; the Host header is the fallback for local `next start`.
  const forwarded = req.headers.get("x-forwarded-host");
  const host = (forwarded ?? req.headers.get("host") ?? "").split(",")[0]!.trim().toLowerCase();
  if (host) return host;
  try {
    return new URL(req.url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function checkSameOrigin(req: Request): SameOriginDecision {
  const site = req.headers.get("sec-fetch-site");
  if (site !== null) {
    return site.toLowerCase() === "same-origin"
      ? { allowed: true }
      : { allowed: false, reason: "request is not same-origin" };
  }
  const origin = req.headers.get("origin");
  if (!origin) return { allowed: false, reason: "no Origin or Sec-Fetch-Site header" };
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return { allowed: false, reason: "Origin header is not a URL" };
  }
  const host = requestHost(req);
  if (host && originHost === host) return { allowed: true };
  return { allowed: false, reason: "Origin does not match this site" };
}

/** True only for an `application/json` body (parameters allowed). */
export function isJsonContentType(req: Request): boolean {
  const ct = req.headers.get("content-type");
  if (!ct) return false;
  return ct.split(";")[0]!.trim().toLowerCase() === "application/json";
}
