"use client";

import { useEffect, useRef } from "react";

/**
 * The homepage's live badge example. The embed used to be a server-rendered <script>
 * inside the page, which ran during HTML parsing and inserted its badge next to itself
 * before React hydrated — so the hydrated tree never matched the DOM (React error #418 on
 * every homepage load). Injecting the same script after mount runs the exact embed a site
 * owner would paste (badge.js reads document.currentScript, which is set for dynamically
 * inserted classic scripts), without racing hydration.
 */
export function LiveBadgeExample({ agent }: { agent: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || host.dataset.loaded) return;
    host.dataset.loaded = "1";
    const s = document.createElement("script");
    s.src = "/badge.js";
    s.async = true;
    s.dataset.agent = agent;
    host.appendChild(s);
  }, [agent]);

  return <div ref={ref} className="min-h-7" />;
}
