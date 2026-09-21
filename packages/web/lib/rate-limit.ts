/**
 * AgenID rate limiting.
 *
 * Closes the gap recorded as GAP-G1 in docs/SECURITY-GAP-ANALYSIS.md and as T-12 in
 * docs/threat-model.md: before this, every public endpoint was unbounded, and a
 * measured 25 rapid unauthenticated POSTs to the public write path were all processed.
 *
 * TWO LAYERS, DELIBERATELY
 *
 *   1. An in-process window that CANNOT FAIL. It bounds one serverless instance, which
 *      is a floor rather than a real limit, but it costs nothing, needs no dependency,
 *      and still holds when the database is unreachable.
 *   2. A durable window in Postgres (migration 0003), incremented by a single atomic
 *      statement so concurrent requests serialize on the row instead of racing.
 *
 * The consequence of ordering them this way is the only honest definition of
 * "fail-open" here: if the durable store errors, the limiter DEGRADES TO PER-INSTANCE
 * LIMITING. It never degrades to unbounded. That is why there is no fail-open/
 * fail-closed switch in this module — the question does not arise.
 *
 * CLIENT IDENTITY IS TAKEN FROM PLATFORM-CONTROLLED HEADERS ONLY
 *
 * `x-forwarded-for` is caller-controllable: a client can send any value it likes and
 * the proxy appends rather than replaces. Keying a limiter on it lets an attacker mint
 * a fresh bucket per request by rotating the header, which is worse than no limiter
 * because it looks like one. `x-real-ip` and `x-vercel-forwarded-for` are set by the
 * platform. This module prefers those and treats XFF as a last resort, taking the
 * FIRST entry (the originating client as the edge recorded it).
 *
 * This is the same rule the key-discovery surface earned in `raw-key-target.ts`:
 * a security decision belongs on the signal the platform controls, not on the one that
 * is convenient to read.
 */

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Policy
// ---------------------------------------------------------------------------

export interface RateLimitPolicy {
  /** Stable name; forms the bucket prefix. Never derived from caller input. */
  readonly name: string;
  /** Requests permitted per window, per client. */
  readonly limit: number;
  /** Window length in seconds. */
  readonly windowSeconds: number;
  /** Per-instance floor. Lower than `limit` is pointless; higher wastes the floor. */
  readonly burst: number;
}

/**
 * One entry per surface named in GAP-G1, plus a default.
 *
 * The numbers are abuse bounds, not quotas. They are set so that a human operator
 * registering agents by hand, or a browser polling a status page, never reaches them,
 * while a script cannot sustain volume. They are deliberately generous: a limiter that
 * fires on legitimate use gets removed, and then there is no limiter.
 */
export const POLICIES = {
  /** Public unauthenticated WRITE. Signature-verified, but nothing bounded volume. */
  register: { name: "register", limit: 30, windowSeconds: 60, burst: 10 },

  /** Batch write. See MAX_BATCH_SIZE — the array bound matters more than the rate. */
  bindBatch: { name: "bind-batch", limit: 10, windowSeconds: 60, burst: 5 },

  /**
   * Unauthenticated relay that forwards a caller-supplied key to a third party from
   * AgenID's own domain. The tightest limit in the table: the risk here is not load on
   * AgenID, it is AgenID's domain being the source of traffic against someone else.
   */
  relay: { name: "relay", limit: 12, windowSeconds: 60, burst: 4 },

  /**
   * Polled amplifier: up to four outbound probes per call against a caller-supplied
   * hostname. The browser polls this every 6s, so the limit must clear ~10/min of
   * legitimate use while refusing to be an outbound cannon.
   */
  probe: { name: "probe", limit: 40, windowSeconds: 60, burst: 15 },

  /** Everything else public and read-only. */
  read: { name: "read", limit: 240, windowSeconds: 60, burst: 80 },
} as const satisfies Record<string, RateLimitPolicy>;

/**
 * Hard cap on `POST /api/retell/bind`'s agent array. One request could previously
 * trigger an unbounded number of store writes; the rate limit bounds requests, this
 * bounds the work inside one.
 */
export const MAX_BATCH_SIZE = 25;

// ---------------------------------------------------------------------------
// Client identity
// ---------------------------------------------------------------------------

/** Headers the platform sets. Order is precedence. */
const TRUSTED_IP_HEADERS = ["x-real-ip", "x-vercel-forwarded-for"] as const;

/**
 * Collapse an IPv6 address to its /64 prefix.
 *
 * A single allocation routinely hands out a /64 or larger, so keying on the full
 * address lets one host rotate through addresses it already owns and defeat the limit,
 * while also giving an attacker unbounded control over row cardinality in the counter
 * table. IPv4 is used whole.
 */
function normalizeClientIp(raw: string): string {
  const ip = raw.trim().toLowerCase();
  if (!ip.includes(":")) return ip; // IPv4 or already-opaque
  // Expand only as far as needed to take the first four hextets.
  const [head] = ip.split("%"); // strip any zone id
  const parts = head.split("::");
  const left = (parts[0] ?? "").split(":").filter(Boolean);
  if (parts.length === 1) return left.slice(0, 4).join(":") + "::/64";
  const right = (parts[1] ?? "").split(":").filter(Boolean);
  const missing = 8 - left.length - right.length;
  const full = [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right];
  return full.slice(0, 4).join(":") + "::/64";
}

/**
 * Derive a stable, non-reflective client key.
 *
 * Returns a hash, never the address itself, so the value can appear in logs and in a
 * bucket name without turning either into a store of client IP addresses.
 */
export function clientKey(req: Request): string {
  let source = "";
  for (const h of TRUSTED_IP_HEADERS) {
    const v = req.headers.get(h);
    if (v) {
      source = v.split(",")[0] ?? "";
      break;
    }
  }
  if (!source) {
    // Last resort. Caller-controllable — see the module header. Taking the FIRST entry
    // matches what the edge records as the originating client.
    source = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  }
  if (!source.trim()) return "unknown";
  return createHash("sha256").update(normalizeClientIp(source)).digest("hex").slice(0, 32);
}

// ---------------------------------------------------------------------------
// Layer 1 — in-process floor
// ---------------------------------------------------------------------------

interface MemoryWindow {
  windowStart: number;
  count: number;
}
const memory = new Map<string, MemoryWindow>();
/** Bounds the map itself: an attacker rotating client keys must not grow it forever. */
const MEMORY_MAX_KEYS = 10_000;

function memoryHit(bucket: string, policy: RateLimitPolicy, nowMs: number): boolean {
  const windowMs = policy.windowSeconds * 1000;
  const windowStart = Math.floor(nowMs / windowMs) * windowMs;
  const existing = memory.get(bucket);
  if (!existing || existing.windowStart !== windowStart) {
    if (memory.size >= MEMORY_MAX_KEYS) {
      // Drop the whole generation rather than evicting one entry: an LRU here would
      // be evicted preferentially by the attacker filling it, which inverts the point.
      memory.clear();
    }
    memory.set(bucket, { windowStart, count: 1 });
    return true;
  }
  existing.count += 1;
  return existing.count <= policy.burst;
}

/** Test seam. Never called by route code. */
export function __resetMemoryLimiter(): void {
  memory.clear();
}

// ---------------------------------------------------------------------------
// Layer 2 — durable window
// ---------------------------------------------------------------------------

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window ends. */
  resetSeconds: number;
  /** Which layer refused. `null` when allowed. */
  refusedBy: "instance" | "registry" | null;
  /** True when the durable layer could not be consulted. */
  degraded: boolean;
}

type RpcRow = { allowed: boolean; hits: number; reset_at: string };

/**
 * Housekeeping for `rate_limit_counters`.
 *
 * 0003_rate_limit.sql says the sweep is "called opportunistically from the application
 * instead (lib/rate-limit.ts)" — and until Sept 20 nothing called it. There are no
 * scheduled jobs in this project and pg_cron is deliberately not assumed, so the table
 * grew without bound on exactly the traffic a rate limiter exists to absorb.
 *
 * Now: roughly one durable hit in SWEEP_ONE_IN deletes windows older than
 * SWEEP_RETENTION_MS. The retention is a day against windows of at most a minute, so a
 * sweep can never delete a window still being counted. It is awaited (an unawaited
 * promise in a serverless function may simply never run) and it can never fail the
 * request: an error is logged and dropped.
 */
export const SWEEP_ONE_IN = 200;
export const SWEEP_RETENTION_MS = 24 * 60 * 60 * 1000;

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> };

export async function sweepExpired(supabase: RpcClient, nowMs: number): Promise<void> {
  try {
    const { error } = await supabase.rpc("rate_limit_sweep", {
      p_older_than: new Date(nowMs - SWEEP_RETENTION_MS).toISOString(),
    });
    if (error) console.error("rate limit sweep failed", { error: error.message });
  } catch (e) {
    console.error("rate limit sweep failed", { error: e instanceof Error ? e.message : String(e) });
  }
}

async function durableHit(
  bucket: string,
  policy: RateLimitPolicy,
  nowIso: string,
  sweep: boolean,
): Promise<{ allowed: boolean; hits: number; resetSeconds: number } | null> {
  // Imported lazily so that a deployment without Supabase configured — or a test that
  // never touches it — does not construct a client just to rate limit.
  const { getSupabaseServiceClient } = await import("@/lib/supabase");
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_bucket: bucket,
    p_window_seconds: policy.windowSeconds,
    p_limit: policy.limit,
    p_now: nowIso,
  });
  if (error) throw new Error(error.message);
  if (sweep) await sweepExpired(supabase, Date.parse(nowIso));
  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
  if (!row) throw new Error("rate_limit_hit returned no row");
  const resetSeconds = Math.max(0, Math.ceil((Date.parse(row.reset_at) - Date.parse(nowIso)) / 1000));
  return { allowed: row.allowed, hits: row.hits, resetSeconds };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface CheckOptions {
  /** Explicit clock. Protocol and security code in this repo never reads a hidden one. */
  now?: string;
  /** Overrides the derived client key. For tests and for keying on something else. */
  subject?: string;
  /** Test seam for the housekeeping sample. Defaults to a 1-in-SWEEP_ONE_IN draw. */
  sweep?: boolean;
}

export async function checkRateLimit(
  req: Request,
  policy: RateLimitPolicy,
  opts: CheckOptions = {},
): Promise<RateLimitDecision> {
  const nowIso = opts.now ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const subject = opts.subject ?? clientKey(req);
  const bucket = `${policy.name}:${subject}`;

  // Layer 1 first, and unconditionally. It is the floor that survives layer 2 failing.
  if (!memoryHit(bucket, policy, nowMs)) {
    return {
      allowed: false,
      limit: policy.limit,
      remaining: 0,
      resetSeconds: policy.windowSeconds,
      refusedBy: "instance",
      degraded: false,
    };
  }

  try {
    const sweep = opts.sweep ?? Math.random() < 1 / SWEEP_ONE_IN;
    const d = await durableHit(bucket, policy, nowIso, sweep);
    if (!d) throw new Error("no decision");
    return {
      allowed: d.allowed,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - d.hits),
      resetSeconds: d.resetSeconds,
      refusedBy: d.allowed ? null : "registry",
      degraded: false,
    };
  } catch (e) {
    // Degraded, NOT unbounded: layer 1 already passed and stays in force for this
    // instance. Logged without the bucket, which contains the client key.
    console.error("rate limiter degraded to per-instance", {
      policy: policy.name,
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.burst - 1),
      resetSeconds: policy.windowSeconds,
      refusedBy: null,
      degraded: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------

/** Advisory headers, safe to send on allowed responses too. */
export function rateLimitHeaders(d: RateLimitDecision): Record<string, string> {
  return {
    "ratelimit-limit": String(d.limit),
    "ratelimit-remaining": String(d.remaining),
    "ratelimit-reset": String(d.resetSeconds),
  };
}

/**
 * The 429 body.
 *
 * Carries NO caller input and no bucket, and does not say which layer refused — the
 * distinction is operational and telling a caller whether they hit the per-instance
 * floor or the durable limit is reconnaissance about the deployment topology.
 */
export function tooManyRequests(d: RateLimitDecision, extraHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: "too many requests; retry after the interval in the retry-after header",
      retry_after_seconds: d.resetSeconds,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(d.resetSeconds),
        "cache-control": "no-store",
        ...rateLimitHeaders(d),
        ...extraHeaders,
      },
    },
  );
}
