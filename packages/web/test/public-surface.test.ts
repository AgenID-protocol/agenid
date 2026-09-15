import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Public-surface integrity guards.
 *
 * Every assertion here exists because the drift it forbids was actually shipped at
 * least once. The marketing pages have held their honesty discipline through review;
 * the surfaces that drifted were the newer ones, which is why these are tests and not
 * a checklist.
 *
 * SCOPE NOTE: the first version of this file scanned only app/, components/ and
 * content/. That missed lib/ — where the manifest builders live — and the sibling
 * packages, which is how a second hardcoded attestation survived the pass that was
 * looking for exactly that pattern. A guard that does not cover the whole blast
 * radius of the defect it guards is a guard that will be bypassed by the next copy.
 */

const WEB = process.cwd();
const REPO = path.resolve(WEB, "..", "..");

function walk(dir: string, exts = /\.(tsx?|md|mdx|json)$/): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, exts));
    else if (exts.test(entry.name)) out.push(full);
  }
  return out;
}

/** Everything a visitor or an integrator can read: this app's public surfaces plus the docs. */
const PUBLIC_FILES = [
  ...["app", "components", "content"].flatMap((d) => walk(path.join(WEB, d))),
  ...walk(path.join(REPO, "docs")),
];

/** Every hand-written source file that can build or present a protocol object. */
const SOURCE_FILES = [
  ...["app", "components", "lib"].flatMap((d) => walk(path.join(WEB, d), /\.tsx?$/)),
  ...["core", "api", "cli", "mcp-server"].flatMap((p) => walk(path.join(REPO, "packages", p, "src"), /\.tsx?$/)),
].filter((f) => !/[.\/]test[s]?[.\/]/.test(f) && !f.endsWith(".test.ts"));

const read = (f: string) => fs.readFileSync(f, "utf-8");
const rel = (f: string) => path.relative(REPO, f);

/** Strip comments so a file may *describe* a forbidden pattern without tripping the guard. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("public surface — namespace", () => {
  it("scans a non-trivial number of files", () => {
    expect(PUBLIC_FILES.length).toBeGreaterThan(20);
    expect(SOURCE_FILES.length).toBeGreaterThan(20);
  });

  /**
   * Erratum E2 unified the namespace on `agenid.com`. The ecosystem test already forbids
   * `agenid.org` inside the registry JSON; this widens the rule to every public page and
   * doc, and adds two hosts that actually reached the live site: `app.agenid.ai` (a
   * product surface that does not exist) and `api.agenid.com` (a hostname that does not
   * resolve — it was printed as the registration target in the operator docs AND in the
   * homepage key-discovery diagram).
   */
  for (const forbidden of [/agenid\.org/i, /agenid\.ai/i, /api\.agenid\.com/i]) {
    it(`never references ${forbidden.source}`, () => {
      const offenders = PUBLIC_FILES.filter((f) => forbidden.test(read(f)));
      expect(offenders.map(rel)).toEqual([]);
    });
  }
});

describe("public surface — attestations are never defaulted", () => {
  /**
   * `discloses_to_user` and `human_escalation` are claims about an agent's real-world
   * behavior. They are not discoverable from any API, they go under an Ed25519 signature,
   * and they cannot be inferred from anything a registry can see.
   *
   * Three separate surfaces shipped them pre-set to true:
   *   - the Retell wizard hardcoded both (plus a hardcoded operator name and contact),
   *     so every operator signed AI Venture Holdings' identity and two claims nobody made;
   *   - /issue — the main homepage CTA — pre-checked both boxes;
   *   - the MCP server's generate_keypair skeleton pre-set both while marking every other
   *     field REPLACE_WITH_, so the one thing it silently supplied was the one thing it
   *     could not know.
   *
   * `false` is the only safe default: it under-claims, which is recoverable.
   */
  const TRUE_PATTERNS = [
    /discloses_?[Tt]o_?[Uu]ser\s*[::]\s*true/,
    /human_?[Ee]scalation\s*[::]\s*true/,
    /useState<?[^>]*>?\(\s*true\s*\)\s*;?\s*\/\/\s*(discloses|escalation)/,
  ];

  it("no source file sets a disclosure attestation to true", () => {
    const offenders: string[] = [];
    for (const f of SOURCE_FILES) {
      const src = stripComments(read(f));
      if (TRUE_PATTERNS.some((p) => p.test(src))) offenders.push(rel(f));
    }
    expect(offenders).toEqual([]);
  });

  it("the two attestation checkboxes in /issue initialise to false", () => {
    const src = read(path.join(WEB, "components", "IssueWizard.tsx"));
    expect(src).toMatch(/const \[discloses, setDiscloses\] = useState\(false\)/);
    expect(src).toMatch(/const \[escalation, setEscalation\] = useState\(false\)/);
  });

  it("the Retell wizard's attestation state initialises to false", () => {
    const src = read(path.join(WEB, "app", "onboarding", "retell", "page.tsx"));
    expect(src).toMatch(/const \[disclosesToUser, setDisclosesToUser\] = useState\(false\)/);
    expect(src).toMatch(/const \[humanEscalation, setHumanEscalation\] = useState\(false\)/);
  });
});

describe("public surface — no customer identity is hardcoded into a generic workflow", () => {
  /**
   * The Retell wizard signed `operator: "AI Venture Holdings LLC"` and a fixed contact
   * into every manifest it produced, for every operator who used it. A generic public
   * workflow must never inject a specific organization's identity into signed material.
   *
   * Attribution in a footer, a placeholder in an input, and a doc naming the authority
   * that operates the reference deployment are all fine — this guards the code paths
   * that BUILD protocol objects.
   */
  const IDENTITY = /["'`](AI Venture Holdings[^"'`]*|[a-z0-9._%-]+@aiventureholdings\.com)["'`]/i;
  const BUILDER_HINT = /\b(operator|contact|ownership|manifest)\b/;

  it("no manifest-building code embeds a specific operator identity", () => {
    const offenders: string[] = [];
    for (const f of SOURCE_FILES) {
      const src = stripComments(read(f));
      for (const line of src.split("\n")) {
        if (IDENTITY.test(line) && BUILDER_HINT.test(line)) offenders.push(`${rel(f)}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("public surface — trust state is read, never asserted by a presentation layer", () => {
  /**
   * Verified Emerald is reserved for third-party-verified state. A self-declaration —
   * DECLARED, or L1_REGISTERED — renders amber in badge.js, in the SVG badge, on /issue
   * and on the Verification Card. The Retell wizard rendered its result in emerald with
   * confetti, so the same identity read as verified in one surface and unverified in
   * every other.
   *
   * It also rendered a HARDCODED level string while the route returned a different one.
   * A presentation layer must display the level the authoritative response carries.
   */
  it("the Retell wizard renders the server's level, in amber, and never hardcodes one", () => {
    const wizard = path.join(WEB, "app", "onboarding", "retell", "page.tsx");
    const src = read(wizard);
    const line = src.split("\n").find((l) => /className="text-amber text-2xl/.test(l));
    expect(line, "expected an amber level element in the Retell wizard").toBeTruthy();
    expect(line).toMatch(/\{bindResult\.level\}/);
    expect(stripComments(src)).not.toMatch(/>\s*(DECLARED|L[1-5]_[A-Z_]+)\s*</);
  });

  /**
   * L1's colour is now decided once, in lib/trust-presentation.ts, and every surface
   * reads it from there. This asserts the decision itself rather than one copy of it:
   * #f59e0b is amber, #10B981 is Verified Emerald, and L1 is a self-declaration.
   */
  it("the canonical module renders L1 amber and never marks it verified", async () => {
    const { presentTrustLevel } = await import("../lib/trust-presentation");
    const l1 = presentTrustLevel("L1_REGISTERED");
    expect(l1.color.toLowerCase()).toBe("#f59e0b");
    expect(l1.color.toLowerCase()).not.toBe("#10b981");
    expect(l1.verified).toBe(false);
  });

  /**
   * The presentation table lives in exactly one file. Any OTHER file under the app,
   * components or lib that hardcodes a brand trust colour has started a second table —
   * which is how the two badges came to share a fail-open `else -> emerald` branch.
   */
  it("no surface outside the canonical module hardcodes a trust colour", () => {
    const CANONICAL = path.join(WEB, "lib", "trust-presentation.ts");
    const offenders = PUBLIC_FILES.filter((f) => {
      if (f === CANONICAL) return false;
      if (!/\.(tsx?|js)$/.test(f)) return false;
      return /#(f59e0b|10b981|94a3b8|ef4444)/i.test(stripComments(read(f)));
    });
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe("public surface — one implementation per business rule", () => {
  /**
   * Registration was implemented twice: the canonical route (RegistryStore seam, bounded
   * clock-skew policy, event ledger, key-substitution check) and /api/retell/bind, which
   * reimplemented it with raw Supabase upserts, its own clock and no ledger. The same
   * signed manifest got different security semantics depending on which door it entered.
   *
   * Every write path now goes through lib/register.ts. A route may shape a request and a
   * response; it may not decide what registration means.
   */
  const WRITE_ROUTES = ["app/api/v1/agents/route.ts", "app/api/retell/bind/route.ts"];

  for (const r of WRITE_ROUTES) {
    it(`${r} registers through lib/register.ts`, () => {
      const src = read(path.join(WEB, r));
      expect(src).toMatch(/from "@\/lib\/register"/);
      expect(src).toMatch(/registerAgent\(/);
    });

    it(`${r} does not re-implement verification or storage itself`, () => {
      const src = stripComments(read(path.join(WEB, r)));
      expect(src, "must not call the verifier directly").not.toMatch(/verifyManifestProof\s*\(/);
      expect(src, "must not write to storage directly").not.toMatch(/\.from\(["'](agents|keys|assertions|events)["']\)/);
      expect(src, "must not apply its own clock policy").not.toMatch(/registrationTime\s*\(/);
    });
  }
});

describe("public surface — no timestamp is truncated", () => {
  /**
   * `Rfc3339Utc` permits fractional seconds, and `.replace(/\.\d{3}Z$/, "Z")` only ever
   * moves an instant backward. It shipped in three places, failed registrations outright,
   * was removed — and a fourth copy survived in the MCP server until this sweep. Normalize
   * a timestamp's spelling, never its precision.
   */
  it("no source file truncates milliseconds off an ISO timestamp", () => {
    const offenders = SOURCE_FILES.filter((f) => /replace\(\s*\/\\\.\\d\{3\}Z\$\//.test(stripComments(read(f))));
    expect(offenders.map(rel)).toEqual([]);
  });
});
