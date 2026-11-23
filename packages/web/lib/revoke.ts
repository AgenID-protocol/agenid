/**
 * Agent revocation for the deployed registry. The rules live in `@agenid/api`'s
 * `revoke.ts` — the single implementation, shared with the Fastify registry — and this
 * wrapper only supplies the deployment's store. A route's job is to shape the request
 * and the response, never to decide what a revocation means.
 */
import { revokeAgentRequest, type RevokeResult, type RegistryStore } from "@agenid/api";
import { getStore } from "@/lib/api";

export { REVOCATION_DISCLOSURES, REVOCATION_WINDOW_MS, revocationDigestHex, type RevokeResult } from "@agenid/api";

export function revokeAgent(
  body: unknown,
  opts: { now?: Date; store?: RegistryStore; agentIdFromPath?: string } = {},
): Promise<RevokeResult> {
  return revokeAgentRequest(body, opts.store ?? getStore(), { now: opts.now, agentIdFromPath: opts.agentIdFromPath });
}
