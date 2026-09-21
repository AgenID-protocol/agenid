/**
 * Two small defects from the Sept 20 launch-readiness pass, each with its own guard.
 *
 * P3-8 — `rate_limit_sweep` was never called. 0003_rate_limit.sql says the application
 * calls it opportunistically; nothing did, and with no scheduled jobs in the project the
 * counters table grew without bound.
 *
 * P3-9 — `/api/verify-dns` returned the resolver's own error message on a 502. Node's DNS
 * errors interpolate the queried name, so the body echoed caller input — which the key
 * route deliberately never does.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const rpcLog: Array<{ fn: string; args: Record<string, unknown> }> = [];
let sweepMode: "ok" | "error" | "throw" = "ok";

vi.mock("@/lib/supabase", () => ({
  getSupabaseServiceClient: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcLog.push({ fn, args });
      if (fn === "rate_limit_sweep") {
        if (sweepMode === "throw") throw new Error("socket hang up");
        if (sweepMode === "error") return { data: null, error: { message: "permission denied" } };
        return { data: 3, error: null };
      }
      return {
        data: [{ allowed: true, hits: 1, reset_at: new Date(Date.parse(args.p_now as string) + 60_000).toISOString() }],
        error: null,
      };
    },
  }),
}));

const HOSTILE = "zz-echo-canary-7f3a.example";
vi.mock("@/lib/dns-probe", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/dns-probe")>();
  return {
    ...real,
    probeTxtRecord: async (domain: string, token: string) => ({
      host: `_agenid.${domain}`,
      record: { type: "TXT", name: `_agenid.${domain}`, value: `agenid-site-verification=${token}`, ttl: 300 },
      found: false,
      matched: false,
      count: 0,
      error: { code: "ESERVFAIL", message: `queryTxt ESERVFAIL _agenid.${domain}` },
    }),
  };
});

import { POLICIES, SWEEP_RETENTION_MS, __resetMemoryLimiter, checkRateLimit, sweepExpired } from "../lib/rate-limit";

const NOW = "2026-09-20T23:00:00.000Z";
const req = () => new Request("https://www.agenid.com/api/v1/agents", { method: "POST", headers: { "x-real-ip": "198.51.100.9" } });

beforeEach(() => {
  rpcLog.length = 0;
  sweepMode = "ok";
  __resetMemoryLimiter();
});

describe("P3-8 — the counters table is swept", () => {
  it("a sampled durable hit sweeps windows older than the retention", async () => {
    const d = await checkRateLimit(req(), POLICIES.register, { now: NOW, sweep: true });
    expect(d.allowed).toBe(true);
    const sweep = rpcLog.find((c) => c.fn === "rate_limit_sweep");
    expect(sweep).toBeDefined();
    expect(sweep!.args.p_older_than).toBe(new Date(Date.parse(NOW) - SWEEP_RETENTION_MS).toISOString());
  });

  it("an unsampled hit does not sweep", async () => {
    await checkRateLimit(req(), POLICIES.register, { now: NOW, sweep: false });
    expect(rpcLog.map((c) => c.fn)).toEqual(["rate_limit_hit"]);
  });

  it("the retention can never reach a window that is still being counted", () => {
    const longest = Math.max(...Object.values(POLICIES).map((p) => p.windowSeconds)) * 1000;
    expect(SWEEP_RETENTION_MS).toBeGreaterThan(longest * 100);
  });

  it("a sweep that errors or throws never fails or degrades the decision", async () => {
    for (const mode of ["error", "throw"] as const) {
      sweepMode = mode;
      __resetMemoryLimiter();
      const d = await checkRateLimit(req(), POLICIES.register, { now: NOW, sweep: true });
      expect(d).toMatchObject({ allowed: true, degraded: false });
    }
  });

  it("sweepExpired swallows a rejected client call", async () => {
    await expect(sweepExpired({ rpc: () => Promise.reject(new Error("down")) }, Date.parse(NOW))).resolves.toBeUndefined();
  });

  it("the migration's claim that the application sweeps is now true", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "lib", "rate-limit.ts"), "utf8");
    expect(src).toMatch(/rpc\("rate_limit_sweep"/);
  });
});

describe("P3-9 — /api/verify-dns does not echo caller input on a resolver failure", () => {
  it("returns 502 with fixed text and the error code, and no part of the submitted hostname", async () => {
    const { POST } = await import("../app/api/verify-dns/route");
    const res = await POST(
      new Request("https://www.agenid.com/api/verify-dns", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "198.51.100.10" },
        body: JSON.stringify({ domain: HOSTILE, token: "agenid-probe-token-0000000000" }),
      }),
    );
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain("zz-echo-canary");
    expect(JSON.parse(text)).toMatchObject({ error: "dns_error", code: "ESERVFAIL" });
  });
});
