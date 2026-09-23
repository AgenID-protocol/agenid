"use client";

import { useState } from "react";

/**
 * Copy-to-clipboard with visible and announced confirmation. The icon and label swap to
 * "Copied" for 1.2s, and the same text goes to a polite live region so a screen-reader
 * user hears it too.
 */
export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* Clipboard blocked (insecure context, permissions). The text is still selectable. */
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={`inline-flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-xs font-medium text-paper-dim transition-colors hover:text-paper ${className}`}
      >
        <span aria-hidden>{copied ? "✓" : "⧉"}</span>
        {copied ? "Copied" : label}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
