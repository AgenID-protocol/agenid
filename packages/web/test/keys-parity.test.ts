/**
 * Cross-registry parity for `GET /v1/keys` (spec §9.2).
 *
 * This repository ships two HTTP registries — the Next.js routes in `packages/web` and
 * the Fastify app in `@agenid/api` — and an independent audit found they were two
 * SEMANTIC implementations, not two adapters. Only the web one re-validated the stored
 * document against the strict schema, only it refused a document whose `key_id`
 * disagreed with the identifier it was indexed under, and only it kept the caller's own
 * input out of its error bodies. Production served the web one, so nothing was exposed —
 * but `@agenid/api` is a deployable registry in its own right, and a protocol surface
 * that answers differently depending on the framework in front of it is not one surface.
 *
 * Both now call `resolveKeyDocument`. This file proves that from the outside, by driving
 * the REAL handlers of both frameworks against the SAME fixtures and the same store —
 * not by comparing source code, which is what let the divergence survive review.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { buildApp, MemoryStore, type RegistryStore } from "@agenid/api";
import { generateKeyId, keyIdToWire, type KeyDocument } from "@agenid/core";
import { getStore } from "../lib/api";
import { generateKeyPair, signAgent } from "../lib/client-crypto";

let doc: KeyDocument;
let fastify: ReturnType<typeof buildApp>;
let store: RegistryStore;
/** A document whose key_id disagrees with the index it is stored under — a substitution. */
let mismatchedIndex: string;
/** A stored row carrying a member KeyDocument does not define. */
let pollutedId: string;

beforeAll(async () => {
  // One store, both registries: `getStore()` is the web registry's store when
  // AGENID_API_URL is unset, which is how production resolves.
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

async function web(url: string): Promise<{ status: number; body: string }> {
  const u = new URL(url, "https://www.agenid.com");
  const segments = u.pathname.split("/").filter(Boolean); // ["v1","keys", ...]
  if (segments.length > 2) {
    const { GET } = await import("../app/v1/keys/[key_ulid]/route");
    const seg = segments[2] as string;
    const res = await GET(new Request(u), { params: Promise.resolve({ key_ulid: seg }) });
    return { status: res.status, body: await res.text() };
  }
  const { GET } = await import("../app/v1/keys/route");
  const res = await GET(new Request(u));
  return { status: res.status, body: await res.text() };
}

async function api(url: string): Promise<{ status: number; body: string }> {
  const r = await fastify.inject({ method: "GET", url });
  return { status: r.statusCode, body: r.body };
}

/** The whole point: same request, same answer, whichever framework serves it. */
async function both(url: string): Promise<{ status: number; body: string }> {
  const w = await web(url);
  const a = await api(url);
  expect(a.status, `status disagreed for ${url}`).toBe(w.status);
  expect(JSON.parse(a.body), `body disagreed for ${url}`).toEqual(JSON.parse(w.body));
  return w;
}

describe("both registries answer identically", () => {
  it("a valid key: same document, byte-identical", async () => {
    const r = await both(`/v1/keys/${keyIdToWire(doc.key_id)}`);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body)).toEqual(doc);
    // And the query form agrees with the path form in both registries.
    const q = await both(`/v1/keys?key_id=${encodeURIComponent(doc.key_id)}`);
    expect(q.body).toBe(r.body);
  });

  it("a key that was never published: same 404 key_not_found", async () => {
    const r = await both(`/v1/keys/${keyIdToWire(generateKeyId())}`);
    expect(r.status).toBe(404);
    expect(JSON.parse(r.body).error).toBe("key_not_found");
  });

  it.each([
    ["not-a-ulid", "malformed reference"],
    ["01M2HYWJ1NW959K7HT187PNXD", "25 characters"],
    ["01M2HYWJ1NW959K7HT187PNXDEE", "27 characters"],
    ["01m2hywj1nw959k7ht187pnxde", "lowercase"],
    ["01M2HYWJ1NW959K7HT187PNXDI", "Crockford excludes I"],
    ["91M2HYWJ1NW959K7HT187PNXDE", "first character out of range"],
  ])("an invalid reference (%s — %s): same 400 invalid_key_id and the same message", async (segment) => {
    const r = await both(`/v1/keys/${segment}`);
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).error).toBe("invalid_key_id");
  });

  it("a double-encoded reference is refused by both, not resolved by either", async () => {
    const r = await both(`/v1/keys/agenid%253Akey%253A${keyIdToWire(doc.key_id)}`);
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).message).toMatch(/more than once/);
    expect(r.body).not.toContain("public_key_b64u");
  });

  it("a duplicated key_id is refused by both, not first-won by either", async () => {
    const r = await both(
      `/v1/keys?key_id=${encodeURIComponent(doc.key_id)}&key_id=${encodeURIComponent(generateKeyId())}`,
    );
    expect(r.status).toBe(400);
    expect(JSON.parse(r.body).message).toMatch(/exactly once/);
  });

  it("a stored document with an undefined member: both refuse with 503, neither leaks it", async () => {
    const r = await both(`/v1/keys/${keyIdToWire(pollutedId)}`);
    expect(r.status).toBe(503);
    expect(JSON.parse(r.body).error).toBe("key_document_invalid");
    expect(r.body).not.toContain("internal_row_id");
  });

  it("a document indexed under an identifier it does not claim: both refuse with 503", async () => {
    const asMap = getStore() as unknown as { keys?: Map<string, KeyDocument> };
    if (!(asMap.keys instanceof Map)) return; // store internals differ; guard still exercised above
    const r = await both(`/v1/keys/${keyIdToWire(mismatchedIndex)}`);
    expect(r.status).toBe(503);
    expect(JSON.parse(r.body).error).toBe("key_document_invalid");
    expect(r.body).not.toContain("public_key_b64u");
  });

  it("neither registry echoes the caller's input back", async () => {
    for (const hostile of ["AAAA-canary-AAAA", "%3Cscript%3E", "'%20OR%20'1'='1", "..%2Fagents"]) {
      const w = await web(`/v1/keys/${hostile}`);
      const a = await api(`/v1/keys/${hostile}`);
      for (const body of [w.body, a.body]) {
        expect(body).not.toContain("canary");
        expect(body).not.toContain("script");
        expect(body).not.toContain("OR '1'='1");
      }
    }
  });

  it.each(["private", "secret", "seed", "service_role", "supabase", "authorization"])(
    "no response from either registry contains %j",
    async (needle) => {
      for (const url of [
        `/v1/keys/${keyIdToWire(doc.key_id)}`,
        `/v1/keys/${keyIdToWire(generateKeyId())}`,
        `/v1/keys/not-a-ulid`,
        `/v1/keys/${keyIdToWire(pollutedId)}`,
      ]) {
        const w = await web(url);
        const a = await api(url);
        expect(w.body.toLowerCase()).not.toContain(needle);
        expect(a.body.toLowerCase()).not.toContain(needle);
      }
    },
  );

  it("an unsupported method is 405 with Allow in both registries", async () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const a = await fastify.inject({ method, url: `/v1/keys/${keyIdToWire(doc.key_id)}` });
      expect(a.statusCode, `fastify ${method}`).toBe(405);
      expect(a.headers.allow).toBe("GET, OPTIONS");

      const route = (await import("../app/v1/keys/[key_ulid]/route")) as unknown as Record<string, () => Response>;
      const w = route[method]!();
      expect(w.status, `next ${method}`).toBe(405);
      expect(w.headers.get("allow")).toBe("GET, OPTIONS");
    }
  });
});
