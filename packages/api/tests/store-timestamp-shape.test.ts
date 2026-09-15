/**
 * Store boundary equivalence: every timestamp a store hands back must have the same
 * SHAPE regardless of which store is behind the registry.
 *
 * This exists because `RegistryStore` having one TypeScript interface does not make two
 * implementations behave identically. Postgres renders a `timestamptz` as
 * `2026-09-15T04:43:37.488+00:00`; `MemoryStore` round-trips the `Z` form it was given.
 * Both parse to the same instant, but `Rfc3339Utc` — the protocol's own format — accepts
 * only the `Z` form, so the `+00:00` shape is not a valid protocol timestamp.
 *
 * It was found in production, not here: a real registration returned `...488Z` from the
 * POST response and `...488+00:00` from the resolution envelope for the same field. That
 * is the signature of a divergence no unit test was looking for, so this file tests the
 * boundary rather than either implementation.
 *
 * SupabaseStore is exercised against a fake PostgREST client that mimics the one behavior
 * that matters here — returning timestamptz columns in Postgres's offset rendering. A real
 * database is not needed to prove the normalization happens, and requiring one would mean
 * this never runs in CI.
 */
import { describe, it, expect } from "vitest";
import { MemoryStore } from "../src/store.js";
import { SupabaseStore } from "../src/supabase-store.js";
import type { AgentRecord, LedgerEvent } from "../src/store.js";

/** The protocol's own format: UTC with a literal `Z`, optional fractional seconds. */
const RFC3339_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

/** How Postgres renders the same instants over PostgREST. */
const PG = (iso: string) => iso.replace(/Z$/, "+00:00");

const REGISTERED_AT = "2026-09-15T04:43:37.488Z";
const OCCURRED_AT = "2026-09-15T04:43:37.500Z";

const AGENT_ID = "agenid:01M2HP1B8RDVKX4QEN7H20CWCK";

const RECORD = {
  agent_id: AGENT_ID,
  manifest: { agent_id: AGENT_ID },
  manifest_digest: "b3798edc99e051251f4a4101df6f71b7b7246442049cf14ec9806b8e2a49fcfe",
  proof: { agent_id: AGENT_ID },
  status: "ACTIVE",
  registered_at: REGISTERED_AT,
  updated_at: REGISTERED_AT,
} as unknown as AgentRecord;

const EVENT: LedgerEvent = {
  event_id: "evt_01M2HP1B8RDVKX4QEN7H20CWCM",
  agent_id: AGENT_ID,
  type: "agent.registered",
  occurred_at: OCCURRED_AT,
  detail_ref: { manifest_digest: RECORD.manifest_digest },
};

/**
 * Minimal PostgREST stand-in. Only models what this test is about: rows come back with
 * timestamptz columns in `+00:00` form. Every chained builder method returns `this`, and
 * awaiting the builder resolves to `{ data, error }`, matching supabase-js's shape.
 */
function fakeClient(rows: Record<string, unknown[]>) {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      order: () => b,
      maybeSingle: async () => ({ data: (rows[table] ?? [])[0] ?? null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: rows[table] ?? [], error: null }),
    };
    return b;
  };
  return { from: (table: string) => builder(table) } as never;
}

function supabaseStoreReturning(rows: Record<string, unknown[]>): SupabaseStore {
  const store = new SupabaseStore({ url: "https://example.supabase.co", serviceRoleKey: "test" });
  // Replace the real client; the constructor has already validated the URL.
  (store as unknown as { client: unknown }).client = fakeClient(rows);
  return store;
}

describe("store boundary: timestamp shape is identical across implementations", () => {
  it("MemoryStore returns RFC 3339 UTC for agent timestamps", async () => {
    const mem = new MemoryStore();
    await mem.createAgent(RECORD);

    const got = await mem.getAgent(AGENT_ID);
    expect(got?.registered_at).toMatch(RFC3339_UTC);
    expect(got?.updated_at).toMatch(RFC3339_UTC);
  });

  it("SupabaseStore normalizes Postgres offset rendering on agent timestamps", async () => {
    const store = supabaseStoreReturning({
      agents: [{ ...RECORD, registered_at: PG(REGISTERED_AT), updated_at: PG(REGISTERED_AT) }],
    });

    const got = await store.getAgent(AGENT_ID);
    expect(got?.registered_at).toMatch(RFC3339_UTC);
    expect(got?.updated_at).toMatch(RFC3339_UTC);
    // Normalization must change spelling only, never the instant.
    expect(Date.parse(got!.registered_at)).toBe(Date.parse(REGISTERED_AT));
  });

  it("both stores agree on the agent timestamps they return", async () => {
    const mem = new MemoryStore();
    await mem.createAgent(RECORD);
    const supa = supabaseStoreReturning({
      agents: [{ ...RECORD, registered_at: PG(REGISTERED_AT), updated_at: PG(REGISTERED_AT) }],
    });

    expect((await supa.getAgent(AGENT_ID))?.registered_at).toBe((await mem.getAgent(AGENT_ID))?.registered_at);
  });

  it("SupabaseStore normalizes the event ledger's occurred_at (the occurrence found by the §13 sweep)", async () => {
    const store = supabaseStoreReturning({ events: [{ ...EVENT, occurred_at: PG(OCCURRED_AT) }] });

    const [got] = await store.listEvents(AGENT_ID);
    expect(got.occurred_at).toMatch(RFC3339_UTC);
    expect(Date.parse(got.occurred_at)).toBe(Date.parse(OCCURRED_AT));
  });

  it("both stores agree on the event timestamps they return", async () => {
    const mem = new MemoryStore();
    await mem.appendEvent(EVENT);
    const supa = supabaseStoreReturning({ events: [{ ...EVENT, occurred_at: PG(OCCURRED_AT) }] });

    const [m] = await mem.listEvents(AGENT_ID);
    const [s] = await supa.listEvents(AGENT_ID);
    expect(s.occurred_at).toBe(m.occurred_at);
  });

  it("listEvents returns exactly the LedgerEvent members, so a new column cannot leak into one", async () => {
    const store = supabaseStoreReturning({
      events: [{ ...EVENT, occurred_at: PG(OCCURRED_AT) }],
    });

    const [got] = await store.listEvents(AGENT_ID);
    expect(Object.keys(got).sort()).toEqual(["agent_id", "detail_ref", "event_id", "occurred_at", "type"]);
  });

  it("key and assertion reads are immune: they return the stored jsonb document verbatim", async () => {
    // Both tables store the protocol object as jsonb, which round-trips byte-for-byte.
    // assertions.verified_at is a timestamptz column, but it exists only to ORDER BY and
    // is never part of what these methods return — asserted here so a future refactor
    // that starts returning the row instead of the document breaks this test.
    const keyDoc = { key_id: "agenid:key:01M2HP1B8REVKVV4GE44YQ6RF8", created_at: REGISTERED_AT };
    const assertionDoc = { assertion_id: "assertion:01M2HP1B8REVKVV4GE44YQ6RF9", verified_at: REGISTERED_AT };

    const store = supabaseStoreReturning({
      keys: [{ document: keyDoc }],
      assertions: [{ document: assertionDoc, verified_at: PG(REGISTERED_AT) }],
    });

    expect((await store.getKey(keyDoc.key_id))?.created_at).toMatch(RFC3339_UTC);
    const [a] = await store.listAssertionsForSubject(AGENT_ID);
    expect(a.verified_at).toMatch(RFC3339_UTC);
    expect(a).not.toHaveProperty("document");
  });
});
