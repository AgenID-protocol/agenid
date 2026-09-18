"use client";

/**
 * The React side of the scenario timeline: a rAF loop, an IntersectionObserver, and
 * the reduced-motion decision. All step arithmetic lives in lib/scenarios/timeline.ts.
 *
 * Three behaviors are load-bearing and easy to lose in a refactor:
 *
 *   1. REDUCED MOTION SHOWS THE END, NOT THE BEGINNING. The prototype's fallback
 *      rendered the final frame, and that is right: a reader who has asked their OS to
 *      stop animations still deserves the completed argument, not an empty stage
 *      waiting for a loop that will never run. Step 0 is an empty room.
 *   2. OFF-SCREEN IS PAUSED. Eight scenarios on one index page, each running a rAF
 *      loop, is eight loops burning battery to animate nothing.
 *   3. THE ACCUMULATOR IS THE CLOCK, NOT `performance.now()`. Frame deltas are clamped
 *      before they are added, so a backgrounded tab resuming after two minutes advances
 *      one frame rather than jumping to the end of the loop.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampSpeed,
  elapsedForStep,
  loopDuration,
  stepAt,
  stepLimit,
  type ScenarioMode,
  type TimelineShape,
} from "@/lib/scenarios/timeline";

/** A single frame longer than this is a tab that was asleep, not a slow frame. */
const MAX_FRAME_MS = 250;

export interface ScenarioTimeline {
  step: number;
  mode: ScenarioMode;
  playing: boolean;
  /** 0..1 through the current mode. */
  progress: number;
  reducedMotion: boolean;
  setMode: (mode: ScenarioMode) => void;
  toggle: () => void;
  replay: () => void;
  /** Attach to the element whose visibility gates playback. */
  containerRef: (node: HTMLElement | null) => void;
}

export function useScenarioTimeline(shape: TimelineShape, speed = 1): ScenarioTimeline {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mode, setModeState] = useState<ScenarioMode>("with");
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);

  const elapsed = useRef(0);
  const visible = useRef(true);
  const node = useRef<HTMLElement | null>(null);
  const observer = useRef<IntersectionObserver | null>(null);

  // Read once on mount and then follow the media query: a reader can flip the OS
  // setting with the page open, and the animation should stop without a reload.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const containerRef = useCallback((el: HTMLElement | null) => {
    node.current = el;
    observer.current?.disconnect();
    observer.current = null;
    if (!el || typeof IntersectionObserver === "undefined") {
      visible.current = true;
      return;
    }
    observer.current = new IntersectionObserver(
      (entries) => {
        visible.current = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.06 },
    );
    observer.current.observe(el);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  // Reduced motion: hold the last frame of the current mode and run no loop at all.
  useEffect(() => {
    if (!reducedMotion) return;
    setStep(stepLimit(shape, mode));
  }, [reducedMotion, shape, mode]);

  useEffect(() => {
    if (reducedMotion || !playing) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;

    let raf = 0;
    let last = performance.now();
    const total = loopDuration(shape, mode, speed) * clampSpeed(speed);

    const frame = (now: number) => {
      const delta = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      if (visible.current) {
        elapsed.current += delta;
        if (elapsed.current > total) elapsed.current = 0;
        const next = stepAt(shape, mode, elapsed.current, speed);
        setStep((prev) => (prev === next ? prev : next));
      }
      raf = window.requestAnimationFrame(frame);
    };

    raf = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(raf);
  }, [reducedMotion, playing, shape, mode, speed]);

  const setMode = useCallback((next: ScenarioMode) => {
    elapsed.current = 0;
    setModeState(next);
    setStep(0);
    setPlaying(true);
  }, []);

  const replay = useCallback(() => {
    elapsed.current = 0;
    setStep(0);
    setPlaying(true);
  }, []);

  const toggle = useCallback(() => {
    // Pausing at step 0 would leave a blank stage with a Play button over it, so a
    // pause that lands on the idle frame advances to the first real one instead.
    setPlaying((prev) => {
      if (prev && elapsed.current === 0) elapsed.current = elapsedForStep(1, speed);
      return !prev;
    });
  }, [speed]);

  const limit = stepLimit(shape, mode);
  return {
    step,
    mode,
    playing: playing && !reducedMotion,
    progress: limit <= 0 ? 1 : Math.min(1, step / limit),
    reducedMotion,
    setMode,
    toggle,
    replay,
    containerRef,
  };
}
