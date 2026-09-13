/**
 * @agenid/core — AgenID v1.1.1 protocol core.
 *
 * Scope (Phase 1): identifiers, RFC 8785 canonicalization, normative schemas,
 * Ed25519 proof engine. Deliberately NO storage, NO HTTP server, NO UI.
 */
export * from "./errors.js";
export * from "./identifier.js";
export * from "./jcs.js";
export * from "./schemas.js";
export * from "./crypto.js";

export const PROTOCOL_VERSION = "1.1.1" as const;
