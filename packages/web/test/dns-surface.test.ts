/**
 * Guards for the DNS/domain surface consolidation.
 *
 * Deliberately its own file rather than additions to `public-surface.test.ts`: that file
 * is edited by concurrent sessions on this repo, and the standing rule here is that a
 * guard goes in a new file rather than into one another session is holding. Coverage is
 * what matters, not which file it lives in.
 *
 * Every assertion below guards a drift that ACTUALLY SHIPPED. `/api/verify-dns` and
 * `/api/dns/verify` were byte-for-byte copies of one handler that had already diverged
 * (only one carried the domain-control disclosure); `/api/dns/detect` and
 * `/api/domain/status` both did provider detection and disagreed about GoDaddy; three
 * separate files built the TXT record value from their own local constant instead of the
 * single authoritative builder; and the OpenAPI document described 4 of 13 deployed
 * routes.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const PKG = join(__dirname, "..");
const APP = join(PKG, "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Strip comments before matching, so a file may explain a rule without tripping it. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const routeFiles = walk(APP).filter((f) => f.endsWith("route.ts") || f.endsWith("route.tsx"));

// ---------------------------------------------------------------------------
// One TXT-check implementation
// ---------------------------------------------------------------------------

describe("one DNS probe implementation", () => {
  it("no route resolves TXT records itself — they all go through lib/dns-probe", () => {
    const offenders = routeFiles.filter((f) => /\bresolveTxt\s*\(/.test(stripComments(readFileSync(f, "utf8"))));
    expect(offenders.map((f) => relative(PKG, f))).toEqual([]);
  });

  it("no route resolves NS or CNAME itself — provider detection is also shared", () => {
    const offenders = routeFiles.filter((f) => {
      const src = stripComments(readFileSync(f, "utf8"));
      return /\bresolveNs\s*\(/.test(src) || /\bresolveCname\s*\(/.test(src);
    });
    expect(offenders.map((f) => relative(PKG, f))).toEqual([]);
  });

  it("the verification record value is built in exactly one place", () => {
    // Two routes each carried `const PREFIX = "agenid-site-verification="` and built the
    // expected value from it, rather than calling verificationRecord(). A change to the
    // record's shape would have left them checking DNS for a value AgenID no longer asks
    // for — matching nothing, forever, with no error anywhere.
    const sources = walk(PKG)
      .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes("/node_modules/") && !f.includes("/.next/") && !f.includes("/test/"))
      .filter((f) => !f.endsWith(join("lib", "domain-connect.ts")));
    const offenders = sources.filter((f) => stripComments(readFileSync(f, "utf8")).includes("agenid-site-verification="));
    expect(offenders.map((f) => relative(PKG, f))).toEqual([]);
  });

  it("the domain-control disclosure is a shared constant, not per-route prose", () => {
    // The copy that lacked it was the one nobody was reading.
    const probe = readFileSync(join(PKG, "lib", "dns-probe.ts"), "utf8");
    expect(probe).toContain("DOMAIN_CONTROL_DISCLOSURES");
    expect(probe).toContain("Domain control is evidence, not a verification level");

    for (const name of ["api/verify-dns/route.ts", "api/domain/status/route.ts"]) {
      const src = readFileSync(join(APP, name), "utf8");
      expect(src, `${name} must import the shared disclosures`).toContain("DOMAIN_CONTROL_DISCLOSURES");
    }
  });
});

// ---------------------------------------------------------------------------
// No credential-holding DNS write path
// ---------------------------------------------------------------------------

describe("AgenID holds no write credential for a customer's DNS zone", () => {
  it("the deleted auto-add route has not come back", () => {
    const paths = routeFiles.map((f) => relative(APP, f));
    expect(paths).not.toContain(join("api", "dns", "auto-add", "route.ts"));
    // The whole /api/dns namespace is gone. A half-empty namespace invites a future
    // session to repopulate it with the route the architecture decision ruled out.
    expect(paths.filter((p) => p.startsWith(join("api", "dns")))).toEqual([]);
  });

  it("no source file reads a DNS provider write credential", () => {
    const sources = walk(PKG)
      .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes("/node_modules/") && !f.includes("/.next/") && !f.includes("/test/"));
    const offenders = sources.filter((f) => {
      const src = stripComments(readFileSync(f, "utf8"));
      return /CLOUDFLARE_API_TOKEN|GODADDY_API_KEY|GODADDY_API_SECRET/.test(src);
    });
    expect(offenders.map((f) => relative(PKG, f))).toEqual([]);
  });

  it("no source file writes to a DNS provider's API", () => {
    const sources = walk(PKG)
      .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes("/node_modules/") && !f.includes("/.next/") && !f.includes("/test/"));
    const offenders = sources.filter((f) => {
      const src = stripComments(readFileSync(f, "utf8"));
      return /api\.cloudflare\.com|api\.godaddy\.com\/v1\/domains/.test(src);
    });
    expect(offenders.map((f) => relative(PKG, f))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The OpenAPI document matches the deployed surface, in both directions
// ---------------------------------------------------------------------------

/** Map a route file to the URL path it serves. */
function routeUrlPath(file: string): string {
  const rel = relative(APP, file).replace(/[\\/]route\.tsx?$/, "");
  const segments = rel.split(/[\\/]/).filter((s) => s.length > 0 && !s.startsWith("("));
  return "/" + segments.map((s) => (s.startsWith("[") ? `{${s.slice(1, -1)}}` : s)).join("/");
}

describe("OpenAPI covers the deployed surface", () => {
  const spec = readFileSync(join(APP, "api", "v1", "openapi.json", "route.ts"), "utf8");
  const documented = new Set(Array.from(spec.matchAll(/^\s{6}"(\/[^"]*)":\s*\{$/gm), (m) => m[1]));
  const deployed = routeFiles.map(routeUrlPath);

  it("documents every deployed API route", () => {
    // Omission is a claim. A contract that understates the public surface tells a
    // security reviewer that endpoints which exist do not.
    const missing = deployed.filter((p) => !documented.has(p));
    expect(missing).toEqual([]);
  });

  it("documents no route that does not exist", () => {
    // The older, and still binding, half of the rule.
    const pageBacked = ["/a/{agenid}", "/badge.js", "/badge/{agenid}/shield.svg"];
    const extra = Array.from(documented).filter((p) => !deployed.includes(p) && !pageBacked.includes(p));
    expect(extra).toEqual([]);
  });

  it("every page-backed documented path has a handler on disk", () => {
    // /a, /badge.js and the SVG badge are served outside app/api, so the route scan
    // above cannot see them. Assert their files exist rather than exempting them.
    const files = walk(join(PKG, "app")).map((f) => relative(PKG, f));
    for (const needle of [join("app", "a"), join("app", "badge.js"), join("app", "badge")]) {
      expect(files.some((f) => f.startsWith(needle)), `${needle} must exist on disk`).toBe(true);
    }
  });

  it("names no verification level as issuable above L1 anywhere in the spec", () => {
    // The document describes levels in the envelope's enum, which is correct — the
    // protocol defines them. What it must never do is describe one as obtainable here.
    expect(spec).not.toMatch(/L5_CONTINUOUSLY_MONITORED/);
    expect(spec).toContain("root authority key ceremony has not been performed");
  });
});
