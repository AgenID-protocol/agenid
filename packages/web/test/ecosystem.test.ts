import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getEcosystem, getByCategory, getFeatured, validateEntry, ECOSYSTEM_STATUSES } from "../lib/ecosystem";

const REGISTRY_DIR = path.join(process.cwd(), "data", "ecosystem");

describe("ecosystem registry", () => {
  it("loads every data/ecosystem/*.json file without throwing", () => {
    const entries = getEcosystem();
    const fileCount = fs.readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json")).length;
    expect(entries.length).toBe(fileCount);
  });

  it("has a unique id per entry, matching its filename", () => {
    const ids = getEcosystem().map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("enforces the honesty contract: verified/partner must agree with status", () => {
    // Asserted against the status table, not against `status !== "compatible"`. That
    // expression is the exact one lib/ecosystem.ts documents as unsafe: it silently
    // became wrong when "planned" was added — planned is neither compatible nor
    // verified — and only kept passing because no entry occupies that status. A test
    // that agrees with the code only by coincidence is not checking the code.
    for (const e of getEcosystem()) {
      const expected = ECOSYSTEM_STATUSES[e.status];
      expect(e.verified, `${e.id}`).toBe(expected.verified);
      expect(e.partner, `${e.id}`).toBe(expected.partner);
    }
  });

  it("rejects an entry claiming verified/partner without a matching status", () => {
    const base = {
      id: "example",
      name: "Example",
      abbr: "Ex",
      category: "voice",
      description: "test",
      website: "https://example.com",
      status: "compatible",
      integration_type: "test",
      verified: true, // wrong for "compatible"
      partner: false,
      last_verified: "2026-01-01",
      compatibility_note: "This entry exists only to exercise the validator's honesty-contract check.",
      featured: false,
    };
    expect(() => validateEntry(base, "example.json")).toThrow(/verified/);
  });

  it("only ever asserts partner/verified-integration status where actually true today", () => {
    // Documents the current, disclosed state of the registry rather than assuming it —
    // if this ever fails, an entry's status changed and this test (and any marketing
    // copy referencing "every entry is compatible") needs a deliberate update, not a
    // silent pass.
    const nonCompatible = getEcosystem().filter((e) => e.status !== "compatible");
    expect(nonCompatible).toEqual([]);
  });

  it("keeps the flag/status contract readable from the status table itself", () => {
    // The rule used to be written as `verified === (status !== "compatible")`, which
    // silently became wrong the moment "planned" was added — planned is neither
    // compatible nor verified. Asserting against the table is what keeps the next
    // status from quietly inverting the meaning of the existing ones.
    for (const [id, def] of Object.entries(ECOSYSTEM_STATUSES)) {
      if (def.partner) expect(def.verified, `${id}: a partner is necessarily verified`).toBe(true);
    }
    expect(ECOSYSTEM_STATUSES.planned.verified).toBe(false);
    expect(ECOSYSTEM_STATUSES.planned.partner).toBe(false);
  });

  it("groups entries by every declared category", () => {
    const grouped = getByCategory();
    expect(grouped.length).toBeGreaterThan(0);
    for (const g of grouped) expect(Array.isArray(g.entries)).toBe(true);
  });

  it("getFeatured returns only entries with featured: true", () => {
    for (const e of getFeatured()) expect(e.featured).toBe(true);
  });

  it("never references agenid.org (Erratum E2: namespace unified on agenid.com)", () => {
    for (const f of fs.readdirSync(REGISTRY_DIR)) {
      const raw = fs.readFileSync(path.join(REGISTRY_DIR, f), "utf-8");
      expect(raw).not.toMatch(/agenid\.org/i);
    }
  });

  it("points every docs link at a partner brief that actually exists", () => {
    // A dead "Integration brief" link on the compatibility matrix would imply written
    // guidance that isn't there — the same class of overstatement the status contract
    // above guards against, so it is enforced the same way.
    const partnersDir = path.join(process.cwd(), "content", "partners");
    for (const e of getEcosystem()) {
      if (!e.docs) continue;
      expect(e.docs.startsWith("/docs/partners/")).toBe(true);
      const slug = e.docs.replace("/docs/partners/", "");
      expect(fs.existsSync(path.join(partnersDir, `${slug}.md`))).toBe(true);
    }
  });

  it("keeps every hub-featured entry inside a declared category", () => {
    const declared = new Set(getByCategory().map((g) => g.category.id));
    for (const e of getFeatured()) expect(declared.has(e.category)).toBe(true);
  });

  it("exposes exactly the four documented statuses", () => {
    // Was three until "planned" was added for the ecosystem cloud. Updating this
    // deliberately — rather than loosening it to a count — is the point of pinning the
    // set: a status appearing without anyone noticing is how a roadmap word ends up on
    // a public graphic.
    expect(Object.keys(ECOSYSTEM_STATUSES).sort()).toEqual(
      ["compatible", "official-partner", "planned", "verified-integration"].sort(),
    );
  });
});
