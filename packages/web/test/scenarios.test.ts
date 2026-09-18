import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  CATALOGUE,
  EXAMPLE_AGENID,
  ISSUANCE_CEILING,
  SCENARIOS,
  findEntry,
  findScenario,
  groupedCatalogue,
  nextEntry,
  scenarioSlugs,
} from "../lib/scenarios";
import {
  clampSpeed,
  elapsedForStep,
  labelAt,
  loopDuration,
  progressAt,
  stepAt,
  stepLimit,
} from "../lib/scenarios/timeline";

/**
 * Guards for the scenario illustrations.
 *
 * This is a NEW file rather than an addition to public-surface.test.ts, per the standing
 * rule about concurrent sessions: that file is shared and frequently in flight, and
 * coverage is what matters, not which file holds it.
 *
 * The defect class these guard against is specific and, for this product, the worst one
 * available: a surface that shows a verification outcome without being clear about
 * whose outcome it is. These scenarios legitimately name L2, L3 and L4 — they are
 * explaining the protocol. The reference deployment issues none of them. Every
 * assertion below exists to keep that distinction from quietly eroding.
 */

const WEB = process.cwd();
const SCENARIO_SRC = [
  ...fs.readdirSync(path.join(WEB, "components", "scenarios")).map((f) => path.join(WEB, "components", "scenarios", f)),
  ...fs.readdirSync(path.join(WEB, "lib", "scenarios")).map((f) => path.join(WEB, "lib", "scenarios", f)),
];
const PAGE_INDEX = path.join(WEB, "app", "how-it-works", "page.tsx");
const PAGE_DETAIL = path.join(WEB, "app", "how-it-works", "[slug]", "page.tsx");
const read = (f: string) => fs.readFileSync(f, "utf-8");

/**
 * Strip comments before matching, exactly as public-surface.test.ts does.
 *
 * A file must be able to DESCRIBE what it forbids. types.ts explains in prose why L5 is
 * absent from the level union, and parts.tsx names the prototype's near-brand hexes to
 * record what deliberately did not survive the port. Both of those are the documentation
 * that makes the rule survivable; a guard that punishes them teaches the next author to
 * delete the explanation rather than to keep the rule.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
const code = (f: string) => stripComments(read(f));

describe("scenarios — the illustration disclosure is structural, not editorial", () => {
  it("the ceiling statement names L1 as the ceiling and says the root key does not exist", () => {
    expect(ISSUANCE_CEILING).toMatch(/L1_REGISTERED/);
    expect(ISSUANCE_CEILING).toMatch(/root authority key/i);
    expect(ISSUANCE_CEILING).toMatch(/has not been created|does not exist/i);
  });

  it("both the index and every scenario page render the ceiling statement", () => {
    expect(read(PAGE_INDEX)).toMatch(/ISSUANCE_CEILING/);
    expect(read(PAGE_DETAIL)).toMatch(/ISSUANCE_CEILING/);
  });

  it("every scenario page states that challenge-response is a proposed pattern", () => {
    expect(read(PAGE_DETAIL)).toMatch(/CHALLENGE_IS_PROPOSED/);
  });

  /**
   * Every scenario states what it establishes AND what it does not.
   *
   * The first version of this test matched a word list — "not", "remain", "separate" —
   * and the logistics scenario failed it while stating its limit perfectly well
   * ("...are the carrier's and the shipper's to establish"). That is the failure mode of
   * any prose guard: widen the list until it matches every English sentence and it is
   * decorative, or keep it narrow and it rejects correct copy. So the positive check is
   * only that the statement is substantive and reaches the page, and the real guard
   * points the other way — at the overclaim vocabulary this project already forbids
   * everywhere else, which is the thing that would actually be wrong.
   */
  it("every scenario's statement is substantive and free of overclaim vocabulary", () => {
    const BANNED =
      /\b(production[- ]ready|generally available|enterprise[- ]grade|SOC ?2|ISO ?27001|HIPAA|trusted by|fully (automated|integrated|supported)|guarantee[sd]?|ensures? (safety|security|trust)|proves? (safety|legitimacy))\b/i;
    for (const s of SCENARIOS) {
      expect(s.proves.length, `${s.slug} proves`).toBeGreaterThan(80);
      expect(s.proves, `${s.slug} overclaims`).not.toMatch(BANNED);
      expect(s.summary, `${s.slug} summary overclaims`).not.toMatch(BANNED);
    }
  });
});

describe("scenarios — levels are illustrated, never issued", () => {
  /**
   * L5_CONTINUOUSLY_MONITORED is a reserved name the spec does not make issuable. It is
   * absent from the IllustratedLevel union on purpose, and it must stay absent from the
   * rendered set: anything an illustration can show is something a reader can reasonably
   * believe exists.
   */
  it("no scenario names L5", () => {
    for (const s of SCENARIOS) {
      const json = JSON.stringify(s);
      expect(json, `${s.slug}`).not.toMatch(/L5/);
    }
    for (const f of SCENARIO_SRC) {
      expect(code(f), path.basename(f)).not.toMatch(/L5_[A-Z_]+/);
    }
  });

  it("every level named is a real v1.1.1 level name", () => {
    const ALLOWED = new Set([
      "L1_REGISTERED",
      "L2_DOMAIN_VERIFIED",
      "L3_ORGANIZATION_VERIFIED",
      "L4_DEPLOYMENT_VERIFIED",
    ]);
    for (const s of SCENARIOS) {
      for (const row of s.flow.rows) {
        if (row.level) expect(ALLOWED.has(row.level), `${s.slug}: ${row.level}`).toBe(true);
      }
    }
  });

  /**
   * DECLARED and L1_REGISTERED are self-declarations and render amber everywhere else in
   * the product — badge.js, the SVG badge, /issue, the Verification Card. A scenario
   * that rendered either in Verified Emerald would be the only surface in the product
   * disagreeing with the rest about what emerald means.
   */
  it("DECLARED and L1 never carry the verified tone", () => {
    for (const s of SCENARIOS) {
      for (const row of s.flow.rows) {
        if (row.level === "L1_REGISTERED" || /DECLARED/.test(row.value)) {
          expect(row.tone, `${s.slug}: ${row.label}`).not.toBe("verified");
        }
      }
    }
  });

  it("the Today-vs comparison renders DECLARED amber and VERIFIED emerald", () => {
    const src = read(path.join(WEB, "components", "scenarios", "TodayVsAgentic.tsx"));
    expect(src).toMatch(/value:\s*"DECLARED",\s*tone:\s*"declared"/);
    expect(src).toMatch(/value:\s*"VERIFIED",\s*tone:\s*"verified"/);
  });

  /**
   * No red, anywhere in this directory. Absence of verification is not a negative
   * finding — the same rule both badges and the domain flow already follow. A scenario
   * that flashed red mid-handshake would teach the opposite of what the colour means.
   */
  it("no scenario surface renders a failure state", () => {
    for (const f of SCENARIO_SRC) {
      expect(code(f), path.basename(f)).not.toMatch(/\btext-red\b|\bbg-red\b|\bborder-red\b/);
    }
  });
});

describe("scenarios — no fabricated material", () => {
  /**
   * The identifier is the spec's own example ULID, and it is the only one in the set
   * beyond the truncated display forms in the delegation chain. An invented identifier
   * on a public page is something a reader can paste into the resolver, and a resolver
   * that says "not registered" for an identifier the site itself printed is a worse
   * first impression than no illustration at all.
   */
  it("uses the spec's example ULID and invents no other full identifier", () => {
    expect(EXAMPLE_AGENID).toBe("agenid:01J8Z3P2K8VW4RN7XTQ6MYD5HC");
    const full = /agenid:[0-9A-HJKMNP-TV-Z]{26}/g;
    for (const s of SCENARIOS) {
      for (const found of JSON.stringify(s).match(full) ?? []) {
        expect(found, `${s.slug}`).toBe(EXAMPLE_AGENID);
      }
    }
  });

  it("no key material of any kind appears", () => {
    for (const f of SCENARIO_SRC) {
      expect(code(f), path.basename(f)).not.toMatch(/private[_ -]?key|PRIVATE KEY|secretKey|seed\b/i);
    }
  });

  /**
   * The prototype these were ported from used a near-brand palette: #4FD1A5 where the
   * Brand Guide says #10B981, #0A0C0E where it says #0B0F17. Close is how a product ends
   * up with two greens that both claim to mean verified. Every colour in this directory
   * is a Tailwind token defined once in globals.css — which also keeps the trust-colour
   * table in lib/trust-presentation.ts the only place a brand trust colour is written.
   */
  it("no scenario source writes a hex colour", () => {
    for (const f of SCENARIO_SRC) {
      const offenders = code(f).match(/#[0-9a-fA-F]{6}\b/g) ?? [];
      expect(offenders, `${path.basename(f)} must use theme tokens`).toEqual([]);
    }
  });
});

describe("scenarios — catalogue integrity", () => {
  it("slugs are unique and URL-safe", () => {
    const slugs = scenarioSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("every catalogue entry resolves, and only the custom one has no Scenario", () => {
    for (const e of CATALOGUE) {
      expect(findEntry(e.slug)).toBeTruthy();
      if (e.kind === "scenario") expect(findScenario(e.slug), e.slug).toBeTruthy();
      else expect(findScenario(e.slug), e.slug).toBeUndefined();
    }
    expect(CATALOGUE.filter((e) => e.kind === "custom").map((e) => e.slug)).toEqual(["today-vs-agentic"]);
  });

  it("the set is the nine that were built", () => {
    expect(CATALOGUE).toHaveLength(9);
  });

  it("nextEntry wraps rather than dead-ending", () => {
    const last = CATALOGUE[CATALOGUE.length - 1]!;
    expect(nextEntry(last.slug)?.slug).toBe(CATALOGUE[0]!.slug);
    expect(nextEntry("no-such-scenario")).toBeUndefined();
  });

  it("grouping keeps every entry and leads with Start here", () => {
    const groups = groupedCatalogue();
    expect(groups[0]!.group).toBe("Start here");
    expect(groups.flatMap((g) => g.entries)).toHaveLength(CATALOGUE.length);
  });
});

describe("scenarios — timeline shape", () => {
  it("every label list covers every step, plus the idle frame", () => {
    for (const s of SCENARIOS) {
      expect(s.labels.length, `${s.slug} labels`).toBe(s.shape.steps + 1);
    }
  });

  it("the outcome is the last step, and nothing reveals after it", () => {
    for (const s of SCENARIOS) {
      expect(s.outcome.step, `${s.slug} outcome`).toBe(s.shape.steps);
      const steps = [
        s.prompt?.step,
        s.agent.step,
        ...s.flow.rows.map((r) => r.step),
        ...s.separate.rows.map((r) => r.step),
      ].filter((n): n is number => typeof n === "number");
      for (const step of steps) expect(step, `${s.slug}`).toBeLessThan(s.outcome.step);
    }
  });

  it("the identifier appears no earlier than the agent that presents it", () => {
    for (const s of SCENARIOS) {
      expect(s.shape.idStep, `${s.slug} idStep`).toBeGreaterThanOrEqual(s.agent.step);
      expect(s.shape.idStep, `${s.slug} idStep`).toBeLessThanOrEqual(s.shape.steps);
    }
  });

  /**
   * The without-AgenID cut is a real cut, and the identifier never appears in it.
   *
   * An earlier version of this guard asserted `beforeSteps <= idStep`, which is wrong:
   * the delegation scenario presents its identifier at step 2 and runs the without-cut
   * to step 3, because the interesting part of that story is the chain failing at the
   * first hop rather than the origin agent failing to speak. The property that actually
   * matters is not a step comparison at all — it is that the renderer gates the
   * identifier panel on the mode, so no arrangement of steps can leak it into the
   * without-AgenID world. That is asserted directly, against the source.
   */
  it("the without-AgenID cut is shorter than the full story", () => {
    for (const s of SCENARIOS) {
      expect(s.shape.beforeSteps, `${s.slug}`).toBeGreaterThan(0);
      expect(s.shape.beforeSteps, `${s.slug}`).toBeLessThan(s.shape.steps);
    }
  });

  /**
   * Both of these were found by watching the thing run in a browser, not by a test —
   * and neither could have been found by one written before the fact, because in both
   * cases each half was individually correct.
   *
   *   - The caption read "AgenID presented" at the end of the without-AgenID cut. The
   *     label list narrates the full story and the step arithmetic was right; the bug
   *     was that the caption belonged to the mode and nobody had said so.
   *   - The camera treated "nothing revealed yet" as "scroll to the end", so pressing
   *     Replay put an empty stage at the bottom of its own track.
   *
   * They are asserted here against the source so the next refactor has to keep them.
   */
  it("the caption ends the without-cut on its own outcome, not on the full story's label", () => {
    const src = code(path.join(WEB, "components", "scenarios", "ScenarioPlayer.tsx"));
    expect(src).toMatch(/without && t\.step >= scenario\.shape\.beforeSteps[\s\S]{0,80}outcome\.without\.title/);
  });

  it("the camera starts at the top when nothing is revealed", () => {
    const src = code(path.join(WEB, "components", "scenarios", "ScenarioPlayer.tsx"));
    expect(src).toMatch(/if \(!newest\) \{\s*target = 0;/);
  });

  it("the renderer gates the identifier on mode, not only on step", () => {
    const src = code(path.join(WEB, "components", "scenarios", "ScenarioPlayer.tsx"));
    expect(src).toMatch(/show=\{!without && t\.step >= scenario\.shape\.idStep\}/);
    // And the unverifiable-claim panel is the exact complement of it.
    expect(src).toMatch(/show=\{without\}/);
  });

  /**
   * A grid counterparty must reveal in three beats: cards, then each card's own
   * verification, then the number it releases. Collapsing them would show sellers
   * pricing a buyer they have not resolved — the behavior the scenario exists to
   * contrast with.
   */
  it("grid counterparties verify before they release detail", () => {
    for (const s of SCENARIOS) {
      const cp = s.counterparty;
      if (cp.kind !== "grid") continue;
      expect(cp.step, `${s.slug}`).toBeLessThan(cp.badgeStep);
      expect(cp.badgeStep, `${s.slug}`).toBeLessThan(cp.detailStep);
      expect(cp.badgeStep, `${s.slug}`).toBeGreaterThanOrEqual(s.shape.idStep);
    }
  });

  it("delegation hops reveal in order", () => {
    for (const s of SCENARIOS) {
      const cp = s.counterparty;
      if (cp.kind !== "hops") continue;
      const steps = cp.hops.map((h) => h.step);
      expect(steps, `${s.slug}`).toEqual([...steps].sort((a, b) => a - b));
    }
  });
});

describe("scenarios — timeline math", () => {
  const shape = { steps: 10, beforeSteps: 4, idStep: 4 };

  it("clamps speed rather than letting a bad prop stop the clock", () => {
    expect(clampSpeed(undefined)).toBe(1);
    expect(clampSpeed(Number.NaN)).toBe(1);
    expect(clampSpeed(0)).toBe(0.4);
    expect(clampSpeed(99)).toBe(4);
  });

  it("stepAt is clamped at both ends and never wraps", () => {
    expect(stepAt(shape, "with", -5)).toBe(0);
    expect(stepAt(shape, "with", 0)).toBe(0);
    expect(stepAt(shape, "with", 1_000_000)).toBe(10);
    expect(stepAt(shape, "without", 1_000_000)).toBe(4);
    expect(stepAt(shape, "with", Number.NaN)).toBe(0);
  });

  it("stepAt and elapsedForStep agree", () => {
    for (let s = 0; s <= shape.steps; s++) {
      expect(stepAt(shape, "with", elapsedForStep(s))).toBe(s);
    }
  });

  it("a loop is long enough to show every step and then hold", () => {
    const total = loopDuration(shape, "with");
    expect(total).toBeGreaterThan(elapsedForStep(shape.steps));
    expect(loopDuration(shape, "without")).toBeLessThan(total);
  });

  it("progress reaches exactly 1 at the last step of each mode", () => {
    expect(progressAt(shape, "with", shape.steps)).toBe(1);
    expect(progressAt(shape, "without", shape.beforeSteps)).toBe(1);
    expect(progressAt(shape, "with", 0)).toBe(0);
  });

  it("stepLimit is mode-aware", () => {
    expect(stepLimit(shape, "with")).toBe(10);
    expect(stepLimit(shape, "without")).toBe(4);
  });

  /** A caption that stops updating beats one that reads "undefined" on a public page. */
  it("labelAt clamps instead of returning undefined", () => {
    expect(labelAt(["a", "b"], 99)).toBe("b");
    expect(labelAt(["a", "b"], -1)).toBe("a");
    expect(labelAt([], 3)).toBe("");
  });

  it("every real scenario's captions resolve at every step", () => {
    for (const s of SCENARIOS) {
      for (let step = 0; step <= s.shape.steps; step++) {
        expect(labelAt(s.labels, step), `${s.slug} @${step}`).toBeTruthy();
      }
    }
  });
});
