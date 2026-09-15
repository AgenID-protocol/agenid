/**
 * The README badge (/badge/<agenid>/shield.svg).
 *
 * Two rules matter more than the pixels:
 *   1. It must agree with public/badge.js about what each state looks like. Two badges
 *      for one protocol that disagree about a color are worse than one badge.
 *   2. "Not registered" must render NEUTRAL. An identifier with no record is not evidence
 *      of wrongdoing, and a red badge would make absence look like a finding.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

const envelopes = new Map<string, unknown>();
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return {
    ...actual,
    fetchEnvelope: async (id: string) =>
      envelopes.has(id) ? { status: 200, envelope: envelopes.get(id) } : { status: 404, envelope: null, error: "not_found" },
  };
});

const AMBER = "#f59e0b";
const MINT = "#10b981";
const RED = "#ef4444";
const SLATE = "#94a3b8";

const ID = "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y";

function envelope(over: Record<string, unknown> = {}) {
  return {
    status: "ACTIVE",
    proof_check: { ok: true },
    verification: { level: "L1_REGISTERED" },
    manifest: { identity: { name: "Sunny" }, ownership: { operator: "Acme Health, Inc." } },
    ...over,
  };
}

async function badge(id: string) {
  const { GET } = await import("../app/badge/[agenid]/shield.svg/route");
  const res = await GET(new Request(`https://www.agenid.com/badge/${id}/shield.svg`), {
    params: Promise.resolve({ agenid: id }),
  });
  return { res, svg: await res.text() };
}

describe("GET /badge/<agenid>/shield.svg", () => {
  it("serves a real SVG document", async () => {
    envelopes.set(ID, envelope());
    const { res, svg } = await badge(ID);
    expect(res.headers.get("content-type")).toMatch(/image\/svg\+xml/);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("renders L1 amber, not emerald — it is a self-declaration", async () => {
    envelopes.set(ID, envelope());
    const { svg } = await badge(ID);
    expect(svg).toContain(AMBER);
    expect(svg).not.toContain(MINT);
    expect(svg).toContain("REGISTERED");
    expect(svg).not.toMatch(/>VERIFIED/);
  });

  it("renders an authority-verified level emerald", async () => {
    envelopes.set(ID, envelope({ verification: { level: "L2_DOMAIN_VERIFIED" } }));
    const { svg } = await badge(ID);
    expect(svg).toContain(MINT);
    expect(svg).toContain("VERIFIED L2");
  });

  it("renders revoked red", async () => {
    envelopes.set(ID, envelope({ status: "REVOKED" }));
    const { svg } = await badge(ID);
    expect(svg).toContain(RED);
    expect(svg).toContain("REVOKED");
  });

  it("renders a failed proof red", async () => {
    envelopes.set(ID, envelope({ proof_check: { ok: false } }));
    const { svg } = await badge(ID);
    expect(svg).toContain(RED);
    expect(svg).toContain("PROOF INVALID");
  });

  it("renders an unknown agent NEUTRAL, never red, never 'invalid'", async () => {
    const unknown = "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Z";
    envelopes.delete(unknown);
    const { res, svg } = await badge(unknown);
    // 200 on purpose: a non-200 renders as a broken image, not as a badge.
    expect(res.status).toBe(200);
    expect(svg).toContain(SLATE);
    expect(svg).not.toContain(RED);
    expect(svg).toContain("NOT REGISTERED");
    expect(svg.toUpperCase()).not.toContain("INVALID");
  });

  it("renders a malformed identifier neutrally too", async () => {
    const { res, svg } = await badge("not-an-agenid");
    expect(res.status).toBe(200);
    expect(svg).toContain(SLATE);
    expect(svg).not.toContain(RED);
  });

  it("escapes agent-controlled text into the title", async () => {
    envelopes.set(ID, envelope({ manifest: { identity: { name: '"><script>x</script>' }, ownership: { operator: "A & B" } } }));
    const { svg } = await badge(ID);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&amp;");
  });

  it("caches briefly, so a revocation can turn a README badge red", async () => {
    envelopes.set(ID, envelope());
    const { res } = await badge(ID);
    const cc = res.headers.get("cache-control") ?? "";
    const sMaxAge = Number(/s-maxage=(\d+)/.exec(cc)?.[1] ?? Infinity);
    expect(sMaxAge).toBeLessThanOrEqual(300);
  });

  it("uses the same level labels and colors as badge.js", () => {
    const js = readFileSync(new URL("../public/badge.js", import.meta.url), "utf8");
    const svgRoute = readFileSync(new URL("../app/badge/[agenid]/shield.svg/route.ts", import.meta.url), "utf8");
    for (const level of ["L1_REGISTERED", "L2_DOMAIN_VERIFIED", "L3_ORGANIZATION_VERIFIED", "L4_DEPLOYMENT_VERIFIED"]) {
      expect(js, `badge.js must know ${level}`).toContain(level);
      expect(svgRoute, `shield.svg must know ${level}`).toContain(level);
    }
    // Same four state colors in both.
    for (const color of [AMBER, MINT, RED, SLATE]) {
      expect(js).toContain(color);
      expect(svgRoute).toContain(color);
    }
  });
});
