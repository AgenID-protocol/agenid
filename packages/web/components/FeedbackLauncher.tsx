"use client";

import { useEffect, useState } from "react";

/**
 * Our own launcher for the BugLoop feedback widget.
 *
 * The widget's built-in launcher draws a filled button in the project's accent colour,
 * which is configured as Verified Emerald — the one colour this brand reserves for
 * verified trust state — with white text at a 2.53:1 contrast ratio, plus a 22px badge
 * that misses the WCAG 2.2 24px target size. axe flagged both on all 98 pages. The script
 * is loaded with `data-bugloop-launcher="none"`, so it renders no launcher, and this
 * button opens it through the widget's documented `window.BugLoop.open()`.
 *
 * Rendered only once the widget has loaded: a feedback button that does nothing when a
 * blocker strips the script would be dead navigation.
 */
type BugLoopApi = { open: () => void };

export function FeedbackLauncher() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let tries = 0;
    const id = window.setInterval(() => {
      const api = (window as unknown as { BugLoop?: BugLoopApi }).BugLoop;
      if (api && typeof api.open === "function") {
        setReady(true);
        window.clearInterval(id);
      } else if (++tries > 40) {
        window.clearInterval(id);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  if (!ready) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm fixed bottom-4 right-4 z-40 bg-ink-2/90 backdrop-blur print:hidden"
      onClick={() => (window as unknown as { BugLoop?: BugLoopApi }).BugLoop?.open()}
    >
      Feedback
    </button>
  );
}
