"use client";

import { useEffect, useState } from "react";

type Item = { id: string; label: string };

/**
 * Sticky table of contents with scrollspy for long documents (Trust Center, operator
 * onboarding, partner briefs). Either pass `items`, or pass `selector` and the headings are
 * collected from the page once it mounts — which is what the markdown-rendered docs need,
 * since their headings come out of lib/markdown.ts with ids already on them.
 *
 * The section in view gets `aria-current="location"`.
 */
export function Toc({ items: given, selector, label = "On this page" }: { items?: Item[]; selector?: string; label?: string }) {
  const [items, setItems] = useState<Item[]>(given ?? []);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (given || !selector) return;
    const found = Array.from(document.querySelectorAll<HTMLElement>(selector))
      .filter((h) => h.id)
      .map((h) => ({ id: h.id, label: h.textContent?.trim() ?? h.id }));
    setItems(found);
  }, [given, selector]);

  useEffect(() => {
    if (items.length === 0 || typeof IntersectionObserver === "undefined") return;
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  if (items.length === 0) return null;
  return (
    <nav aria-label={label} className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-y-auto lg:block">
      <div className="eyebrow">{label}</div>
      <ul className="space-y-1 border-l border-line">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={active === i.id ? "location" : undefined}
              className={`-ml-px block border-l-2 py-1 pl-4 text-sm transition-colors ${
                active === i.id ? "border-paper text-paper" : "border-transparent text-muted hover:text-paper"
              }`}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
