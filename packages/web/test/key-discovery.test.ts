/**
 * The operator half of two-path key discovery must never report a key document that
 * was not served.
 *
 * REGRESSION GUARD, not a hypothetical. Until Sept 20, `/api/domain/status` mapped any
 * 2xx to `key_discovery.status: "verified"`. `aiventureholdings.com` — the operator
 * domain of AgenID's own flagship pilot — answers every unknown path with its SPA
 * homepage as `200 text/html`, and the endpoint reported it as verified, live.
 *
 * The first test below reproduces that exact response. It is the one proven to fail
 * against the old implementation.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

// The route-level test must not touch real DNS. Only the two DNS probes are replaced;
// the constants and the key-discovery probe under test are the real ones.
vi.mock("@/lib/dns-probe", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/dns-probe")>();
  return {
    ...real,
    probeProvider: async () => ({ nameservers: ["ns1.example"], domainConnectHost: null, name: null }),
    probeTxtRecord: async (domain: string, token: string) => ({
      record: { type: "TXT", name: `_agenid.${domain}`, value: `agenid-site-verification=${token}`, ttl: 300 },
      found: false,
      matched: false,
      count: 0,
    }),
  };
});
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { KEYS_SCHEMA_ID, type KeyDocument } from "@agenid/core";
import {
  MAX_KEYS_DOCUMENT_BYTES,
  isJsonContentType,
  keyDocumentUrl,
  probeKeyDiscovery,
} from "../lib/key-discovery";
import { generateKeyPair, signAgent } from "../lib/client-crypto";

const DOMAIN = "operator.example";
let keyDoc: KeyDocument;

beforeAll(async () => {
  const signed = await signAgent(generateKeyPair(), "Key Discovery Probe", {
    operator: "Example Operator",
    operatorDomain: DOMAIN,
    purposeSummary: "Exercises the operator-half key discovery probe.",
    disclosesToUser: false,
    humanEscalation: false,
    channels: ["voice"],
  });
  keyDoc = signed.keyDocument as KeyDocument;
});

const validDoc = (domain = DOMAIN) => ({ $schema: KEYS_SCHEMA_ID, controller_domain: domain, keys: [keyDoc] });

/** A fetch that answers one fixed response and records the URL it was asked for. */
function respond(body: BodyInit | null, init: ResponseInit = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(body, init);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (v: unknown, type = "application/json") =>
  respond(JSON.stringify(v), { status: 200, headers: { "content-type": type } });

const probe = (f: typeof fetch, domain = DOMAIN) => probeKeyDiscovery(domain, { timeoutMs: 2000, fetchImpl: f });

describe("probeKeyDiscovery — the SPA catch-all trap", () => {
  it("a 200 text/html homepage is NOT a published key document", async () => {
    const html = `<!doctype html><html lang="en"><head><title>AI Venture Holdings</title></head><body><div id="root"></div></body></html>`;
    const { fetchImpl } = respond(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
    const r = await probe(fetchImpl);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("not_json");
    expect(r.http_status).toBe(200);
    expect(r.state).not.toBe("published");
  });

  it("a 200 with no content-type is not assumed to be JSON", async () => {
    const r = await probe(respond(JSON.stringify(validDoc()), { status: 200, headers: { "content-type": "" } }).fetchImpl);
    expect(r).toMatchObject({ state: "invalid", reason: "not_json" });
  });
});

describe("probeKeyDiscovery — what published requires", () => {
  it("a strict KeysDocument naming this domain is published", async () => {
    const { fetchImpl, calls } = json(validDoc());
    const r = await probe(fetchImpl);
    expect(r).toMatchObject({ state: "published", reason: null, http_status: 200, key_count: 1 });
    expect(calls).toEqual([keyDocumentUrl(DOMAIN)]);
  });

  it("accepts a +json structured-syntax type and ignores parameters", async () => {
    expect((await probe(json(validDoc(), "application/vnd.agenid+json; charset=utf-8").fetchImpl)).state).toBe("published");
    expect(isJsonContentType("Application/JSON; charset=UTF-8")).toBe(true);
    expect(isJsonContentType("text/html")).toBe(false);
    expect(isJsonContentType("application/jsonp")).toBe(false);
  });

  it("matches the controller domain case-insensitively", async () => {
    expect((await probe(json(validDoc("Operator.Example")).fetchImpl)).state).toBe("published");
  });

  it("JSON that does not parse is invalid/malformed_json", async () => {
    const r = await probe(respond("{ not json", { status: 200, headers: { "content-type": "application/json" } }).fetchImpl);
    expect(r).toMatchObject({ state: "invalid", reason: "malformed_json" });
  });

  it("valid JSON of the wrong shape is invalid/schema_invalid", async () => {
    expect(await probe(json({ hello: "world" }).fetchImpl)).toMatchObject({ state: "invalid", reason: "schema_invalid" });
  });

  it("an empty keys array is invalid — a key document with no keys publishes nothing", async () => {
    expect(await probe(json({ ...validDoc(), keys: [] }).fetchImpl)).toMatchObject({ state: "invalid", reason: "schema_invalid" });
  });

  it("an extra member is invalid — the parse is strict, nothing passes through", async () => {
    expect(await probe(json({ ...validDoc(), note: "extra" }).fetchImpl)).toMatchObject({ state: "invalid", reason: "schema_invalid" });
  });

  it("private key material in a key is invalid", async () => {
    const leaky = { ...validDoc(), keys: [{ ...keyDoc, private_key_b64u: "AAAA" }] };
    expect(await probe(json(leaky).fetchImpl)).toMatchObject({ state: "invalid", reason: "schema_invalid" });
  });

  it("a document naming a different controller domain is not this domain's document", async () => {
    expect(await probe(json(validDoc("someone-else.example")).fetchImpl)).toMatchObject({
      state: "invalid",
      reason: "controller_domain_mismatch",
    });
  });
});

describe("probeKeyDiscovery — absence and failure are not verdicts", () => {
  it("404 and 410 are absent", async () => {
    expect(await probe(respond("nope", { status: 404 }).fetchImpl)).toMatchObject({ state: "absent", reason: null, http_status: 404 });
    expect((await probe(respond(null, { status: 410 }).fetchImpl)).state).toBe("absent");
  });

  it("a 5xx is unreachable, not invalid — the operator's server is down, not wrong", async () => {
    expect(await probe(respond("err", { status: 503 }).fetchImpl)).toMatchObject({ state: "unreachable", reason: "http_503" });
  });

  it("any other non-2xx is invalid with the status as its reason", async () => {
    expect(await probe(respond("no", { status: 403 }).fetchImpl)).toMatchObject({ state: "invalid", reason: "http_403" });
  });

  it("a network error is unreachable", async () => {
    const boom = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    expect(await probe(boom)).toMatchObject({ state: "unreachable", http_status: null });
  });

  it("a hung server is unreachable within the timeout", async () => {
    const hang = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as typeof fetch;
    const started = Date.now();
    const r = await probeKeyDiscovery(DOMAIN, { timeoutMs: 50, fetchImpl: hang });
    expect(r.state).toBe("unreachable");
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("probeKeyDiscovery — bounded reads", () => {
  it("rejects an oversized body by declared length without reading it", async () => {
    const r = await probe(
      respond("{}", { status: 200, headers: { "content-type": "application/json", "content-length": String(MAX_KEYS_DOCUMENT_BYTES + 1) } })
        .fetchImpl,
    );
    expect(r).toMatchObject({ state: "invalid", reason: "too_large" });
  });

  it("rejects an oversized body that lies about (or omits) its length", async () => {
    const big = "x".repeat(MAX_KEYS_DOCUMENT_BYTES + 10);
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(big));
        c.close();
      },
    });
    const r = await probe(respond(stream, { status: 200, headers: { "content-type": "application/json" } }).fetchImpl);
    expect(r).toMatchObject({ state: "invalid", reason: "too_large" });
  });
});

describe("POST /api/domain/status — end to end through the real route", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  async function statusFor(keysResponse: () => Response) {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/.well-known/agenid/keys.json")) return keysResponse();
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    const { POST } = await import("../app/api/domain/status/route");
    const res = await POST(
      new Request("https://www.agenid.com/api/domain/status", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.7" },
        body: JSON.stringify({ domain: DOMAIN, token: "agenid-probe-token-0000000000" }),
      }),
    );
    expect(res.status).toBe(200);
    return (await res.json()) as { key_discovery: { status: string; reason: string | null; http_status: number | null } };
  }

  it("reports the SPA homepage as invalid/not_json — the response that used to say 'verified'", async () => {
    const body = await statusFor(
      () => new Response("<!doctype html><html></html>", { status: 200, headers: { "content-type": "text/html" } }),
    );
    expect(body.key_discovery.status).not.toBe("verified");
    expect(body.key_discovery).toMatchObject({ status: "invalid", reason: "not_json", http_status: 200 });
  });

  it("reports a real key document as published", async () => {
    const body = await statusFor(
      () => new Response(JSON.stringify(validDoc()), { status: 200, headers: { "content-type": "application/json" } }),
    );
    expect(body.key_discovery).toMatchObject({ status: "published", reason: null });
  });
});

describe("the route and the UI tell the same truth", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  it("the domain status route delegates to probeKeyDiscovery and never maps a bare 2xx to a state", () => {
    const route = code("app/api/domain/status/route.ts");
    expect(route).toMatch(/probeKeyDiscovery\(/);
    expect(route).not.toMatch(/present:\s*res\.ok/);
    expect(route).not.toMatch(/key_discovery[\s\S]{0,200}"verified"/);
  });

  it("the key-discovery state vocabulary contains no 'verified'", () => {
    const lib = code("lib/key-discovery.ts");
    const union = lib.match(/export type KeyDiscoveryState\s*=([^;]+);/)?.[1] ?? "";
    expect(union).toMatch(/"published"/);
    expect(union).not.toMatch(/verified/);
  });

  it("DomainFlow renders a published key document neutral, never mint and never red", () => {
    const ui = code("components/DomainFlow.tsx");
    const pill = ui.match(/function KeyDocPill[\s\S]*?\n}\n/)?.[0] ?? "";
    expect(pill).not.toBe("");
    expect(pill).not.toMatch(/pill-ok|pill-bad|mint|red/);
  });

  it("DomainFlow shows the key-document URL from the same builder the server probes", () => {
    const ui = code("components/DomainFlow.tsx");
    expect(ui).toMatch(/keyDocumentUrl\(domain\)/);
    expect(ui).not.toMatch(/\.well-known\/agenid\/keys\.json/);
  });
});
