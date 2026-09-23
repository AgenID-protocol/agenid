"use client";

import { useId, useRef, useState } from "react";

/**
 * Accessible tabs (WAI-ARIA tabs pattern, manual activation with arrow keys).
 *
 * EVERY PANEL IS ALWAYS IN THE DOM. Inactive panels are `hidden`, not unmounted, so every
 * disclosure a panel carries is still served to crawlers, to the e2e checks that grep the
 * page, and to anyone reading the source. Consolidating sections must never be the way a
 * disclosure quietly disappears.
 */
export function Tabs({ label, tabs }: { label: string; tabs: { id: string; label: string; panel: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKey(e: React.KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      setActive(next);
      refs.current[next]?.focus();
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-2 border-b border-line">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px h-11 border-b-2 px-4 text-sm font-medium transition-colors ${
              i === active ? "border-paper text-paper" : "border-transparent text-muted hover:text-paper"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={i !== active}
          tabIndex={0}
          className="pt-10"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
