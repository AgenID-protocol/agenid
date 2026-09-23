import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Public-surface link and availability guards.
 *
 * Four defect classes, all of which had shipped, all of which are invisible to a
 * logged-in maintainer and obvious to a logged-out reader:
 *
 *   T-1  A link into a PRIVATE repository. Five public surfaces linked
 *        github.com/AgenID-protocol/agenid — including the homepage's primary
 *        developer CTA. Every logged-out visitor who clicked it got GitHub's 404.
 *   T-2  A link to a file that is not there. The footer's Errata Log pointed at
 *        spec/blob/main/ERRATA.md; the errata log lives at docs/errata.md.
 *   T-3  "Issuable" collapsing a SPEC capability into a DEPLOYED one. L2/L3/L4 are
 *        defined in v1.1.1 and issued by nobody, because issuing one needs the root
 *        authority key, which does not exist. Defined and issued are two questions.
 *   T-4  A capability claim the deployment cannot honour — an npm package that was
 *        never published, a revocation flow with no write path, a directory that is
 *        "not published yet" as though someone were building it.
 *
 * SCOPE IS DELIBERATELY WIDER THAN THE FIX THAT PROMPTED IT. The standing lesson in
 * this repository is that a search is a sample and a guard is the fix: write the guard
 * across the whole package and let it say where you did not look. It did — it found
 * copies in content/ and in the homepage terminal that the audit had not listed.
 *
 * In its own file per the standing concurrent-session rule.
 */

const WEB = process.cwd();
const SCAN_ROOTS = ["app", "components", "content", "lib"];

/**
 * components/scenarios and lib/scenarios are governed by scenarios.test.ts under the
 * illustration-vs-resolution decision on record: a surface ILLUSTRATING the protocol may
 * name a level it is explaining, provided it says so and states the issuance ceiling.
 * That guard is stricter there than this one would be, so this file stays out of it
 * rather than duplicating a rule and letting the two drift.
 */
const ILLUSTRATION_DIRS = [
  path.join("components", "scenarios"),
  path.join("lib", "scenarios"),
];

const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".md", ".mdx"]);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
      continue;
    }
    if (SOURCE_EXT.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

/** Every scanned file, as a repo-relative path. */
function publicSurfaceFiles(): string[] {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) walk(path.join(WEB, root), files);
  return files
    .map((f) => path.relative(WEB, f))
    .filter((rel) => !ILLUSTRATION_DIRS.some((d) => rel.startsWith(d)))
    .sort();
}

/**
 * A guard must let the code explain itself: a file has to be able to record in prose WHY
 * a rule exists, or what a link used to be, without tripping the rule it is explaining.
 * Comments are stripped before matching — never the other way round, which would mean
 * adding escape hatches to the rule itself.
 */
function stripComments(src: string, ext: string): string {
  if (ext === ".md" || ext === ".mdx") return src.replace(/<!--[\s\S]*?-->/g, "");
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "") // JSX {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, "") // block
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // line, without eating https://
}

/**
 * Whitespace is collapsed after comments are stripped. JSX prose wraps wherever the
 * formatter decided, so a guard that matches a sentence must not care where the line
 * broke — the first draft of this file passed on the homepage and failed on /trust for
 * no reason other than a newline falling between two words of the same sentence.
 */
function read(rel: string): string {
  const ext = path.extname(rel);
  return stripComments(fs.readFileSync(path.join(WEB, rel), "utf-8"), ext).replace(/\s+/g, " ");
}

const FILES = publicSurfaceFiles();

describe("T-1 — no public surface links into a private repository", () => {
  it("scans a non-trivial number of files", () => {
    // A walker that silently matches nothing passes every assertion below.
    expect(FILES.length).toBeGreaterThan(40);
  });

  it("links no file at AgenID-protocol/agenid, which is private", () => {
    const offenders: string[] = [];
    for (const rel of FILES) {
      if (/github\.com\/AgenID-protocol\/agenid\b/i.test(read(rel))) offenders.push(rel);
    }
    expect(
      offenders,
      `These surfaces link the PRIVATE monorepo; a logged-out reader gets a 404:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("references only repositories that are actually public", () => {
    // github.com/AgenID-protocol            → the org page, public
    // github.com/AgenID-protocol/spec       → public, MIT
    // github.com/AgenID-protocol/conformance→ public, MIT
    // Anything else in this org is private until someone decides otherwise, and the
    // decision should be made here rather than discovered by a visitor.
    const PUBLIC = new Set(["spec", "conformance"]);
    const bad: string[] = [];
    for (const rel of FILES) {
      for (const m of read(rel).matchAll(/github\.com\/AgenID-protocol\/([A-Za-z0-9._-]+)/g)) {
        if (!PUBLIC.has(m[1])) bad.push(`${rel}: AgenID-protocol/${m[1]}`);
      }
    }
    expect(bad, `Reference(s) to a repository not known to be public:\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});

describe("T-2 — the errata link points at the file that exists", () => {
  it("references no ERRATA.md at the repository root", () => {
    // docs/errata.md is the real path. The root-level spelling 404s.
    const bad = FILES.filter((rel) => /\/ERRATA\.md/.test(read(rel)));
    expect(bad, `Dead errata link in:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("gives the footer's Errata Log the real path", () => {
    const footer = read(path.join("components", "Footer.tsx"));
    expect(footer).toMatch(/github\.com\/AgenID-protocol\/spec\/blob\/main\/docs\/errata\.md/);
  });
});

describe("T-3 — defined in v1.1.1 and issued by AgenID today are two claims", () => {
  const HOME = path.join("app", "page.tsx");
  const TRUST = path.join("app", "trust", "page.tsx");

  it("never says a level is 'issuable in v1.1.1'", () => {
    // The word conflates the spec with the deployment, which is the whole defect.
    const bad = FILES.filter((rel) => /issuable in v1\.1\.1/i.test(read(rel)));
    expect(bad, `Conflates spec capability with deployed capability:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("gives the homepage level table both columns", () => {
    const home = read(HOME);
    expect(home).toMatch(/Defined in v1\.1\.1/);
    expect(home).toMatch(/Issued by AgenID today/);
  });

  it("marks exactly one level as issued today, and it is L1", () => {
    const home = read(HOME);
    const rows = [...home.matchAll(/\{\s*l:\s*"(L[1-5])"[^}]*?issuedToday:\s*(true|false)/g)];
    expect(rows.length, "the LEVELS table did not parse — did its shape change?").toBe(5);
    const issued = rows.filter((r) => r[2] === "true").map((r) => r[1]);
    expect(issued).toEqual(["L1"]);
  });

  it("states the deployment's issuance ceiling on the homepage and on /trust", () => {
    for (const rel of [HOME, TRUST]) {
      expect(read(rel), `${rel} does not name the ceiling`).toMatch(
        /only level agenid\.com issues today is L1_REGISTERED|ceiling on this deployment is L1_REGISTERED/i,
      );
    }
  });

  it("splits every level on /trust instead of calling three of them issuable", () => {
    const trust = read(TRUST);
    expect(trust, "/trust still uses the bare word 'Issuable.'").not.toMatch(/\bIssuable\./);
    expect(trust).toMatch(/Defined in v1\.1\.1 · Issued by AgenID today\./);
    // L2, L3 and L4 — three levels that are defined and not issued here.
    expect((trust.match(/Not issued by AgenID today\./g) ?? []).length).toBe(3);
  });

  it("renders no verification level above L1 as a resolution result", () => {
    // An illustration may name a level (see ILLUSTRATION_DIRS); a surface showing what
    // resolving actually returns may not show one this deployment cannot issue.
    const bad: string[] = [];
    for (const rel of FILES) {
      for (const m of read(rel).matchAll(/"level":\s*"(L[2-5]_[A-Z_]+)"/g)) bad.push(`${rel}: ${m[1]}`);
    }
    expect(bad, `Shows an unissuable level as a result:\n  ${bad.join("\n  ")}`).toEqual([]);
  });
});

describe("T-4 — no public surface claims a capability this deployment does not have", () => {
  const HOME = path.join("app", "page.tsx");
  const TRUST = path.join("app", "trust", "page.tsx");

  it("never presents an @agenid/* npm install or npx as working", () => {
    // Nothing in this project is published: @agenid/core, @agenid/cli and
    // @agenid/mcp-server all 404 on the npm registry. A file may still SHOW the command
    // — that is useful documentation of the eventual shape — but only if the same file
    // says it does not resolve today.
    // The disclosure must come FIRST in reading order, not merely somewhere in the file:
    // a reader who copies the command out of a code block has already left, and a note
    // further down is a note they never saw.
    const firstNpm = (s: string) => {
      const hits = [/npm\s+install\s+@agenid\//, /npx[^\n]{0,80}@agenid\//]
        .map((re) => s.search(re))
        .filter((i) => i >= 0);
      return hits.length ? Math.min(...hits) : -1;
    };
    const firstDisclosure = (s: string) =>
      s.search(/not published to npm|is not published|not on npm|npm error 404/i);
    const bad: string[] = [];
    for (const rel of FILES) {
      const src = read(rel);
      const npm = firstNpm(src);
      if (npm < 0) continue;
      const note = firstDisclosure(src);
      if (note < 0) bad.push(`${rel}: no "not published" disclosure anywhere`);
      else if (note > npm) bad.push(`${rel}: disclosure appears after the install command`);
    }
    expect(bad, `Implies an unpublished package can be installed:\n  ${bad.join("\n  ")}`).toEqual([]);
  });

  it("claims no live status transition, because no write path sets one", () => {
    // Agent status (CHANGED/STALE/SUSPENDED/REVOKED) and key retirement/revocation are
    // in the schemas and rendered by both badges — and nothing writes them. Describing
    // them as something that happens to a live identity is a capability claim.
    const bad = FILES.filter((rel) => /(suspended|revoked) identity changes/i.test(read(rel)));
    expect(bad, `Claims a status transition that cannot occur:\n  ${bad.join("\n  ")}`).toEqual([]);
    for (const rel of [HOME, TRUST]) {
      expect(read(rel), `${rel} does not disclose that there is no revocation flow`).toMatch(
        /no revocation flow/i,
      );
    }
  });

  it("lets the terminal demo show its own commands instead of clipping them", () => {
    // Not a link or an availability claim, but the same failure mode: a surface that
    // does not deliver what it says it delivers. The honest commands are long enough to
    // run off the card, and a clipped command with a scrollbar under it means the reader
    // never reaches the output the demo exists to show. Found by watching it, not by a
    // test — so it gets a test.
    const term = read(path.join("components", "Terminal.tsx"));
    const pre = term.match(/<pre className="([^"]+)"/);
    expect(pre, "the terminal's <pre> did not parse").not.toBeNull();
    expect(pre![1], "the terminal must wrap long commands").toMatch(/whitespace-pre-wrap/);
  });

  it("describes the agent directory as it is deployed: opt-in only, not endorsement", () => {
    // The directory used to be absent and the page said so. It now exists (2026-09-23,
    // /agents) and is opt-in: registration alone lists nothing. The page must say exactly
    // that — neither the old "no directory" (now false) nor anything implying every
    // registered agent is enumerable.
    const trust = read(TRUST);
    expect(trust, "'…no directory yet' reads as a roadmap").not.toMatch(/directory of registered[\s\S]{0,60}\byet\b/i);
    expect(trust, "stale: the directory now exists").not.toMatch(/publishes no directory of registered agents/i);
    expect(trust).toMatch(/Registration lists an agent nowhere/);
    expect(trust).toMatch(/opted in by signing a listing consent/);
    expect(trust).toMatch(/not an endorsement and changes no verification level/);
  });
});
