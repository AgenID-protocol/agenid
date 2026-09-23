"use client";

import { useState } from "react";

export function JsonInspector({ title, data, defaultOpen = false }: { title: string; data: unknown; defaultOpen?: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(data, null, 2);
  return (
    <details open={defaultOpen} className="card group">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <span className="text-muted transition group-open:rotate-90">▸</span> {title}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="kbd hover:text-paper"
        >
          {copied ? "copied" : "copy"}
        </button>
      </summary>
      <pre className="overflow-x-auto border-t border-line px-5 py-4 font-mono text-xs leading-relaxed text-paper/85">{text}</pre>
    </details>
  );
}
