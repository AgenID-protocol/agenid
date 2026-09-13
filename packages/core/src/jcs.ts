/**
 * AgenID v1.1.1 §5 — RFC 8785 JSON Canonicalization Scheme (JCS).
 *
 * This is a strict, self-contained RFC 8785 implementation. It deliberately
 * builds on the two ECMAScript primitives that RFC 8785 itself is defined in
 * terms of:
 *
 *   - Strings and numbers are serialized exactly as ES `JSON.stringify` does
 *     (RFC 8785 §3.2.2.2 and §3.2.2.3 normatively reference the ECMAScript
 *     serialization algorithms for these types).
 *   - Object members are sorted by comparing property names as arrays of
 *     UTF-16 code units (RFC 8785 §3.2.3) — which is precisely what the ES
 *     `<` operator on strings does.
 *
 * On top of the RFC, AgenID §5 adds a *validation* rule that the RFC leaves to
 * profiles: integers with magnitude > 2^53 - 1 and non-finite numbers are
 * REJECTED (InvalidNumberDomainError) rather than silently rounded. JavaScript
 * would otherwise lose precision on such integers without any error, which
 * would make signatures non-portable across implementations.
 *
 * Conformance is proven against the executed vectors in the specification
 * (§8.2–8.4, §8.7), which were produced by an independent Python RFC 8785
 * implementation. See tests/v1_1_1_vectors.test.ts.
 */

import { InvalidNumberDomainError, UnserializableValueError } from "./errors.js";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const MAX_SAFE = Number.MAX_SAFE_INTEGER; // 2^53 - 1

/**
 * Validate the AgenID number-domain rule (§5) for a single number and return
 * its canonical token. Throws InvalidNumberDomainError on violation.
 *
 * The rule is defined on the CANONICAL TOKEN, not on the host language's number
 * type, so that it is language-neutral (the spec's §5 prose says "integer";
 * this is the precise form — see ERRATA in README):
 *
 *   1. Non-finite numbers (NaN, ±Infinity) are rejected.
 *   2. A number whose canonical token is an INTEGER LITERAL (no '.' and no 'e')
 *      with magnitude > 2^53-1 is rejected. Such a token is not guaranteed to
 *      round-trip through implementations that parse integer literals into
 *      64-bit or arbitrary-precision integers (e.g. Python), so it cannot be
 *      part of a portable signature. Exponent-form tokens ("1e+21", "1e+100")
 *      are unambiguously floating-point in every JSON implementation and are
 *      accepted; ES Number::toString switches to exponent form at |n| >= 1e21.
 *
 * Consequences: 9007199254740991 ok; 9007199254740992 rejected; 1e20 (token
 * "100000000000000000000") rejected; 1e21 (token "1e+21") ok; 1e100 ok.
 */
export function assertNumberDomain(n: number, path: string): string {
  if (typeof n !== "number") {
    throw new UnserializableValueError(`${path}: expected number`);
  }
  if (!Number.isFinite(n)) {
    throw new InvalidNumberDomainError(`${path}: ${String(n)} is not representable in JCS`);
  }
  // RFC 8785 §3.2.2.3: ES Number::toString. JSON.stringify(-0) === "0" as required.
  const token = JSON.stringify(n);
  const isIntegerLiteral = !token.includes(".") && !token.includes("e");
  if (isIntegerLiteral && Math.abs(n) > MAX_SAFE) {
    throw new InvalidNumberDomainError(
      `${path}: integer literal ${token} exceeds the safe integer domain (|n| must be <= 2^53-1)`,
    );
  }
  return token;
}

/**
 * Walk a value and enforce the number-domain rule everywhere, without
 * serializing. Useful for validating inbound documents before they are stored.
 */
export function validateNumberDomain(value: unknown, path = "$"): void {
  if (typeof value === "number") {
    assertNumberDomain(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => validateNumberDomain(v, `${path}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const k of Object.keys(value as object)) {
      validateNumberDomain((value as Record<string, unknown>)[k], `${path}.${k}`);
    }
  }
}

function serialize(value: unknown, path: string, out: string[]): void {
  if (value === null) {
    out.push("null");
    return;
  }
  switch (typeof value) {
    case "boolean":
      out.push(value ? "true" : "false");
      return;
    case "number":
      out.push(assertNumberDomain(value, path));
      return;
    case "string":
      // RFC 8785 §3.2.2.2: ES JSON.stringify string serialization — escapes only
      // ", \ and U+0000–U+001F; emits all other code points (incl. U+007F, U+00A0,
      // astral chars) as raw UTF-8 when the result is UTF-8 encoded.
      out.push(JSON.stringify(value));
      return;
    case "bigint":
      throw new InvalidNumberDomainError(`${path}: BigInt is not representable in JSON/JCS`);
    case "undefined":
    case "function":
    case "symbol":
      throw new UnserializableValueError(`${path}: ${typeof value} is not representable in JCS`);
    case "object": {
      if (Array.isArray(value)) {
        out.push("[");
        for (let i = 0; i < value.length; i++) {
          if (i > 0) out.push(",");
          const item = value[i];
          if (item === undefined || typeof item === "function" || typeof item === "symbol") {
            // JSON.stringify would coerce these to null inside arrays; JCS forbids
            // silently changing meaning, so we reject instead.
            throw new UnserializableValueError(`${path}[${i}]: ${typeof item} is not representable in JCS`);
          }
          serialize(item, `${path}[${i}]`, out);
        }
        out.push("]");
        return;
      }
      // Reject class instances that would serialize unexpectedly (Date, Map, Buffer...).
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new UnserializableValueError(
          `${path}: only plain objects are canonicalizable (got ${proto?.constructor?.name ?? "unknown"})`,
        );
      }
      const obj = value as Record<string, unknown>;
      // RFC 8785 §3.2.3: sort by UTF-16 code units. ES string comparison does exactly this.
      const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      out.push("{");
      let first = true;
      for (const k of keys) {
        const v = obj[k];
        if (v === undefined) {
          // JSON.stringify drops undefined members; JCS input must be pure JSON, so reject.
          throw new UnserializableValueError(`${path}.${k}: undefined is not representable in JCS`);
        }
        if (!first) out.push(",");
        first = false;
        out.push(JSON.stringify(k), ":");
        serialize(v, `${path}.${k}`, out);
      }
      out.push("}");
      return;
    }
    default:
      throw new UnserializableValueError(`${path}: unsupported value`);
  }
}

/** RFC 8785 canonical serialization as a JavaScript string (UTF-16). */
export function canonicalize(value: unknown): string {
  const out: string[] = [];
  serialize(value, "$", out);
  return out.join("");
}

/** RFC 8785 canonical serialization as UTF-8 bytes — the form that is hashed and signed. */
export function canonicalizeToBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}

/**
 * Parse JSON text, then canonicalize. Use this for documents received as text.
 *
 * Extra guard for the text layer: `JSON.parse` silently rounds integer literals
 * above 2^53 (e.g. "9007199254740993" → 9007199254740992) before our
 * value-level check can see the original token. On runtimes that expose the
 * source text to the reviver (Node ≥ 21 via `context.source`) we reject such
 * literals directly; elsewhere the value-level rule still catches every case
 * that would produce a non-portable canonical token.
 */
export function canonicalizeJsonText(text: string): Uint8Array {
  const value = JSON.parse(text, function reviver(this: unknown, _key: string, v: unknown, context?: { source?: string }) {
    if (typeof v === "number" && context && typeof context.source === "string") {
      const src = context.source;
      const isIntegerLiteral = !/[.eE]/.test(src);
      if (isIntegerLiteral && /^-?\d+$/.test(src)) {
        const digits = src.replace("-", "");
        // Compare textually against "9007199254740991" to avoid any float rounding.
        const tooBig = digits.length > 16 || (digits.length === 16 && digits > "9007199254740991");
        if (tooBig) {
          throw new InvalidNumberDomainError(`integer literal ${src} exceeds the safe integer domain (|n| must be <= 2^53-1)`);
        }
      }
    }
    return v;
  } as (this: unknown, key: string, value: unknown) => unknown);
  return canonicalizeToBytes(value);
}
