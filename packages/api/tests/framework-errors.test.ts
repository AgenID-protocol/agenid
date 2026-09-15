/**
 * R-2 — the Fastify application boundary must not reflect caller-controlled input.
 *
 * `serve-key.ts` keeps the caller's own reference out of its 400s, but it can only do
 * that for requests that REACH it. Fastify raises `FST_ERR_BAD_URL` while find-my-way is
 * still parsing the target, before routing, and its default body is
 *
 *     {"statusCode":400,"code":"FST_ERR_BAD_URL","error":"Bad Request",
 *      "message":"Invalid URL: /v1/keys/<script>CANARY…%ZZ"}
 *
 * — the complete request target, echoed to an unauthenticated stranger, from a surface
 * whose own error text was carefully written not to do that. An adversarial audit found
 * it by aiming a canary at a route that never ran.
 *
 * These tests drive REAL requests through the REAL HTTP parser (`inject` feeds the same
 * parser a socket would), because the finding concerns behaviour before the handler and
 * a direct handler call cannot reach it.
 */
import { describe, it, expect } from "vitest";
import { buildApp, KEY_ERROR_MESSAGES } from "../src/index.js";

const CANARY = "CANARY_SCRIPT_918273";
const app = buildApp({});

/** Targets chosen so the parser, not the handler, is what refuses them. */
const HOSTILE = [
  `<script>${CANARY}%ZZ`,
  `${CANARY}%ZZ`,
  "%",
  "%2",
  "%ZZ",
  `<script>alert(${CANARY})</script>`,
  `' OR '1'='1 ${CANARY}`,
  `..%2F..%2Fetc%2Fpasswd${CANARY}`,
  `%00${CANARY}`,
];

describe("no framework error reflects the caller's request target", () => {
  it.each(HOSTILE)("GET /v1/keys/%s", async (segment) => {
    const r = await app.inject({ method: "GET", url: `/v1/keys/${segment}` });
    expect(r.statusCode).toBe(400);
    expect(r.body).not.toContain(CANARY);
    expect(r.body).not.toContain("script");
    expect(r.body).not.toContain("OR '1'='1");
    expect(r.body).not.toContain("passwd");
    // No framework internals, no stack, no reflected target.
    expect(r.body).not.toContain("FST_ERR");
    expect(r.body).not.toContain("Invalid URL");
    expect(r.body).not.toContain("at ");
    const j = JSON.parse(r.body);
    expect(j.error).toBe("invalid_key_id");
    expect(Object.keys(j).sort()).toEqual(["error", "message"]);
    // The reason is one of key discovery's own fixed sentences, not improvised text.
    expect(Object.values(KEY_ERROR_MESSAGES)).toContain(j.message);
  });

  // The same class of request aimed at a DIFFERENT route: the fix must be at the
  // boundary, not a special case bolted onto key discovery.
  it.each(HOSTILE)("GET /v1/agents/%s carries nothing back either", async (segment) => {
    const r = await app.inject({ method: "GET", url: `/v1/agents/${segment}` });
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    expect(r.body).not.toContain(CANARY);
    expect(r.body).not.toContain("FST_ERR");
    expect(r.body).not.toContain("Invalid URL");
  });

  it("a legitimate application error is untouched by the boundary handler", async () => {
    // Guard against the global handler swallowing real errors into generic text: this
    // 400 is produced by the route, names the schema failure, and must survive intact.
    const r = await app.inject({ method: "POST", url: "/v1/agents", payload: {} });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe("schema_validation_failed");
  });

  it("an unknown route is still a plain 404, not a key-discovery error", async () => {
    const r = await app.inject({ method: "GET", url: "/v1/nothing-here" });
    expect(r.statusCode).toBe(404);
    expect(r.json().error).toBe("not_found");
  });
});
