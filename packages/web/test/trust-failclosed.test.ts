/**
 * F-1 / F-2 / F-3 regression: the trust-presentation boundary fails closed at RUNTIME.
 *
 * Objective 1 closed the level hole. An independent adversarial audit then found three
 * ways the same fail-open shape survived one field over:
 *
 *   F-1  Lookups returned the SHARED table entry, and `readonly`/`as const` are erased at
 *        runtime. Mutating a returned presentation poisoned the canonical value for every
 *        later caller in the process — reproduced end to end: an honest L1 agent's shield
 *        rendered emerald VERIFIED.
 *   F-2  `status === "SUSPENDED" || status === "REVOKED"` let every other value fall
 *        through to the level branch. A lowercase "revoked" carrying L2 rendered emerald
 *        VERIFIED L2; so did an invented "TOMBSTONED" carrying L4.
 *   F-3  The Verification Card kept its own copy of that status comparison.
 *
 * These tests attack the real rendered SVG as well as the helper, because the helper being
 * correct is not the property that matters.
 */
import { describe, it, expect, vi } from "vitest";
import {
  presentTrustLevel,
  presentEnvelopeTrust,
  recognizedStatuses,
  supportedTrustLevels,
  TRUST_COLORS,
} from "../lib/trust-presentation";

const EMERALD = TRUST_COLORS.mint;
const SLATE = TRUST_COLORS.slate;
const ID = "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y";

const envelopes = new Map<string, unknown>();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchEnvelope: async (id: string) =>
      envelopes.has(id) ? { status: 200, envelope: envelopes.get(id) } : { status: 404, envelope: null, error: "not_found" },
  };
});

function envelope(status: unknown, level: unknown) {
  return {
    agent_id: ID,
    status,
    proof_check: { ok: true },
    verification: { level, valid_assertions: 1, total_assertions: 1 },
    manifest: { identity: { name: "Probe" }, ownership: { operator: "Acme" } },
    assertions: [],
  };
}

async function shield(status: unknown, level: unknown): Promise<string> {
  envelopes.set(ID, envelope(status, level));
  const { GET } = await import("../app/badge/[agenid]/shield.svg/route");
  const res = await GET(new Request(`https://www.agenid.com/badge/${ID}/shield.svg`), {
    params: Promise.resolve({ agenid: ID }),
  });
  return res.text();
}

// ---------------------------------------------------------------------------
// F-1
// ---------------------------------------------------------------------------
describe("F-1: a returned presentation cannot poison later lookups", () => {
  const FIELDS = ["verified", "color", "badgeLabel", "embedLabel", "cardLabel", "pillLabel", "tone", "level", "summary"] as const;

  for (const level of supportedTrustLevels()) {
    it(`${level} survives an attempt to mutate every field`, () => {
      const before = { ...presentTrustLevel(level) };
      const p = presentTrustLevel(level) as unknown as Record<string, unknown>;
      for (const f of FIELDS) {
        // Frozen objects throw under "use strict" (ES modules) and no-op otherwise.
        // Either outcome is fine; what matters is the value afterwards.
        try {
          p[f] = f === "verified" ? true : EMERALD;
        } catch {
          /* TypeError from the frozen object — expected */
        }
      }
      const after = presentTrustLevel(level);
      expect(after.verified, `${level}.verified was poisoned`).toBe(before.verified);
      expect(after.color, `${level}.color was poisoned`).toBe(before.color);
      expect(after.badgeLabel).toBe(before.badgeLabel);
      expect(after.pillLabel).toBe(before.pillLabel);
      expect(after.tone).toBe(before.tone);
    });
  }

  it("L1 stays REGISTERED/amber and not verified after a mutation attempt", () => {
    const p = presentTrustLevel("L1_REGISTERED") as unknown as Record<string, unknown>;
    try { p.verified = true; p.color = EMERALD; p.badgeLabel = "VERIFIED L9"; } catch { /* frozen */ }
    const fresh = presentTrustLevel("L1_REGISTERED");
    expect(fresh.verified).toBe(false);
    expect(fresh.color).toBe(TRUST_COLORS.amber);
    expect(fresh.badgeLabel).toBe("REGISTERED");
  });

  it("L2 stays VERIFIED/emerald after a mutation attempt (downgrade is also poisoning)", () => {
    const p = presentTrustLevel("L2_DOMAIN_VERIFIED") as unknown as Record<string, unknown>;
    try { p.verified = false; p.color = SLATE; } catch { /* frozen */ }
    const fresh = presentTrustLevel("L2_DOMAIN_VERIFIED");
    expect(fresh.verified).toBe(true);
    expect(fresh.color).toBe(EMERALD);
  });

  it("the neutral UNKNOWN state stays neutral after a mutation attempt", () => {
    const p = presentTrustLevel("NOT_A_LEVEL") as unknown as Record<string, unknown>;
    try { p.verified = true; p.color = EMERALD; } catch { /* frozen */ }
    const fresh = presentTrustLevel("ALSO_NOT_A_LEVEL");
    expect(fresh.verified).toBe(false);
    expect(fresh.color).toBe(SLATE);
  });

  it("every canonical presentation object is frozen at runtime", () => {
    for (const level of supportedTrustLevels()) {
      expect(Object.isFrozen(presentTrustLevel(level)), `${level} is not frozen`).toBe(true);
    }
    expect(Object.isFrozen(presentTrustLevel("UNKNOWN"))).toBe(true);
    expect(Object.isFrozen(presentEnvelopeTrust(null))).toBe(true);
    expect(Object.isFrozen(presentEnvelopeTrust({ status: "REVOKED" }))).toBe(true);
  });

  it("an honest L1 still renders amber in the REAL shield after a mutation attempt", async () => {
    const p = presentTrustLevel("L1_REGISTERED") as unknown as Record<string, unknown>;
    try { p.color = EMERALD; p.verified = true; p.badgeLabel = "VERIFIED L9"; } catch { /* frozen */ }
    const svg = await shield("ACTIVE", "L1_REGISTERED");
    expect(svg, "a mutation poisoned the rendered badge").not.toContain(EMERALD);
    expect(svg).toContain(TRUST_COLORS.amber);
    expect(svg).toContain("REGISTERED");
    expect(svg).not.toContain("VERIFIED L9");
  });
});

// ---------------------------------------------------------------------------
// F-2
// ---------------------------------------------------------------------------
const HOSTILE_STATUSES: [string, unknown][] = [
  ["REVOKED", "REVOKED"],
  ["SUSPENDED", "SUSPENDED"],
  ["revoked", "revoked"],
  ["suspended", "suspended"],
  ["TOMBSTONED", "TOMBSTONED"],
  ["UNKNOWN_STATUS", "UNKNOWN_STATUS"],
  ["empty string", ""],
  ["whitespace", "   "],
  ["undefined", undefined],
  ["null", null],
  ["Active (mixed case)", "Active"],
  ["ACTIVE with space", "ACTIVE "],
  ["number", 1],
  ["object", {}],
];

describe("F-2: an unrecognized lifecycle status never reaches a verified presentation", () => {
  for (const [name, status] of HOSTILE_STATUSES) {
    for (const level of ["L2_DOMAIN_VERIFIED", "L4_DEPLOYMENT_VERIFIED"]) {
      it(`helper: status=${name} + ${level} is not verified`, () => {
        const p = presentEnvelopeTrust(envelope(status, level));
        expect(p.verified, `status=${name} produced a verified presentation`).toBe(false);
        expect(p.color, `status=${name} produced emerald`).not.toBe(EMERALD);
      });
    }
  }

  for (const [name, status] of HOSTILE_STATUSES) {
    it(`rendered shield: status=${name} + L2 is never emerald and never says VERIFIED`, async () => {
      const svg = await shield(status, "L2_DOMAIN_VERIFIED");
      expect(svg, `status=${name} rendered emerald`).not.toContain(EMERALD);
      expect(svg, `status=${name} rendered the word VERIFIED`).not.toMatch(/>VERIFIED/);
    });
  }

  it("the two demonstrated attacks specifically", async () => {
    const revoked = presentEnvelopeTrust(envelope("revoked", "L2_DOMAIN_VERIFIED"));
    expect(revoked.verified).toBe(false);
    expect(revoked.color).not.toBe(EMERALD);

    const tombstoned = presentEnvelopeTrust(envelope("TOMBSTONED", "L4_DEPLOYMENT_VERIFIED"));
    expect(tombstoned.verified).toBe(false);
    expect(tombstoned.color).not.toBe(EMERALD);

    expect(await shield("revoked", "L2_DOMAIN_VERIFIED")).not.toContain(EMERALD);
    expect(await shield("TOMBSTONED", "L4_DEPLOYMENT_VERIFIED")).not.toContain(EMERALD);
  });

  it("legitimate status behaviour is intact", async () => {
    // Recognized healthy statuses still evaluate proof and level.
    for (const ok of recognizedStatuses().healthy) {
      expect(presentEnvelopeTrust(envelope(ok, "L2_DOMAIN_VERIFIED")).verified, ok).toBe(true);
      expect(presentEnvelopeTrust(envelope(ok, "L1_REGISTERED")).verified, ok).toBe(false);
    }
    // Recognized alert statuses still render red and still override the level.
    for (const alert of recognizedStatuses().alert) {
      const p = presentEnvelopeTrust(envelope(alert, "L4_DEPLOYMENT_VERIFIED"));
      expect(p.color, alert).toBe(TRUST_COLORS.red);
      expect(p.badgeLabel, alert).toBe(alert);
      expect(p.verified, alert).toBe(false);
    }
    const revokedSvg = await shield("REVOKED", "L4_DEPLOYMENT_VERIFIED");
    expect(revokedSvg).toContain(TRUST_COLORS.red);
    expect(revokedSvg).toContain("REVOKED");
    // And a genuinely verified agent is still verified.
    const good = await shield("ACTIVE", "L2_DOMAIN_VERIFIED");
    expect(good).toContain(EMERALD);
    expect(good).toContain("VERIFIED L2");
  });

  it("a proof that does not verify still overrides a healthy status", () => {
    const p = presentEnvelopeTrust({ status: "ACTIVE", proof_check: { ok: false }, verification: { level: "L4_DEPLOYMENT_VERIFIED" } });
    expect(p.verified).toBe(false);
    expect(p.color).toBe(TRUST_COLORS.red);
  });

  it("a malformed envelope is neutral, not verified and not an accusation", () => {
    for (const bad of [null, undefined, "L2_DOMAIN_VERIFIED", [], 7]) {
      const p = presentEnvelopeTrust(bad as never);
      expect(p.verified, String(bad)).toBe(false);
      expect(p.color, String(bad)).toBe(SLATE);
    }
  });
});

// ---------------------------------------------------------------------------
// F-2 in the generated browser badge
// ---------------------------------------------------------------------------
describe("F-2: the generated /badge.js fails closed on status too", () => {
  it("carries the canonical status allowlist and has no bare status comparison", async () => {
    const { GET } = await import("../app/badge.js/route");
    const script = await (GET() as Response).text();
    const table = JSON.parse(/var T = (\{.*?\});/s.exec(script)![1]) as {
      statuses: { healthy: string[]; alert: string[] };
    };
    expect(table.statuses.healthy).toEqual([...recognizedStatuses().healthy]);
    expect(table.statuses.alert).toEqual([...recognizedStatuses().alert]);

    const logic = script.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/var T = \{.*?\};/s, "");
    expect(logic, "a hardcoded status comparison is a second mapping").not.toMatch(/status === "(SUSPENDED|REVOKED|ACTIVE)"/);
    expect(logic).toMatch(/T\.statuses\.alert\.indexOf/);
    expect(logic).toMatch(/T\.statuses\.healthy\.indexOf/);
  });

  it("its shipped status logic rejects every hostile status", async () => {
    const { GET } = await import("../app/badge.js/route");
    const script = await (GET() as Response).text();
    const T = JSON.parse(/var T = (\{.*?\});/s.exec(script)![1]);
    // Reproduce the shipped decision exactly.
    const decide = (status: unknown) => {
      if (typeof status !== "string") return T.unavailable;
      if (T.statuses.alert.indexOf(status) !== -1) return { color: T.revokedColor };
      if (T.statuses.healthy.indexOf(status) === -1) return T.unavailable;
      return T.levels.L2_DOMAIN_VERIFIED;
    };
    for (const [name, status] of HOSTILE_STATUSES) {
      const r = decide(status);
      if (["REVOKED", "SUSPENDED"].includes(String(status))) continue;
      expect(r.color, `status=${name} reached emerald in /badge.js`).not.toBe(EMERALD);
    }
    expect(decide("ACTIVE").color).toBe(EMERALD);
  });
});

// ---------------------------------------------------------------------------
// F-3
// ---------------------------------------------------------------------------
describe("F-3: the Verification Card keeps no status mapping of its own", () => {
  it("reads lifecycle state from the canonical result", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(import.meta.dirname, "../app/a/[agenid]/page.tsx"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code, "the card still compares status itself").not.toMatch(/status === "(SUSPENDED|REVOKED|ACTIVE)"/);
    expect(code).toMatch(/presentEnvelopeTrust\(env\)/);
    expect(code).toMatch(/trust\.tone === "alert"/);
    expect(code).toMatch(/trust\.verified/);
  });
});
