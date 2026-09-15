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

/**
 * F-1: every presentation value below is frozen at module load.
 *
 * `readonly` and `as const` are compile-time only — TypeScript erases them, so a caller
 * could reach into a returned presentation and write to it. Because lookups return the
 * SHARED table entry, one such write poisoned the canonical value for every subsequent
 * caller in that process, including other requests on the same warm serverless instance.
 * An adversarial audit reproduced it end to end: mutate the L1 entry, then render an
 * honest L1 agent's shield and get emerald `VERIFIED`.
 *
 * Freezing makes the write a silent no-op in sloppy mode and a TypeError under "use
 * strict" (which ES modules are), so the canonical value survives either way. The LEVELS
 * Map is module-private and never exported, so no caller can reach `.set` on it; the
 * entries it holds are frozen for the case that matters, which is the reference handed
 * back to callers.
 */
function frozen<T>(value: T): T {
  return Object.freeze(value);
}

/** Brand tokens. Emerald is reserved for independently verified state (Brand Guide v1.0). */
export const TRUST_COLORS = frozen({
  slate: "#94a3b8",
  amber: "#f59e0b",
  mint: "#10b981",
  red: "#ef4444",
} as const);

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
const LEVELS: ReadonlyMap<string, TrustPresentation> = new Map<string, TrustPresentation>([
  [
    "L1_REGISTERED",
    frozen({
      level: "L1_REGISTERED",
      verified: false,
      tone: "declared",
      color: TRUST_COLORS.amber,
      badgeLabel: "REGISTERED",
      embedLabel: "AGENID REGISTERED",
      cardLabel: "L1 · Registered",
      pillLabel: "REGISTERED · not yet verified",
      summary: "{name} — registered by {operator}. Self-declared, not independently verified.",
    }),
  ],
  [
    "L2_DOMAIN_VERIFIED",
    frozen({
      level: "L2_DOMAIN_VERIFIED",
      verified: true,
      tone: "verified",
      color: TRUST_COLORS.mint,
      badgeLabel: "VERIFIED L2",
      embedLabel: "AGENID VERIFIED · L2",
      cardLabel: "L2 · Domain Verified",
      pillLabel: "AGENID VERIFIED",
      summary: "{name} — operated by {operator}. Domain control verified by an authority.",
    }),
  ],
  [
    "L3_ORGANIZATION_VERIFIED",
    frozen({
      level: "L3_ORGANIZATION_VERIFIED",
      verified: true,
      tone: "verified",
      color: TRUST_COLORS.mint,
      badgeLabel: "VERIFIED L3",
      embedLabel: "AGENID VERIFIED · L3",
      cardLabel: "L3 · Organization Verified",
      pillLabel: "AGENID VERIFIED",
      summary: "{name} — operated by {operator}. Legal entity verified by an authority.",
    }),
  ],
  [
    "L4_DEPLOYMENT_VERIFIED",
    frozen({
      level: "L4_DEPLOYMENT_VERIFIED",
      verified: true,
      tone: "verified",
      color: TRUST_COLORS.mint,
      badgeLabel: "VERIFIED L4",
      embedLabel: "AGENID VERIFIED · L4",
      cardLabel: "L4 · Deployment Verified",
      pillLabel: "AGENID VERIFIED",
      summary: "{name} — operated by {operator}. Deployment verified by an authority.",
    }),
  ],
]);

const HEALTHY_STATUSES: ReadonlySet<string> = new Set(["ACTIVE", "CHANGED", "STALE"]);
const ALERT_STATUSES: ReadonlySet<string> = new Set(["SUSPENDED", "REVOKED"]);

/** The safe default. Anything this build does not explicitly recognize lands here. */
export const UNKNOWN_TRUST: TrustPresentation = frozen({
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "UNVERIFIED",
  embedLabel: "AGENID · UNVERIFIED",
  cardLabel: "Unrecognized verification state",
  pillLabel: "NOT VERIFIED",
  summary: "{name} — this registry reports a verification state this page does not recognize. Treat it as unverified.",
});

/** No record in this registry. Neutral by product rule: absence is not a negative finding. */
export const NOT_REGISTERED_TRUST: TrustPresentation = frozen({
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "NOT REGISTERED",
  embedLabel: "AGENID · NOT REGISTERED",
  cardLabel: "Not registered",
  pillLabel: "NOT REGISTERED",
  summary: "{name} has no record in this registry.",
});

/** The identifier is not a well-formed `agenid:<ULID>`. Still neutral, still not red. */
export const MALFORMED_ID_TRUST: TrustPresentation = frozen({
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "NOT AN AGENID",
  embedLabel: "AGENID · NOT AN AGENID",
  cardLabel: "Not an AgenID",
  pillLabel: "NOT AN AGENID",
  summary: "Not a well-formed agenid:<ULID>.",
});

/** The registry could not be reached. Unknown status, not disproven. */
export const UNAVAILABLE_TRUST: TrustPresentation = frozen({
  level: null,
  verified: false,
  tone: "neutral",
  color: TRUST_COLORS.slate,
  badgeLabel: "UNAVAILABLE",
  embedLabel: "AGENID · unavailable",
  cardLabel: "Registry unavailable",
  pillLabel: "UNAVAILABLE",
  summary: "This registry could not be reached. The identity's status is unknown, not disproven.",
});

/** The operator proof does not verify. This one IS a negative finding, and reads as one. */
export const PROOF_INVALID_TRUST: TrustPresentation = frozen({
  level: null,
  verified: false,
  tone: "alert",
  color: TRUST_COLORS.red,
  badgeLabel: "PROOF INVALID",
  embedLabel: "AGENID PROOF INVALID",
  cardLabel: "Proof invalid",
  pillLabel: "PROOF INVALID",
  summary: "The operator proof for this agent does not verify.",
});

/** Registry-reported lifecycle states that override any level. */
export function revokedTrust(status: string): TrustPresentation {
  return frozen({
    level: null,
    verified: false,
    tone: "alert",
    color: TRUST_COLORS.red,
    badgeLabel: status,
    embedLabel: `AGENID ${status}`,
    cardLabel: status,
    pillLabel: status,
    summary: `This identity is ${status.toLowerCase()}.`,
  });
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

/**
 * The lifecycle statuses this build recognizes, for the generated browser badge and for
 * tests. Returned as frozen arrays so a caller cannot widen the allowlist.
 */
export function recognizedStatuses(): { readonly healthy: readonly string[]; readonly alert: readonly string[] } {
  return frozen({ healthy: frozen([...HEALTHY_STATUSES]), alert: frozen([...ALERT_STATUSES]) });
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
 * Lifecycle statuses this build recognizes. Mirrors `AgentStatus` in `@agenid/api`
 * ("ACTIVE" | "CHANGED" | "STALE" | "SUSPENDED" | "REVOKED"), which the registry's own
 * CHECK constraint enforces. Mirrored rather than imported because this is the
 * presentation layer's opinion about what it can safely draw, not a protocol definition —
 * if the protocol ever adds a status, this build must render it neutrally until someone
 * decides what it should look like.
 *
 * Split into two sets on purpose: "recognized" is not the same as "healthy".
 */
/**
 * The precedence every badge and card applies, in one place so they cannot disagree
 * about which signal wins:
 *
 *   1. the envelope is not an envelope                    -> neutral (unavailable)
 *   2. the lifecycle status is not one we recognize       -> neutral (unavailable)
 *   3. a recognized SUSPENDED / REVOKED                   -> alert
 *   4. the operator proof does not verify                 -> alert
 *   5. the verification level                             -> enumerated, or neutral
 *
 * F-2: step 2 used to not exist. The check was `status === "SUSPENDED" || status ===
 * "REVOKED"`, and anything else — a lowercase "revoked", a status this build has never
 * heard of, an absent one — fell straight through to the level branch. An adversarial
 * audit rendered a REVOKED identity as emerald `VERIFIED L2` by lowercasing one word.
 *
 * Status now fails closed the same way level does: an unrecognized lifecycle state is an
 * UNKNOWN state, not a healthy one, and unknown never earns a stronger presentation.
 * Deliberately NOT case-normalized — "revoked" is not a value this system emits, so
 * accepting it would be inventing protocol semantics to paper over a malformed envelope.
 *
 * A missing or non-true `proof_check` is treated as a failed one. The envelope always
 * carries it; one that does not is not an envelope this build should vouch for.
 */
export function presentEnvelopeTrust(env: {
  status?: unknown;
  proof_check?: { ok?: unknown } | null;
  verification?: { level?: unknown } | null;
} | null | undefined): TrustPresentation {
  if (!env || typeof env !== "object" || Array.isArray(env)) return UNAVAILABLE_TRUST;

  const status = env.status;
  if (typeof status !== "string") return UNAVAILABLE_TRUST;
  if (ALERT_STATUSES.has(status)) return revokedTrust(status);
  if (!HEALTHY_STATUSES.has(status)) return UNAVAILABLE_TRUST;

  if (env.proof_check?.ok !== true) return PROOF_INVALID_TRUST;
  return presentTrustLevel(env.verification?.level);
}
