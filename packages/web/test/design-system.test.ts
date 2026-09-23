import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Design-system guards (design pass, 2026-09-23).
 *
 * Each assertion pins a defect the seven-expert review found on the live site, so the fix
 * cannot quietly regress. Every guard here was proven to fail once by reintroducing the
 * defect, then restored.
 *
 * Scope is the whole of app/ and components/, not the files the pass happened to edit:
 * this project's own record is that a guard scoped to where a defect was noticed is a
 * sample, not a fix.
 */

const WEB = process.cwd();

function walk(dir: string, exts = /\.(tsx?|css)$/): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.test(entry.name)) out.push(full);
  }
  return out;
}

/** Comments stripped, so a file can explain in prose what it no longer does. */
function code(file: string): string {
  return fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const read = (rel: string) => code(path.join(WEB, rel));
const UI_FILES = ["app", "components"].flatMap((d) => walk(path.join(WEB, d)));
const rel = (f: string) => path.relative(WEB, f);

describe("type scale", () => {
  it("no arbitrary pixel font sizes anywhere in app/ or components/ (12px floor, fixed scale)", () => {
    const hits = UI_FILES.flatMap((f) =>
      (code(f).match(/(?<![\w-])text-\[\d+(?:\.\d+)?px\]/g) ?? []).map((m) => `${rel(f)}: ${m}`),
    );
    expect(hits).toEqual([]);
  });
});

describe("trust colour semantics", () => {
  it("the verification-levels chips and ladder never use mint or amber — they describe the protocol, not an agent", () => {
    const page = read("app/page.tsx");
    const chip = page.slice(page.indexOf("function LevelChip"), page.indexOf("export default function Home"));
    expect(chip.length).toBeGreaterThan(0);
    expect(chip).not.toMatch(/\b(mint|amber|pill-ok|pill-warn)\b/);
    const table = page.slice(page.indexOf("<table"), page.indexOf("</table>"));
    expect(table).not.toMatch(/\b(mint|amber|pill-ok|pill-warn)\b/);
    expect(read("components/LevelLadder.tsx")).not.toMatch(/\b(mint|amber)\b/);
    const css = read("app/globals.css");
    for (const cls of ["chip-issued", "chip-defined", "chip-not-issued", "chip-reserved"]) {
      const rule = css.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`))?.[0] ?? "";
      expect(rule, cls).toBeTruthy();
      expect(rule, cls).not.toMatch(/mint|amber|red/);
    }
  });

  it("the ladder states the issuance ceiling and never offers L5 as issuable", () => {
    const ladder = read("components/LevelLadder.tsx");
    expect(ladder).toMatch(/Only L1, Registered, is issued by agenid\.com today/);
    expect(ladder).toMatch(/L5[^\n]*reserved/);
  });

  it("terminal window chrome carries no red, amber or mint", () => {
    expect(read("components/Terminal.tsx")).not.toMatch(/\bbg-(red|amber|mint)\b|\btext-mint\b/);
  });

  it("protocol diagrams use no trust colour, and authority-dependent steps say they need the root key", () => {
    const d = read("components/Diagrams.tsx");
    expect(d).not.toMatch(/\b(mint|amber|red)\b/);
    expect(d).toMatch(/requires root authority key/);
  });

  it("the logo check is never emerald (it appears on 'Not registered' pages)", () => {
    for (const f of ["components/Nav.tsx", "components/Footer.tsx"]) {
      const src = read(f);
      const mark = src.match(/<span[^>]*h-7 w-7[^>]*>\s*✓/)?.[0] ?? "";
      expect(mark, f).toBeTruthy();
      expect(mark, f).not.toMatch(/mint/);
    }
  });

  it("the verified glow can only be applied through lib/trust-presentation.ts", () => {
    const glow = /rgba\(16,\s*185,\s*129/;
    const hits = UI_FILES.filter((f) => glow.test(code(f))).map(rel);
    expect(hits).toEqual([]);
    expect(code(path.join(WEB, "lib/trust-presentation.ts"))).toMatch(glow);
  });

  it("the focus ring is paper, never mint", () => {
    const css = read("app/globals.css");
    const rule = css.match(/:focus-visible\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/outline:\s*2px solid var\(--color-paper\)/);
    expect(rule).toMatch(/outline-offset:\s*2px/);
  });
});

describe("WCAG", () => {
  it("1.4.11: interactive boundaries have a 3:1 token, and every text field uses it", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/--color-line-strong:\s*#5b6a84/i);
    expect(css).toMatch(/\.field\s*\{[^}]*border-line-strong/);
    const offenders: string[] = [];
    for (const f of UI_FILES.filter((x) => x.endsWith(".tsx"))) {
      const src = code(f);
      for (const m of src.matchAll(/<(input|textarea|select)\b[\s\S]*?\/>/g)) {
        const tag = m[0];
        if (/type="(checkbox|radio|hidden)"/.test(tag)) continue;
        const cls = tag.match(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([^}]*)\})/);
        const value = cls ? (cls[1] ?? cls[2] ?? cls[3] ?? "") : "";
        // `FIELD` is the wizard's alias for "field"; bg-transparent is the palette input,
        // whose boundary is its bordered dialog.
        if (!/\bfield\b|line-strong|FIELD|bg-transparent/.test(value)) offenders.push(`${rel(f)}: ${tag.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("2.2.2 + 2.5.8: the hero carousel has a pause control and 44px controls", () => {
    const src = read("components/IdentityStory.tsx");
    expect(src).toMatch(/aria-label=\{userPaused \? "Play story" : "Pause story"\}/);
    expect(src).toMatch(/aria-pressed=\{userPaused\}/);
    expect(src).toMatch(/visibilitychange/);
    // Arrows, pause, and each scene dot's hit area are all h-11.
    expect((src.match(/h-11/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(src).not.toMatch(/className=\{`h-1\.5 rounded-full transition-all/);
  });

  it("2.4.8: navigation marks the current page", () => {
    expect(read("components/Nav.tsx")).toMatch(/aria-current=\{here \? "page" : undefined\}/);
    expect(read("components/ui/Breadcrumbs.tsx")).toMatch(/aria-current=\{last \? "page" : undefined\}/);
  });

  it("forced-colours and reduced-motion backstops exist for every new animation", () => {
    const css = read("app/globals.css");
    expect(css).toMatch(/@media \(forced-colors: active\)/);
    const start = css.search(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.pop-in/);
    expect(start).toBeGreaterThanOrEqual(0);
    const reduce = css.slice(start, css.indexOf("\n}\n", start));
    for (const cls of ["pop-in", "scene-progress", "check-draw", "result-in", "chip-set"]) expect(reduce, cls).toMatch(cls);
  });
});

describe("honesty through consolidation", () => {
  it("tabs keep every panel in the DOM (hidden, never unmounted)", () => {
    const tabs = read("components/ui/Tabs.tsx");
    expect(tabs).toMatch(/hidden=\{i !== active\}/);
    expect(tabs).not.toMatch(/active === i &&|i === active &&/);
  });

  it("the homepage still carries every disclosure it carried before the consolidation", () => {
    const page = read("app/page.tsx");
    for (const phrase of [
      "The\n          only level agenid.com issues today is L1_REGISTERED.",
      "is a reserved name only",
      "has not completed its HSM ceremony",
      "Not yet installable.",
      "no adapter package exists for any of them",
      "there is no revocation flow today",
      "Not a third-party check of the",
      "Verification ≠ compliance.",
    ]) {
      expect(page.replace(/\s+/g, " "), phrase).toContain(phrase.replace(/\s+/g, " "));
    }
  });

  it("the /issue step cards advance on real events, never on a timer", () => {
    const src = read("components/IssueWizard.tsx");
    const steps = src.slice(src.indexOf("export function IssueSteps"), src.indexOf("function Copyable"));
    expect(steps).not.toMatch(/setTimeout|setInterval/);
    expect(src).toMatch(/setStage\(2\)[\s\S]*fetch\("\/api\/v1\/agents"/);
    expect(src).toMatch(/if \(!res\.ok\)[\s\S]*setStage\(0\)[\s\S]*setStage\(3\)/);
  });
});
