import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ECOSYSTEM_CATEGORIES,
  ECOSYSTEM_RELATIONSHIPS,
  ECOSYSTEM_STATUSES,
  buildCloudClusters,
  getCloudClusters,
  getEcosystem,
  relationshipOf,
  validateEntry,
} from "../lib/ecosystem";

/**
 * Truth controls for the ecosystem cloud.
 *
 * A logo cloud is the single highest-risk surface on a trust product's homepage. It is
 * read in about five seconds, it is made of other companies' names, and every one of
 * those names carries an implication the reader supplies for free: that the logo is
 * there because something is connected. Nothing on this site is.
 *
 * These guards exist because the pressure on this component only ever runs one way —
 * toward more logos and warmer words. They are in their own file rather than appended
 * to ecosystem.test.ts per the standing concurrent-session rule.
 */

const WEB = process.cwd();
const COMPONENT = path.join(WEB, "components", "ecosystem", "EcosystemHub.tsx");
const COMPONENT_DIR = path.join(WEB, "components", "ecosystem");
const read = (f: string) => fs.readFileSync(f, "utf-8");

/** Strip comments so the component may DESCRIBE what it forbids without tripping a guard. */
function stripComments(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const code = (f: string) => stripComments(read(f));

describe("ecosystem cloud — a logo is not an integration", () => {
  /**
   * The load-bearing assertion of this entire sprint. Appearing in the graphic is a
   * technical statement about an API surface; it is not a connection, and the registry
   * is what decides which is which.
   */
  it("every platform in the cloud is compatible-only, with nothing verified or partnered", () => {
    for (const cluster of getCloudClusters()) {
      for (const e of cluster.entries) {
        expect(e.status, `${e.id}`).toBe("compatible");
        expect(e.verified, `${e.id} must not claim verification`).toBe(false);
        expect(e.partner, `${e.id} must not claim partnership`).toBe(false);
      }
    }
  });

  it("no entry can reach LIVE or PARTNER without the flags the status table demands", () => {
    const base = {
      id: "example",
      name: "Example",
      abbr: "Ex",
      category: "action",
      description: "test",
      website: "https://example.com",
      integration_type: "test",
      last_verified: "2026-01-01",
      compatibility_note: "This entry exists only to exercise the validator's honesty-contract check.",
      featured: false,
    };

    // A platform cannot be shown as a verified integration by flipping the status alone.
    expect(() =>
      validateEntry({ ...base, status: "verified-integration", verified: false, partner: false }, "x.json"),
    ).toThrow(/verified/);

    // Nor by flipping the flag alone.
    expect(() => validateEntry({ ...base, status: "compatible", verified: true, partner: false }, "x.json")).toThrow(
      /verified/,
    );

    // Partnership is its own claim on top of verification, and cannot be asserted alone.
    expect(() =>
      validateEntry({ ...base, status: "official-partner", verified: true, partner: false }, "x.json"),
    ).toThrow(/partner/);
    expect(() => validateEntry({ ...base, status: "compatible", verified: false, partner: true }, "x.json")).toThrow(
      /partner/,
    );
  });

  /**
   * "Planned" is defined and deliberately unoccupied. If this ever fails, someone put a
   * roadmap entry in a public graphic — which needs to be a decision, not a diff.
   */
  it("the planned status has no occupants", () => {
    expect(getEcosystem().filter((e) => e.status === "planned").map((e) => e.id)).toEqual([]);
  });

  /**
   * Relationship is derived, so it cannot drift from the registry. This asserts the
   * derivation itself — in particular that a written integration brief is a fact about
   * AgenID's documentation and never gets promoted into a partnership.
   */
  it("derives relationship from status and docs, and never invents a partnership", () => {
    for (const e of getEcosystem()) {
      const rel = relationshipOf(e);
      expect(Object.keys(ECOSYSTEM_RELATIONSHIPS)).toContain(rel);
      if (rel === "partner") expect(e.status).toBe("official-partner");
      if (e.docs && e.status !== "official-partner") expect(rel).toBe("pattern-documented");
      if (!e.docs && e.status !== "official-partner") expect(rel).toBe("none");
    }
    // Today: every relationship is either none or a brief AgenID wrote. No partners.
    expect(getEcosystem().map(relationshipOf).filter((r) => r === "partner")).toEqual([]);
  });

  it("states plainly that a documented pattern is AgenID's own work, not the vendor's", () => {
    const d = ECOSYSTEM_RELATIONSHIPS["pattern-documented"].definition;
    expect(d).toMatch(/AgenID's own work|no involvement/i);
    expect(d).toMatch(/ships no AgenID code/i);
  });
});

describe("ecosystem cloud — the component decides nothing", () => {
  /**
   * The component may DISPLAY a trust word that came from the registry; it may not
   * contain one. Every banned word below is something a well-meaning edit would add to
   * make the section read more confidently, and each would be a claim no code computed.
   */
  it("asserts no integration vocabulary of its own", () => {
    /*
     * The STATUS_DOT literal is excised before scanning, and that is a scoping decision
     * rather than an escape hatch. The map's keys ARE registry status ids — one of them
     * is literally "verified-integration" — so the component has to name them in order
     * to wire a status to a treatment. Naming a status id in a lookup table is the
     * opposite of asserting it: it is what makes the registry's decision render.
     *
     * The excised region is not unguarded. The next test pins its exact contents, so
     * the only text this scan skips is text another assertion holds character for
     * character. Everything outside it — every string a reader could ever see — is
     * scanned in full.
     */
    const src = code(COMPONENT).replace(/const STATUS_DOT: Record<string, string> = \{[\s\S]*?\n\};/, "");
    const BANNED = [
      /\bintegrated\b/i,
      /\bcertified\b/i,
      /\bofficial partner\b/i,
      /\btrusted by\b/i,
      /\bpowered by\b/i,
      /\bworks with\b/i,
      /\bsupported\b/i,
      /\bverified\b/i,
    ];
    for (const re of BANNED) {
      expect(src, `EcosystemHub.tsx must not assert ${re.source}`).not.toMatch(re);
    }
  });

  it("reads every status and relationship string from props", () => {
    const src = code(COMPONENT);
    for (const key of ["statusLabel", "statusDefinition", "relationshipLabel", "relationshipDefinition"]) {
      expect(src, `must render ${key} from props`).toContain(`active.${key}`);
    }
    // No status label may be spelled out in the component — that is a second table.
    for (const def of Object.values(ECOSYSTEM_STATUSES)) {
      expect(src, `"${def.label}" must come from the registry, not the component`).not.toContain(`>${def.label}<`);
    }
  });

  /**
   * Emerald is reserved for an actual verified state across this whole product. It is
   * wired to exactly one branch here, and a status the component has not been taught
   * about must fall through to the muted treatment rather than the strongest one.
   */
  it("wires the verified colour to the status map alone, and fails soft on the unknown", () => {
    const src = code(COMPONENT);
    expect(src).toMatch(/const STATUS_DOT: Record<string, string> = \{/);
    expect(src).toMatch(/STATUS_DOT\[status\] \?\? "bg-muted\/60"/);
    // Exactly the two strongest statuses carry mint, and nothing weaker does.
    expect(src).toMatch(/"verified-integration": "bg-mint"/);
    expect(src).toMatch(/compatible: "bg-muted\/60"/);
    expect(src).toMatch(/planned: "border border-muted\/50"/);
  });

  /** Same rule the scenario sprint earned: no hex in a component directory. */
  it("writes no hex colour anywhere in the ecosystem component directory", () => {
    for (const f of fs.readdirSync(COMPONENT_DIR)) {
      if (!/\.tsx?$/.test(f)) continue;
      const offenders = code(path.join(COMPONENT_DIR, f)).match(/#[0-9a-fA-F]{6}\b/g) ?? [];
      expect(offenders, `${f} must use theme tokens`).toEqual([]);
    }
  });

  it("renders no failure state — an unlisted platform is not a negative finding", () => {
    const src = code(COMPONENT);
    expect(src).not.toMatch(/\btext-red\b|\bbg-red\b|\bborder-red\b|\bfill-red\b/);
  });
});

describe("ecosystem cloud — accessibility and motion", () => {
  it("gives every node an accessible name carrying its platform, layer and status", () => {
    const src = read(COMPONENT);
    // Both the desktop node and the mobile chip use the same composed label.
    const labels = src.match(/aria-label=\{`\$\{n\.name\} — \$\{cluster\.label\}, \$\{n\.statusLabel\}`\}/g) ?? [];
    expect(labels.length, "desktop node and mobile chip must both be named").toBe(2);
  });

  it("makes every node keyboard operable and the detail panel a live region", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/tabIndex=\{0\}/);
    expect(src).toMatch(/onFocus=/);
    expect(src).toMatch(/onBlur=/);
    expect(src).toMatch(/aria-live="polite"/);
    expect(src).toMatch(/aria-pressed=/);
    // The svg is a named group so a screen reader announces what the diagram is.
    expect(src).toMatch(/role="group"/);
    expect(src).toMatch(/aria-label="Platforms an AgenID identity can be carried through/);
  });

  /**
   * One-shot entrance only. The scenario sprint established that continuous animation is
   * a battery cost paid forever for an effect noticed once, and this graphic sits
   * mid-page on the homepage where it would spin unseen.
   */
  it("animates once and stops, and does not animate at all under reduced motion", () => {
    const css = read(path.join(WEB, "app", "globals.css"));
    expect(css).toMatch(/@keyframes cloud-node-in/);
    expect(css).toMatch(/\.cloud-node \{[\s\S]*?animation: cloud-node-in[\s\S]*?\}/);
    expect(css).not.toMatch(/animation: cloud-node-in[^;]*infinite/);

    const reduced = css.slice(css.indexOf("@keyframes cloud-node-in"));
    expect(reduced).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.cloud-node \{ animation: none/);
  });
});

describe("ecosystem cloud — registry integrity", () => {
  it("has unique ids and unique display names across the whole registry", () => {
    const all = getEcosystem();
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
    expect(new Set(all.map((e) => e.name)).size).toBe(all.length);
  });

  it("uses only declared categories and declared statuses", () => {
    const cats = new Set(ECOSYSTEM_CATEGORIES.map((c) => c.id));
    for (const e of getEcosystem()) {
      expect(cats.has(e.category), `${e.id}: ${e.category}`).toBe(true);
      expect(Object.keys(ECOSYSTEM_STATUSES)).toContain(e.status);
    }
  });

  /**
   * A tile with an empty detail card invites the reader to supply their own idea of what
   * "compatible" bought them, which is the whole failure this sprint is about.
   */
  it("gives every platform in the cloud concrete capabilities to show", () => {
    for (const cluster of buildCloudClusters()) {
      for (const n of cluster.nodes) {
        expect(n.capabilities.length, `${n.id} has nothing to show`).toBeGreaterThan(0);
        for (const c of n.capabilities) expect(c.trim().length).toBeGreaterThan(2);
        expect(new Set(n.capabilities).size).toBe(n.capabilities.length);
      }
    }
  });

  it("refuses a featured entry that has no capabilities", () => {
    expect(() =>
      validateEntry(
        {
          id: "example",
          name: "Example",
          abbr: "Ex",
          category: "action",
          description: "test",
          website: "https://example.com",
          status: "compatible",
          integration_type: "test",
          verified: false,
          partner: false,
          last_verified: "2026-01-01",
          compatibility_note: "This entry exists only to exercise the featured/capabilities requirement.",
          featured: true,
        },
        "x.json",
      ),
    ).toThrow(/capabilities/);
  });

  /**
   * The cloud has its own placement order, deliberately not the matrix's. Models start
   * at twelve o'clock and Action falls in the lower half, so the diagram reads
   * technology → identity → action without needing a caption to say so.
   */
  it("places the cloud in narrative order, not matrix order, and drops empty clusters", () => {
    const built = buildCloudClusters().map((c) => c.id);
    expect(built[0], "the model layer sits at the top").toBe("models");
    expect(built.indexOf("action")).toBeGreaterThan(built.indexOf("models"));
    // Every declared category that has featured entries must appear exactly once.
    expect(new Set(built).size).toBe(built.length);
    for (const id of built) expect(ECOSYSTEM_CATEGORIES.map((c) => c.id)).toContain(id);
    for (const c of buildCloudClusters()) expect(c.nodes.length).toBeGreaterThan(0);
  });

  /**
   * The Action tier is the reason the graphic reads as a sentence rather than a list:
   * technology, then identity, then something a person is accountable for. If it is
   * empty the centre claim loses its object.
   */
  it("keeps the action tier populated and in the lower half of the diagram", () => {
    const built = buildCloudClusters();
    const action = built.find((c) => c.id === "action");
    expect(action, "the action tier must exist").toBeTruthy();
    expect(action!.nodes.length).toBeGreaterThan(0);
    // Placement runs clockwise from twelve o'clock, so an index past the halfway point
    // of the cluster list puts this tier below the centre — where the sentence ends.
    expect(built.indexOf(action!)).toBeGreaterThanOrEqual(Math.floor(built.length / 2));
  });

  it("never claims a capability that contradicts the compatible status", () => {
    // A capability is a restatement of the note, so it must not assert the platform
    // itself does anything — the recurring shape of this defect on this project.
    const BAD = /\b(we verified|platform verifies|officially|certified|partnership)\b/i;
    for (const e of getEcosystem()) {
      for (const c of e.capabilities ?? []) expect(c, `${e.id}: ${c}`).not.toMatch(BAD);
    }
  });
});
