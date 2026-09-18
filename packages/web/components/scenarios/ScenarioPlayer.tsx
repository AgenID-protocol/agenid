"use client";

/**
 * The scenario renderer: one component for eight of the nine illustrations.
 *
 * THE CAMERA. The stage is a fixed-height, masked window over a taller track, and the
 * track translates so the newest revealed block sits at the bottom edge. The prototype
 * found that block by scanning every element's inline `opacity` and `translateY`, which
 * worked and would have broken the first time anyone added a transition. Here each
 * block registers a ref against its own step, so the camera asks the data what the
 * newest block is instead of asking the DOM what looks recent.
 *
 * Under reduced motion the camera is off entirely: no fixed height, no mask, no
 * transform. The scenario becomes a static diagram of its own final state, which is
 * the whole argument laid out at once rather than a frozen frame partway through it.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenarios/types";
import {
  CHALLENGE_IS_PROPOSED,
  EXAMPLE_AGENID,
  EXAMPLE_FLOW_LABEL,
  WHAT_WAS_VERIFIED,
} from "@/lib/scenarios/types";
import { labelAt } from "@/lib/scenarios/timeline";
import { useScenarioTimeline } from "./useScenarioTimeline";
import { AgentMark, Card, Connector, Eyebrow, FlowLine, Panel, Reveal } from "./parts";

const STAGE_HEIGHT = "max(420px, min(660px, calc(100vh - 260px)))";

export function ScenarioPlayer({ scenario }: { scenario: Scenario }) {
  const t = useScenarioTimeline(scenario.shape, 1);
  const [explain, setExplain] = useState(false);
  const without = t.mode === "without";

  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const marks = useRef(new Map<number, HTMLElement>());

  const mark = useCallback(
    (step: number) => (el: HTMLElement | null) => {
      if (el) marks.current.set(step, el);
      else marks.current.delete(step);
    },
    [],
  );

  // Follow the newest revealed block. Runs after paint on every step change, and again
  // on resize, because the track's height depends on how the cards wrapped.
  useEffect(() => {
    if (t.reducedMotion) return;
    const move = () => {
      const stage = stageRef.current;
      const track = trackRef.current;
      if (!stage || !track) return;
      const span = Math.max(0, track.scrollHeight - stage.clientHeight);
      if (span === 0) {
        track.style.transform = "none";
        return;
      }
      let newest: HTMLElement | null = null;
      let newestStep = -1;
      for (const [step, el] of marks.current) {
        if (step <= t.step && step > newestStep) {
          newestStep = step;
          newest = el;
        }
      }
      // Three cases, and the first one is the one a browser pass caught: before
      // anything is revealed there is no newest block, and treating that as "scroll to
      // the end" put the camera at the BOTTOM of an empty track — which is what a
      // viewer sees for a frame every time they press Replay. An empty stage starts at
      // the top.
      let target: number;
      if (!newest) {
        target = 0;
      } else if (t.step >= scenario.outcome.step) {
        target = span;
      } else {
        const bottom = newest.getBoundingClientRect().bottom - track.getBoundingClientRect().top;
        target = Math.max(0, Math.min(span, Math.round(bottom + 20 - stage.clientHeight)));
      }
      track.style.transform = `translate3d(0, ${-target}px, 0)`;
    };
    const raf = requestAnimationFrame(move);
    window.addEventListener("resize", move);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", move);
    };
  }, [t.step, t.reducedMotion, scenario.outcome.step]);

  const cp = scenario.counterparty;
  const visibleRows = without ? [] : scenario.flow.rows;

  return (
    <div ref={t.containerRef}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2" role="group" aria-label="Comparison mode">
          <ModeButton active={without} onClick={() => t.setMode("without")}>
            Without AgenID
          </ModeButton>
          <ModeButton active={!without} onClick={() => t.setMode("with")}>
            With AgenID
          </ModeButton>
        </div>
        {!t.reducedMotion && (
          <div className="flex gap-2">
            <SmallButton onClick={t.toggle}>{t.playing ? "Pause" : "Play"}</SmallButton>
            <SmallButton onClick={t.replay}>Replay</SmallButton>
          </div>
        )}
      </div>

      {/* Progress + phase caption */}
      <div className="relative mt-4 h-px bg-line">
        <div
          className="absolute left-0 top-0 h-px bg-mint transition-[width] duration-[1100ms] ease-linear"
          style={{ width: `${Math.round(t.progress * 100)}%` }}
        />
      </div>
      {/*
        The caption belongs to the mode, not only to the step.
        `labels` narrates the full story, so at the without-AgenID cut it kept reading
        "AgenID presented" — describing the one thing that had not happened, on the
        screen built to show it not happening. A browser pass caught it; no unit test
        would have, because both halves were individually correct. The without-cut ends
        on its own outcome title, which is written for exactly this moment.
      */}
      <div
        aria-live="polite"
        className="mt-3 min-h-[14px] font-mono text-[10px] uppercase tracking-[0.22em] text-muted"
      >
        {without && t.step >= scenario.shape.beforeSteps
          ? scenario.outcome.without.title
          : labelAt(scenario.labels, t.step)}
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        className={t.reducedMotion ? "mt-4" : "relative mt-4 overflow-hidden"}
        style={
          t.reducedMotion
            ? undefined
            : {
                height: STAGE_HEIGHT,
                maskImage:
                  "linear-gradient(180deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(180deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%)",
              }
        }
      >
        <div
          ref={trackRef}
          className={
            t.reducedMotion
              ? ""
              : "pb-6 pt-4 transition-transform duration-[780ms] ease-[cubic-bezier(.22,.7,.2,1)] will-change-transform"
          }
        >
          <div className="mx-auto max-w-[520px] space-y-0">
            {scenario.prompt && (
              <>
                <div ref={mark(scenario.prompt.step)}>
                  <Reveal at={scenario.prompt.step} step={t.step} reduced={t.reducedMotion}>
                    <Card>
                      <div className="flex items-center gap-3.5">
                        <AgentMark />
                        <div className="min-w-0">
                          <Eyebrow>{scenario.prompt.role}</Eyebrow>
                          <div className="mt-1 text-[17px] font-medium leading-tight">{scenario.prompt.name}</div>
                        </div>
                      </div>
                      <div className="mt-3 border-l border-line px-3.5 py-2.5 text-sm leading-relaxed text-paper/80">
                        {scenario.prompt.quote}
                      </div>
                    </Card>
                  </Reveal>
                </div>
                <Connector at={scenario.agent.step} step={t.step} reduced={t.reducedMotion} />
              </>
            )}

            {/* The agent, and the swap at its centre: an unverifiable claim, or an identifier. */}
            <div ref={mark(scenario.agent.step)}>
              <Reveal at={scenario.agent.step} step={t.step} reduced={t.reducedMotion}>
                <Card accent>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Eyebrow>{scenario.agent.role}</Eyebrow>
                    <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-mint">
                      <span className="inline-block h-[5px] w-[5px] rounded-full bg-mint" />
                      Identity proof
                    </span>
                  </div>
                  <div className="mt-3.5 flex items-center gap-3.5">
                    <AgentMark />
                    <div className="min-w-0">
                      <div className="text-[19px] font-semibold leading-tight tracking-tight">
                        {scenario.agent.name}
                      </div>
                      <div className="mt-1 text-[12.5px] text-muted">{scenario.agent.meta}</div>
                    </div>
                  </div>
                  {scenario.agent.quote && (
                    <div className="mt-3.5 border-l border-line px-3.5 py-2.5 text-sm leading-relaxed text-paper/80">
                      {scenario.agent.quote}
                    </div>
                  )}
                  <div className="mt-3.5 grid border-t border-line pt-3.5">
                    <div className="col-start-1 row-start-1">
                      <SwapPanel show={without} reduced={t.reducedMotion}>
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <span className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-amber">
                            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-amber/50 font-mono text-[9px]">
                              ?
                            </span>
                            Unverifiable claim
                          </span>
                          <span className="font-mono text-xs text-muted">no portable identity</span>
                        </div>
                      </SwapPanel>
                    </div>
                    <div className="col-start-1 row-start-1">
                      <SwapPanel show={!without && t.step >= scenario.shape.idStep} reduced={t.reducedMotion}>
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <Eyebrow>AgenID presented</Eyebrow>
                          <span className="break-all font-mono text-[12.5px] text-mint">{EXAMPLE_AGENID}</span>
                        </div>
                      </SwapPanel>
                    </div>
                  </div>
                </Card>
              </Reveal>
            </div>

            <CounterpartyBlock cp={cp} step={t.step} reduced={t.reducedMotion} mark={mark} />

            {/* The verification flow itself. */}
            <Connector at={scenario.flow.rows[0]?.step ?? 0} step={t.step} reduced={t.reducedMotion} />
            <div ref={mark(scenario.flow.rows[0]?.step ?? 0)}>
              <Panel
                title={EXAMPLE_FLOW_LABEL}
                action={
                  <button
                    type="button"
                    onClick={() => setExplain((v) => !v)}
                    aria-expanded={explain}
                    aria-label="What does verified mean here?"
                    className="h-[22px] w-[22px] shrink-0 rounded-full border border-line font-mono text-[10px] text-muted transition hover:border-mint hover:text-mint"
                  >
                    ?
                  </button>
                }
              >
                {without && (
                  <FlowLine
                    first
                    label={scenario.flow.nothingToResolve.label}
                    value={scenario.flow.nothingToResolve.value}
                    tone="declared"
                  />
                )}
                {visibleRows.map((row, i) => (
                  <div key={row.label} ref={mark(row.step)}>
                    <Reveal at={row.step} step={t.step} reduced={t.reducedMotion}>
                      <FlowLine
                        first={i === 0}
                        label={row.label}
                        value={row.value}
                        tone={row.tone}
                        level={row.level}
                        pulse={row.pulse}
                      />
                    </Reveal>
                  </div>
                ))}
                {explain && (
                  <div className="border-t border-mint/25 bg-mint-deep/40 px-4 py-4">
                    <Eyebrow className="!text-mint">What was verified?</Eyebrow>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-paper/80">{WHAT_WAS_VERIFIED}</p>
                    <p className="mt-2.5 font-mono text-[11.5px] leading-relaxed text-muted">
                      {CHALLENGE_IS_PROPOSED}
                    </p>
                  </div>
                )}
              </Panel>
            </div>

            {/* Everything AgenID deliberately does not decide. */}
            <Connector at={scenario.separate.rows[0]?.step ?? 0} step={t.step} reduced={t.reducedMotion} />
            <div ref={mark(scenario.separate.rows[0]?.step ?? 0)}>
              <Panel title={scenario.separate.title}>
                {scenario.separate.rows.map((row, i) => (
                  <div key={row.label}>
                    <Reveal at={without ? 0 : row.step} step={t.step} reduced={t.reducedMotion}>
                      <FlowLine first={i === 0} label={row.label} value={row.value} tone={row.tone} />
                    </Reveal>
                  </div>
                ))}
                <div className="border-t border-line px-4 py-3.5">
                  <p className="font-mono text-[11.5px] leading-relaxed text-muted">{scenario.separate.note}</p>
                </div>
              </Panel>
            </div>

            {/* The outcome, in both worlds. */}
            <Connector at={scenario.outcome.step} step={t.step} reduced={t.reducedMotion} />
            <div ref={mark(scenario.outcome.step)}>
              <OutcomeGate scenario={scenario} step={t.step} without={without} reduced={t.reducedMotion} />
            </div>

            {scenario.closing && !without && (
              <Reveal at={scenario.outcome.step} step={t.step} reduced={t.reducedMotion} className="pt-10">
                <div className="text-center">
                  <p className="text-[25px] font-medium leading-snug tracking-tight text-balance">
                    {scenario.closing.line}
                  </p>
                  <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.26em] text-mint">
                    {scenario.closing.kicker}
                  </div>
                </div>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OutcomeGate({
  scenario,
  step,
  without,
  reduced,
}: {
  scenario: Scenario;
  step: number;
  without: boolean;
  reduced: boolean;
}) {
  const reached = step >= scenario.outcome.step;
  const succeeded = reached && !without;
  return (
    <div
      className={`rounded-2xl border px-5 py-6 text-center transition-[border-color,background-color] duration-[640ms] ${
        succeeded ? "border-mint/45 bg-mint-deep/40" : "border-line bg-paper/[0.012]"
      }`}
    >
      {succeeded ? (
        <div className={reduced ? "" : "transition-opacity duration-[440ms]"}>
          <Eyebrow className="!text-mint">{scenario.outcome.with.title}</Eyebrow>
          <div className="mt-2.5 text-[21px] font-medium leading-snug tracking-tight text-balance">
            {scenario.outcome.with.headline}
          </div>
          <div className="mt-2 text-[13px] leading-relaxed text-muted">{scenario.outcome.with.body}</div>
        </div>
      ) : (
        <div className={reduced ? "" : "transition-opacity duration-[440ms]"}>
          <Eyebrow>{without ? scenario.outcome.without.title : "Awaiting proof"}</Eyebrow>
          <div className="mt-2.5 text-[13px] leading-relaxed text-muted">
            {without ? scenario.outcome.without.body : "Nothing proceeds on an unproven claim"}
          </div>
        </div>
      )}
    </div>
  );
}

function CounterpartyBlock({
  cp,
  step,
  reduced,
  mark,
}: {
  cp: Scenario["counterparty"];
  step: number;
  reduced: boolean;
  mark: (step: number) => (el: HTMLElement | null) => void;
}) {
  if (cp.kind === "single") {
    return (
      <>
        <Connector at={cp.step} step={step} reduced={reduced} />
        <div ref={mark(cp.step)}>
          <Reveal at={cp.step} step={step} reduced={reduced}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <Eyebrow>{cp.role}</Eyebrow>
                  <div className="mt-2 text-[17px] font-medium leading-tight">{cp.name}</div>
                  {cp.meta && <div className="mt-1 text-[12.5px] text-muted">{cp.meta}</div>}
                </div>
                <div className="whitespace-nowrap rounded-md border border-amber/30 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-amber">
                  {cp.challenge}
                </div>
              </div>
            </Card>
          </Reveal>
        </div>
      </>
    );
  }

  if (cp.kind === "grid") {
    return (
      <>
        <Connector at={cp.step} step={step} reduced={reduced} />
        <div ref={mark(cp.step)} className="grid gap-2.5 sm:grid-cols-2">
          {cp.members.map((m) => (
            <Reveal key={m.name} at={cp.step} step={step} reduced={reduced}>
              <div
                className={`h-full rounded-2xl border bg-ink-2 px-4 py-3.5 ${
                  m.chosen && step >= cp.detailStep ? "border-mint/40" : "border-line"
                }`}
              >
                <Eyebrow>{m.role}</Eyebrow>
                <div className="mt-1.5 text-[15px] font-medium leading-tight">{m.name}</div>
                <div className="mt-2 min-h-[14px]">
                  <Reveal at={cp.badgeStep} step={step} reduced={reduced}>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-mint">{m.badge}</div>
                  </Reveal>
                </div>
                <div className="mt-2 min-h-[34px]">
                  <Reveal at={cp.detailStep} step={step} reduced={reduced}>
                    <div className="text-[17px] font-semibold tracking-tight">{m.headline}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted">{m.detail}</div>
                  </Reveal>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {cp.hops.map((hop) => (
        <div key={hop.index}>
          <Connector at={hop.step} step={step} reduced={reduced} />
          <div ref={mark(hop.step)}>
            <Reveal at={hop.step} step={step} reduced={reduced}>
              <div className="overflow-hidden rounded-2xl border border-line bg-ink-2">
                <div className="bg-paper/[0.015] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted">
                  {cp.connector}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Eyebrow>{hop.index}</Eyebrow>
                    <div className="mt-1 text-[15px] font-medium leading-tight">{hop.name}</div>
                  </div>
                  <span className="whitespace-nowrap font-mono text-xs text-muted">{hop.id}</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      ))}
    </>
  );
}

/** Crossfade slot: the two identity states occupy the same grid cell. */
function SwapPanel({ show, reduced, children }: { show: boolean; reduced: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!show}
      className={`${reduced ? "" : "transition-opacity duration-[460ms]"} ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-md border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
        active ? "border-mint/50 bg-mint-deep/50 text-mint" : "border-line text-muted hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-[74px] rounded-md border border-line px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted transition hover:border-mint hover:text-mint"
    >
      {children}
    </button>
  );
}
