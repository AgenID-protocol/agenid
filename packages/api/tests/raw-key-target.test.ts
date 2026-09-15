/**
 * R-1 — the key-discovery security decision is taken on the RAW request target.
 *
 * The rule under test, stated once: the path segment, AS IT APPEARS IN THE RAW REQUEST
 * TARGET, must be the literal wire form of a key identifier. A bare key-ULID contains no
 * percent sign, so any percent-escape in that position is refused without decoding
 * anything — which is what makes the decision independent of how many times some layer
 * upstream has already decoded the path.
 *
 * Why that matters here rather than in a route test: the defect it fixes was invisible to
 * every route test in this repository, because it lived in the difference between what a
 * platform hands a handler and what a client actually sent.
 */
import { describe, it, expect } from "vitest";
import {
  originForm,
  rawKeyPathSegment,
  rawKeyQueryValues,
  rawKeyTargetFailure,
  KEY_ERROR_MESSAGES,
} from "../src/index.js";

const ULID = "01M2HYWJ1NW959K7HT187PNXDE";
const LOGICAL = `agenid:key:${ULID}`;
const enc = (s: string) => s.replace(/[^A-Za-z0-9]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
/** Percent-encode EVERY character, the way a client double-encoding an identifier does. */
const encAll = (s: string) => [...s].map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`).join("");

describe("originForm", () => {
  it.each([
    ["https://www.agenid.com/v1/keys/X?a=b", "/v1/keys/X?a=b"],
    ["http://127.0.0.1:3900/v1/keys", "/v1/keys"],
    ["/v1/keys/X", "/v1/keys/X"],
    ["https://www.agenid.com", "/"],
  ])("%s -> %s", (input, expected) => expect(originForm(input)).toBe(expected));
});

describe("rawKeyPathSegment — the literal wire form, or nothing", () => {
  it("accepts the canonical bare ULID untouched", () => {
    const r = rawKeyPathSegment(`https://www.agenid.com/v1/keys/${ULID}`);
    expect(r).toEqual({ ok: true, value: ULID });
  });

  // THE PRODUCTION DEFECT. Each of these decodes down to the canonical ULID after enough
  // rounds; none of them is the canonical request target, and none may resolve.
  it.each([
    ["once-encoded ULID", encAll(ULID)],
    ["twice-encoded ULID", encAll(encAll(ULID))],
    ["three-times-encoded ULID", encAll(encAll(encAll(ULID)))],
    ["once-encoded logical form", enc(LOGICAL)],
    ["twice-encoded logical form", encAll(enc(LOGICAL))],
    ["encoded slash", "%2F"],
    ["twice-encoded slash", "%252F"],
    ["lone percent", "%"],
    ["truncated escape", "%2"],
    ["non-hex escape", "%ZZ"],
    ["NUL", "%00"],
    ["traversal", "..%2Fagents"],
  ])("refuses %s as a non-literal wire form", (_name, segment) => {
    const r = rawKeyPathSegment(`https://www.agenid.com/v1/keys/${segment}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(KEY_ERROR_MESSAGES.path_not_literal);
  });

  it("reports an encoded fragment as the fragment it is (§0.A names this failure)", () => {
    for (const s of [`${ULID}%23z1`, `${ULID}%2311`, `%23`]) {
      const r = rawKeyPathSegment(`https://www.agenid.com/v1/keys/${s}`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(KEY_ERROR_MESSAGES.fragment);
    }
  });

  it("a literal '#' anywhere in the target is a fragment, never truncated silently", () => {
    const r = rawKeyPathSegment(`https://www.agenid.com/v1/keys/${ULID}#z1`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(KEY_ERROR_MESSAGES.fragment);
  });

  it("passes a non-ULID literal through for the form check rather than guessing", () => {
    // Not this module's job to decide it is invalid — only that it is LITERAL. The
    // wire-form check downstream is what refuses it, with its own message.
    expect(rawKeyPathSegment(`/v1/keys/${LOGICAL}`)).toEqual({ ok: true, value: LOGICAL });
    expect(rawKeyPathSegment("/v1/keys/<script>")).toEqual({ ok: true, value: "<script>" });
  });

  it("the query string cannot smuggle a segment past the path check", () => {
    expect(rawKeyPathSegment(`/v1/keys/${ULID}?x=%2530`)).toEqual({ ok: true, value: ULID });
  });
});

describe("rawKeyQueryValues — exactly one decode, performed here", () => {
  it("decodes the normative percent-encoded logical form once", () => {
    expect(rawKeyQueryValues(`/v1/keys?key_id=${enc(LOGICAL)}`)).toEqual({ ok: true, value: [LOGICAL] });
  });

  it("returns every value supplied, in order, so a duplicate can be refused", () => {
    const r = rawKeyQueryValues(`/v1/keys?key_id=${enc(LOGICAL)}&key_id=${enc(LOGICAL)}`);
    expect(r).toEqual({ ok: true, value: [LOGICAL, LOGICAL] });
  });

  it("an empty value is a value, not an absence", () => {
    expect(rawKeyQueryValues(`/v1/keys?key_id=&key_id=${enc(LOGICAL)}`)).toEqual({ ok: true, value: ["", LOGICAL] });
  });

  it("ignores parameters that are not exactly key_id, bracket syntax included", () => {
    for (const q of ["other=1", "key_ids=x", "key_id%5B%5D=x", "key_id[]=x", "KEY_ID=x"]) {
      expect(rawKeyQueryValues(`/v1/keys?${q}`)).toEqual({ ok: true, value: [] });
    }
  });

  it("decodes ONCE — a twice-encoded value keeps its percent sign and is caught downstream", () => {
    const r = rawKeyQueryValues(`/v1/keys?key_id=${encAll(enc(LOGICAL))}`);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value[0]).toContain("%");
  });

  it("a malformed escape is not a key reference in any spelling", () => {
    for (const bad of ["%", "%2", "%ZZ", "%E0%A4%A"]) {
      const r = rawKeyQueryValues(`/v1/keys?key_id=${bad}`);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(KEY_ERROR_MESSAGES.malformed_escape);
    }
  });

  it("does not treat '+' as a space: a form convention is not a protocol rule", () => {
    const r = rawKeyQueryValues("/v1/keys?key_id=agenid:key:+");
    expect(r).toEqual({ ok: true, value: ["agenid:key:+"] });
  });

  it("an encoded fragment in the value is the fragment failure", () => {
    const r = rawKeyQueryValues(`/v1/keys?key_id=${enc(LOGICAL)}%23z1`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(KEY_ERROR_MESSAGES.fragment);
  });
});

describe("rawKeyTargetFailure — one reason, whichever layer refuses the request", () => {
  it("is null for a target this surface can handle", () => {
    expect(rawKeyTargetFailure(`/v1/keys/${ULID}`)).toBeNull();
    expect(rawKeyTargetFailure(`/v1/keys?key_id=${enc(LOGICAL)}`)).toBeNull();
    expect(rawKeyTargetFailure("/v1/keys")).toBeNull();
  });

  it("gives the handler's own sentence for a target the router will refuse first", () => {
    expect(rawKeyTargetFailure("/v1/keys/%ZZ")).toBe(KEY_ERROR_MESSAGES.path_not_literal);
    expect(rawKeyTargetFailure("/v1/keys/%23z")).toBe(KEY_ERROR_MESSAGES.fragment);
    expect(rawKeyTargetFailure("/v1/keys?key_id=%ZZ")).toBe(KEY_ERROR_MESSAGES.malformed_escape);
  });

  it("never returns anything the caller sent", () => {
    const msg = rawKeyTargetFailure("/v1/keys/CANARY_918273%ZZ");
    expect(msg).not.toContain("CANARY");
    expect(Object.values(KEY_ERROR_MESSAGES)).toContain(msg);
  });
});
