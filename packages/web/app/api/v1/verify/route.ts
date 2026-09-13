/**
 * POST /api/v1/verify — stateless Ed25519 (RFC 8032) signature verification over an
 * RFC 8785 JCS canonicalized payload. No registry lookup, no storage: this route is a
 * pure function of its request body, safe to call from an AI agent, a CI job, or a
 * Custom GPT Action without any AgenID account or trust in the registry's database.
 * Mirrors the same primitive `@agenid/mcp-server`'s `verify_agent_manifest` tool uses.
 */
import { canonicalizeToBytes, verifyBytes, fromHex, b64uDecode, sha256, hex } from "@agenid/core";

export const dynamic = "force-dynamic";

const CORS_HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*" };

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function decodeSignature(signature: string): Uint8Array {
  if (/^[0-9a-fA-F]{128}$/.test(signature)) return fromHex(signature);
  return b64uDecode(signature);
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400);
  }

  if (typeof body !== "object" || body === null) return json({ error: "invalid_body", message: "expected a JSON object" }, 400);
  const { manifest, signature, public_key_hex } = body as Record<string, unknown>;

  if (typeof manifest !== "object" || manifest === null) return json({ error: "invalid_manifest", message: "`manifest` must be a JSON object" }, 400);
  if (typeof signature !== "string" || signature.length === 0) return json({ error: "invalid_signature", message: "`signature` must be a base64url or hex-encoded Ed25519 signature" }, 400);
  if (typeof public_key_hex !== "string" || !/^[0-9a-fA-F]{64}$/.test(public_key_hex)) {
    return json({ error: "invalid_public_key", message: "`public_key_hex` must be a 64-character hex-encoded Ed25519 public key" }, 400);
  }

  try {
    const canonicalBytes = canonicalizeToBytes(manifest);
    const sigBytes = decodeSignature(signature);
    const pubKeyBytes = fromHex(public_key_hex);
    const valid = verifyBytes(pubKeyBytes, canonicalBytes, sigBytes);
    return json(
      {
        ok: valid,
        valid,
        algorithm: "Ed25519",
        canonicalization: "RFC 8785 JCS",
        canonical_sha256_hex: hex(sha256(canonicalBytes)),
      },
      200,
    );
  } catch (e) {
    return json({ ok: false, valid: false, error: "verification_failed", message: e instanceof Error ? e.message : String(e) }, 400);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" } });
}
