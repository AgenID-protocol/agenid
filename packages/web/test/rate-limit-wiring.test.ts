/**
 * The limiter is WIRED — a separate question from whether it works.
 *
 * `rate-limit.test.ts` tests the limiter's own logic. Every one of those tests would
 * still pass if someone deleted the `checkRateLimit` call from all four routes, which
 * would leave the system exactly as unbounded as it was before. This file asserts the
 * call sites exist, and exercises one route end-to-end until it actually answers 429.
 *
 * Scope is deliberately every route under app/api, not just the four surfaces named in
 * the gap analysis: the lesson on record here is that a guard scoped to where the
 * defect was found is a sample, not a guard. A NEW unbounded public write path should
 * fail this file on the day it is added, not on the day someone notices.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { MemoryStore } from "@agenid/api";
import { generateKeyPair, signAgent } from "../lib/client-crypto";
import { __resetMemoryLimiter, POLICIES } from "../lib/rate-limit";

const store = new MemoryStore();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, API_URL: undefined, SITE_URL: "https://www.agenid.com", getStore: () => store };
});

const APP_API = path.resolve(import.meta.dirname, "../app/api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** Comment-stripped, so a route may still *describe* the limiter without satisfying this. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const ALL_ROUTES = routeFiles(APP_API);

/**
 * Routes that legitimately have no limiter, each with the reason recorded here rather
 * than inferred. Adding to this list is a deliberate act that shows up in a diff.
 */
const EXEMPT: Record<string, string> = {
  "v1/openapi.json/route.ts": "static document, no work performed per request, no outbound call",
};

function relative(file: string): string {
  return path.relative(APP_API, file);
}

describe("every mutating or amplifying route is bounded", () => {
  const mutating = ALL_ROUTES.filter((f) => {
    const src = code(f);
    return /export async function POST/.test(src);
  });

  it("found the routes to check", () => {
    expect(mutating.length).toBeGreaterThanOrEqual(6);
  });

  for (const file of mutating) {
    const rel = relative(file);
    if (EXEMPT[rel]) continue;
    it(`${rel} calls checkRateLimit`, () => {
      const src = code(file);
      expect(src, `${rel} has a POST handler but no rate limit`).toMatch(/checkRateLimit\s*\(/);
      expect(src, `${rel} never returns 429`).toMatch(/tooManyRequests\s*\(/);
    });
  }
});

describe("the limit is applied before the work", () => {
  for (const file of ALL_ROUTES) {
    const rel = relative(file);
    const src = code(file);
    if (!/checkRateLimit\s*\(/.test(src)) continue;
    it(`${rel} checks the limit before reading the body`, () => {
      const limitAt = src.indexOf("checkRateLimit");
      const bodyAt = src.indexOf("req.json()");
      if (bodyAt === -1) return;
      // Parsing an unbounded request body on behalf of a caller who is already over the
      // limit is work performed for them — the limiter has to come first or it only
      // bounds the response, not the cost.
      expect(limitAt, `${rel} reads the body before checking the limit`).toBeLessThan(bodyAt);
    });
  }
});

describe("the batch endpoint caps its array", () => {
  it("bind rejects an oversized batch by size, not by exhausting the loop", () => {
    const src = code(path.join(APP_API, "retell/bind/route.ts"));
    expect(src).toMatch(/MAX_BATCH_SIZE/);
    expect(src).toMatch(/batch_too_large/);
  });
});

describe("end to end — the route really answers 429", () => {
  beforeEach(() => {
    Object.assign(store, new MemoryStore());
    __resetMemoryLimiter();
  });

  async function register(body: unknown, ip = "203.0.113.50") {
    const { POST } = await import("../app/api/v1/agents/route");
    return POST(
      new Request("https://www.agenid.com/api/v1/agents", {
        method: "POST",
        headers: { "x-real-ip": ip, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("refuses the caller once past the per-instance floor, and says retry-after", async () => {
    // No Supabase in this environment, so the durable layer is unavailable and the
    // limiter runs degraded — which is precisely the case worth asserting, because it
    // is the one where a naive implementation would let everything through.
    let last: Response | null = null;
    for (let i = 0; i < POLICIES.register.burst + 1; i++) last = await register({ not: "valid" });
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(last!.headers.get("access-control-allow-origin")).toBe("*");
    const body = (await last!.json()) as Record<string, unknown>;
    expect(body.error).toBe("rate_limited");
  });

  it("does not refuse a different caller", async () => {
    for (let i = 0; i < POLICIES.register.burst + 1; i++) await register({ not: "valid" }, "203.0.113.51");
    const other = await register({ not: "valid" }, "203.0.113.52");
    expect(other.status).not.toBe(429);
  });

  it("a legitimate registration still succeeds under the limit", async () => {
    const keyPair = generateKeyPair();
    const signed = await signAgent(keyPair, "Appointment Scheduler", {
      operator: "Acme Health, Inc.",
      operatorDomain: "acmehealth.com",
      purposeSummary: "Books and reschedules patient appointments.",
      contact: "ops@acmehealth.com",
      // Explicitly false. These are signed claims about real behaviour and a fixture
      // that defaults them true is how a defaulted attestation stops looking wrong.
      disclosesToUser: false,
      humanEscalation: false,
    });
    const res = await register(
      { manifest: signed.manifest, proof: signed.proof, key_document: signed.keyDocument },
      "203.0.113.60",
    );
    expect(res.status).toBe(201);
    // Advisory headers ride along on the success path too, so a well-behaved client can
    // pace itself instead of discovering the limit by hitting it.
    expect(res.headers.get("ratelimit-limit")).toBe(String(POLICIES.register.limit));
    expect(Number(res.headers.get("ratelimit-remaining"))).toBeGreaterThanOrEqual(0);
  });
});
