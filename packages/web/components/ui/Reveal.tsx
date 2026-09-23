"use client";

import { useEffect, useRef } from "react";

/**
 * Wraps content in the site's single reveal primitive (`.reveal` in globals.css).
 *
 * Visible by default: the hidden starting state only applies under `html.js` and
 * `prefers-reduced-motion: no-preference`, and this component sets `data-revealed` the
 * first time the element intersects. A context where the observer never fires — a
 * full-page capture, print, a crawler — sees finished content, never an empty block.
 */
export function Reveal({
  children,
  className = "",
  index = 0,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Stagger position; capped at 6 so a long list never waits on its tail. */
  index?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.revealed = "";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revealed = "";
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style = { "--i": Math.min(index, 6) } as React.CSSProperties;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`reveal ${className}`} style={style}>
      {children}
    </Tag>
  );
}
