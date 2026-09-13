"use client";

import { useEffect } from "react";

/**
 * Attaches a "copy" button to every <pre><code> block rendered inside a
 * `.prose-agenid` article — the markdown code fences in the onboarding guide and
 * partner docs. Dependency-free (same pattern as JsonInspector's copy button)
 * rather than pulling in a syntax-highlighter/copy library for static content.
 */
export function DocCodeCopy() {
  useEffect(() => {
    const blocks = Array.from(document.querySelectorAll<HTMLPreElement>(".prose-agenid pre"));
    const cleanups: Array<() => void> = [];

    for (const pre of blocks) {
      if (pre.dataset.copyEnhanced === "true") continue;
      pre.dataset.copyEnhanced = "true";
      pre.style.position = "relative";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "copy";
      button.className = "doc-code-copy-btn";
      button.setAttribute("aria-label", "Copy code to clipboard");

      const onClick = () => {
        const code = pre.querySelector("code")?.textContent ?? "";
        navigator.clipboard?.writeText(code).then(() => {
          button.textContent = "copied";
          setTimeout(() => {
            button.textContent = "copy";
          }, 1500);
        });
      };
      button.addEventListener("click", onClick);
      cleanups.push(() => button.removeEventListener("click", onClick));

      pre.appendChild(button);
    }

    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return null;
}
