/**
 * Protocol error types for @agenid/core.
 *
 * Thrown errors are reserved for *programming/input* errors (malformed input,
 * illegal number domains, wrong key role at signing time). Verification
 * OUTCOMES are never thrown — they are returned as `VerifyResult` (see
 * crypto.ts) so that a verifier's decision is a deterministic value, not a
 * control-flow accident.
 */

export class AgenIdError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** RFC 8785 §3.2.2.3 / AgenID §5: number outside IEEE-754 safe domain. */
export class InvalidNumberDomainError extends AgenIdError {
  constructor(message: string) {
    super("invalid_number_domain", message);
  }
}

/** A value that cannot be represented in JCS at all (undefined, function, symbol, BigInt, ...). */
export class UnserializableValueError extends AgenIdError {
  constructor(message: string) {
    super("unserializable_value", message);
  }
}

/** Identifier does not conform to the AgenID identifier grammar (§2). */
export class InvalidIdentifierError extends AgenIdError {
  constructor(message: string) {
    super("invalid_identifier", message);
  }
}

/** Key identifier contains an unencoded URI fragment or is otherwise unresolvable on the wire (§0.A / §9.2). */
export class InvalidKeyIdError extends AgenIdError {
  constructor(message: string) {
    super("invalid_key_id", message);
  }
}

/** Attempt to sign with a key whose role/controller does not match the object being signed (§7.3). */
export class KeyRoleError extends AgenIdError {
  constructor(message: string) {
    super("key_role_mismatch", message);
  }
}

/** Input failed normative schema validation (§6). */
export class SchemaValidationError extends AgenIdError {
  readonly issues: unknown;
  constructor(message: string, issues: unknown) {
    super("schema_validation_failed", message);
    this.issues = issues;
  }
}
