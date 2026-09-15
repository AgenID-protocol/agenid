/**
 * Registration clock policy (src/registration-time.ts).
 *
 * The first test is a regression guard, not a hypothetical: the registry used to truncate
 * its own clock to whole seconds, which moved it backward by up to 999ms and made every
 * same-second registration fail `not_yet_valid` against its own fresh proof.
 */
import { describe, it, expect } from "vitest";
import { registrationTime, MAX_FORWARD_SKEW_MS } from "../src/registration-time.js";

const at = (iso: string) => new Date(iso);

describe("registrationTime", () => {
  it("does not reject a proof signed milliseconds ahead of the registry", () => {
    const server = at("2026-09-15T04:43:37.000Z");
    const r = registrationTime("2026-09-15T04:43:37.488Z", server);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Evaluated at the proof's own instant, so `now < created_at` cannot trigger.
    expect(Date.parse(r.now)).toBeGreaterThanOrEqual(Date.parse("2026-09-15T04:43:37.488Z"));
  });

  it("evaluates at the server clock when the client is behind (the normal case)", () => {
    const server = at("2026-09-15T04:43:40.000Z");
    const r = registrationTime("2026-09-15T04:43:37.111Z", server);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.now).toBe("2026-09-15T04:43:40.000Z");
  });

  it("registered_at is always the server's clock, never the client's", () => {
    const server = at("2026-09-15T04:43:37.000Z");
    const r = registrationTime("2026-09-15T04:44:30.000Z", server); // client 53s ahead

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.registeredAt).toBe("2026-09-15T04:43:37.000Z");
  });

  it("accepts right up to the skew limit", () => {
    const server = at("2026-09-15T04:43:37.000Z");
    const r = registrationTime(new Date(server.getTime() + MAX_FORWARD_SKEW_MS).toISOString(), server);
    expect(r.ok).toBe(true);
  });

  it("refuses just past the limit, and names the cause", () => {
    const server = at("2026-09-15T04:43:37.000Z");
    const r = registrationTime(new Date(server.getTime() + MAX_FORWARD_SKEW_MS + 1000).toISOString(), server);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("clock_skew_too_large");
    expect(r.message).toMatch(/system time/i);
  });

  it("emits full-precision UTC, never a truncated or offset form", () => {
    const r = registrationTime("2026-09-15T04:43:37.111Z", at("2026-09-15T04:43:40.488Z"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.registeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("stays total on a malformed timestamp (schema validation is what rejects those)", () => {
    const r = registrationTime("not-a-timestamp", at("2026-09-15T04:43:37.000Z"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.now).toBe("2026-09-15T04:43:37.000Z");
  });

  it("the skew window is small enough to be meaningless against a 90-day proof", () => {
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    expect(MAX_FORWARD_SKEW_MS / ninetyDays).toBeLessThan(0.0001);
  });
});
