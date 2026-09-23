"use client";

import { useEffect, useRef, useState } from "react";

type Step = { cmd: string; out: string[] };

/**
 * Every line below is something a reader can actually run, and every output is what the
 * live system actually returns.
 *
 * It used to open with `npm install @agenid/core` → "added 1 package in 0.8s", and close
 * by resolving the specification's example identifier to `"level": "L2_DOMAIN_VERIFIED"`
 * with one valid assertion. Neither was true. Nothing in this project is published to
 * npm — @agenid/core, @agenid/cli and @agenid/mcp-server all 404 on the registry — and
 * L2 cannot be issued by anyone, because it is a VerificationAssertion signed by a root
 * authority key that does not exist yet. The homepage was demonstrating a level the
 * product cannot issue, in a panel that looks like a real terminal session, three
 * sections below a paragraph explaining that the same example identifier is unregistered.
 *
 * A demo is a claim. This one now shows the fail-safe path, which is the more honest
 * argument anyway: an unregistered identifier returns a clean not-found rather than a
 * fabricated result.
 */
const STEPS: Step[] = [
  {
    cmd: "curl -s https://agenid.com/a/<your-agenid> -H 'Accept: application/json' | jq .verification",
    out: ["{", '  "level": "L1_REGISTERED",', '  "valid_assertions": 0,', '  "total_assertions": 0', "}"],
  },
  {
    cmd: "curl -s https://agenid.com/a/agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y -H 'Accept: application/json' | jq .error",
    out: ['"agent_not_found"', ""],
  },
];

/** Typed-out demo of the developer flow. Purely presentational; no network. */
export function Terminal() {
  const [lines, setLines] = useState<{ t: "cmd" | "out"; s: string }[]>([]);
  const [typing, setTyping] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Types once, the first time the panel is on screen — not on page load, where it used to
  // finish before anyone scrolled to it. No observer support: start immediately.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setStarted(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    (async () => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
      for (const step of STEPS) {
        for (let i = 1; i <= step.cmd.length; i++) {
          if (cancelled) return;
          setTyping(step.cmd.slice(0, i));
          await sleep(18);
        }
        await sleep(250);
        setLines((l) => [...l, { t: "cmd", s: step.cmd }]);
        setTyping("");
        for (const o of step.out) {
          if (cancelled) return;
          setLines((l) => [...l, { t: "out", s: o }]);
          await sleep(60);
        }
        await sleep(500);
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [started]);

  return (
    <div ref={rootRef} className="card overflow-hidden">
      {/* Window chrome in neutral. The usual red/amber/green traffic lights put two trust
          colours and a banned one on a panel that carries no trust state. */}
      <div className="flex items-center gap-2 border-b border-line px-4 py-3" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="ml-3 font-mono text-xs text-muted">agenid — zsh</span>
      </div>
      {/*
        FOUND BY A RENDERED-BROWSER PASS, NOT BY A TEST. The demo's commands used to be
        short (`npm install @agenid/core`), so nothing ever reached the panel's right
        edge. The honest replacements are real curl invocations and they do: with
        `overflow-x-auto` alone the command typed itself off the edge of the card and
        parked a horizontal scrollbar under it, so a reader saw a clipped command and
        never reached the output — which is the part that carries the argument. Wrapping
        is the fix, not shorter commands: a command trimmed to fit this card at this
        breakpoint is one viewport away from clipping again.
      */}
      <pre className="min-h-[220px] overflow-x-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-paper-dim" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={l.t === "cmd" ? "text-paper" : "text-muted"}>
            {l.t === "cmd" ? <span className="text-muted">$ </span> : "  "}
            {l.s}
          </div>
        ))}
        <div>
          <span className="text-muted">$ </span>
          {typing}
          {!done && <span className="caret">▍</span>}
        </div>
      </pre>
    </div>
  );
}
