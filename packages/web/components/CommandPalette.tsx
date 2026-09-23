"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const AGENID_RE = /^(?:agenid:)?([0-7][0-9A-HJKMNP-TV-Z]{25})$/i;

export type PaletteLink = { href: string; label: string; hint?: string; external?: boolean };

/**
 * ⌘K / Ctrl+K (or "/" outside a text field) opens a palette. Paste an agenid:<ULID> and
 * Enter resolves it; type anything else and it filters the site's pages. Built on the
 * native <dialog> element, so focus trapping, Escape and the backdrop come from the
 * browser rather than from a dependency.
 */
export function CommandPalette({ links }: { links: PaletteLink[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const open = () => {
    const d = ref.current;
    if (!d || d.open) return;
    setQ("");
    setActive(0);
    d.showModal();
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const close = () => ref.current?.close();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        open();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        open();
      }
    }
    const onOpen = () => open();
    window.addEventListener("keydown", onKey);
    window.addEventListener("agenid:open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("agenid:open-palette", onOpen);
    };
  }, []);

  const results = useMemo(() => {
    const v = q.trim();
    const m = AGENID_RE.exec(v);
    const items: (PaletteLink & { resolve?: boolean })[] = [];
    if (m) items.push({ href: `/a/agenid:${m[1].toUpperCase()}`, label: `Resolve agenid:${m[1].toUpperCase()}`, hint: "Open its Verification Card", resolve: true });
    const needle = v.toLowerCase();
    for (const l of links) {
      if (!needle || l.label.toLowerCase().includes(needle) || l.hint?.toLowerCase().includes(needle)) items.push(l);
    }
    return items.slice(0, 12);
  }, [q, links]);

  function go(i: number) {
    const r = results[i];
    if (!r) return;
    close();
    if (r.external) window.open(r.href, "_blank", "noopener");
    else router.push(r.href);
  }

  return (
    <dialog
      ref={ref}
      aria-label="Search pages or resolve an AgenID"
      className="m-0 mx-auto mt-[12vh] w-[min(92vw,36rem)] rounded-xl border border-line-strong bg-ink-4 p-0 text-paper shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] backdrop:bg-ink/70 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="border-b border-line p-3">
        <label htmlFor="palette-input" className="sr-only">
          Search pages, or paste an agenid:&lt;ULID&gt;
        </label>
        <input
          id="palette-input"
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(active);
            }
          }}
          placeholder="Search pages, or paste an agenid:<ULID>"
          spellCheck={false}
          autoComplete="off"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `palette-opt-${active}` : undefined}
          className="h-11 w-full bg-transparent px-2 text-base text-paper placeholder:text-muted focus:outline-none"
        />
      </div>
      <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
        {results.length === 0 && <li className="px-3 py-3 text-sm text-muted">No matching page.</li>}
        {results.map((r, i) => (
          <li
            key={`${r.href}-${i}`}
            id={`palette-opt-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => go(i)}
            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-3 text-sm ${i === active ? "bg-ink-3 text-paper" : "text-paper-dim"}`}
          >
            <span className={r.resolve ? "font-mono" : ""}>{r.label}</span>
            <span className="text-xs text-muted">{r.external ? "↗" : r.hint ?? ""}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between border-t border-line px-4 py-2 text-xs text-muted">
        <span>↑↓ to move · Enter to open</span>
        <span>Esc to close</span>
      </div>
    </dialog>
  );
}
