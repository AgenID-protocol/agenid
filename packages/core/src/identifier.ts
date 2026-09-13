/**
 * AgenID v1.1.1 §2 — Identifier model, and §0.A / §9.2 — key identifier wire forms.
 *
 * Namespaces (complete list for v1.1.1):
 *   agenid:<ULID>              Agent
 *   agenid:key:<ULID>          Key (its OWN ULID — never derived from the agent's)
 *   agenid:authority:<name>    Verification authority
 *   assertion:<ULID>           VerificationAssertion
 *   dep_<opaque>               Deployment (platform-scoped)
 */

import { randomBytes } from "node:crypto";
import { InvalidIdentifierError, InvalidKeyIdError } from "./errors.js";

// ---------------------------------------------------------------------------
// ULID (https://github.com/ulid/spec): 26 chars, Crockford Base32, no I L O U.
// First char is limited to 0-7 so the 48-bit timestamp does not overflow.
// ---------------------------------------------------------------------------

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const ULID_REGEX = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export const AGENT_ID_REGEX = /^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
export const KEY_ID_REGEX = /^agenid:key:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
export const ASSERTION_ID_REGEX = /^assertion:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;
export const AUTHORITY_ID_REGEX = /^agenid:authority:[a-z0-9][a-z0-9-]{0,62}$/;
export const DEPLOYMENT_ID_REGEX = /^dep_[A-Za-z0-9_-]{1,64}$/;

export function isValidUlid(value: string): boolean {
  return ULID_REGEX.test(value);
}

/**
 * Generate a ULID: 48-bit millisecond timestamp + 80 bits of CSPRNG randomness.
 * Monotonic ordering within the same millisecond is NOT guaranteed by this
 * generator; the protocol does not require it (§2 requires uniqueness checks at
 * registration regardless).
 */
export function generateUlid(now: number = Date.now()): string {
  if (!Number.isInteger(now) || now < 0 || now > 0xffffffffffff) {
    throw new InvalidIdentifierError("ULID timestamp must be an integer in [0, 2^48)");
  }
  // Time: 10 chars (50 bits, top 2 always zero → first char 0-7).
  let t = now;
  const time = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    time[i] = CROCKFORD[t % 32]!;
    t = Math.floor(t / 32);
  }
  // Random: 80 bits = 16 chars × 5 bits. Draw 10 bytes and bit-pack.
  const rnd = randomBytes(10);
  const rand = new Array<string>(16);
  let bitBuf = 0;
  let bitCount = 0;
  let idx = 0;
  for (let i = 0; i < 10; i++) {
    bitBuf = (bitBuf << 8) | rnd[i]!;
    bitCount += 8;
    while (bitCount >= 5) {
      bitCount -= 5;
      rand[idx++] = CROCKFORD[(bitBuf >>> bitCount) & 31]!;
    }
  }
  return time.join("") + rand.join("");
}

// ---------------------------------------------------------------------------
// Agent identifiers
// ---------------------------------------------------------------------------

export function generateAgentId(now?: number): string {
  return `agenid:${generateUlid(now)}`;
}

export function isValidAgentId(value: string): boolean {
  return AGENT_ID_REGEX.test(value);
}

export function parseAgentId(value: string): { ulid: string } {
  if (!isValidAgentId(value)) {
    throw new InvalidIdentifierError(`Not a valid agent identifier: ${JSON.stringify(value)}`);
  }
  return { ulid: value.slice("agenid:".length) };
}

// ---------------------------------------------------------------------------
// Key identifiers — logical vs wire form (§0.A, §9.2)
// ---------------------------------------------------------------------------

export function generateKeyId(now?: number): string {
  return `agenid:key:${generateUlid(now)}`;
}

/**
 * Strict logical-form validation. Rejects any `#` (unencoded fragment) — a
 * fragment is never transmitted over HTTP, so a key_id carrying one is
 * unresolvable by construction. Also rejects `?`, `/`, whitespace and
 * percent-encoding, which would make the logical form ambiguous.
 */
export function isValidKeyId(value: string): boolean {
  return KEY_ID_REGEX.test(value);
}

export function assertValidKeyId(value: string): void {
  if (typeof value !== "string") {
    throw new InvalidKeyIdError("key_id must be a string");
  }
  if (value.includes("#")) {
    throw new InvalidKeyIdError(
      `key_id must not contain a URI fragment ('#'): fragments are not sent to servers and cannot be resolved (§0.A)`,
    );
  }
  if (!isValidKeyId(value)) {
    throw new InvalidKeyIdError(`Not a valid key identifier: ${JSON.stringify(value)}`);
  }
}

/** Logical form → bare key-ULID (the wire path segment). */
export function keyIdToWire(keyId: string): string {
  assertValidKeyId(keyId);
  return keyId.slice("agenid:key:".length);
}

/** Bare key-ULID (wire path segment) → logical form. */
export function keyIdFromWire(wire: string): string {
  if (typeof wire !== "string" || !isValidUlid(wire)) {
    throw new InvalidKeyIdError(`Wire key identifier must be a bare ULID, got ${JSON.stringify(wire)}`);
  }
  return `agenid:key:${wire}`;
}

/** `GET /v1/keys/{key-ULID}` — canonical resolver path (§9.2). */
export function keyResolverPath(keyId: string): string {
  return `/v1/keys/${keyIdToWire(keyId)}`;
}

/** `GET /v1/keys?key_id=agenid%3Akey%3A...` — percent-encoded logical form (§9.2). Must resolve identically. */
export function keyResolverQuery(keyId: string): string {
  assertValidKeyId(keyId);
  return `/v1/keys?key_id=${encodeURIComponent(keyId)}`;
}

/**
 * Parse an incoming request's key reference — either a wire path segment or a
 * `key_id` query value (percent-encoded or not) — into the logical form.
 * Any `#`, whether raw or percent-encoded as `%23`, is rejected with
 * `invalid_key_id` (a server MUST 400, never truncate).
 */
export function parseKeyReference(input: string): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new InvalidKeyIdError("empty key reference");
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    throw new InvalidKeyIdError("key reference is not valid percent-encoding");
  }
  if (decoded.includes("#") || input.includes("#")) {
    throw new InvalidKeyIdError("key reference must not contain a URI fragment ('#')");
  }
  if (isValidUlid(decoded)) return keyIdFromWire(decoded);
  if (isValidKeyId(decoded)) return decoded;
  throw new InvalidKeyIdError(`Unresolvable key reference: ${JSON.stringify(input)}`);
}

// ---------------------------------------------------------------------------
// Other identifiers
// ---------------------------------------------------------------------------

export function generateAssertionId(now?: number): string {
  return `assertion:${generateUlid(now)}`;
}
export function isValidAssertionId(value: string): boolean {
  return ASSERTION_ID_REGEX.test(value);
}
export function isValidAuthorityId(value: string): boolean {
  return AUTHORITY_ID_REGEX.test(value);
}
export function isValidDeploymentId(value: string): boolean {
  return DEPLOYMENT_ID_REGEX.test(value);
}

/** Well-known discovery URIs (§9.3, §9.4). Always HTTPS. */
export function wellKnownKeysUrl(domain: string): string {
  assertHostname(domain);
  return `https://${domain}/.well-known/agenid/keys.json`;
}
export function wellKnownAuthoritiesUrl(domain: string): string {
  assertHostname(domain);
  return `https://${domain}/.well-known/agenid/authorities.json`;
}

const HOSTNAME_REGEX = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
export function isValidHostname(value: string): boolean {
  return HOSTNAME_REGEX.test(value);
}
function assertHostname(value: string): void {
  if (!isValidHostname(value)) {
    throw new InvalidIdentifierError(`Not a valid hostname: ${JSON.stringify(value)}`);
  }
}
