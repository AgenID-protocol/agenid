"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's animated visual explanation — "Unknown Agent -> Identity ->
 * Portable -> Declared vs Verified -> Agent-to-Agent Trust".
 *
 * Deliberately NOT scroll-jacked: scroll-hijacking hero animations hurt
 * accessibility, Core Web Vitals, and mobile usability, and the sprint's own
 * UX requirements (never block page interaction, no layout shift, keyboard
 * navigable) argue against it. Instead this is an interaction-driven stepper
 * — autoplaying on a timer, pausable, and fully operable with the prev/next
 * buttons or the step dots. All step copy is real DOM text (not baked into
 * an image or canvas), so it's readable, selectable, and screen-reader
 * accessible without a separate hidden transcript.
 *
 * Reduced motion: no autoplay, no transition animation — steps still change
 * on click, instantly. The concept is fully understandable with animation
 * fully disabled per the accessibility requirement.
 */

type Chip = { label: string; tone?: "mint" | "muted" };

type Step = {
  eyebrow: string;
  headline: string;
  sub: string;
  render: () => React.ReactNode;
};

function AgentBubble({ small = false }: { small?: boolean }) {
  return (
    <div className={`card flex flex-col items-center justify-center gap-1.5 border-line bg-ink-3/60 px-6 py-5 text-center ${small ? "w-40" : "w-56"}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">AI Agent</span>
      <span className="text-sm text-paper">&ldquo;Hi, I&rsquo;m Sarah.&rdquo;</span>
    </div>
  );
}

function ChipRow({ chips }: { chips: Chip[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {chips.map((c) => (
        <span key={c.label} className={`pill !py-1 !text-[11px] ${c.tone === "mint" ? "pill-ok" : ""}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

const STEPS: Step[] = [
  {
    eyebrow: "SCENE 1 · UNKNOWN AGENT",
    headline: "Who are you?",
    sub: "An AI agent shows up. Nothing about it says who operates it, or whether it's the same agent tomorrow.",
    render: () => (
      <div className="flex flex-col items-center gap-5">
        <AgentBubble />
        <ChipRow
          chips={[
            { label: "Who is this agent?" },
            { label: "Who operates it?" },
            { label: "Is this the same agent tomorrow?" },
          ]}
        />
      </div>
    ),
  },
  {
    eyebrow: "SCENE 2 · IDENTITY, ASSIGNED",
    headline: "One agent. One persistent identity.",
    sub: "AgenID anchors a permanent agenid:<ULID> to the agent. The environment changes underneath it — the identity doesn't.",
    render: () => (
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] text-muted">
          <span className="pill">Website</span>
          <span aria-hidden>→</span>
          <span className="pill">Phone</span>
          <span aria-hidden>→</span>
          <span className="pill">CRM</span>
          <span aria-hidden>→</span>
          <span className="pill">Platform</span>
          <span aria-hidden>→</span>
          <span className="pill">API</span>
        </div>
        <div className="card border-mint/40 bg-mint-deep/40 px-5 py-3 font-mono text-sm text-mint">agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y</div>
      </div>
    ),
  },
  {
    eyebrow: "SCENE 3 · IDENTITY EXPANDS",
    headline: "One identifier. Five things it actually carries.",
    sub: "Identity, operator, declarations, verification, and deployment — disclosed progressively, not all at once.",
    render: () => (
      <div className="grid w-full max-w-md grid-cols-1 gap-1.5 sm:grid-cols-2">
        {[
          ["Identity", "Permanent identifier"],
          ["Operator", "Accountable organization"],
          ["Declarations", "What the operator says"],
          ["Verification", "What's actually been checked"],
          ["Deployment", "Where the agent is running"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-start gap-2 rounded-lg border border-line bg-ink-3/50 px-3 py-2 text-left text-xs">
            <span className="mt-0.5 text-mint" aria-hidden>✓</span>
            <span>
              <span className="font-semibold text-paper">{k}</span>
              <span className="block text-muted">{v}</span>
            </span>
          </div>
        ))}
      </div>
    ),
  },
  {
    eyebrow: "SCENE 4 · DECLARED ≠ VERIFIED",
    headline: "What's claimed is not what's proven.",
    sub: "DECLARED ≠ VERIFIED. VERIFIED ≠ AUTHORIZED. AgenID keeps these three claim states explicitly separate — enforced by key role, never inferred.",
    render: () => (
      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="pill">DECLARED</span>
          <span aria-hidden className="text-muted">→</span>
          <span className="pill">Evidence</span>
          <span aria-hidden className="text-muted">→</span>
          <span className="pill">Independent review</span>
          <span aria-hidden className="text-muted">→</span>
          <span className="pill pill-ok">VERIFIED</span>
        </div>
        <div className="font-mono text-[11px] text-muted">DECLARED ≠ VERIFIED &nbsp;·&nbsp; VERIFIED ≠ AUTHORIZED</div>
      </div>
    ),
  },
  {
    eyebrow: "SCENE 5 · AGENT-TO-AGENT",
    headline: "Machines need to verify machines.",
    sub: "As agents interact with people, systems, APIs, and each other, identity becomes part of the infrastructure — not an afterthought.",
    render: () => (
      <div className="flex w-full max-w-lg items-center justify-between gap-3">
        <AgentBubble small />
        <div className="flex flex-1 flex-col items-center gap-1.5 px-2">
          <span className="font-mono text-[10px] text-muted">&ldquo;Who are you?&rdquo;</span>
          <div className="h-px w-full bg-line" aria-hidden />
          <span className="pill !py-1 !text-[10px]">AGENID</span>
          <div className="h-px w-full bg-line" aria-hidden />
          <span className="font-mono text-[10px] text-mint">✓ Identity · Operator · Verification</span>
        </div>
        <AgentBubble small />
      </div>
    ),
  },
];

export function IdentityStory() {
  const [step, setStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion || paused) return;
    const id = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 4200);
    return () => clearInterval(id);
  }, [reduceMotion, paused]);

  const current = STEPS[step];

  return (
    <div
      ref={rootRef}
      className="mx-auto mt-10 max-w-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="card relative flex min-h-[300px] flex-col items-center justify-center gap-5 overflow-hidden px-6 py-10 text-center sm:min-h-[280px]"
        role="group"
        aria-roledescription="carousel"
        aria-label="How AgenID gives an AI agent a verifiable identity"
      >
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
        <div key={step} className={reduceMotion ? "" : "animate-[storyfade_0.5s_ease]"}>
          <div className="font-mono text-[11px] text-mint">{current.eyebrow}</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{current.headline}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">{current.sub}</p>
          <div className="mt-6 flex items-center justify-center">{current.render()}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => (s - 1 + STEPS.length) % STEPS.length)}
          className="rounded-md border border-line p-1.5 text-muted transition hover:text-paper"
          aria-label="Previous scene"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="flex gap-1.5" role="tablist" aria-label="Story scenes">
          {STEPS.map((s, i) => (
            <button
              key={s.eyebrow}
              role="tab"
              aria-selected={i === step}
              aria-label={`Scene ${i + 1} of ${STEPS.length}: ${s.headline}`}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-mint" : "w-1.5 bg-line hover:bg-muted"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep((s) => (s + 1) % STEPS.length)}
          className="rounded-md border border-line p-1.5 text-muted transition hover:text-paper"
          aria-label="Next scene"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
