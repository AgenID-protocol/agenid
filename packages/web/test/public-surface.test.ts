import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Product <-> website synchronization guards.
 *
 * Every assertion here exists because the drift it forbids was actually shipped
 * to the live site at least once. The marketing pages have held their honesty
 * discipline through review; the surfaces that drifted were the newer ones, which
 * is exactly why these are tests and not a checklist.
 */

const WEB = process.cwd();
const SCANNED_DIRS = ["app", "components", "content"];

function walk(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|md|mdx|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const PUBLIC_FILES = SCANNED_DIRS.flatMap((d) => walk(path.join(WEB, d)));

describe("public surface — namespace", () => {
  it("scans a non-trivial number of files", () => {
    expect(PUBLIC_FILES.length).toBeGreaterThan(20);
  });

  /**
   * Erratum E2 unified the namespace on `agenid.com`. The ecosystem test already
   * forbids `agenid.org` inside the registry JSON; this widens the same rule to
   * every public page and doc, and adds two hosts that actually appeared on the
   * live site: `app.agenid.ai` (a product surface that does not exist) and
   * `api.agenid.com` (a hostname that does not resolve, printed in a homepage
   * diagram and in the operator onboarding curl example).
   */
  for (const forbidden of [/agenid\.org/i, /agenid\.ai/i, /api\.agenid\.com/i]) {
    it(`never references ${forbidden.source}`, () => {
      const offenders = PUBLIC_FILES.filter((f) => forbidden.test(fs.readFileSync(f, "utf-8")));
      expect(offenders.map((f) => path.relative(WEB, f))).toEqual([]);
    });
  }
});

describe("public surface — attestations are never defaulted", () => {
  /**
   * `discloses_to_user` and `human_escalation` are claims about an agent's
   * real-world behavior. They are not discoverable from any API, they go under an
   * Ed25519 signature, and a hardcoded `true` is therefore a fabricated claim
   * carried under the operator's own key. The Retell wizard shipped with both
   * hardcoded true, plus a hardcoded operator name and contact, which meant every
   * operator who used it signed AI Venture Holdings' identity and two behavioral
   * claims nobody had made.
   */
  const PATTERNS = [
    /disclosesToUser\s*:\s*true/,
    /discloses_to_user\s*:\s*true/,
    /humanEscalation\s*:\s*true/,
    /human_escalation\s*:\s*true/,
  ];

  it("no page hardcodes a disclosure attestation as true", () => {
    const offenders: string[] = [];
    for (const f of PUBLIC_FILES) {
      if (!f.endsWith(".tsx") && !f.endsWith(".ts")) continue;
      const src = fs.readFileSync(f, "utf-8");
      if (PATTERNS.some((p) => p.test(src))) offenders.push(path.relative(WEB, f));
    }
    expect(offenders).toEqual([]);
  });
});

describe("public surface — self-declared state never renders as verified", () => {
  /**
   * Verified Emerald is reserved for third-party-verified state. DECLARED is an
   * operator self-declaration and sits below L1, which itself renders amber in
   * both badges and on /issue. The Retell wizard rendered its DECLARED result in
   * emerald with confetti, so the same identity read as verified in one surface
   * and unverified in every other.
   */
  it("renders the DECLARED result in amber, not mint", () => {
    const wizard = path.join(WEB, "app", "onboarding", "retell", "page.tsx");
    const src = fs.readFileSync(wizard, "utf-8");
    const line = src.split("\n").find((l) => l.includes(">DECLARED<"));
    expect(line, "expected a DECLARED status element in the Retell wizard").toBeTruthy();
    expect(line).toMatch(/amber/);
    expect(line).not.toMatch(/mint/);
  });
});
