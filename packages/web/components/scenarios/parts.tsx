"use client";

/**
 * Shared scenario primitives.
 *
 * COLOUR RULE, enforced by test/scenarios.test.ts: nothing in this directory writes a
 * hex value. Every colour is a Tailwind token defined once in app/globals.css from the
 * Brand & Interface Guide v1.0 — which also means the standalone prototype's palette
 * (`#4FD1A5` mint, `#0A0C0E` ink, `#D9A84F` amber) does not survive the port. Those
 * were close to the brand colours without being them, and "close" is how a product
 * ends up with two greens that both claim to mean verified.
 *
 * TONE RULE: `verified` is the only tone that renders emerald, and it means a third
 * party checked a specific claim. A self-declaration is amber. An in-flight check is
 * amber. There is no red tone in this directory at all — absence of verification is
 * not a negative finding, and a scenario that flashed red mid-handshake would teach
 * exactly the wrong thing about what the colour means.
 */

import type { ReactNode } from "react";
import type { RowTone } from "@/lib/scenarios/types";

export function toneText(tone: RowTone): string {
  switch (tone) {
    case "verified":
      return "text-mint";
    case "declared":
    case "pending":
      return "text-amber";
    default:
      return "text-muted";
  }
}

function toneDot(tone: RowTone): string {
  switch (tone) {
    case "verified":
      return "bg-mint";
    case "declared":
    case "pending":
      return "bg-amber";
    default:
      return "bg-muted";
  }
}

/** A block that fades and lifts into place once the timeline reaches `at`. */
export function Reveal({
  at,
  step,
  reduced,
  children,
  className = "",
}: {
  at: number;
  step: number;
  reduced: boolean;
  children: ReactNode;
  className?: string;
}) {
  const on = at <= 0 || step >= at;
  if (reduced) {
    return <div className={`${className} ${on ? "opacity-100" : "opacity-30"}`}>{children}</div>;
  }
  return (
    <div
      className={`${className} transition-[opacity,transform] duration-[560ms] ease-[cubic-bezier(.22,.7,.2,1)] ${
        on ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-10"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * The vertical rule between cards, filling downward as the step lands.
 *
 * The fill is a height percentage rather than a colour change, so it carries motion
 * without carrying a trust signal — a connector is plumbing, not a verdict.
 */
export function Connector({ at, step, reduced }: { at: number; step: number; reduced: boolean }) {
  const on = step >= at;
  return (
    <div className="relative mx-auto h-8 w-px bg-line" aria-hidden="true">
      <div
        className={`absolute left-0 top-0 w-px bg-gradient-to-b from-mint/20 to-mint ${
          reduced ? "" : "transition-[height] duration-[640ms] ease-[cubic-bezier(.22,.7,.2,1)]"
        }`}
        style={{ height: on ? "100%" : "0%" }}
      />
    </div>
  );
}

/** Small uppercase mono label — the eyebrow used throughout the set. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-[9px] uppercase tracking-[0.2em] text-muted ${className}`}>{children}</div>
  );
}

/**
 * A spec level name, shown beside the claim it belongs to.
 *
 * Rendered in muted grey deliberately, never in the row's tone: the chip names WHICH
 * level is being illustrated, and colouring it like a verdict would make the label
 * itself read as an outcome. The verdict is the value on the right.
 */
export function LevelChip({ level }: { level: string }) {
  return (
    <span className="ml-2 inline-block rounded border border-line px-1.5 py-[3px] font-mono text-[8.5px] tracking-[0.08em] text-muted">
      {level}
    </span>
  );
}

export function FlowLine({
  label,
  value,
  tone,
  level,
  pulse,
  first,
}: {
  label: string;
  value: string;
  tone: RowTone;
  level?: string;
  pulse?: boolean;
  first?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
        first ? "" : "border-t border-line"
      }`}
    >
      <span className="flex min-w-0 flex-wrap items-center text-[13.5px] leading-snug text-paper/80">
        {label}
        {level ? <LevelChip level={level} /> : null}
      </span>
      <span
        className={`flex items-center gap-2 whitespace-nowrap font-mono text-[11.5px] tracking-[0.09em] ${toneText(tone)}`}
      >
        {pulse ? <span className={`scenario-pulse h-[5px] w-[5px] shrink-0 rounded-full ${toneDot(tone)}`} /> : null}
        {value}
      </span>
    </div>
  );
}

/** The bordered panel that holds a run of flow lines. */
export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-ink-2">
      <div className="flex items-center justify-between gap-3 bg-paper/[0.015] px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A card: the agent, the counterparty, the human who delegated. */
export function Card({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-ink-2 px-5 py-4 ${accent ? "border-mint/25" : "border-line"}`}>
      {children}
    </div>
  );
}

/** The hatched square standing in for an agent's avatar. Decorative, never an identity. */
export function AgentMark() {
  return (
    <div
      aria-hidden="true"
      className="h-[34px] w-[34px] shrink-0 rounded-[9px] border border-line bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.07)_0_2px,transparent_2px_5px)]"
    />
  );
}
