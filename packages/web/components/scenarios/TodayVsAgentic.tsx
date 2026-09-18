"use client";

/**
 * The one scenario that is not a handshake.
 *
 * Today's internet puts a person on one end of every transaction. The agentic one puts
 * an agent there — often on both ends — and that is a structural change, not a faster
 * version of the same thing. So this renders as a side-by-side comparison rather than a
 * sequence, and it gets its own component instead of a variant flag on ScenarioPlayer
 * that nothing else would ever set.
 *
 * It keeps the two-mode control for the same reason every other scenario has one: in
 * `without` mode it plays to the question and stops there, which is exactly the state
 * of the world it is describing.
 *
 * No camera here. A comparison is read by looking at both halves at once, so the
 * columns stay in view and the reveals happen in place.
 */

import type { TimelineShape } from "@/lib/scenarios/timeline";
import { labelAt } from "@/lib/scenarios/timeline";
import { EXAMPLE_AGENID } from "@/lib/scenarios/types";
import { useScenarioTimeline } from "./useScenarioTimeline";
import { Eyebrow, Reveal, toneText } from "./parts";
import type { RowTone } from "@/lib/scenarios/types";

const SHAPE: TimelineShape = { steps: 9, beforeSteps: 8, idStep: 9 };

const LABELS = [
  "Ready",
  "A person",
  "An interface",
  "A transaction",
  "A person",
  "A personal agent",
  "A business agent",
  "A transaction",
  "Who identifies the agents?",
  "AgenID",
];

type Node = { role: string; name: string; meta?: string; step: number };

const TODAY: Node[] = [
  { role: "Human", name: "A person", meta: "Types, taps, waits", step: 1 },
  { role: "Interface", name: "A website or an app", meta: "Identity handled by a login", step: 2 },
  { role: "Transaction", name: "Transaction", step: 3 },
];

const AGENTIC: Node[] = [
  { role: "Human", name: "A person", meta: "Says what they want, once", step: 4 },
  { role: "Personal agent", name: "Acts on their behalf", meta: "Calls, negotiates, books", step: 5 },
  { role: "Business agent", name: "Answers for the business", meta: "No human in the loop", step: 6 },
  { role: "Transaction", name: "Transaction", step: 7 },
];

const ANSWER_ROWS: { label: string; value: string; tone: RowTone }[] = [
  { label: "A persistent identity", value: "PORTABLE", tone: "neutral" },
  // DECLARED is a self-declaration and sits below L1, so it renders amber here exactly
  // as it does on /issue, in both badges and on the Verification Card.
  { label: "An accountable operator", value: "DECLARED", tone: "declared" },
  { label: "Specific claims, independently checked", value: "VERIFIED", tone: "verified" },
];

export function TodayVsAgentic() {
  const t = useScenarioTimeline(SHAPE, 1);
  const without = t.mode === "without";

  return (
    <div ref={t.containerRef}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2" role="group" aria-label="Comparison mode">
          <Mode active={without} onClick={() => t.setMode("without")}>
            Stop at the question
          </Mode>
          <Mode active={!without} onClick={() => t.setMode("with")}>
            With AgenID
          </Mode>
        </div>
        {!t.reducedMotion && (
          <div className="flex gap-2">
            <Small onClick={t.toggle}>{t.playing ? "Pause" : "Play"}</Small>
            <Small onClick={t.replay}>Replay</Small>
          </div>
        )}
      </div>

      <div className="relative mt-4 h-px bg-line">
        <div
          className="absolute left-0 top-0 h-px bg-mint transition-[width] duration-[1100ms] ease-linear"
          style={{ width: `${Math.round(t.progress * 100)}%` }}
        />
      </div>
      <div
        aria-live="polite"
        className="mt-3 min-h-[14px] font-mono text-[10px] uppercase tracking-[0.22em] text-muted"
      >
        {labelAt(LABELS, t.step)}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Column
          title="Today"
          nodes={TODAY}
          step={t.step}
          reduced={t.reducedMotion}
          note="One human, one account, one session. The question of who is acting never comes up."
        />
        <Column
          title="The agentic internet"
          nodes={AGENTIC}
          step={t.step}
          reduced={t.reducedMotion}
          note="Two agents, no shared account, no session, no face. Each one is a claim until something checks it."
        />
      </div>

      <Reveal at={8} step={t.step} reduced={t.reducedMotion} className="mt-6">
        <div className="rounded-2xl border border-line bg-ink-2 px-6 py-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-amber/40 font-mono text-base text-amber">
            ?
          </div>
          <p className="mt-4 text-[27px] font-medium leading-snug tracking-tight text-balance">
            Who identifies the agents?
          </p>
          <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-muted text-pretty">
            Not the platform they happen to be on. Not the sentence they say about themselves.
          </p>
        </div>
      </Reveal>

      {!without && (
        <Reveal at={9} step={t.step} reduced={t.reducedMotion} className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-mint/25 bg-ink-2">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-paper/[0.015] px-5 py-3.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mint">AgenID</span>
              <span className="break-all font-mono text-[12.5px] text-mint">{EXAMPLE_AGENID}</span>
            </div>
            {ANSWER_ROWS.map((r, i) => (
              <div
                key={r.label}
                className={`flex flex-wrap items-center justify-between gap-3 px-5 py-3 ${
                  i === 0 ? "" : "border-t border-line"
                }`}
              >
                <span className="text-[13.5px] leading-snug text-paper/80">{r.label}</span>
                <span className={`whitespace-nowrap font-mono text-[11.5px] tracking-[0.09em] ${toneText(r.tone)}`}>
                  {r.value}
                </span>
              </div>
            ))}
            <div className="border-t border-line px-5 py-4">
              <p className="font-mono text-[11.5px] leading-relaxed text-muted text-pretty">
                Checkable by a person, a program, an auditor, or another agent — without trusting AgenID&rsquo;s own
                database.
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-[25px] font-medium leading-snug tracking-tight text-balance">
              Before you trust an AI agent, resolve its AgenID.
            </p>
            <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.26em] text-mint">
              Trust the proof. Not the platform.
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}

/** What this scenario establishes, and what it does not. Rendered by the page beneath the player. */
export const TODAY_VS_PROVES =
  "That an agent controls the identity it presented, and which specific claims about it an independent authority has verified. It does not make the agent safe, legitimate, or permitted — those are separate judgements for whoever is on the other side.";

function Column({
  title,
  nodes,
  step,
  reduced,
  note,
}: {
  title: string;
  nodes: Node[];
  step: number;
  reduced: boolean;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-ink-2 px-5 py-5">
      <Eyebrow>{title}</Eyebrow>
      <div className="mt-4">
        {nodes.map((n, i) => (
          <div key={n.role + n.name}>
            {i > 0 && (
              <div className="relative mx-auto h-7 w-px bg-line" aria-hidden="true">
                <div
                  className={`absolute left-0 top-0 w-px bg-gradient-to-b from-mint/20 to-mint ${
                    reduced ? "" : "transition-[height] duration-[640ms] ease-[cubic-bezier(.22,.7,.2,1)]"
                  }`}
                  style={{ height: step >= n.step ? "100%" : "0%" }}
                />
              </div>
            )}
            <Reveal at={n.step} step={step} reduced={reduced}>
              <div className="rounded-xl border border-line bg-ink-3 px-4 py-3">
                <Eyebrow>{n.role}</Eyebrow>
                <div className="mt-1 text-[15px] font-medium leading-tight">{n.name}</div>
                {n.meta && <div className="mt-1 text-[12px] text-muted">{n.meta}</div>}
              </div>
            </Reveal>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted text-pretty">{note}</p>
    </div>
  );
}

function Mode({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function Small({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
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
