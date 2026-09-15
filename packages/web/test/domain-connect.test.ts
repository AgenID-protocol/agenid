import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DOMAIN_CONNECT_SERVICE,
  applyUrlFor,
  fallbackSettingsHost,
  templateIsRegistered,
  usableSyncUx,
  verificationRecord,
  type EnvLike,
} from "@/lib/domain-connect";

const WEB = process.cwd();

const REGISTERED: EnvLike = { AGENID_DOMAIN_CONNECT_PROVIDER_ID: "agenid.com" };
const UNREGISTERED: EnvLike = {};

describe("domain connect — registration gate", () => {
  /**
   * The gate is the whole point. An apply URL built before AgenID's template is
   * registered with DNS providers is a link to a 404 on Cloudflare's dashboard — an
   * overclaim rendered on someone else's domain, which is strictly worse than one of
   * our own. This is the same class as the "Domain Connect" capability pill that
   * `1a52a2c` had to relabel, so it is a test and not a comment.
   */
  it("produces no apply URL while the template is unregistered", () => {
    expect(templateIsRegistered(UNREGISTERED)).toBe(false);
    const url = applyUrlFor(
      { syncUx: "https://dash.cloudflare.com/domainconnect", domain: "acme.com", token: "a".repeat(32), redirectUri: "https://www.agenid.com/verify/domain" },
      UNREGISTERED,
    );
    expect(url).toBeNull();
  });

  it("is not satisfied by an arbitrary truthy value", () => {
    expect(templateIsRegistered({ AGENID_DOMAIN_CONNECT_PROVIDER_ID: "true" })).toBe(false);
    expect(templateIsRegistered({ AGENID_DOMAIN_CONNECT_PROVIDER_ID: "agenid.org" })).toBe(false);
  });

  it("builds the spec-shaped apply URL once registered", () => {
    const url = applyUrlFor(
      {
        syncUx: "https://dash.cloudflare.com/domainconnect/",
        domain: "acme.com",
        token: "b".repeat(32),
        redirectUri: "https://www.agenid.com/verify/domain?domain=acme.com",
      },
      REGISTERED,
    );
    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.pathname).toBe(
      `/domainconnect/v2/domainTemplates/providers/${DOMAIN_CONNECT_SERVICE.providerId}/services/${DOMAIN_CONNECT_SERVICE.serviceId}/apply`,
    );
    expect(parsed.searchParams.get("domain")).toBe("acme.com");
    expect(parsed.searchParams.get("token")).toBe("b".repeat(32));
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://www.agenid.com/verify/domain?domain=acme.com");
    // Trailing slash on the base must not double up.
    expect(url).not.toContain("//v2/");
  });
});

describe("domain connect — provider settings", () => {
  it("rejects a non-https sync endpoint", () => {
    // We are redirecting an operator, signed in to their DNS provider, at this URL.
    expect(usableSyncUx({ urlSyncUX: "http://dash.example.com/dc" })).toBeNull();
  });

  it("rejects a malformed or absent endpoint", () => {
    expect(usableSyncUx({ urlSyncUX: "not a url" })).toBeNull();
    expect(usableSyncUx({})).toBeNull();
    expect(usableSyncUx(null)).toBeNull();
  });

  it("normalizes a usable endpoint", () => {
    expect(usableSyncUx({ urlSyncUX: "https://dash.cloudflare.com/domainconnect//" })).toBe(
      "https://dash.cloudflare.com/domainconnect",
    );
  });
});

describe("domain connect — the record we ask for", () => {
  it("asks for exactly one record, carrying the caller's token", () => {
    const r = verificationRecord("acme.com", "c".repeat(32));
    expect(r).toEqual({ type: "TXT", name: "_agenid.acme.com", value: `agenid-site-verification=${"c".repeat(32)}`, ttl: 300 });
  });

  /**
   * The replaced stub emitted `agenid-site-verification=aivh_7f9b8c2d1e9a3b5c7d8e` for
   * every user and every domain, and it reached real DNS before anyone read the code
   * that produced it. Two different domains must never be handed the same record value.
   */
  it("never emits a shared constant across domains or tokens", () => {
    expect(verificationRecord("a.com", "x".repeat(32)).value).not.toBe(verificationRecord("a.com", "y".repeat(32)).value);
    expect(verificationRecord("a.com", "x".repeat(32)).name).not.toBe(verificationRecord("b.com", "x".repeat(32)).name);
    const src = fs.readFileSync(path.join(WEB, "lib", "domain-connect.ts"), "utf-8");
    expect(src).not.toMatch(/aivh_7f9b8c2d1e9a3b5c7d8e/);
  });
});

describe("domain connect — published template", () => {
  const template = JSON.parse(fs.readFileSync(path.join(WEB, "public", "domain-connect", "agent-identity.json"), "utf-8"));

  it("matches the ids the apply-URL builder uses", () => {
    // If these drift, every apply URL we build points at a template the provider cannot
    // resolve — and the failure surfaces on the provider's dashboard, not ours.
    expect(template.providerId).toBe(DOMAIN_CONNECT_SERVICE.providerId);
    expect(template.serviceId).toBe(DOMAIN_CONNECT_SERVICE.serviceId);
  });

  it("requests exactly the record verificationRecord() describes", () => {
    expect(template.records).toHaveLength(1);
    const [rec] = template.records;
    expect(rec.type).toBe("TXT");
    expect(rec.host).toBe("_agenid");
    expect(rec.data).toBe("agenid-site-verification=%token%");
    expect(rec.ttl).toBe(verificationRecord("acme.com", "z".repeat(32)).ttl);
  });

  it("names no domain outside the unified namespace", () => {
    const raw = JSON.stringify(template);
    expect(raw).not.toMatch(/agenid\.org/i);
    expect(raw).not.toMatch(/agenid\.ai\b/i);
    expect(raw).not.toMatch(/api\.agenid\.com/i);
  });
});

describe("domain flow — trust-state presentation", () => {
  const flow = fs.readFileSync(path.join(WEB, "components", "DomainFlow.tsx"), "utf-8");

  /**
   * A pending DNS record is not a failure. Every badge in this product renders an
   * unverified state neutral or amber and never red, because a red status screen during
   * normal DNS propagation teaches operators that AgenID's colours mean impatience
   * rather than trust state.
   */
  it("never renders a red state in the domain flow", () => {
    expect(flow).not.toMatch(/\b(?:text|bg|border)-red\b/);
    expect(flow).not.toMatch(/\bpill-bad\b/);
  });

  /**
   * A presentation layer displays trust state; it never decides it. The Retell wizard
   * rendered a hardcoded level while its route returned a different one, and that is
   * the defect this guards against here.
   */
  it("never hardcodes a verification level or claim state", () => {
    const stripped = flow.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const level of ["L1_REGISTERED", "L2_DOMAIN_VERIFIED", "L3_ORGANIZATION_VERIFIED", "L4_", "L5_", "DECLARED", "AUTHORIZED"]) {
      // The page may *name* a level in explanatory prose inside a JSX string, but must
      // never assign one as a value.
      expect(stripped).not.toMatch(new RegExp(`(?:level|status|claimState)\\s*[:=]\\s*["'\`]${level}`));
    }
  });

  /** The ceiling is stated on the page itself, not only in the API response. */
  it("states that L2 requires a root key that does not exist", () => {
    expect(flow).toMatch(/root authority key/i);
    expect(flow).toMatch(/L2_DOMAIN_VERIFIED/);
  });

  /** The verification token is public, but no private material may be persisted here. */
  it("stores nothing in browser storage", () => {
    expect(flow).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
});

describe("domain connect — settings-host fallback", () => {
  it("redirects GoDaddy's unresolvable CNAME target at their real settings API", () => {
    // Verified by request, not inferred: GET https://domainconnect.api.godaddy.com
    // /v2/coolexample.com/settings returns 200 with providerId "godaddy", while the
    // CNAME target _domainconnect.gd.domaincontrol.com has no A record at all.
    expect(fallbackSettingsHost("_domainconnect.gd.domaincontrol.com")).toBe("domainconnect.api.godaddy.com");
    expect(fallbackSettingsHost("_domainconnect.gd.domaincontrol.com.")).toBe("domainconnect.api.godaddy.com");
  });

  it("has no fallback for a provider we have not verified", () => {
    // An unverified guess here sends an operator's domain name to a host we have never
    // called. Absent is the correct answer until someone checks.
    expect(fallbackSettingsHost("domainconnect.example.net")).toBeNull();
  });
});
