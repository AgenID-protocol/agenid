/**
 * Rate limiting — GAP-G1 / threat T-12.
 *
 * Before this, 25 rapid unauthenticated POSTs to the public write path were all
 * processed against production. These tests assert the bound exists, that it is keyed
 * on something an attacker cannot rotate at will, and — the part that matters most —
 * that when the durable layer fails the limiter DEGRADES rather than disappearing.
 *
 * The durable layer is exercised against a fake Supabase client rather than the real
 * one: the SQL function's own behaviour (window alignment, atomic increment, the
 * over-limit boundary) was proven directly against the production database and is not
 * what these tests are for. These test the decision logic that sits on top of it.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  POLICIES,
  MAX_BATCH_SIZE,
  clientKey,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
  __resetMemoryLimiter,
} from "../lib/rate-limit";

// --- durable-layer double ---------------------------------------------------
// Mirrors rate_limit_hit's contract: fixed window, atomic increment, allowed iff
// count <= limit. Verified against the real function in production before being
// written down here.
const counters = new Map<string, number>();
let rpcMode: "ok" | "error" = "ok";
let rpcCalls = 0;

vi.mock("@/lib/supabase", () => ({
  getSupabaseServiceClient: () => ({
    rpc: async (_fn: string, args: Record<string, unknown>) => {
      rpcCalls += 1;
      if (rpcMode === "error") return { data: null, error: { message: "connection refused" } };
      const windowSeconds = args.p_window_seconds as number;
      const nowMs = Date.parse(args.p_now as string);
      const windowStart = Math.floor(nowMs / 1000 / windowSeconds) * windowSeconds;
      const key = `${args.p_bucket as string}@${windowStart}`;
      const hits = (counters.get(key) ?? 0) + 1;
      counters.set(key, hits);
      return {
        data: [
          {
            allowed: hits <= (args.p_limit as number),
            hits,
            reset_at: new Date((windowStart + windowSeconds) * 1000).toISOString(),
          },
        ],
        error: null,
      };
    },
  }),
}));

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://www.agenid.com/api/v1/agents", { method: "POST", headers });
}
const FROM = (ip: string) => req({ "x-real-ip": ip });

beforeEach(() => {
  counters.clear();
  rpcMode = "ok";
  rpcCalls = 0;
  __resetMemoryLimiter();
});
afterEach(() => {
  __resetMemoryLimiter();
});

// ---------------------------------------------------------------------------
describe("client identity", () => {
  it("prefers the platform-set header over the caller-controllable one", () => {
    const spoofed = clientKey(req({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.1.1.1" }));
    const honest = clientKey(req({ "x-real-ip": "203.0.113.9" }));
    expect(spoofed).toBe(honest);
  });

  it("a caller cannot mint a fresh bucket by rotating x-forwarded-for", async () => {
    // The whole point: if XFF won, each of these would be a new bucket and the limit
    // would bound nothing.
    const keys = new Set(
      ["9.9.9.9", "8.8.8.8", "7.7.7.7"].map((spoof) =>
        clientKey(req({ "x-real-ip": "203.0.113.9", "x-forwarded-for": spoof })),
      ),
    );
    expect(keys.size).toBe(1);
  });

  it("falls back to x-forwarded-for only when no trusted header is present", () => {
    const a = clientKey(req({ "x-forwarded-for": "198.51.100.4, 10.0.0.1" }));
    const b = clientKey(req({ "x-forwarded-for": "198.51.100.4" }));
    expect(a).toBe(b); // first entry, not the whole chain
    expect(a).not.toBe(clientKey(req({ "x-forwarded-for": "198.51.100.5" })));
  });

  it("collapses IPv6 to a /64 so one allocation is one bucket", () => {
    const a = clientKey(FROM("2001:db8:abcd:1234:1:2:3:4"));
    const b = clientKey(FROM("2001:db8:abcd:1234:9:9:9:9"));
    expect(a).toBe(b);
    // A different /64 is a different bucket.
    expect(a).not.toBe(clientKey(FROM("2001:db8:abcd:9999:1:2:3:4")));
  });

  it("handles compressed IPv6 without throwing or collapsing everything together", () => {
    expect(clientKey(FROM("2001:db8::1"))).not.toBe(clientKey(FROM("2001:dead::1")));
    expect(clientKey(FROM("::1"))).toBeTruthy();
  });

  it("never returns the address itself", () => {
    expect(clientKey(FROM("203.0.113.9"))).not.toContain("203.0.113");
  });

  it("does not throw when no identifying header is present", () => {
    expect(clientKey(req())).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
describe("the bound", () => {
  const now = (s: number) => new Date(Date.UTC(2026, 8, 18, 10, 0, s)).toISOString();

  it("allows up to the limit and refuses the next request", async () => {
    const p = { ...POLICIES.register, burst: 1000 }; // isolate the durable layer
    for (let i = 1; i <= p.limit; i++) {
      const d = await checkRateLimit(FROM("203.0.113.1"), p, { now: now(1) });
      expect(d.allowed, `request ${i} should be allowed`).toBe(true);
    }
    const over = await checkRateLimit(FROM("203.0.113.1"), p, { now: now(1) });
    expect(over.allowed).toBe(false);
    expect(over.refusedBy).toBe("registry");
    expect(over.remaining).toBe(0);
  });

  it("bounds one client without affecting another", async () => {
    const p = { ...POLICIES.relay, burst: 1000 };
    for (let i = 0; i < p.limit + 5; i++) await checkRateLimit(FROM("203.0.113.1"), p, { now: now(1) });
    const other = await checkRateLimit(FROM("203.0.113.2"), p, { now: now(1) });
    expect(other.allowed).toBe(true);
  });

  it("resets in the next window", async () => {
    const p = { ...POLICIES.relay, burst: 1000 };
    for (let i = 0; i < p.limit + 1; i++) await checkRateLimit(FROM("203.0.113.1"), p, { now: now(1) });
    const next = await checkRateLimit(FROM("203.0.113.1"), p, {
      now: new Date(Date.UTC(2026, 8, 18, 10, 2, 0)).toISOString(),
    });
    expect(next.allowed).toBe(true);
  });

  it("keeps each policy in its own bucket", async () => {
    const a = { ...POLICIES.relay, burst: 1000 };
    for (let i = 0; i < a.limit + 1; i++) await checkRateLimit(FROM("203.0.113.1"), a, { now: now(1) });
    const b = await checkRateLimit(FROM("203.0.113.1"), { ...POLICIES.probe, burst: 1000 }, { now: now(1) });
    expect(b.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("degradation — the property that makes this limiter honest", () => {
  const now = new Date(Date.UTC(2026, 8, 18, 10, 0, 1)).toISOString();

  it("still bounds the caller when the durable layer is unreachable", async () => {
    rpcMode = "error";
    const p = POLICIES.register; // burst: 10
    let allowed = 0;
    for (let i = 0; i < 100; i++) {
      const d = await checkRateLimit(FROM("203.0.113.7"), p, { now });
      if (d.allowed) allowed += 1;
    }
    // Degraded means per-instance, NOT unbounded. 100 attempts, at most `burst` through.
    expect(allowed).toBe(p.burst);
    expect(allowed).toBeLessThan(100);
  });

  it("reports that it degraded rather than reporting a clean allow", async () => {
    rpcMode = "error";
    const d = await checkRateLimit(FROM("203.0.113.8"), POLICIES.register, { now });
    expect(d.allowed).toBe(true);
    expect(d.degraded).toBe(true);
  });

  it("does not consult the durable layer once the in-process floor has refused", async () => {
    const p = { ...POLICIES.register, burst: 3 };
    for (let i = 0; i < 3; i++) await checkRateLimit(FROM("203.0.113.9"), p, { now });
    const callsBefore = rpcCalls;
    const refused = await checkRateLimit(FROM("203.0.113.9"), p, { now });
    expect(refused.allowed).toBe(false);
    expect(refused.refusedBy).toBe("instance");
    // A refused caller must not be able to make the registry do work on their behalf —
    // otherwise the limiter is itself an amplifier.
    expect(rpcCalls).toBe(callsBefore);
  });
});

// ---------------------------------------------------------------------------
describe("the 429 response", () => {
  it("carries retry-after and no caller input", async () => {
    const d = {
      allowed: false as const,
      limit: 30,
      remaining: 0,
      resetSeconds: 42,
      refusedBy: "registry" as const,
      degraded: false,
    };
    const res = tooManyRequests(d);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("rate_limited");
    expect(body.retry_after_seconds).toBe(42);
    // Must not disclose which layer refused: that is deployment topology, and the
    // caller has no legitimate use for it.
    expect(JSON.stringify(body)).not.toContain("instance");
    expect(JSON.stringify(body)).not.toContain("registry");
    expect(JSON.stringify(body)).not.toContain("bucket");
  });

  it("advertises the standard advisory headers", () => {
    const h = rateLimitHeaders({
      allowed: true,
      limit: 30,
      remaining: 29,
      resetSeconds: 12,
      refusedBy: null,
      degraded: false,
    });
    expect(h["ratelimit-limit"]).toBe("30");
    expect(h["ratelimit-remaining"]).toBe("29");
    expect(h["ratelimit-reset"]).toBe("12");
  });
});

// ---------------------------------------------------------------------------
describe("policy table", () => {
  it("every surface named in the gap analysis has a policy", () => {
    for (const name of ["register", "bindBatch", "relay", "probe", "read"] as const) {
      expect(POLICIES[name], name).toBeDefined();
      expect(POLICIES[name].limit).toBeGreaterThan(0);
      expect(POLICIES[name].windowSeconds).toBeGreaterThan(0);
    }
  });

  it("the per-instance floor is never above the durable limit", () => {
    // A burst above the limit would mean the floor never fires and the degraded path
    // is unbounded in practice.
    for (const [name, p] of Object.entries(POLICIES)) {
      expect(p.burst, name).toBeLessThanOrEqual(p.limit);
    }
  });

  it("the relay is the most tightly bounded surface", () => {
    // It forwards a caller-supplied credential to a third party from AgenID's domain.
    // If a future change loosens it past the others, that ordering assumption is gone.
    const others = [POLICIES.register, POLICIES.probe, POLICIES.read].map((p) => p.limit);
    expect(Math.min(...others)).toBeGreaterThan(POLICIES.relay.limit);
  });

  it("the polled surface clears its own legitimate polling rate", () => {
    // /verify/domain polls every 6s => 10/min. A limit at or below that would fire on
    // the product's own happy path, and a limiter that fires on normal use gets deleted.
    expect(POLICIES.probe.limit).toBeGreaterThan(10);
  });

  it("caps the batch array", () => {
    expect(MAX_BATCH_SIZE).toBeGreaterThan(0);
    expect(MAX_BATCH_SIZE).toBeLessThanOrEqual(100);
  });
});
