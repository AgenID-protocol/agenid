import { serveKeyReference, keyPreflight } from "@/lib/serve-key";

export const dynamic = "force-dynamic";

/** Spec §9.2 — `GET /v1/keys?key_id={percent-encoded logical id}`. Resolves identically
 *  to the path form; both delegate to the same builder. */
export async function GET(req: Request) {
  return serveKeyReference(new URL(req.url).searchParams.get("key_id"));
}

export function OPTIONS() {
  return keyPreflight();
}
