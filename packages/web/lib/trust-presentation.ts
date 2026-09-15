/**
 * Canonical trust-state presentation. The ONE place that decides what a verification
 * level looks like to a human.
 *
 * WHY THIS EXISTS. Four surfaces independently mapped levels to labels and colours:
 * the embeddable badge, the README shield, the Verification Card, and the issuance
 * wizard. All four shared the same shape:
 *
 *     if (level === "L1_REGISTERED") -> amber
 *     else                           -> emerald / VERIFIED
 *
 * That default is backwards. An unrecognized, malformed, empty, or absent level took
 * the `else` branch and rendered as VERIFIED — the strongest claim the product can
 * make, produced by the absence of information. For a protocol whose entire value is
 * that a claim cannot be forged, a presentation layer that upgrades on ignorance is
 * the same defect class as a route asserting a level it never computed.
 *
 * THE RULE THIS MODULE ENFORCES: trust presentation fails CLOSED. `verified` is true
 * only for levels enumerated below. Everything else — including levels a future
 * protocol version may add — resolves to the neutral UNKNOWN state.
 *
 * NEUTRAL IS NOT NEGATIVE. Absence of verification renders slate and reads plainly;
 * it is never red and never "invalid". An identifier with no record, or a level this
 * build does not recognize, is not evidence of wrongdoing.
 *
 * SCOPE. This is the application/UI layer. It reads a trust state the protocol already
 * established; it never computes, upgrades, or downgrades one. Level semantics,
 * cryptographic verification, and envelope shape belong to `@agenid/core` and the
 * registry, and are not this module's business.
 */

/** Brand tokens. Emerald is reserved for independently verified state (Brand Guide v1.0). */
export const TRUST_COLORS = {
  slate: "#94a3b8",
  amber: "#f59e0b",
  mint: "#10b981",
  red: "#ef4444",
} as const;

/**
 * `verified` means a third party checked something. `declared` means the operator
 * signed a statement about their own agent. `neutral` means we do not know, which is
 * never an upgrade. `alert` is reserved for a state the registry affirmatively
 * reports as wrong (revoked, suspended, failed proof).
 */
export type TrustTone = "verified" | "declared" | "neutral" | "alert";

export interface TrustPresentation {
  /** The machine level this was derived from, or null when the input was not a supported level. */
  readonly level: string | null;
  /** TRUE ONLY for explicitly enumerated independently-verified levels. Never inferred, never defaulted. */
  readonly verified: boolean;
  readonly tone: TrustTone;
  readonly color: string;
  /** Shield badge, right-hand text. */
  readonly badgeLabel: string;
  /** Embeddable badge text (carries the AGENID wordmark inline). */
  readonly embedLabel: string;
  /** Verification Card, machine-level line. */
  readonly cardLabel: string;
  /** Verification Card, headline pill. */
  readonly pillLabel: string;
  /** Tooltip / SVG <title> sentence. `{name}` and `{operator}` are substituted by the caller. */
  readonly summary: string;
}

/**
 * Supported levels, enumerated. L5_CONTINUOUSLY_MONITORED is deliberately absent: it is
 * a reserved NAME in the specification and is not in `@agenid/core`'s VerificationLevel
 * enum, so it can never be issued in v1.1.1 — and if it ever appears in an envelope, it
 * must render neutral rather than as a level this build does not understand.
 *
 * A Map, not an object literal: `LEVELS["constructor"]` on a plain object returns a
 * truthy Function, which is exactly the kind of attacker-supplied string that used to
 * slip past a `LABELS[level] ?? fallback` lookup.
 */
const LEVELS: ReadonlyMap<string, TrustPresentation> = new Map([
  [
    "L1_REGISTERED",
    {
      level: "L1_REGISTERED",
      verified: false,
      tone: "declared",
      color: TRUST_COLORS.amber,
      badgeLabel: "REGISTERED",
      embedLabel: "AGENID REGISTERED",
      cardLabel: "L1 · Registered",
      pillLabel: "REGISTERED · not yet verified",
      summary: "{name} — registered by {operator}. Self-declared, not independently verified.",
    } as const,
  ],
  [
    "L2_DOMAIN_VERIFIED",
    {
      level: "L2_DOMAIN_VERIFIED",
      verified: true,
      tone: "verified",
      color: TRUST_COLORS.mint,
      badgeLabel: "VERIFIED L2",
      embedLabel: "AGENID VERIFIED · L2",
      cardLabel: "L2 · Domain Verified",
      pillLabel: "AGENID VERIFIED",
      summary: "{name} — operated by {operator}. Domain control verified by an authority.",
    } as const,
  ],
  [
    "L3_ORGANIZATION_VERIFIED",
    {
      level: "L3_ORGANIZATION_VERIFIED",
      verified: true,
      tone: "verified",
      color: TRUST_COLORS.mint,
      badgeLabel: "VERIFIED L3",
      embedLabel: "AGENID VERIFIED · L3",
      cardLabel: "L3 · Organization Verified",
      pillLabel: "AGENID VERIFIED",
      summary: "{name} — operated by {operator}. Legal entity verified by an authority.",
    } as const,
  ],
  [
    "L4_DEPLOYMENT_VERIFIED",
    {
      level: "L4_DEPLOYMENT_VERIFIED",
      verified: true,
      tone: "verified",
      color: TRUST_COLORS.mint,
      badgeLabel: "VERIFIED L4",
      embedLabel: "AGENID VERIFIED · L4",
      cardLabel: "L4 · Deployment Verified",
      pillLabel: "AGENID VERIFIED",
      summary: "{name} — operated by {operator}. Deployment verified by an authority.",
    } as const,
  ],
]);

/** The safe default. Anything this build does not explicitly recognize lands here. */
export const UNKNOWN_TRUST: TrustPresentation = {
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "UNVERIFIED",
  embedLabel: "AGENID · UNVERIFIED",
  cardLabel: "Unrecognized verification state",
  pillLabel: "NOT VERIFIED",
  summary: "{name} — this registry reports a verification state this page does not recognize. Treat it as unverified.",
};

/** No record in this registry. Neutral by product rule: absence is not a negative finding. */
export const NOT_REGISTERED_TRUST: TrustPresentation = {
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "NOT REGISTERED",
  embedLabel: "AGENID · NOT REGISTERED",
  cardLabel: "Not registered",
  pillLabel: "NOT REGISTERED",
  summary: "{name} has no record in this registry.",
};

/** The identifier is not a well-formed `agenid:<ULID>`. Still neutral, still not red. */
export const MALFORMED_ID_TRUST: TrustPresentation = {
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "NOT AN AGENID",
  embedLabel: "AGENID · NOT AN AGENID",
  cardLabel: "Not an AgenID",
  pillLabel: "NOT AN AGENID",
  summary: "Not a well-formed agenid:<ULID>.",
};

/** The registry could not be reached. Unknown status, not disproven. */
export const UNAVAILABLE_TRUST: TrustPresentation = {
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "UNAVAILABLE",
  embedLabel: "AGENID · unavailable",
  cardLabel: "Registry unavailable",
  pillLabel: "UNAVAILABLE",
  summary: "This registry could not be reached. The identity's status is unknown, not disproven.",
};

/** The operator proof does not verify. This one IS a negative finding, and reads as one. */
export const PROOF_INVALID_TRUST: TrustPresentation = {
  level: null,
  verified: false,
  tone: "alert",
  color: TRUST_COLORS.red,
  badgeLabel: "PROOF INVALID",
  embedLabel: "AGENID PROOF INVALID",
  cardLabel: "Proof invalid",
  pillLabel: "PROOF INVALID",
  summary: "The operator proof for this agent does not verify.",
};

/** Registry-reported lifecycle states that override any level. */
export function revokedTrust(status: string): TrustPresentation {
  return {
    level: null,
    verified: false,
    tone: "alert",
    color: TRUST_COLORS.red,
    badgeLabel: status,
    embedLabel: `AGENID ${status}`,
    cardLabel: status,
    pillLabel: status,
    summary: `This identity is ${status.toLowerCase()}.`,
  };
}

/**
 * Resolve a verification level to its presentation.
 *
 * Accepts `unknown` on purpose — the level arrives from a JSON envelope over the
 * network, so it may be undefined, null, a number, an object, or an attacker-supplied
 * string. Exact string match against the enumerated table, or UNKNOWN. No casing
 * normalization, no prefix matching, no "starts with L" heuristic: a level this build
 * does not know is a level it must not dress up.
 */
export function presentTrustLevel(level: unknown): TrustPresentation {
  if (typeof level !== "string") return UNKNOWN_TRUST;
  return LEVELS.get(level) ?? UNKNOWN_TRUST;
}

/** The levels this build can render, for tests and for callers that need to enumerate. */
export function supportedTrustLevels(): readonly string[] {
  return [...LEVELS.keys()];
}

/** Fill `{name}` / `{operator}` in a presentation summary. */
export function trustSummary(p: TrustPresentation, name: string, operator?: string | null): string {
  return p.summary.replace(/\{name\}/g, name).replace(/\{operator\}/g, operator ?? "its operator");
}

/**
 * The precedence every badge and card applies, in one place so they cannot disagree
 * about which signal wins:
 *
 *   1. registry-reported SUSPENDED/REVOKED   (alert)
 *   2. operator proof does not verify        (alert)
 *   3. the verification level                (enumerated, or UNKNOWN)
 *
 * A missing `proof_check` is treated as a failed one. The envelope always carries it;
 * an envelope that does not is not an envelope this build should vouch for.
 */
export function presentEnvelopeTrust(env: {
  status?: unknown;
  proof_check?: { ok?: unknown } | null;
  verification?: { level?: unknown } | null;
} | null | undefined): TrustPresentation {
  if (!env || typeof env !== "object") return UNAVAILABLE_TRUST;
  if (env.status === "SUSPENDED" || env.status === "REVOKED") return revokedTrust(env.status);
  if (env.proof_check?.ok !== true) return PROOF_INVALID_TRUST;
  return presentTrustLevel(env.verification?.level);
}
