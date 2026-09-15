/**
 * Registration-time clock policy.
 *
 * THE PROBLEM THIS SOLVES. `verifyManifestProof` rejects a proof whose `created_at` is
 * after the instant it is evaluated at ("not_yet_valid"). That is right for a verifier:
 * protocol code must not silently invent leeway, and a third party checking a proof has
 * no business assuming the signer's clock was honest.
 *
 * But at registration the signer and the evaluator are different machines, milliseconds
 * apart in the same request. An operator's browser signs `created_at` from its own clock
 * and POSTs immediately. If the registry's clock is even 1ms behind, the proof it just
 * received is "from the future" and the registration fails — for a clock property the
 * operator cannot see, control, or fix.
 *
 * This was not hypothetical. The registry previously computed its evaluation instant as
 * `new Date().toISOString().replace(/\.\d{3}Z$/, "Z")`, truncating milliseconds. Truncation
 * only ever moves time BACKWARD, by up to 999ms, so a browser signing and posting within
 * the same second produced `created_at > now` almost every time. Every such registration
 * failed with `not_yet_valid`. The integration tests did not catch it because they inject
 * their own `now`, and the fixtures they sign are already second-aligned.
 *
 * THE POLICY. Two separate decisions, kept separate on purpose:
 *
 *   1. Never truncate. `new Date().toISOString()` is already valid `Rfc3339Utc` (the
 *      schema permits optional fractional seconds), so the registry keeps full precision
 *      and stops manufacturing backward skew.
 *
 *   2. Tolerate a small, bounded, EXPLICIT amount of forward client skew, and nothing
 *      more. A proof created up to `MAX_FORWARD_SKEW_MS` ahead of the registry's clock is
 *      evaluated at its own `created_at` rather than being rejected. Beyond that window
 *      the registration is refused and the operator is told their clock is ahead, which
 *      is an answer they can act on.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It does not touch `verifyManifestProof`, and it
 * does not weaken any check. The signature, the digest binding, the key role, and the
 * controller are all still verified exactly as before, and `expires_at` is still enforced
 * against the evaluation instant. The only thing being decided here is which instant a
 * same-request registration is evaluated at. Resolution, envelope building, and assertion
 * verification are untouched and keep using the registry's own clock with no leeway.
 *
 * WHY 120 SECONDS. Large enough to cover ordinary unsynchronized consumer clocks (NTP
 * drift is seconds, not minutes) and any reasonable request latency; small enough that it
 * cannot be used to meaningfully backdate or postdate anything. A proof is valid for 90
 * days, so two minutes at its leading edge changes nothing an attacker cares about.
 */

/** Maximum forward client clock skew accepted at registration. */
export const MAX_FORWARD_SKEW_MS = 120_000;

export type RegistrationTime =
  | { ok: true; now: string; registeredAt: string }
  | { ok: false; code: "clock_skew_too_large"; message: string };

/**
 * Decide the instant a registration's proof is evaluated at.
 *
 * @param proofCreatedAt the proof's own `created_at` (RFC 3339 UTC)
 * @param serverNow      the registry's clock, defaulting to now at full precision
 */
export function registrationTime(proofCreatedAt: string, serverNow: Date = new Date()): RegistrationTime {
  // The registry's own observation of when this happened. Always the server clock:
  // `registered_at` is the registry's claim, so a client must never be able to set it.
  const registeredAt = serverNow.toISOString();

  const created = Date.parse(proofCreatedAt);
  if (Number.isNaN(created)) {
    // Schema validation runs before this and already rejects a malformed timestamp;
    // falling through with the server clock keeps this function total.
    return { ok: true, now: registeredAt, registeredAt };
  }

  const aheadBy = created - serverNow.getTime();
  if (aheadBy > MAX_FORWARD_SKEW_MS) {
    return {
      ok: false,
      code: "clock_skew_too_large",
      message:
        `proof.created_at is ${Math.round(aheadBy / 1000)}s ahead of this registry's clock ` +
        `(limit ${MAX_FORWARD_SKEW_MS / 1000}s). Check the signing machine's system time.`,
    };
  }

  // Within the window, evaluate at the later of the two instants so a proof signed
  // moments ago is not "not yet valid". Outside it (client behind, the normal case),
  // this is exactly the server clock.
  return { ok: true, now: aheadBy > 0 ? proofCreatedAt : registeredAt, registeredAt };
}
