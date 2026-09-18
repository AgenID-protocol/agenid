/**
 * Scenario timeline — the pure step math behind components/scenarios.
 *
 * Ported from the standalone animation prototype's `agenid-engine.js`, which ran a
 * `setInterval` accumulator over a shared mutable object. The arithmetic is separated
 * from React here for one reason: it is the part that can be wrong in a way nobody
 * sees. A reveal that fires one step early looks like a design choice; a timeline that
 * silently never reaches its last step looks like nothing at all.
 *
 * No DOM, no timers, no React. Every function is total and deterministic.
 */

/** The two things a scenario can be playing: the world with AgenID, and the world without it. */
export type ScenarioMode = "with" | "without";

export interface TimelineShape {
  /** Total steps in `with` mode. The last step is the outcome. */
  readonly steps: number;
  /** Steps in `without` mode — the story stops early, because nothing resolves. */
  readonly beforeSteps: number;
  /** The step at which the identifier itself appears. Below it, the claim is unverifiable. */
  readonly idStep: number;
}

/** Milliseconds per step, and the pause on the final frame before the loop restarts. */
export const STEP_MS = 1100;
export const HOLD_MS = 2600;

/** Playback speed is bounded: below 0.4x a loop outlasts anyone's patience. */
export function clampSpeed(speed: number | undefined): number {
  if (!Number.isFinite(speed as number)) return 1;
  return Math.min(4, Math.max(0.4, speed as number));
}

/** How many steps this mode actually plays. `without` stops where the story stops. */
export function stepLimit(shape: TimelineShape, mode: ScenarioMode): number {
  return mode === "without" ? shape.beforeSteps : shape.steps;
}

/** Total loop duration: every step, plus the hold on the last frame. */
export function loopDuration(shape: TimelineShape, mode: ScenarioMode, speed = 1): number {
  const s = clampSpeed(speed);
  return (stepLimit(shape, mode) * STEP_MS + HOLD_MS) / s;
}

/**
 * The step visible at `elapsed` ms into the loop.
 *
 * Clamped at both ends rather than wrapped: wrapping here would make the caller's
 * accumulator and this function disagree about which loop they are in, and the hold
 * on the final frame would be the frame that got skipped.
 */
export function stepAt(shape: TimelineShape, mode: ScenarioMode, elapsed: number, speed = 1): number {
  const limit = stepLimit(shape, mode);
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  const scaled = elapsed * clampSpeed(speed);
  return Math.max(0, Math.min(limit, Math.floor(scaled / STEP_MS)));
}

/** Elapsed ms at which a given step first shows — the inverse of `stepAt`, for seeking. */
export function elapsedForStep(step: number, speed = 1): number {
  return (Math.max(0, step) * STEP_MS) / clampSpeed(speed);
}

/** 0..1 progress through the current mode, for the progress rule above the stage. */
export function progressAt(shape: TimelineShape, mode: ScenarioMode, step: number): number {
  const limit = stepLimit(shape, mode);
  if (limit <= 0) return 1;
  return Math.max(0, Math.min(1, step / limit));
}

/**
 * The phase caption for a step.
 *
 * `labels[0]` is the idle caption, so a label list is one longer than the step count.
 * A short list clamps to its last entry rather than rendering `undefined` — a caption
 * that stops updating is a smaller failure than one that reads "undefined" on a
 * public page.
 */
export function labelAt(labels: readonly string[], step: number): string {
  if (labels.length === 0) return "";
  return labels[Math.min(Math.max(0, step), labels.length - 1)] ?? "";
}

/** True once `step` has reached the point where this element is revealed. */
export function revealed(step: number, at: number): boolean {
  return at > 0 && step >= at;
}
