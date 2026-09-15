/**
 * Regression: constructing a SupabaseStore must not require a global WebSocket.
 *
 * AgenID never uses Supabase Realtime — the registry is request/response only.
 * But `createClient` builds a RealtimeClient eagerly, and that probes for a
 * global `WebSocket`, which does not exist before Node 22. The result was that
 * merely *building* a store threw on Node 20 — a runtime this package's
 * `engines` field claims to support — which turned one third of the CI matrix
 * red while the other two legs stayed green and hid it.
 *
 * This asserts the property directly rather than relying on the matrix to
 * notice: it removes the global and constructs the store anyway.
 */
import { describe, it, expect, afterEach } from "vitest";
import { SupabaseStore } from "../src/supabase-store.js";

const g = globalThis as { WebSocket?: unknown };
const REAL_WEBSOCKET = g.WebSocket;

afterEach(() => {
  if (REAL_WEBSOCKET === undefined) delete g.WebSocket;
  else g.WebSocket = REAL_WEBSOCKET;
});

describe("SupabaseStore runtime requirements", () => {
  it("constructs on a runtime with no global WebSocket (Node 20)", () => {
    delete g.WebSocket;
    expect(() => new SupabaseStore({ url: "https://example.supabase.co", serviceRoleKey: "test" })).not.toThrow();
  });

  it("still constructs when a global WebSocket is present (Node 22+)", () => {
    expect(() => new SupabaseStore({ url: "https://example.supabase.co", serviceRoleKey: "test" })).not.toThrow();
  });
});
