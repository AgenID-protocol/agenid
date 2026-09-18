/**
 * POST /api/retell/declare — verify an operator-signed ManifestProof for a Retell agent.
 *
 * WHAT THIS DOES: re-verifies a ManifestProof the caller signed on their own machine,
 * and reports the protocol outcome. Nothing else.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO, and why:
 *  - It never generates or receives a private key. The operator signs locally; this
 *    route only ever sees public material. A registry that can sign on your behalf is
 *    a registry whose assertions mean nothing.
 *  - It never returns VERIFIED, ORGANIZATION_VERIFIED, or any level above DECLARED.
 *    Under the spec, levels above DECLARED require an authority-signed
 *    VerificationAssertion, and AgenID's root authority key ceremony has not been
 *    performed. There is currently no key on earth entitled to issue one.
 *  - It does not persist. No durable write path is deployed yet (queue item #6);
 *    claiming registration without storage would be a lie by omission.
 *
 * The replaced stub returned `status: 'ORGANIZATION_VERIFIED'` unconditionally for any
 * domain posted to it, with no signature check of any kind.
 */
import { ManifestProof, Manifest, KeyDocument, verifyManifestProof, manifestDigestHex } from "@agenid/core";
import { POLICIES, checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = { "content-type": "application/json", "access-control-allow-origin": "*" };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export async function POST(req: Request) {
  /**
   * Re-verifies an operator-signed ManifestProof: real Ed25519 and canonicalization work\n   * performed on request, unauthenticated.
   */
  const rl = await checkRateLimit(req, POLICIES.register);
  if (!rl.allowed) return tooManyRequests(rl);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", message: "request body must be JSON" }, 400);
  }
  const { manifest, proof, key_document: keyDocument, now } = (body ?? {}) as Record<string, unknown>;

  const parsedManifest = Manifest.safeParse(manifest);
  if (!parsedManifest.success) {
    return json({ error: "invalid_manifest", issues: parsedManifest.error.issues }, 400);
  }
  const parsedProof = ManifestProof.safeParse(proof);
  if (!parsedProof.success) {
    return json({ error: "invalid_proof", issues: parsedProof.error.issues }, 400);
  }
  const parsedKey = KeyDocument.safeParse(keyDocument);
  if (!parsedKey.success) {
    return json({ error: "invalid_key_document", issues: parsedKey.error.issues }, 400);
  }

  // The protocol never reads a hidden clock; `now` is explicit and caller-supplied.
  const evaluatedAt = typeof now === "string" ? now : new Date().toISOString();

  const result = verifyManifestProof(parsedProof.data, parsedManifest.data, parsedKey.data, { now: evaluatedAt });

  if (!result.ok) {
    return json(
      {
        ok: false,
        level: null,
        code: result.code,
        message: result.message ?? "manifest proof did not verify",
        evaluated_at: evaluatedAt,
      },
      422,
    );
  }

  return json(
    {
      ok: true,
      level: "DECLARED",
      agent_id: parsedManifest.data.agent_id,
      manifest_digest: { alg: "sha-256", value: manifestDigestHex(parsedManifest.data) },
      key_id: parsedProof.data.key_id,
      evaluated_at: evaluatedAt,
      persisted: false,
      disclosures: [
        "DECLARED is an operator self-declaration. It attests who signed, not that any third party checked them.",
        "Levels above DECLARED require an authority-signed VerificationAssertion. AgenID's root authority key ceremony has not been performed, so no such assertion can currently be issued.",
        "This result was not written to any registry: no durable write path is deployed.",
      ],
    },
    200,
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...HEADERS, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" },
  });
}
