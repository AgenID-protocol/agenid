/**
 * Trust presentation fails CLOSED.
 *
 * The defect this file exists to prevent: both badges mapped levels as
 *
 *     if (level === "L1_REGISTERED") -> amber
 *     else                           -> emerald / VERIFIED
 *
 * so an unrecognized, malformed, empty or absent level produced the strongest claim the
 * product can make. The Verification Card had the same shape (`levelOk = level !==
 * "L1_REGISTERED"`). Nothing forged a signature; the presentation layer simply upgraded
 * on ignorance.
 *
 * These tests attack the real rendering paths, not just the helper, because the helper
 * being correct is not the property that matters — what reaches a README, a webpage and
 * a Verification Card is.
 */
import { describe, it, expect, vi } from "vitest";
import {
  presentTrustLevel,
  presentEnvelopeTrust,
  supportedTrustLevels,
  TRUST_COLORS,
  UNKNOWN_TRUST,
} from "../lib/trust-presentation";

const EMERALD = TRUST_COLORS.mint;
const AMBER = TRUST_COLORS.amber;
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

function envelope(level: unknown): Record<string, unknown> {
  return {
    agent_id: ID,
    status: "ACTIVE",
    proof_check: { ok: true },
    verification: level === undefined ? {} : { level },
    manifest: { identity: { name: "Probe" }, ownership: { operator: "Acme" } },
    assertions: [],
  };
}

/** Render the real README shield for a given envelope level. */
async function shield(level: unknown): Promise<string> {
  envelopes.set(ID, envelope(level));
  const { GET } = await import("../app/badge/[agenid]/shield.svg/route");
  const res = await GET(new Request(`https://www.agenid.com/badge/${ID}/shield.svg`), {
    params: Promise.resolve({ agenid: ID }),
  });
  return res.text();
}

/** The generated /badge.js, and the table it actually ships to browsers. */
async function badgeJsTable() {
  const { GET } = await import("../app/badge.js/route");
  const script = await (GET() as Response).text();
  return {
    script,
    table: JSON.parse(/var T = (\{.*?\});/s.exec(script)![1]) as {
      levels: Record<string, { color: string; label: string }>;
      unknown: { color: string; label: string };
    },
  };
}

/**
 * Everything an attacker or a future protocol version might put in `verification.level`.
 * `constructor`/`__proto__`/`toString` are here because the old lookup was a plain object
 * literal, where `LABELS["constructor"]` returns a truthy Function.
 */
const HOSTILE_LEVELS: [string, unknown][] = [
  ["undefined", undefined],
  ["null", null],
  ["empty string", ""],
  ["whitespace", "   "],
  ["UNKNOWN", "UNKNOWN"],
  ["L5", "L5"],
  ["L5_CONTINUOUSLY_MONITORED", "L5_CONTINUOUSLY_MONITORED"],
  ["AUTHORIZED", "AUTHORIZED"],
  ["VERIFIED", "VERIFIED"],
  ["lowercase L2", "l2_domain_verified"],
  ["mixed case L2", "L2_Domain_Verified"],
  ["trailing space L2", "L2_DOMAIN_VERIFIED "],
  ["prefix attack", "L2_DOMAIN_VERIFIEDX"],
  ["prototype key", "constructor"],
  ["proto key", "__proto__"],
  ["toString", "toString"],
  ["number", 2],
  ["object", { level: "L2_DOMAIN_VERIFIED" }],
  ["array", ["L2_DOMAIN_VERIFIED"]],
  ["boolean", true],
];

describe("trust presentation — supported levels render exactly as before", () => {
  it("L1_REGISTERED is amber, declared, and not verified", () => {
    const p = presentTrustLevel("L1_REGISTERED");
    expect(p.color).toBe(AMBER);
    expect(p.verified).toBe(false);
    expect(p.tone).toBe("declared");
    expect(p.badgeLabel).toBe("REGISTERED");
    expect(p.embedLabel).toBe("AGENID REGISTERED");
    expect(p.cardLabel).toBe("L1 · Registered");
  });

  it("L2/L3/L4 remain emerald and verified", () => {
    for (const level of ["L2_DOMAIN_VERIFIED", "L3_ORGANIZATION_VERIFIED", "L4_DEPLOYMENT_VERIFIED"]) {
      const p = presentTrustLevel(level);
      expect(p.color, level).toBe(EMERALD);
      expect(p.verified, level).toBe(true);
      expect(p.badgeLabel, level).toMatch(/^VERIFIED L[234]$/);
    }
  });

  it("exposes exactly the four issuable levels — L5 is not one of them", () => {
    expect(supportedTrustLevels()).toEqual([
      "L1_REGISTERED",
      "L2_DOMAIN_VERIFIED",
      "L3_ORGANIZATION_VERIFIED",
      "L4_DEPLOYMENT_VERIFIED",
    ]);
  });

  it("the real shield still renders L1 amber and reads REGISTERED", async () => {
    const svg = await shield("L1_REGISTERED");
    expect(svg).toContain(AMBER);
    expect(svg).toContain("REGISTERED");
    expect(svg).not.toContain(EMERALD);
  });
});

describe("trust presentation — unknown never becomes verified", () => {
  for (const [name, level] of HOSTILE_LEVELS) {
    it(`helper: ${name} resolves to the neutral UNKNOWN state`, () => {
      const p = presentTrustLevel(level);
      expect(p.verified, `${name} must not be verified`).toBe(false);
      expect(p.color, `${name} must not be emerald`).not.toBe(EMERALD);
      expect(p.color).toBe(SLATE);
      expect(p.tone).toBe("neutral");
      expect(p.level).toBeNull();
      expect(p.badgeLabel).toBe(UNKNOWN_TRUST.badgeLabel);
    });
  }

  for (const [name, level] of HOSTILE_LEVELS) {
    it(`rendered shield: ${name} is never emerald and never says VERIFIED`, async () => {
      const svg = await shield(level);
      expect(svg, `${name} rendered emerald`).not.toContain(EMERALD);
      expect(svg, `${name} rendered the word VERIFIED`).not.toMatch(/>VERIFIED/);
      expect(svg).toContain(SLATE);
      expect(svg).toContain("UNVERIFIED");
    });
  }

  it("an envelope with no verification object at all is neutral", async () => {
    const svg = await shield(undefined);
    expect(svg).not.toContain(EMERALD);
    expect(svg).toContain(SLATE);
  });

  it("a malformed envelope (no proof_check) is an alert, not a verified state", () => {
    expect(presentEnvelopeTrust({ status: "ACTIVE", verification: { level: "L2_DOMAIN_VERIFIED" } }).verified).toBe(false);
    expect(presentEnvelopeTrust({} as never).verified).toBe(false);
    expect(presentEnvelopeTrust(null).verified).toBe(false);
    expect(presentEnvelopeTrust(undefined).verified).toBe(false);
  });

  it("a revoked or suspended identity overrides any level it claims", () => {
    for (const status of ["REVOKED", "SUSPENDED"]) {
      const p = presentEnvelopeTrust({ status, proof_check: { ok: true }, verification: { level: "L4_DEPLOYMENT_VERIFIED" } });
      expect(p.verified, status).toBe(false);
      expect(p.color, status).toBe(TRUST_COLORS.red);
    }
  });

  it("a failed proof overrides any level it claims", () => {
    const p = presentEnvelopeTrust({ status: "ACTIVE", proof_check: { ok: false }, verification: { level: "L4_DEPLOYMENT_VERIFIED" } });
    expect(p.verified).toBe(false);
    expect(p.color).toBe(TRUST_COLORS.red);
  });
});

describe("trust presentation — one mapping, shared by every consumer", () => {
  it("/badge.js ships the canonical table, not a copy of it", async () => {
    const { table } = await badgeJsTable();
    for (const level of supportedTrustLevels()) {
      const canonical = presentTrustLevel(level);
      expect(table.levels[level].color, level).toBe(canonical.color);
      expect(table.levels[level].label, level).toBe(canonical.embedLabel);
    }
    expect(Object.keys(table.levels)).toEqual([...supportedTrustLevels()]);
    expect(table.unknown.color).toBe(UNKNOWN_TRUST.color);
    expect(table.unknown.label).toBe(UNKNOWN_TRUST.embedLabel);
  });

  it("/badge.js has no else-branch that assumes verified", async () => {
    const { script } = await badgeJsTable();
    // Strip comments AND the serialized table: emerald belongs in the table (L2/L3/L4
    // genuinely are verified). What must not exist is emerald or a "VERIFIED" fallback
    // in the BRANCH LOGIC, which is where the old `else` lived.
    const logic = script
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/var T = \{.*?\};/s, "");
    expect(logic, "the level fallback must be the UNKNOWN entry").toMatch(/T\.unknown/);
    expect(logic).not.toMatch(/"AGENID VERIFIED"/);
    expect(logic).not.toMatch(/#10b981/i);
    // And the lookup must be an own-property check, not a truthy `||` fallback.
    expect(logic).toMatch(/hasOwnProperty\.call\(T\.levels, level\)/);
    expect(logic).not.toMatch(/T\.levels\[level\]\s*\|\|/);
  });

  it("no consumer defines its own level→presentation table", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const path = await import("node:path");
    const WEB = path.resolve(import.meta.dirname, "..");
    const CANONICAL = path.join(WEB, "lib", "trust-presentation.ts");

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((e) => {
        const full = path.join(dir, e);
        if (e === "node_modules" || e === ".next") return [];
        return statSync(full).isDirectory() ? walk(full) : /\.(tsx?|js)$/.test(full) ? [full] : [];
      });

    const files = ["app", "components", "lib", "public"].flatMap((d) => {
      try {
        return walk(path.join(WEB, d));
      } catch {
        return [];
      }
    });

    const offenders = files.filter((f) => {
      if (f === CANONICAL) return false;
      const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      // Two or more level keys in one executable statement block is a table.
      const levelKeys = (code.match(/L[1-4]_[A-Z_]+\s*:/g) ?? []).length;
      return levelKeys >= 2;
    });
    expect(offenders.map((f) => path.relative(WEB, f))).toEqual([]);
  });
});
