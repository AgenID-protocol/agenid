"use client";

import Link from "next/link";
import { useState } from "react";

export type HubNode = {
  id: string;
  name: string;
  abbr: string;
  category: string;
  categoryLabel: string;
  statusLabel: string;
  integration_type: string;
  compatibility_note: string;
  docs?: string;
};

const VB_W = 680;
const VB_H = 440;
const CX = VB_W / 2;
const CY = VB_H / 2;
const R = 158;

/**
 * The orchestration network: AgenID at the hub, platforms on one ring around it.
 *
 * Deterministic geometry (angle is a pure function of index and count) so the server
 * and client render byte-identical markup — no randomness, no layout measurement, no
 * hydration mismatch. Every node is a real focusable control, so the network is
 * navigable by keyboard and not just by pointer; the detail panel below the diagram
 * is the single output target for both hover and focus, which also means the same
 * component works on touch where there is no hover at all.
 *
 * Below `md` the ring is replaced by a per-category horizontal strip — a ring of 13
 * nodes is unreadable at 380px, and shrinking it would make the labels illegible
 * rather than merely small.
 */
export function EcosystemHub({ nodes }: { nodes: HubNode[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = nodes.find((n) => n.id === activeId) ?? null;

  const placed = nodes.map((n, i) => {
    const angle = (-90 + (360 / nodes.length) * i) * (Math.PI / 180);
    return { ...n, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  });

  const categories = Array.from(new Set(nodes.map((n) => n.categoryLabel)));

  return (
    <div>
      {/* ---------- ring (md and up) ---------- */}
      <div className="hidden md:block">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="mx-auto w-full max-w-3xl"
          role="group"
          aria-label="Platforms AgenID identity can be carried through"
        >
          {placed.map((n) => (
            <line
              key={`l-${n.id}`}
              x1={CX}
              y1={CY}
              x2={n.x}
              y2={n.y}
              className={activeId === n.id ? "stroke-muted" : "stroke-line"}
              strokeWidth={1}
            />
          ))}

          {/* hub */}
          <rect x={CX - 76} y={CY - 30} width={152} height={60} rx={14} className="fill-ink-2 stroke-line" strokeWidth={1} />
          <text x={CX} y={CY - 4} textAnchor="middle" className="fill-paper font-mono text-[15px] font-semibold tracking-[0.14em]">
            AGENID
          </text>
          <text x={CX} y={CY + 16} textAnchor="middle" className="fill-muted font-mono text-[10px]">
            identity layer
          </text>

          {placed.map((n) => {
            const on = activeId === n.id;
            return (
              <g
                key={n.id}
                tabIndex={0}
                role="button"
                aria-label={`${n.name} — ${n.categoryLabel}, ${n.statusLabel}`}
                className="cursor-pointer outline-none"
                onMouseEnter={() => setActiveId(n.id)}
                onMouseLeave={() => setActiveId((cur) => (cur === n.id ? null : cur))}
                onFocus={() => setActiveId(n.id)}
                onBlur={() => setActiveId((cur) => (cur === n.id ? null : cur))}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={26}
                  className={`${on ? "fill-ink-3 stroke-paper" : "fill-ink-2 stroke-line"} transition-colors`}
                  strokeWidth={1}
                />
                <text
                  x={n.x}
                  y={n.y + 4}
                  textAnchor="middle"
                  className={`${on ? "fill-paper" : "fill-muted"} pointer-events-none font-mono text-[12px] font-semibold transition-colors`}
                >
                  {n.abbr}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mx-auto mt-2 flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          {categories.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      </div>

      {/* ---------- category strip (below md) ---------- */}
      <div className="md:hidden">
        <div className="card mb-4 px-4 py-3 text-center">
          <div className="font-mono text-[13px] font-semibold tracking-[0.14em] text-paper">AGENID</div>
          <div className="font-mono text-[10px] text-muted">identity layer</div>
        </div>
        {categories.map((c) => (
          <div key={c} className="mb-4">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">{c}</div>
            <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
              {nodes
                .filter((n) => n.categoryLabel === c)
                .map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setActiveId((cur) => (cur === n.id ? null : n.id))}
                    aria-pressed={activeId === n.id}
                    className={`snap-start whitespace-nowrap rounded-lg border px-3 py-2 text-xs transition ${
                      activeId === n.id ? "border-muted text-paper" : "border-line text-muted"
                    }`}
                  >
                    <span className="font-mono">{n.abbr}</span> · {n.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- shared detail panel ---------- */}
      <div className="card mx-auto mt-6 max-w-3xl p-5" aria-live="polite">
        {active ? (
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold">{active.name}</h3>
              <span className="pill !py-0.5 !text-[10px]">{active.statusLabel}</span>
            </div>
            <div className="mt-1 font-mono text-[11px] text-muted">
              {active.categoryLabel} · {active.integration_type}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{active.compatibility_note}</p>
            {active.docs && (
              <Link href={active.docs} className="mt-3 inline-block text-sm text-paper underline underline-offset-2 hover:no-underline">
                Integration brief →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Hover, focus, or tap a platform to see exactly what &ldquo;compatible&rdquo; means for it. Every listing here is a
            technical statement about how an <span className="font-mono">agenid:&lt;ULID&gt;</span> travels through that
            platform&rsquo;s existing API surface — never an endorsement, partnership, or shipped adapter.
          </p>
        )}
      </div>
    </div>
  );
}
