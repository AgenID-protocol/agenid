"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The ecosystem cloud: AgenID at the centre, the platforms it composes with clustered
 * around it by what kind of thing they are.
 *
 * WHY CLUSTERED AND NOT A RING. The first version spaced every platform evenly around
 * one circle, which quietly said they were interchangeable neighbours of AgenID. They
 * are not: a model vendor, a telephony rail and a payments API occupy different places
 * in the same sentence — technology, then identity, then an action someone is
 * accountable for. The clustering is the argument, so the geometry carries it.
 *
 * WHAT THIS COMPONENT IS NOT ALLOWED TO DO. It renders status; it never decides status.
 * Every label, definition and relationship on screen is read from the registry through
 * props — there is no string in this file that asserts a platform is integrated,
 * verified, supported, certified or partnered. test/ecosystem-cloud.test.ts enforces
 * that by scanning this source, because a logo cloud is exactly the surface where a
 * confident adjective gets added later "for balance".
 *
 * Geometry is a pure function of the cluster list: no randomness, no measurement, no
 * layout effects, so the server and client render byte-identical markup.
 */

export type CloudNode = {
  id: string;
  name: string;
  abbr: string;
  /** Registry status id. Drives the indicator class through STATUS_DOT below. */
  status: string;
  statusLabel: string;
  statusDefinition: string;
  relationshipLabel: string;
  relationshipDefinition: string;
  integration_type: string;
  compatibility_note: string;
  capabilities: string[];
  docs?: string;
};

export type CloudCluster = {
  id: string;
  label: string;
  blurb: string;
  nodes: CloudNode[];
};

const VB_W = 840;
const VB_H = 620;
const CX = VB_W / 2;
const CY = VB_H / 2;
const R = 190;
/**
 * Labels sit 46px clear of the node edge (R + NODE_R = 216). An earlier pass put them
 * at 243 — 31px of clearance — and a browser check showed "FRAMEWORKS" printed straight
 * through the node beside it. A label that collides with the thing it names is worse
 * than no label, so the clearance is generous and the viewBox grew to hold it.
 */
const LABEL_R = 262;
const NODE_R = 26;
/** Degrees of empty arc between clusters — what makes a cluster read as a cluster. */
const CLUSTER_GAP = 12;

/**
 * Status indicator classes, keyed by registry status id.
 *
 * Every entry is `compatible` today, so in practice every dot is muted. That is the
 * correct outcome and not a reason to drop the indicator: the mapping is what stops a
 * future `verified-integration` entry from rendering identically to a compatible one,
 * and emerald is wired here and nowhere else so it can only ever appear on a status
 * that has actually been executed end to end. An unknown status falls through to muted —
 * a status this component has not been taught about must never render as the strongest
 * signal available.
 */
const STATUS_DOT: Record<string, string> = {
  planned: "border border-muted/50",
  compatible: "bg-muted/60",
  "verified-integration": "bg-mint",
  "official-partner": "bg-mint",
};
const statusDot = (status: string) => STATUS_DOT[status] ?? "bg-muted/60";
const isStrong = (status: string) => statusDot(status).includes("bg-mint");

/** Angular layout. Sector width is proportional to node count, so clusters read evenly. */
function layout(clusters: CloudCluster[]) {
  const total = clusters.reduce((n, c) => n + c.nodes.length, 0);
  const available = 360 - clusters.length * CLUSTER_GAP;
  const perNode = total > 0 ? available / total : 0;

  // Centre the FIRST cluster on twelve o'clock rather than starting its arc there.
  // Starting at -90 put the first cluster's leading edge at the top, which pushed the
  // whole arrangement clockwise and left the top of the diagram empty.
  const firstSpan = (clusters[0]?.nodes.length ?? 0) * perNode;
  let cursor = -90 - firstSpan / 2;

  return clusters.map((cluster) => {
    const span = cluster.nodes.length * perNode;
    const start = cursor;
    const placed = cluster.nodes.map((n, i) => {
      // Centre each node inside its own slice rather than at the slice edge, so a
      // one-node cluster sits on its label instead of beside it.
      const deg = start + perNode * (i + 0.5);
      const rad = (deg * Math.PI) / 180;
      return { ...n, x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
    });
    const midRad = ((start + span / 2) * Math.PI) / 180;
    cursor = start + span + CLUSTER_GAP;
    return {
      ...cluster,
      nodes: placed,
      lx: CX + LABEL_R * Math.cos(midRad),
      ly: CY + LABEL_R * Math.sin(midRad),
    };
  });
}

export function EcosystemHub({ clusters }: { clusters: CloudCluster[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  // Start the node entrance when the hub is first on screen (see `.cloud-host` in
  // globals.css). Without observer support, reveal immediately.
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.revealed = "";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.revealed = "";
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const placed = useMemo(() => layout(clusters), [clusters]);
  const all = useMemo(() => clusters.flatMap((c) => c.nodes), [clusters]);
  const active = all.find((n) => n.id === activeId) ?? null;
  const activeCluster = clusters.find((c) => c.nodes.some((n) => n.id === activeId)) ?? null;

  let order = 0; // stable entrance order, cluster by cluster

  return (
    <div ref={hostRef} className="cloud-host">
      {/* ---------- clustered cloud (md and up) ---------- */}
      <div className="hidden md:block">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="mx-auto w-full max-w-3xl"
          role="group"
          aria-label="Platforms an AgenID identity can be carried through, grouped by layer"
        >
          {placed.map((cluster) =>
            cluster.nodes.map((n) => (
              <line
                key={`l-${n.id}`}
                x1={CX}
                y1={CY}
                x2={n.x}
                y2={n.y}
                className={activeId === n.id ? "stroke-muted" : "stroke-line"}
                strokeWidth={1}
              />
            )),
          )}

          {/*
            The centre is deliberately not a node. A rounded rectangle among circles,
            wider than anything else, with its own caption — AgenID is the layer the
            others pass through, and if it rendered as one more logo in the collection
            the graphic would argue the opposite of what it says.
          */}
          <rect
            x={CX - 92}
            y={CY - 38}
            width={184}
            height={76}
            rx={16}
            className="fill-ink-2 stroke-mint/40"
            strokeWidth={1}
          />
          <text
            x={CX}
            y={CY - 8}
            textAnchor="middle"
            className="fill-paper font-mono text-base font-semibold tracking-[0.16em]"
          >
            AGENID
          </text>
          <text x={CX} y={CY + 12} textAnchor="middle" className="fill-muted font-mono text-xs tracking-[0.08em]">
            identity · provenance
          </text>
          <text x={CX} y={CY + 27} textAnchor="middle" className="fill-muted font-mono text-xs tracking-[0.08em]">
            verification layer
          </text>

          {placed.map((cluster) => {
            // "Enterprise Identity" set on one line at this tracking is wider than the
            // gap between its neighbours' nodes. Wrapping at the first space keeps every
            // label inside its own sector instead of reaching into the next one.
            const words = cluster.label.split(" ");
            const lines = words.length > 1 && cluster.label.length > 12 ? words : [cluster.label];
            return (
              <text
                key={`c-${cluster.id}`}
                x={cluster.lx}
                y={cluster.ly - (lines.length - 1) * 6}
                textAnchor="middle"
                className="fill-muted font-mono text-xs uppercase tracking-[0.2em]"
              >
                {lines.map((line, i) => (
                  <tspan key={line} x={cluster.lx} dy={i === 0 ? 0 : 13}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}

          {placed.map((cluster) =>
            cluster.nodes.map((n) => {
              const on = activeId === n.id;
              const delay = `${order++ * 45}ms`;
              return (
                <g
                  key={n.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.name} — ${cluster.label}, ${n.statusLabel}`}
                  className="cloud-node cursor-pointer outline-none"
                  style={{ animationDelay: delay }}
                  onMouseEnter={() => setActiveId(n.id)}
                  onMouseLeave={() => setActiveId((cur) => (cur === n.id ? null : cur))}
                  onFocus={() => setActiveId(n.id)}
                  onBlur={() => setActiveId((cur) => (cur === n.id ? null : cur))}
                >
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={NODE_R}
                    className={`${on ? "fill-ink-3 stroke-paper" : "fill-ink-2 stroke-line"} transition-colors`}
                    strokeWidth={1}
                  />
                  <text
                    x={n.x}
                    y={n.y + 4}
                    textAnchor="middle"
                    className={`${on ? "fill-paper" : "fill-muted"} pointer-events-none font-mono text-xs font-semibold transition-colors`}
                  >
                    {n.abbr}
                  </text>
                  {/* Status indicator. The class comes from the registry status, never from here. */}
                  <circle
                    cx={n.x + NODE_R - 7}
                    cy={n.y - NODE_R + 7}
                    r={3}
                    className={`pointer-events-none ${isStrong(n.status) ? "fill-mint" : "fill-muted"}`}
                    opacity={0.75}
                  />
                </g>
              );
            }),
          )}
        </svg>
      </div>

      {/* ---------- category strips (below md) ---------- */}
      <div className="md:hidden">
        <div className="card mb-5 px-4 py-4 text-center">
          <div className="font-mono text-sm font-semibold tracking-[0.16em] text-paper">AGENID</div>
          <div className="mt-1 font-mono text-xs text-muted">identity · provenance · verification layer</div>
        </div>
        {clusters.map((cluster) => (
          <div key={cluster.id} className="mb-5">
            <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted">{cluster.label}</div>
            <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1">
              {cluster.nodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setActiveId((cur) => (cur === n.id ? null : n.id))}
                  aria-pressed={activeId === n.id}
                  aria-label={`${n.name} — ${cluster.label}, ${n.statusLabel}`}
                  className={`flex snap-start items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-3 text-xs transition ${
                    activeId === n.id ? "border-muted text-paper" : "border-line text-muted"
                  }`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDot(n.status)}`} />
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
              <span className="pill !py-1 !text-xs">{active.statusLabel}</span>
            </div>
            <div className="mt-1 font-mono text-xs text-muted">
              {activeCluster?.label} · {active.integration_type}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted">{active.compatibility_note}</p>

            <div className="mt-4">
              <div className="font-mono text-xs uppercase tracking-wider text-muted">What this covers</div>
              <ul className="mt-2 space-y-1">
                {active.capabilities.map((c) => (
                  <li key={c} className="flex gap-2 text-sm leading-relaxed text-paper-dim">
                    <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/*
              Status and relationship are two different facts and are printed as two.
              Collapsing them is how "AgenID wrote a guide for Retell" becomes "Retell is
              a partner" — the exact conflation this panel exists to prevent.
            */}
            <dl className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <div>
                <dt className="font-mono text-xs uppercase tracking-wider text-muted">{active.statusLabel}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-muted">{active.statusDefinition}</dd>
              </div>
              <div>
                <dt className="font-mono text-xs uppercase tracking-wider text-muted">{active.relationshipLabel}</dt>
                <dd className="mt-1 text-xs leading-relaxed text-muted">{active.relationshipDefinition}</dd>
              </div>
            </dl>

            {active.docs && (
              <Link
                href={active.docs}
                className="mt-4 inline-block text-sm text-paper underline underline-offset-2 hover:no-underline"
              >
                Integration brief →
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Hover, focus, or tap a platform to see exactly what it means for it. Every listing here is a technical
            statement about how an <span className="font-mono">agenid:&lt;ULID&gt;</span> travels through that
            platform&rsquo;s existing API surface. Appearing in this diagram is not an endorsement, a partnership, or a
            shipped adapter &mdash; each of those is a separate claim, and the panel says which ones apply.
          </p>
        )}
      </div>
    </div>
  );
}
