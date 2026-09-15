import { serveKeyReference, keyPreflight } from "@/lib/serve-key";

export const dynamic = "force-dynamic";

/** Spec §9.2 — `GET /v1/keys/{key-ULID}`, the canonical resolver path and the target of
 *  every resolution envelope's `operator_key.discovery.registry_path`. The segment is the
 *  WIRE form (a bare ULID); `parseKeyReference` translates it to the logical
 *  `agenid:key:<ULID>` the store is keyed on, and rejects anything else — including a
 *  URI fragment, which Next hands us already decoded from `%23`. */
export async function GET(_req: Request, ctx: { params: Promise<{ key_ulid: string }> }) {
  const { key_ulid } = await ctx.params;
  return serveKeyReference(key_ulid);
}

export function OPTIONS() {
  return keyPreflight();
}
