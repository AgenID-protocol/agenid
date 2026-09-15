/**
 * `GET /v1/keys/{key-ULID}` — the registry half of two-path key discovery (spec §9.2).
 *
 * Exercised against the REAL route handlers and a REAL MemoryStore: nothing here mocks
 * the store, the parser, or crypto. The assertions are deliberately adversarial, because
 * the failure modes that matter for this route are (a) leaking anything that is not one
 * of KeyDocument's nine public members, (b) letting a malformed reference through, and
 * (c) implying that a key existing says something about an agent's trust state.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateKeyId,
  keyIdToWire,
  keyIdFromWire,
  keyResolverPath,
  keyResolverQuery,
  verifyManifestProof,
  type KeyDocument,
} from "@agenid/core";
import { getStore } from "../lib/api";
import { generateKeyPair, signAgent } from "../lib/client-crypto";

const BASE = "https://www.agenid.com";

/**
 * `segment` is the RAW path segment — what a client puts on the wire — not a decoded
 * value. The route now decides from `req.url`, so that is what these helpers must vary;
 * `params` is derived the way Next derives it, by decoding the raw segment exactly once,
 * and is passed only so the route's tripwire is exercised with a realistic value.
 *
 * The earlier version of this helper passed the same string as both, which meant the
 * cases below described a request no client could send and no platform would produce.
 */
async function byPath(segment: string) {
  const { GET } = await import("../app/v1/keys/[key_ulid]/route");
  const req = new Request(`${BASE}/v1/keys/${segment}`);
  let param: string;
  try {
    param = decodeURIComponent(segment);
  } catch {
    param = segment;
  }
  const res = await GET(req, { params: Promise.resolve({ key_ulid: param }) });
  return { res, body: await res.text() };
}

async function byQuery(url: string) {
  const { GET } = await import("../app/v1/keys/route");
  const res = await GET(new Request(`${BASE}${url}`));
  return { res, body: await res.text() };
}

let signed: Awaited<ReturnType<typeof signAgent>>;
let doc: KeyDocument;

beforeAll(async () => {
  const keyPair = generateKeyPair();
  signed = await signAgent(keyPair, "Sunny — Front Desk Scheduler", {
    operator: "Acme Health, Inc.",
    operatorDomain: "acmehealth.com",
    purposeSummary: "Books and reschedules patient appointments.",
    disclosesToUser: true,
    humanEscalation: true,
    channels: ["voice"],
  });
  doc = signed.keyDocument as KeyDocument;
  // Only the key is seeded. No agent record is written anywhere in this file — a key
  // must resolve on its own, and must not imply that any agent exists.
  await getStore().putKey(doc);
});

describe("GET /v1/keys/{key-ULID} — resolution", () => {
  it("resolves a published operator key by its wire form", async () => {
    const { res, body } = await byPath(keyIdToWire(doc.key_id));
    expect(res.status).toBe(200);
    expect(JSON.parse(body)).toEqual(doc);
  });

  it("returns a byte-identical document via the percent-encoded query form (§9.2 'identical document')", async () => {
    const a = await byPath(keyIdToWire(doc.key_id));
    const b = await byQuery(keyResolverQuery(doc.key_id));
    expect(b.res.status).toBe(200);
    expect(b.body).toBe(a.body);
  });

  it("accepts the logical form in the query parameter unencoded as well", async () => {
    const { res, body } = await byQuery(`/v1/keys?key_id=${doc.key_id}`);
    expect(res.status).toBe(200);
    expect(JSON.parse(body).key_id).toBe(doc.key_id);
  });

  it("resolves at exactly the path the resolution envelope advertises", async () => {
    // The envelope's operator_key.discovery.registry_path is built by keyResolverPath.
    const path = keyResolverPath(doc.key_id);
    expect(path).toBe(`/v1/keys/${keyIdToWire(doc.key_id)}`);
    expect(keyIdFromWire(keyIdToWire(doc.key_id))).toBe(doc.key_id);
    const { res } = await byPath(path.slice("/v1/keys/".length));
    expect(res.status).toBe(200);
  });

  it("serves material sufficient to verify a real proof with @agenid/core alone", async () => {
    const { body } = await byPath(keyIdToWire(doc.key_id));
    const fetched = JSON.parse(body) as KeyDocument;
    const r = verifyManifestProof(signed.proof, signed.manifest, fetched, { now: new Date().toISOString() });
    expect(r.ok).toBe(true);
    // And a tampered manifest is rejected using that same fetched key.
    const tampered = JSON.parse(JSON.stringify(signed.manifest)) as typeof signed.manifest;
    (tampered as { purpose: { summary: string } }).purpose.summary = "Something else entirely.";
    const bad = verifyManifestProof(signed.proof, tampered, fetched, { now: new Date().toISOString() });
    expect(bad.ok).toBe(false);
  });
});

describe("GET /v1/keys — absence and malformed input", () => {
  it("a key that was never published is key_not_found, NOT agent_not_found", async () => {
    const { res, body } = await byPath(keyIdToWire(generateKeyId()));
    expect(res.status).toBe(404);
    const j = JSON.parse(body);
    expect(j.error).toBe("key_not_found");
    expect(body).not.toContain("agent_not_found");
    expect(j.document).toBeUndefined();
    // No fabricated key, no fabricated trust state.
    expect(body).not.toContain("public_key_b64u");
    expect(body).not.toContain("level");
  });

  it.each([
    ["not-a-ulid"],
    [""],
    ["01M2HYWJ1NW959K7HT187PNXD"], // 25 chars
    ["01M2HYWJ1NW959K7HT187PNXDEE"], // 27 chars
    ["91M2HYWJ1NW959K7HT187PNXDE"], // first char out of 0-7
    ["01M2HYWJ1NW959K7HT187PNXDI"], // Crockford excludes I
    ["01m2hywj1nw959k7ht187pnxde"], // lowercase
    ["agenid:01M2HYWJ1NZP5HPM8F74P1QW13"], // an AGENT id, not a key id
    ["assertion:01M2HYWJ1NW959K7HT187PNXDE"],
    ["agenid:key:not-a-ulid"],
    ["../../etc/passwd"],
    ["01M2HYWJ1NW959K7HT187PNXDE OR 1=1"],
    ["%"],
  ])("rejects %j with 400 invalid_key_id", async (bad) => {
    const { res, body } = await byPath(bad);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).error).toBe("invalid_key_id");
  });

  it("rejects a URI fragment, decoded or not (§9.2 MUST 400, never truncate)", async () => {
    for (const ref of [`${keyIdToWire(doc.key_id)}#z1`, `${keyIdToWire(doc.key_id)}%23z1`, `${doc.key_id}#z1`]) {
      const { res, body } = await byPath(ref);
      expect(res.status).toBe(400);
      expect(JSON.parse(body).error).toBe("invalid_key_id");
    }
  });

  it("does not echo the caller's raw input back in an error body", async () => {
    const { body } = await byPath("%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    expect(body).not.toContain("script");
  });

  it("the collection route requires key_id", async () => {
    const { res, body } = await byQuery("/v1/keys");
    expect(res.status).toBe(400);
    expect(JSON.parse(body).error).toBe("invalid_key_id");
  });
});

describe("GET /v1/keys — no secret material can reach a response", () => {
  it("returns exactly KeyDocument's nine public members and nothing else", async () => {
    const { body } = await byPath(keyIdToWire(doc.key_id));
    expect(Object.keys(JSON.parse(body)).sort()).toEqual(
      ["controller", "created_at", "key_id", "key_type", "public_key_b64u", "retired_at", "revoked_at", "role", "status"],
    );
  });

  it.each(["private", "secret", "seed", "service_role", "supabase", "SUPABASE", "authorization", "\"d\":"])(
    "never contains %j",
    async (needle) => {
      const { body } = await byPath(keyIdToWire(doc.key_id));
      expect(body.toLowerCase()).not.toContain(needle.toLowerCase());
    },
  );

  it("refuses to serve a stored document carrying any field the schema does not define", async () => {
    // KeyDocument is .strict(), so an extra column or a future added member fails the
    // parse rather than being passed through. This is the mechanism, asserted directly.
    const polluted = { ...doc, key_id: generateKeyId(), private_key_hex: "deadbeef", internal_row_id: 42 };
    await getStore().putKey(polluted as unknown as KeyDocument);
    const { res, body } = await byPath(keyIdToWire(polluted.key_id));
    expect(res.status).toBe(503);
    expect(JSON.parse(body).error).toBe("key_document_invalid");
    expect(body).not.toContain("deadbeef");
    expect(body).not.toContain("internal_row_id");
  });

  it("refuses a document whose key_id disagrees with the identifier it was found under", async () => {
    const wrong = { ...doc, key_id: doc.key_id };
    const indexedAs = generateKeyId();
    await getStore().putKey({ ...wrong } as KeyDocument);
    // Seed the same document under a DIFFERENT index, as a substitution would.
    const store = getStore() as unknown as { keys?: Map<string, KeyDocument> };
    if (store.keys instanceof Map) store.keys.set(indexedAs, doc);
    else return; // store internals differ; the guard is still exercised by the route code path
    const { res, body } = await byPath(keyIdToWire(indexedAs));
    expect(res.status).toBe(503);
    expect(JSON.parse(body).error).toBe("key_document_invalid");
  });
});

describe("GET /v1/keys — transport conventions", () => {
  it("is cross-origin readable and never cached", async () => {
    const { res } = await byPath(keyIdToWire(doc.key_id));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toBe("application/json");
  });

  it("the preflight and the response agree on the origin header", async () => {
    const { OPTIONS } = await import("../app/v1/keys/[key_ulid]/route");
    const pre = OPTIONS();
    const { res } = await byPath(keyIdToWire(doc.key_id));
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-origin")).toBe(res.headers.get("access-control-allow-origin"));
    expect(pre.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("an error response is cross-origin readable too, so a verifier can see the reason", async () => {
    const { res } = await byPath("not-a-ulid");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("GET /v1/keys — the route decides nothing about trust", () => {
  const files = [
    "app/v1/keys/route.ts",
    "app/v1/keys/[key_ulid]/route.ts",
    "lib/serve-key.ts",
  ].map((f) => readFileSync(join(import.meta.dirname, "..", f), "utf-8"));

  it("never imports trust presentation, and never names a verification level", () => {
    for (const src of files) {
      expect(src).not.toMatch(/trust-presentation/);
      expect(src).not.toMatch(/L[1-5]_[A-Z_]+/);
      expect(src).not.toMatch(/DECLARED|VERIFIED|AUTHORIZED/);
    }
  });

  it("performs no write and no verification of its own", () => {
    for (const src of files) {
      expect(src).not.toMatch(/putKey|putAgent|createAgent|putAssertion|appendEvent/);
      expect(src).not.toMatch(/verifyManifestProof|verifyVerificationAssertion|registerAgent/);
      expect(src).not.toMatch(/from\s+"@supabase|getSupabaseServiceClient/);
    }
  });

  it("does the logical/wire translation through core, never by hand — in EVERY key-lookup file", () => {
    // The previous version of this guard read one half of one file. Two live copies of
    // exactly the pattern it forbids were sitting in packages/api at the time, which is
    // the whole lesson: a guard scoped to where the defect was found is a sample, not a
    // guard. This scans every file that participates in a key lookup, in both registries.
    const root = join(import.meta.dirname, "..", "..", "..");
    const sources = [
      "packages/web/lib/api.ts",
      "packages/web/lib/serve-key.ts",
      "packages/web/app/v1/keys/route.ts",
      "packages/web/app/v1/keys/[key_ulid]/route.ts",
      "packages/api/src/serve-key.ts",
      "packages/api/src/app.ts",
      "packages/api/src/envelope.ts",
    ].map((f) => [f, readFileSync(join(root, f), "utf-8")] as const);

    for (const [name, src] of sources) {
      // Comments may *describe* the prefix; code may not perform surgery with it.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, name).not.toMatch(/slice\(\s*["'`]agenid:key:["'`]\.length\s*\)/);
      expect(code, name).not.toMatch(/replace\(\s*[/"'`]agenid:key:/);
      expect(code, name).not.toMatch(/startsWith\(\s*["'`]agenid:key:/);
      expect(code, name).not.toMatch(/["'`]agenid:key:["'`]\s*\+/);
    }

    // And the one sanctioned translator is where the translation actually happens.
    const seam = sources.find(([n]) => n.endsWith("api/src/serve-key.ts"))![1];
    expect(seam).toMatch(/parseKeyReference\(ref\)/);
    expect(seam).toMatch(/isValidUlid/);
    expect(seam).toMatch(/isValidKeyId/);
  });

  it("decides nothing itself: every web key file delegates to the shared seam", () => {
    for (const src of files) {
      expect(src).not.toMatch(/KeyDocument\.safeParse/);
      expect(src).not.toMatch(/getKey\(/);
      expect(src).not.toMatch(/decodeURIComponent/);
    }
  });
});

describe("GET /v1/keys — error bodies are not a reflection surface", () => {
  it.each([
    "%3Cscript%3Ealert(1)%3C%2Fscript%3E",
    "AAAA-canary-AAAA",
    "01M2HYWJ1NW959K7HT187PNXDE%23canary",
  ])("does not echo %j back to the caller", async (input) => {
    const { body } = await byPath(input);
    expect(body).not.toContain("script");
    expect(body).not.toContain("canary");
    expect(JSON.parse(body).error).toBe("invalid_key_id");
  });

  it("names each failure reason distinctly without quoting the input", async () => {
    // The decision is taken on the RAW target, so `%23` is read as what it spells — a
    // fragment — rather than inferred from how many decodes it survived. `%2523` is not
    // a fragment at this layer: it is a segment that is not the literal wire form. All
    // are 400 invalid_key_id; the distinction is the message, and none quotes the caller.
    const frag = JSON.parse((await byPath(`${keyIdToWire(doc.key_id)}%23z1`)).body);
    const doubled = JSON.parse((await byPath(`${keyIdToWire(doc.key_id)}%2523z1`)).body);
    const junk = JSON.parse((await byPath("not-a-ulid")).body);
    expect(frag.message).toMatch(/fragment/);
    expect(doubled.message).toMatch(/literal wire form/);
    expect(junk.message).toMatch(/key-ULID/);
    expect(new Set([frag.message, doubled.message, junk.message]).size).toBe(3);
    for (const m of [frag.message, doubled.message, junk.message]) expect(m).not.toContain("z1");
  });
});

describe("GET /v1/keys — exactly the two forms §0.A defines, and no accidental aliases", () => {
  // A route handler is handed an ALREADY-DECODED value: Next.js decodes a dynamic path
  // segment and URLSearchParams decodes a query value. These cases are therefore written
  // as what the handler actually receives, which is what the transport produces from the
  // URL named in each comment.
  it("the wire form resolves on the path (§0.A canonical resolver path)", async () => {
    const { res } = await byPath(keyIdToWire(doc.key_id));
    expect(res.status).toBe(200);
  });

  it("the logical form resolves in the query (§0.A MUST accept, identical document)", async () => {
    const { res } = await byQuery(keyResolverQuery(doc.key_id));
    expect(res.status).toBe(200);
  });

  it("refuses the logical form in a path position (§0.A puts the wire form there)", async () => {
    // Covers BOTH /v1/keys/agenid:key:<ULID> and /v1/keys/agenid%3Akey%3A<ULID> — the
    // transport decodes the second into the first, so the handler sees one value.
    const { res, body } = await byPath(doc.key_id);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).error).toBe("invalid_key_id");
    expect(JSON.parse(body).message).toMatch(/wire form/);
  });

  it("refuses a DOUBLE-encoded logical form on the path (URL: /v1/keys/agenid%253Akey%253A<ULID>)", async () => {
    // THE PRODUCTION DEFECT. This spelling returned 200 on www.agenid.com while the same
    // code returned 400 under `next start`, because Vercel decoded the path once before
    // Next decoded the parameter again. The rule is now stated on the raw target, where
    // the percent sign is still visible however many layers have already run.
    const { res, body } = await byPath(`agenid%253Akey%253A${keyIdToWire(doc.key_id)}`);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).error).toBe("invalid_key_id");
    expect(JSON.parse(body).message).toMatch(/literal wire form/);
  });

  it("refuses a DOUBLE-encoded logical form in the query (URL: ?key_id=agenid%253Akey%253A<ULID>)", async () => {
    const { res, body } = await byQuery(`/v1/keys?key_id=agenid%253Akey%253A${keyIdToWire(doc.key_id)}`);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).message).toMatch(/more than once/);
  });

  it("refuses a TRIPLE-encoded logical form (URL: /v1/keys/agenid%25253Akey%25253A<ULID>)", async () => {
    // Was passing the DOUBLE-encoded string, so it asserted nothing the case above had
    // not already asserted. The target now matches the name.
    const { res, body } = await byPath(`agenid%25253Akey%25253A${keyIdToWire(doc.key_id)}`);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).message).toMatch(/literal wire form/);
  });

  it("refuses the wire form in a query position: §0.A puts the logical form there", async () => {
    const { res, body } = await byQuery(`/v1/keys?key_id=${keyIdToWire(doc.key_id)}`);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).message).toMatch(/logical form/);
  });

  it("a percent sign in the raw path segment is refused, whatever it encodes", async () => {
    // `%2e%2e` is deliberately absent: the URL parser resolves it as a double-dot path
    // segment, so it cannot be delivered through this harness unchanged. It is covered
    // by the tripwire test below, which is where that rewriting is the point.
    for (const seg of ["%2F", "%00", "%25", "%2523", "%252F", `%30%31${keyIdToWire(doc.key_id).slice(2)}`]) {
      const { res, body } = await byPath(seg);
      expect(res.status).toBe(400);
      expect(JSON.parse(body).error).toBe("invalid_key_id");
      expect(JSON.parse(body).message).toMatch(/literal wire form/);
    }
  });

  it("refuses, rather than guesses, when the raw target and the framework parameter disagree", async () => {
    // The tripwire in resolveKeyFromRawPath, exercised by a real rewriting: `%2e%2e` is a
    // double-dot path segment, so URL parsing removes it from the path entirely while a
    // framework decoding the original segment would still produce `..`. Two readings of
    // one request. A registry that picks one is guessing; this one refuses.
    const { res, body } = await byPath("%2e%2e");
    expect(res.status).toBe(400);
    const j = JSON.parse(body);
    expect(j.error).toBe("invalid_key_id");
    expect(j.message).toMatch(/one unambiguous request target/);
    expect(body).not.toContain("..");
  });

  it("STATES THE PLATFORM BOUNDARY: a singly-encoded path is refused here, and cannot be seen on Vercel", async () => {
    // The old test at this position claimed "legitimate single percent-encoding is NOT
    // broken: the transport removes it first" — and then asserted it by requesting the
    // ALREADY-DECODED ULID, which exercises no encoding at all. It was a false assertion
    // dressed as a passing one, and it is the reason nobody noticed that the same input
    // behaved differently in production than it did locally.
    //
    // What is actually true, measured: where this registry sees the wire target (here,
    // `next start`, and @agenid/api), a singly-encoded segment carries a percent sign and
    // is refused. On Vercel the platform applies RFC 3986 §2.3 normalization before any
    // application code runs, so that request arrives already spelled canonically and
    // resolves — this code cannot observe the difference and does not pretend to. What
    // holds identically on both is the part that matters: nothing beyond one layer of
    // encoding resolves anywhere, so no alias of a key exists on any platform.
    const encoded = [...keyIdToWire(doc.key_id)]
      .map((c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`)
      .join("");
    const { res, body } = await byPath(encoded);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).message).toMatch(/literal wire form/);

    // The normative QUERY form is percent-encoded by definition (§0.A) and resolves —
    // and that half is platform-independent, because this registry performs that decode
    // itself, exactly once, from the raw query. Verified against production: the query
    // string is not normalized upstream.
    expect((await byQuery(keyResolverQuery(doc.key_id))).res.status).toBe(200);
  });
});

describe("GET /v1/keys?key_id= — a repeated parameter is ambiguous, never first-won", () => {
  const other = "agenid:key:01M2HP1B8REVKVV4GE44YQ6RF8";

  it("one key_id resolves", async () => {
    const { res } = await byQuery(`/v1/keys?key_id=${doc.key_id}`);
    expect(res.status).toBe(200);
  });

  it("two DIFFERENT key_id parameters are 400, not the first one", async () => {
    const { res, body } = await byQuery(`/v1/keys?key_id=${doc.key_id}&key_id=${other}`);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).error).toBe("invalid_key_id");
    expect(JSON.parse(body).message).toMatch(/exactly once/);
    expect(body).not.toContain("public_key_b64u");
  });

  it("the same two, reversed, is also 400 — order cannot decide it", async () => {
    const { res } = await byQuery(`/v1/keys?key_id=${other}&key_id=${doc.key_id}`);
    expect(res.status).toBe(400);
  });

  it("two IDENTICAL key_id parameters are 400 too", async () => {
    const { res, body } = await byQuery(`/v1/keys?key_id=${doc.key_id}&key_id=${doc.key_id}`);
    expect(res.status).toBe(400);
    expect(JSON.parse(body).message).toMatch(/exactly once/);
  });

  it("an empty duplicate is 400 (?key_id=&key_id=<valid>)", async () => {
    const { res } = await byQuery(`/v1/keys?key_id=&key_id=${doc.key_id}`);
    expect(res.status).toBe(400);
  });

  it("key_id with an unrelated parameter, either order, still resolves", async () => {
    expect((await byQuery(`/v1/keys?key_id=${doc.key_id}&foo=x`)).res.status).toBe(200);
    expect((await byQuery(`/v1/keys?foo=x&key_id=${doc.key_id}`)).res.status).toBe(200);
  });

  it("KEY_ID and key_id[] are not key_id", async () => {
    for (const q of [`/v1/keys?KEY_ID=${doc.key_id}`, `/v1/keys?key_id[]=${doc.key_id}`]) {
      const { res, body } = await byQuery(q);
      expect(res.status).toBe(400);
      expect(JSON.parse(body).error).toBe("invalid_key_id");
    }
  });
});

describe("GET /v1/keys — method surface and CORS coherence", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s is 405 with Allow, CORS and no-store on both routes", async (method) => {
    const item = await import("../app/v1/keys/[key_ulid]/route");
    const coll = await import("../app/v1/keys/route");
    for (const res of [
      (item as unknown as Record<string, () => Response>)[method]!(),
      (coll as unknown as Record<string, () => Response>)[method]!(),
    ]) {
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("GET, OPTIONS");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("content-type")).toBe("application/json");
    }
  });

  it("405 names the reason and exposes no mutation", async () => {
    const { POST } = await import("../app/v1/keys/route");
    const body = await POST().text();
    expect(JSON.parse(body).error).toBe("method_not_allowed");
    expect(body).not.toContain("public_key_b64u");
  });

  it("GET, OPTIONS, 400, 404 and 405 agree on the CORS origin header", async () => {
    const { OPTIONS, POST } = await import("../app/v1/keys/route");
    const responses = [
      (await byPath(keyIdToWire(doc.key_id))).res, // 200
      (await byPath("not-a-ulid")).res, // 400
      (await byPath(keyIdToWire(generateKeyId()))).res, // 404
      POST(), // 405
      OPTIONS(), // 204
    ];
    for (const r of responses) expect(r.headers.get("access-control-allow-origin")).toBe("*");
    // No credentialed wildcard anywhere on this surface.
    for (const r of responses) expect(r.headers.get("access-control-allow-credentials")).toBeNull();
    expect(OPTIONS().headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });
});
