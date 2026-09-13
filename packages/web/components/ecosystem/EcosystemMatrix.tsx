"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlatformMark } from "./PlatformMark";

export type MatrixEntry = {
  id: string;
  name: string;
  abbr: string;
  category: string;
  categoryLabel: string;
  description: string;
  website: string;
  status: string;
  statusLabel: string;
  integration_type: string;
  last_verified: string;
  compatibility_note: string;
  docs?: string;
  logoSvg: string | null;
};

export type MatrixCategory = { id: string; label: string; blurb: string };

/**
 * Filterable compatibility matrix. Client-side only because the whole registry is 25
 * entries of static JSON already in the payload — routing a tab click through the
 * server would add a round trip to filter an array that is right here. If the registry
 * grows past a few hundred entries, move filtering server-side with searchParams.
 *
 * Status badges are never color-coded to "good/bad". An unlisted or merely-compatible
 * platform is not a negative finding, exactly as an unverified agent renders neutral on
 * the verification card — same rule, same reason.
 */
export function EcosystemMatrix({ entries, categories }: { entries: MatrixEntry[]; categories: MatrixCategory[] }) {
  const [active, setActive] = useState<string>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (active !== "all" && e.category !== active) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.integration_type.toLowerCase().includes(q) ||
        e.categoryLabel.toLowerCase().includes(q)
      );
    });
  }, [entries, active, query]);

  const tabs = [{ id: "all", label: "All", blurb: "Every platform in the registry." }, ...categories];
  const activeBlurb = tabs.find((t) => t.id === active)?.blurb;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0 md:pb-0" role="tablist" aria-label="Platform categories">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => setActive(t.id)}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition ${
                active === t.id ? "border-muted bg-ink-2 text-paper" : "border-line text-muted hover:text-paper"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="md:w-72">
          <label htmlFor="ecosystem-search" className="sr-only">
            Search compatible platforms
          </label>
          <input
            id="ecosystem-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search platforms…"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-ink-2 px-3.5 py-2 text-sm text-paper placeholder:text-muted/60 focus:border-mint focus:outline-none"
          />
        </div>
      </div>

      {activeBlurb && <p className="mt-4 text-sm text-muted">{activeBlurb}</p>}

      <p className="mt-2 font-mono text-[11px] text-muted" aria-live="polite">
        {visible.length} of {entries.length} platforms
      </p>

      {visible.length === 0 ? (
        <div className="card mt-6 p-8 text-center text-sm text-muted">
          No platform in the registry matches that. AgenID is transport-agnostic — absence from this list is not a
          statement that a platform is incompatible, only that no one has written down what carrying an identity through
          it looks like.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((e) => (
            <div key={e.id} id={e.id} className="card group flex flex-col p-5 scroll-mt-24 transition hover:border-muted/60">
              <div className="flex items-start gap-3">
                <PlatformMark abbr={e.abbr} logoSvg={e.logoSvg} />
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold">{e.name}</h3>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{e.categoryLabel}</div>
                </div>
              </div>

              <p className="mt-3 text-sm text-muted">{e.description}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="pill !py-0.5 !text-[10px]">{e.statusLabel}</span>
                <span className="pill !py-0.5 !text-[10px]">{e.integration_type}</span>
              </div>

              <p className="mt-4 border-t border-line/70 pt-4 text-[13px] leading-relaxed text-muted">
                {e.compatibility_note}
              </p>

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 font-mono text-[11px] text-muted">
                {e.docs && (
                  <Link href={e.docs} className="text-paper underline underline-offset-2 hover:no-underline">
                    Integration brief
                  </Link>
                )}
                <a href={e.website} rel="noopener noreferrer nofollow" className="hover:text-paper">
                  Platform site ↗
                </a>
                <span className="ml-auto">reviewed {e.last_verified}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
