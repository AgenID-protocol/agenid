"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
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
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
        <span className="ml-3 font-mono text-[11px] text-muted">agenid — zsh</span>
      </div>
      <pre className="min-h-[220px] overflow-x-auto p-4 font-mono text-[12.5px] leading-relaxed text-paper/90" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className={l.t === "cmd" ? "text-paper" : "text-muted"}>
            {l.t === "cmd" ? <span className="text-mint">$ </span> : "  "}
            {l.s}
          </div>
        ))}
        <div>
          <span className="text-mint">$ </span>
          {typing}
          <span className="caret">▍</span>
        </div>
      </pre>
    </div>
  );
}
