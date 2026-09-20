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

/**
 * v1.2-DRAFT authorization layer. NOT NORMATIVE — see authorization.ts. Exported so it
 * can be built against and tested; every public surface that uses it must label it.
 */
export * from "./authorization.js";
export * from "./authorization-verify.js";

export const PROTOCOL_VERSION = "1.1.1" as const;

/**
 * The draft version of the authorization layer, tracked separately from
 * PROTOCOL_VERSION so nothing can read a draft capability as part of the ratified
 * protocol. When v1.2 is ratified, PROTOCOL_VERSION moves and this constant goes away.
 */
export const AUTHORIZATION_DRAFT_VERSION = "1.2-draft" as const;
