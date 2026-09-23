import Link from "next/link";
import type { ReactNode } from "react";
import { INLINE_TOKEN } from "@/lib/content/markup";

/**
 * Renders the content library's deliberately tiny inline markup as React nodes:
 *
 *   [label](/internal/path)   → next/link
 *   [label](https://…)        → external anchor, rel="noopener noreferrer"
 *   `code`                    → <code>
 *
 * Nothing else is interpreted and nothing is passed through dangerouslySetInnerHTML, so
 * content cannot smuggle markup onto the page. Code spans are matched first so a
 * bracket or parenthesis inside code is never read as a link.
 */

export function Inline({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE_TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    if (m[1] !== undefined) {
      out.push(
        <code key={i++} className="rounded bg-ink-3 px-1 py-0.5 font-mono text-[0.86em] text-paper">
          {m[1]}
        </code>,
      );
    } else {
      const label = m[2]!;
      const href = m[3]!;
      if (/^https?:\/\//.test(href)) {
        out.push(
          <a key={i++} href={href} rel="noopener noreferrer" target="_blank" className="text-paper underline underline-offset-2 hover:no-underline">
            {label}
          </a>,
        );
      } else {
        out.push(
          <Link key={i++} href={href} className="text-paper underline underline-offset-2 hover:no-underline">
            {label}
          </Link>,
        );
      }
    }
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}
