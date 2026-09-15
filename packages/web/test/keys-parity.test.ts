/**
 * Cross-registry parity for `GET /v1/keys` (spec §9.2), driven from RAW REQUEST TARGETS.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE WAS REWRITTEN
 * ---------------------------------------------------------------------------
 * The previous version claimed to prove parity and could not. Its Next adapter did this:
 *
 *     const segments = new URL(url).pathname.split("/");
 *     GET(req, { params: { key_ulid: segments[2] } })
 *
 * `URL.pathname` does NOT percent-decode, so the Next route was handed the RAW segment —
 * while `fastify.inject(url)` handed Fastify a target whose parameter find-my-way then
 * DECODED. For `/v1/keys/agenid%253Akey%253A<ULID>` the two registries were therefore
 * asked different questions: one saw `agenid%253Akey%253A…`, the other `agenid%3Akey%3A…`.
 * Both answered 400, the assertion was satisfied, and the test reported parity for a
 * comparison it never made. Neither representation was the one the real Next runtime
 * produces, so it was not even testing production's behaviour by accident.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS VERSION DOES INSTEAD
 * ---------------------------------------------------------------------------
 * Every case is a RAW REQUEST TARGET string. Both adapters are built from that one
 * string, each records the target it actually observed, and `expect(nextRaw).toBe(
 * fastifyRaw)` runs on every case — so "they were asked the same question" is asserted,
 * not assumed. The Next adapter also derives `params` the way Next derives it, by
 * decoding the raw segment exactly once, so the tripwire in `resolveKeyFromRawPath` is
 * exercised with a realistic value rather than a convenient one.
 *
 * A fixture must survive URL parsing byte-for-byte, and `same raw target` asserts that
 * first. Characters a URL parser would rewrite (a literal space, `<`, `"`)  are therefore
 * written percent-encoded here, which is what a real client sends. Their unencoded forms
 * reach Fastify's parser and not Next's, so they are covered where that difference is the
 * point: `packages/api/tests/framework-errors.test.ts`.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildApp, MemoryStore, KEY_ERROR_MESSAGES, originForm, type RegistryStore } from "@agenid/api";
import { generateKeyId, keyIdToWire, type KeyDocument } from "@agenid/core";
import { getStore } from "../lib/api";
import { generateKeyPair, signAgent } from "../lib/client-crypto";

const BASE = "https://www.agenid.com";
const M = KEY_ERROR_MESSAGES;

let doc: KeyDocument;
let fastify: ReturnType<typeof buildApp>;
let store: RegistryStore;
let pollutedId: string;
let mismatchedIndex: string;

/** Percent-encode every character — how a client double-encodes an identifier. */
const encAll = (s: string) => [...s].map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`).join("");
const encLogical = (s: string) => s.replace(/[^A-Za-z0-9]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

beforeAll(async () => {
  store = getStore();
  fastify = buildApp({ store });
  const signed = await signAgent(generateKeyPair(), "Parity Fixture", {
    operator: "Acme Health, Inc.",
    operatorDomain: "acmehealth.com",
    purposeSummary: "Fixture for cross-registry parity.",
    disclosesToUser: true,
    humanEscalation: true,
    channels: ["voice"],
  });
  doc = signed.keyDocument as KeyDocument;
  await store.putKey(doc);

  pollutedId = generateKeyId();
  await store.putKey({ ...doc, key_id: pollutedId, internal_row_id: 42 } as unknown as KeyDocument);

  mismatchedIndex = generateKeyId();
  const asMap = store as unknown as { keys?: Map<string, KeyDocument> };
  if (asMap.keys instanceof Map) asMap.keys.set(mismatchedIndex, doc);
});

type Observed = { status: number; body: string; raw: string; headers: Record<string, string | undefined> };

/**
 * The Next.js registry, driven exactly as the runtime drives it: the handler receives the
 * `Request` built from the raw target, and `params` is the raw segment decoded ONCE —
 * which is what Next does, and is the value the old, broken guard was built on.
 */
async function web(rawTarget: string, method = "GET"): Promise<Observed> {
  const req = new Request(BASE + rawTarget, { method });
  const raw = originForm(req.url);
  const path = raw.split("?")[0] as string;
  const rest = path.slice("/v1/keys".length);
  const isItem = rest !== "" && rest !== "/";

  const mod = isItem
    ? ((await import("../app/v1/keys/[key_ulid]/route")) as unknown as Record<string, unknown>)
    : ((await import("../app/v1/keys/route")) as unknown as Record<string, unknown>);

  let res: Response;
  if (method === "GET") {
    if (isItem) {
      const segment = path.slice(path.lastIndexOf("/") + 1);
      let param: string;
      try {
        param = decodeURIComponent(segment);
      } catch {
        param = segment;
      }
      res = await (mod.GET as (r: Request, c: { params: Promise<{ key_ulid: string }> }) => Promise<Response>)(req, {
        params: Promise.resolve({ key_ulid: param }),
      });
    } else {
      res = await (mod.GET as (r: Request) => Promise<Response>)(req);
    }
  } else {
    const handler = mod[method] as undefined | (() => Response);
    if (!handler) return { status: 404, body: "", raw, headers: {} };
    res = handler();
  }
  return {
    status: res.status,
    body: await res.text(),
    raw,
    headers: {
      allow: res.headers.get("allow") ?? undefined,
      "access-control-allow-origin": res.headers.get("access-control-allow-origin") ?? undefined,
      "cache-control": res.headers.get("cache-control") ?? undefined,
      "content-type": res.headers.get("content-type") ?? undefined,
    },
  };
}

/** The Fastify registry, through its own HTTP parser, recording the target it saw. */
async function api(rawTarget: string, method = "GET"): Promise<Observed> {
  let raw = "";
  const capture = buildApp({ store });
  capture.addHook("onRequest", (req, _reply, done) => {
    raw = originForm(req.raw.url ?? "");
    done();
  });
  await capture.ready();
  const r = await capture.inject({ method: method as "GET", url: rawTarget });
  await capture.close();
  return {
    status: r.statusCode,
    body: r.body,
    raw: raw || rawTarget,
    headers: {
      allow: r.headers.allow as string | undefined,
      "access-control-allow-origin": r.headers["access-control-allow-origin"] as string | undefined,
      "cache-control": r.headers["cache-control"] as string | undefined,
      "content-type": r.headers["content-type"] as string | undefined,
    },
  };
}

interface Fixture {
  name: string;
  rawTarget: string;
  status: number;
  error?: string;
  message?: string;
}

const ULID = () => keyIdToWire(doc.key_id);

function fixtures(): Fixture[] {
  const wire = ULID();
  const logical = doc.key_id;
  return [
    // ---- the two canonical forms, and only these, resolve -------------------
    { name: "canonical bare ULID in the path", rawTarget: `/v1/keys/${wire}`, status: 200 },
    { name: "canonical percent-encoded logical form in the query", rawTarget: `/v1/keys?key_id=${encLogical(logical)}`, status: 200 },
    { name: "logical form in the query, unencoded (RFC-equivalent)", rawTarget: `/v1/keys?key_id=${logical}`, status: 200 },

    // ---- THE PRODUCTION DEFECT and its family -------------------------------
    { name: "ULID encoded once in the path", rawTarget: `/v1/keys/${encAll(wire)}`, status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "ULID encoded twice in the path", rawTarget: `/v1/keys/${encAll(encAll(wire))}`, status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "ULID encoded three times in the path", rawTarget: `/v1/keys/${encAll(encAll(encAll(wire)))}`, status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "logical form in the path with %3A", rawTarget: `/v1/keys/${encLogical(logical)}`, status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "logical form in the path with %253A", rawTarget: `/v1/keys/agenid%253Akey%253A${wire}`, status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "logical form in the path with %25253A", rawTarget: `/v1/keys/agenid%25253Akey%25253A${wire}`, status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "logical form in the path, literal colons", rawTarget: `/v1/keys/${logical}`, status: 400, error: "invalid_key_id", message: M.bad_wire_form },

    // ---- fragments: §0.A names this failure explicitly ----------------------
    { name: "%23 fragment in the path", rawTarget: `/v1/keys/${wire}%23z1`, status: 400, error: "invalid_key_id", message: M.fragment },
    { name: "%23 fragment in the query value", rawTarget: `/v1/keys?key_id=${encLogical(logical)}%23z1`, status: 400, error: "invalid_key_id", message: M.fragment },
    { name: "%2523 in the path is not a fragment, it is a non-literal segment", rawTarget: `/v1/keys/${wire}%2523z1`, status: 400, error: "invalid_key_id", message: M.path_not_literal },

    // ---- malformed and reserved escapes ------------------------------------
    { name: "lone percent", rawTarget: "/v1/keys/%", status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "truncated escape", rawTarget: "/v1/keys/%2", status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "non-hex escape", rawTarget: "/v1/keys/%ZZ", status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "encoded slash", rawTarget: "/v1/keys/%2F", status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "NUL", rawTarget: "/v1/keys/%00", status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "traversal", rawTarget: "/v1/keys/..%2F..%2Fagents", status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "encoded XSS", rawTarget: "/v1/keys/%3Cscript%3Ealert(1)%3C%2Fscript%3E", status: 400, error: "invalid_key_id", message: M.path_not_literal },
    { name: "malformed escape in the query value", rawTarget: "/v1/keys?key_id=%ZZ", status: 400, error: "invalid_key_id", message: M.malformed_escape },
    { name: "double-encoded query value", rawTarget: `/v1/keys?key_id=${encAll(encLogical(logical))}`, status: 400, error: "invalid_key_id", message: M.double_encoded },

    // ---- malformed identifiers that are nonetheless literal ----------------
    { name: "not a ULID", rawTarget: "/v1/keys/not-a-ulid", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "25 characters", rawTarget: "/v1/keys/01M2HYWJ1NW959K7HT187PNXD", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "27 characters", rawTarget: "/v1/keys/01M2HYWJ1NW959K7HT187PNXDEE", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "lowercase", rawTarget: "/v1/keys/01m2hywj1nw959k7ht187pnxde", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "Crockford excludes I", rawTarget: "/v1/keys/01M2HYWJ1NW959K7HT187PNXDI", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "first character out of range", rawTarget: "/v1/keys/91M2HYWJ1NW959K7HT187PNXDE", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "an agent id in key position", rawTarget: "/v1/keys/agenid:01M2HYWJ1NZP5HPM8F74P1QW13", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "an assertion id in key position", rawTarget: "/v1/keys/assertion:01M2HYWJ1NW959K7HT187PNXDE", status: 400, error: "invalid_key_id", message: M.bad_wire_form },
    { name: "SQL canary", rawTarget: "/v1/keys/01M2HYWJ1NW959K7HT187PNXDE'%20OR%20'1'='1", status: 400, error: "invalid_key_id", message: M.path_not_literal },

    // ---- the one-occurrence rule -------------------------------------------
    { name: "duplicate key_id", rawTarget: `/v1/keys?key_id=${encLogical(logical)}&key_id=${encLogical(generateKeyId())}`, status: 400, error: "invalid_key_id", message: M.duplicate_key_id },
    { name: "duplicate key_id, reversed", rawTarget: `/v1/keys?key_id=${encLogical(generateKeyId())}&key_id=${encLogical(logical)}`, status: 400, error: "invalid_key_id", message: M.duplicate_key_id },
    { name: "identical duplicates", rawTarget: `/v1/keys?key_id=${encLogical(logical)}&key_id=${encLogical(logical)}`, status: 400, error: "invalid_key_id", message: M.duplicate_key_id },
    { name: "three duplicates", rawTarget: `/v1/keys?key_id=${encLogical(logical)}&key_id=${encLogical(logical)}&key_id=${encLogical(logical)}`, status: 400, error: "invalid_key_id", message: M.duplicate_key_id },
    { name: "empty value plus a real one", rawTarget: `/v1/keys?key_id=&key_id=${encLogical(logical)}`, status: 400, error: "invalid_key_id", message: M.duplicate_key_id },

    // ---- absence of key_id --------------------------------------------------
    { name: "no query at all", rawTarget: "/v1/keys", status: 400, error: "invalid_key_id", message: M.missing_key_id },
    { name: "empty key_id", rawTarget: "/v1/keys?key_id=", status: 400, error: "invalid_key_id", message: M.missing_key_id },
    { name: "bracket syntax is not key_id", rawTarget: `/v1/keys?key_id[]=${encLogical(logical)}`, status: 400, error: "invalid_key_id", message: M.missing_key_id },
    { name: "encoded bracket syntax is not key_id", rawTarget: `/v1/keys?key_id%5B%5D=${encLogical(logical)}`, status: 400, error: "invalid_key_id", message: M.missing_key_id },
    { name: "an unrelated parameter is ignored", rawTarget: "/v1/keys?other=1", status: 400, error: "invalid_key_id", message: M.missing_key_id },

    // ---- absence of the key -------------------------------------------------
    { name: "a key that was never published", rawTarget: `/v1/keys/${keyIdToWire(generateKeyId())}`, status: 404, error: "key_not_found" },
  ];
}

describe("both registries are asked the same raw question and give the same answer", () => {
  it("every fixture survives URL parsing byte-for-byte (otherwise the comparison is void)", () => {
    for (const f of fixtures()) {
      expect(originForm(new Request(BASE + f.rawTarget).url), `fixture rewritten by URL parsing: ${f.name}`).toBe(
        f.rawTarget,
      );
    }
  });

  it("each fixture: same raw target, same status, same body", async () => {
    for (const f of fixtures()) {
      const w = await web(f.rawTarget);
      const a = await api(f.rawTarget);

      // THE ASSERTION THE OLD FILE LACKED: both adapters received the same bytes.
      expect(a.raw, `raw target disagreed for ${f.name}`).toBe(w.raw);
      expect(w.raw, `harness did not deliver the fixture for ${f.name}`).toBe(f.rawTarget);

      expect(w.status, `next status for ${f.name}`).toBe(f.status);
      expect(a.status, `fastify status for ${f.name}`).toBe(f.status);
      expect(JSON.parse(a.body), `body disagreed for ${f.name}`).toEqual(JSON.parse(w.body));

      const j = JSON.parse(w.body);
      if (f.error) expect(j.error, `error code for ${f.name}`).toBe(f.error);
      // The REASON, not just the code. A status and a code alone cannot distinguish
      // "the double-encoding guard ran" from "some other rule happened to refuse it".
      if (f.message) expect(j.message, `reason for ${f.name}`).toBe(f.message);
      if (f.status === 200) expect(j).toEqual(doc);
    }
  });

  it("no error body anywhere in the matrix carries the caller's input back", async () => {
    for (const f of fixtures()) {
      if (f.status === 200) continue;
      for (const o of [await web(f.rawTarget), await api(f.rawTarget)]) {
        for (const needle of ["script", "OR '1'='1", "passwd", "CANARY", "%25", "..%2F"]) {
          expect(o.body, `${f.name} leaked ${needle}`).not.toContain(needle);
        }
        // Every reason is one of the fixed sentences; nothing is improvised per-request.
        expect(Object.values(M)).toContain(JSON.parse(o.body).message);
      }
    }
  });

  it("no response from either registry contains anything private", async () => {
    for (const rawTarget of [`/v1/keys/${ULID()}`, `/v1/keys/${keyIdToWire(generateKeyId())}`, "/v1/keys/not-a-ulid", `/v1/keys/${keyIdToWire(pollutedId)}`]) {
      for (const o of [await web(rawTarget), await api(rawTarget)]) {
        for (const needle of ["private", "secret", "seed", "service_role", "supabase", "authorization"]) {
          expect(o.body.toLowerCase()).not.toContain(needle);
        }
      }
    }
  });
});

describe("stored-document guards behave identically in both registries", () => {
  it("a stored document with an undefined member: both refuse with 503, neither leaks it", async () => {
    const t = `/v1/keys/${keyIdToWire(pollutedId)}`;
    const [w, a] = [await web(t), await api(t)];
    for (const o of [w, a]) {
      expect(o.status).toBe(503);
      expect(JSON.parse(o.body).error).toBe("key_document_invalid");
      expect(o.body).not.toContain("internal_row_id");
    }
    expect(JSON.parse(a.body)).toEqual(JSON.parse(w.body));
  });

  it("a document indexed under an identifier it does not claim: both refuse with 503", async () => {
    const asMap = getStore() as unknown as { keys?: Map<string, KeyDocument> };
    if (!(asMap.keys instanceof Map)) return;
    const t = `/v1/keys/${keyIdToWire(mismatchedIndex)}`;
    for (const o of [await web(t), await api(t)]) {
      expect(o.status).toBe(503);
      expect(JSON.parse(o.body).error).toBe("key_document_invalid");
      expect(o.body).not.toContain("public_key_b64u");
    }
  });
});

// ---------------------------------------------------------------------------
// R-3 — one authoritative result per resource per method.
// ---------------------------------------------------------------------------
describe("the method matrix agrees across both registries", () => {
  const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;

  it.each(MUTATING)("%s on the ITEM resource is 405 with Allow in both", async (method) => {
    const t = `/v1/keys/${ULID()}`;
    const [w, a] = [await web(t, method), await api(t, method)];
    for (const o of [w, a]) {
      expect(o.status, `${method} ${o.raw}`).toBe(405);
      expect(o.headers.allow).toBe("GET, OPTIONS");
      expect(JSON.parse(o.body).error).toBe("method_not_allowed");
    }
  });

  it.each(MUTATING)("%s on the COLLECTION resource is 405 with Allow in both", async (method) => {
    // This is the finding: Fastify answered POST /v1/keys with the authority key
    // publication path (503/401 depending on configuration) while Next answered 405 and
    // advertised `Allow: GET, OPTIONS`. One resource, two meanings. Authority publication
    // now lives at /v1/authority/keys and this resource is read-only on both.
    const [w, a] = [await web("/v1/keys", method), await api("/v1/keys", method)];
    for (const o of [w, a]) {
      expect(o.status, `${method} /v1/keys`).toBe(405);
      expect(o.headers.allow).toBe("GET, OPTIONS");
    }
  });

  it("POST /v1/keys reaches no authority logic and no store", async () => {
    const withAuthority = buildApp({ store: new MemoryStore(), authorityToken: "t" });
    const r = await withAuthority.inject({ method: "POST", url: "/v1/keys", payload: { anything: true } });
    await withAuthority.close();
    expect(r.statusCode).toBe(405);
    expect(r.body).not.toContain("authority");
    expect(r.body).not.toContain("unauthorized");
  });

  it("the authority capability still exists, at its own scoped path", async () => {
    const unconfigured = buildApp({ store: new MemoryStore() });
    const r = await unconfigured.inject({ method: "POST", url: "/v1/authority/keys", payload: {} });
    await unconfigured.close();
    expect(r.statusCode).toBe(503);
    expect(r.json().error).toBe("authority_writes_disabled");
  });

  it("GET and HEAD agree on status for both resources", async () => {
    for (const t of [`/v1/keys/${ULID()}`, `/v1/keys?key_id=${encLogical(doc.key_id)}`]) {
      const get = await api(t);
      const head = await api(t, "HEAD");
      expect(head.status, `HEAD ${t}`).toBe(get.status);
    }
  });
});

describe("one explicit CORS policy for a public, credential-free read surface", () => {
  it("a successful response is cross-origin readable, JSON, and never cached, in both", async () => {
    const t = `/v1/keys/${ULID()}`;
    for (const o of [await web(t), await api(t)]) {
      expect(o.headers["access-control-allow-origin"]).toBe("*");
      expect(o.headers["cache-control"]).toBe("no-store");
      expect(o.headers["content-type"]).toContain("application/json");
    }
  });

  it("the preflight advertises the methods the resource actually supports, and no more", async () => {
    for (const url of ["/v1/keys", `/v1/keys/${ULID()}`]) {
      const a = await fastify.inject({ method: "OPTIONS", url });
      expect(a.statusCode).toBe(204);
      expect(a.headers["access-control-allow-methods"]).toBe("GET, OPTIONS");
      expect(a.headers["access-control-allow-origin"]).toBe("*");
    }
    const mod = (await import("../app/v1/keys/route")) as unknown as { OPTIONS: () => Response };
    const w = mod.OPTIONS();
    expect(w.status).toBe(204);
    expect(w.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
    expect(w.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("a hostile Origin is not reflected and no credentials are ever allowed", async () => {
    for (const origin of ["https://evil.example", "null", "https://www.agenid.com"]) {
      const a = await fastify.inject({ method: "OPTIONS", url: "/v1/keys", headers: { origin } });
      expect(a.headers["access-control-allow-origin"], `preflight for ${origin}`).toBe("*");
      expect(a.headers["access-control-allow-credentials"]).toBeUndefined();
      const g = await fastify.inject({ method: "GET", url: `/v1/keys/${ULID()}`, headers: { origin } });
      expect(g.headers["access-control-allow-origin"], `response for ${origin}`).toBe("*");
      expect(g.headers["access-control-allow-credentials"]).toBeUndefined();
    }
  });

  it("the preflight and the response agree on the origin header", async () => {
    const pre = await fastify.inject({ method: "OPTIONS", url: `/v1/keys/${ULID()}` });
    const res = await fastify.inject({ method: "GET", url: `/v1/keys/${ULID()}` });
    expect(pre.headers["access-control-allow-origin"]).toBe(res.headers["access-control-allow-origin"]);
  });

  it("OPTIONS without an Origin still answers, and answers the same", async () => {
    const withOrigin = await fastify.inject({ method: "OPTIONS", url: "/v1/keys", headers: { origin: "https://x.example" } });
    const without = await fastify.inject({ method: "OPTIONS", url: "/v1/keys" });
    expect(without.statusCode).toBe(withOrigin.statusCode);
    expect(without.headers["access-control-allow-methods"]).toBe(withOrigin.headers["access-control-allow-methods"]);
  });
});
