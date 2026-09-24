/**
 * The v1.2-draft schemas served at /schemas/v1.2/. They exist because @agenid/core exports
 * GRANT_SCHEMA_ID and REVOCATION_SCHEMA_ID, and the live pilot grant is signed with that
 * `$schema` value: a signed schema id must resolve. They are draft and NOT normative, and
 * every copy has to say so.
 *
 * New file, per the concurrent-session rule.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GRANT_SCHEMA_ID, REVOCATION_SCHEMA_ID } from "@agenid/core";

const DIR = path.join(process.cwd(), "public", "schemas", "v1.2");
const load = (f: string) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as Record<string, unknown>;

const CASES = [
  { file: "authorization-grant.json", id: GRANT_SCHEMA_ID },
  { file: "revocation.json", id: REVOCATION_SCHEMA_ID },
];

describe("v1.2-draft schemas", () => {
  it("serves exactly the files core exports ids for", () => {
    expect(fs.readdirSync(DIR).sort()).toEqual(CASES.map((c) => c.file).sort());
  });

  for (const { file, id } of CASES) {
    it(`${file}: $id equals the id @agenid/core signs with`, () => {
      expect(load(file).$id).toBe(id);
    });

    it(`${file}: is labelled DRAFT and NOT NORMATIVE in title and $comment`, () => {
      const s = load(file);
      expect(String(s.title)).toMatch(/NOT NORMATIVE/);
      expect(String(s.$comment)).toMatch(/DRAFT/);
      expect(String(s.$comment)).toMatch(/NOT NORMATIVE/);
    });

    it(`${file}: is JSON Schema 2020-12 and closed to unknown members`, () => {
      const s = load(file);
      expect(s.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
      expect(s.additionalProperties).toBe(false);
    });
  }

  it("the pilot grant names the served grant schema", () => {
    const pilot = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "pilot", "grok-bot.json"), "utf8"));
    expect(JSON.stringify(pilot)).toContain(GRANT_SCHEMA_ID);
  });

  it("is served with a schema content type", () => {
    const cfg = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
    expect(cfg).toMatch(/source: "\/schemas\/v1\.2\/:file\*\.json"/);
  });
});
