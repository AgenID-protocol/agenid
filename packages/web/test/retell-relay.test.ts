/**
 * POST /api/retell/agents — the one route that forwards a caller-supplied credential to
 * a third party from agenid.com.
 *
 * The property under test is not "the gate returns 403". It is that a refused request
 * NEVER reaches Retell: the upstream `fetch` is a spy, and every refusal asserts it was
 * not called. A gate that answered 403 after forwarding the key would pass a status-only
 * test and still be an open relay.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { __resetMemoryLimiter } from "../lib/rate-limit";
import { checkSameOrigin, isJsonContentType } from "../lib/same-origin";

const URL_ = "https://www.agenid.com/api/retell/agents";
const BODY = JSON.stringify({ api_key: "key_test_not_real" });

let upstream: ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetMemoryLimiter();
  upstream = vi.fn(async () =>
    new Response(JSON.stringify({ agents: [{ agent_id: "a1", agent_name: "Front desk" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", upstream);
});
afterEach(() => vi.unstubAllGlobals());

async function call(headers: Record<string, string>, body: string = BODY) {
  const { POST } = await import("../app/api/retell/agents/route");
  const res = await POST(new Request(URL_, { method: "POST", headers: { host: "www.agenid.com", ...headers }, body }));
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

const JSON_CT = { "content-type": "application/json" };

describe("same-origin requests reach Retell", () => {
  it("modern browser: Sec-Fetch-Site same-origin", async () => {
    const r = await call({ ...JSON_CT, "sec-fetch-site": "same-origin" });
    expect(r.status).toBe(200);
    expect(r.json.count).toBe(1);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("older browser: Origin matches the request host", async () => {
    const r = await call({ ...JSON_CT, origin: "https://www.agenid.com" });
    expect(r.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it("content type parameters are accepted", async () => {
    const r = await call({ "content-type": "application/json; charset=utf-8", "sec-fetch-site": "same-origin" });
    expect(r.status).toBe(200);
  });
});

describe("everything else is refused before the credential is forwarded", () => {
  const refusals: Array<[string, Record<string, string>, number, string]> = [
    ["cross-site browser request", { ...JSON_CT, "sec-fetch-site": "cross-site", origin: "https://evil.example" }, 403, "cross_origin_refused"],
    ["same-site sibling subdomain", { ...JSON_CT, "sec-fetch-site": "same-site", origin: "https://x.agenid.com" }, 403, "cross_origin_refused"],
    ["user-typed navigation (Sec-Fetch-Site none)", { ...JSON_CT, "sec-fetch-site": "none" }, 403, "cross_origin_refused"],
    ["Sec-Fetch-Site wins over a matching Origin", { ...JSON_CT, "sec-fetch-site": "cross-site", origin: "https://www.agenid.com" }, 403, "cross_origin_refused"],
    ["foreign Origin, no Sec-Fetch-Site", { ...JSON_CT, origin: "https://evil.example" }, 403, "cross_origin_refused"],
    ["lookalike Origin host", { ...JSON_CT, origin: "https://www.agenid.com.evil.example" }, 403, "cross_origin_refused"],
    ["malformed Origin", { ...JSON_CT, origin: "not a url" }, 403, "cross_origin_refused"],
    ["no browser headers at all", { ...JSON_CT }, 403, "cross_origin_refused"],
    ["text/plain simple request from our own page", { "content-type": "text/plain", "sec-fetch-site": "same-origin" }, 415, "unsupported_media_type"],
    ["no content type", { "sec-fetch-site": "same-origin" }, 415, "unsupported_media_type"],
  ];

  for (const [name, headers, status, error] of refusals) {
    it(name, async () => {
      const r = await call(headers);
      expect(r.status).toBe(status);
      expect(r.json.error).toBe(error);
      expect(upstream).not.toHaveBeenCalled();
    });
  }

  it("the refusal never echoes caller-supplied header values", async () => {
    const r = await call({ ...JSON_CT, "sec-fetch-site": "<script>x</script>", origin: "https://evil.example" });
    expect(JSON.stringify(r.json)).not.toContain("script");
    expect(JSON.stringify(r.json)).not.toContain("evil.example");
  });
});

describe("helpers", () => {
  it("x-forwarded-host is the request host when present", () => {
    const req = new Request(URL_, { headers: { host: "internal:3000", "x-forwarded-host": "www.agenid.com", origin: "https://www.agenid.com" } });
    expect(checkSameOrigin(req).allowed).toBe(true);
  });
  it("isJsonContentType is exact on the media type", () => {
    const mk = (ct: string) => new Request(URL_, { method: "POST", headers: { "content-type": ct }, body: "{}" });
    expect(isJsonContentType(mk("application/json"))).toBe(true);
    expect(isJsonContentType(mk("application/jsonp"))).toBe(false);
    expect(isJsonContentType(mk("text/json"))).toBe(false);
  });
});
