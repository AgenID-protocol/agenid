/**
 * Every SECURITY DEFINER function must have EXECUTE revoked from PUBLIC.
 *
 * Regression guard, not a hypothetical. 0003_rate_limit.sql shipped with
 * `revoke all ... from anon, authenticated` — which removes nothing, because Postgres
 * grants EXECUTE to PUBLIC on every new function and both Supabase roles inherit through
 * PUBLIC. Both rate-limit functions ran with owner rights and were callable by anyone
 * holding the publishable key at /rest/v1/rpc/*, in production, for two days.
 *
 * The rule enforced here, over every migration in order:
 *   1. a function declared `security definer` must be revoked `from public` (with or
 *      without other roles) in the same migration or a later one; and
 *   2. no later statement may grant EXECUTE on it back to public, anon or authenticated.
 *
 * SQL comments are stripped before matching, so a migration can explain the rule in
 * prose without satisfying or tripping it.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");

const stripComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");

/** Name without schema qualifier or quotes, lowercased. */
const bare = (name: string) => name.replace(/^public\./i, "").replace(/"/g, "").toLowerCase();

interface Migration { file: string; sql: string }

export function loadMigrations(dir = MIGRATIONS): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((file) => ({ file, sql: stripComments(readFileSync(join(dir, file), "utf8")) }));
}

/** Returns human-readable violations; empty means compliant. */
export function definerGrantViolations(migrations: Migration[]): string[] {
  const violations: string[] = [];
  // function name -> index of the migration that (re)declared it SECURITY DEFINER
  const definers = new Map<string, { file: string; index: number }>();

  migrations.forEach(({ file, sql }, index) => {
    const fnRe = /create\s+(?:or\s+replace\s+)?function\s+([\w."]+)\s*\(([\s\S]*?)\$\$[\s\S]*?\$\$/gi;
    for (const m of sql.matchAll(fnRe)) {
      if (/security\s+definer/i.test(m[0])) definers.set(bare(m[1]), { file, index });
    }
  });

  for (const [name, decl] of definers) {
    const later = migrations.slice(decl.index);
    const onFn = String.raw`on\s+function\s+(?:public\.)?"?${name}"?\s*\([^)]*\)`;
    const revokedFromPublic = later.some(({ sql }) =>
      new RegExp(String.raw`revoke\s+(?:all|execute)(?:\s+privileges)?\s+${onFn}\s+from\s+[^;]*\bpublic\b`, "i").test(sql),
    );
    if (!revokedFromPublic) {
      violations.push(`${name} (declared in ${decl.file}) is SECURITY DEFINER but EXECUTE is never revoked from PUBLIC`);
    }
    const regranted = later.find(({ sql }) =>
      new RegExp(String.raw`grant\s+(?:all|execute)(?:\s+privileges)?\s+${onFn}\s+to\s+[^;]*\b(public|anon|authenticated)\b`, "i").test(sql),
    );
    if (regranted) violations.push(`${name} is granted back to a public role in ${regranted.file}`);
  }
  return violations;
}

describe("SECURITY DEFINER functions are not publicly executable", () => {
  it("finds the definer functions it is meant to check (the scan is not a silent no-op)", () => {
    const sql = loadMigrations().map((m) => m.sql).join("\n");
    expect(sql).toMatch(/security\s+definer/i);
  });

  it("every SECURITY DEFINER function has EXECUTE revoked from PUBLIC and never re-granted", () => {
    expect(definerGrantViolations(loadMigrations())).toEqual([]);
  });

  it("the check rejects the exact revoke that shipped in 0003 (anon/authenticated only)", () => {
    const shipped: Migration = {
      file: "x.sql",
      sql: stripComments(`
        create or replace function rate_limit_sweep(p timestamptz) returns integer
        language plpgsql security definer set search_path = public as $$ begin return 0; end; $$;
        revoke all on function rate_limit_sweep(timestamptz) from anon, authenticated;`),
    };
    expect(definerGrantViolations([shipped])).toHaveLength(1);
  });

  it("the check rejects a grant back to anon after a correct revoke", () => {
    const regrant: Migration[] = [
      { file: "a.sql", sql: `create function f() returns int language sql security definer as $$ select 1 $$;
        revoke all on function f() from public;` },
      { file: "b.sql", sql: `grant execute on function public.f() to anon;` },
    ];
    expect(definerGrantViolations(regrant)).toEqual(["f is granted back to a public role in b.sql"]);
  });

  it("a comment that mentions the revoke does not satisfy it", () => {
    const commented: Migration = {
      file: "c.sql",
      sql: stripComments(`create function g() returns int language sql security definer as $$ select 1 $$;
        -- revoke all on function g() from public;`),
    };
    expect(definerGrantViolations([commented])).toHaveLength(1);
  });
});
