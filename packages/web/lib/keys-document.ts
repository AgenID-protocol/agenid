/**
 * The operator half of two-path key discovery, built for the operator.
 *
 * Spec §9.3: an operator publishes its key documents at
 * `https://<operator_domain>/.well-known/agenid/keys.json`, and a verifier requires that
 * copy to agree with the registry's. Where the operator publishes nothing, the verifier has
 * one source instead of two and the registry is, in practice, authoritative — the exact
 * property this protocol exists to avoid. Until now the product told operators to publish
 * the file and left them to write it by hand.
 *
 * Dependency-free on purpose, like lib/domain-connect.ts: it runs in the /issue tab, where
 * the key document was just generated, and on the server in tests. The output is checked
 * by test against @agenid/core's strict KeysDocument and against the same probe
 * /api/domain/status uses, so "the file we hand you" and "the file we accept" cannot drift.
 */

/** Must equal KEYS_SCHEMA_ID in @agenid/core (test-pinned). */
export const KEYS_DOCUMENT_SCHEMA_ID = "https://agenid.com/schemas/v1.1.1/keys.json";

export const KEYS_DOCUMENT_PATH = "/.well-known/agenid/keys.json";

/**
 * Public key documents only. A KeyDocument has no member that can carry private material,
 * and this function copies whole documents rather than picking fields, so it cannot add one.
 */
export function buildKeysDocument(operatorDomain: string, keyDocuments: readonly Record<string, unknown>[]): string {
  const domain = operatorDomain.trim().toLowerCase();
  if (!domain) throw new Error("operator domain is required");
  if (keyDocuments.length === 0) throw new Error("at least one key document is required");
  return JSON.stringify({ $schema: KEYS_DOCUMENT_SCHEMA_ID, controller_domain: domain, keys: keyDocuments }, null, 2) + "\n";
}

export function keysDocumentUrl(operatorDomain: string): string {
  return `https://${operatorDomain.trim().toLowerCase()}${KEYS_DOCUMENT_PATH}`;
}
