"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const AGENT_ID_RE = /^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    const id = v.startsWith("agenid:") ? v : `agenid:${v}`;
    if (!AGENT_ID_RE.test(id.toUpperCase().replace(/^AGENID:/, "agenid:"))) {
      setError("Expected agenid:<26-char ULID> — e.g. agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y");
      return;
    }
    setError(null);
    startTransition(() => router.push(`/a/${id.replace(/^agenid:/, "agenid:").replace(/^agenid:(.*)$/, (_m, u: string) => `agenid:${u.toUpperCase()}`)}`));
  }

  return (
    <form onSubmit={submit} aria-busy={pending} className={compact ? "w-full" : "mx-auto w-full max-w-2xl"} role="search" aria-label="Resolve an AgenID">
      <div className="flex items-stretch gap-2">
        <label htmlFor="agenid-search" className="sr-only">AgenID to resolve</label>
        <input
          id="agenid-search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"
          spellCheck={false}
          autoComplete="off"
          className="field min-w-0 flex-1 font-mono"
        />
        <button type="submit" className="btn btn-primary min-w-[7.5rem]" disabled={pending}>
          {pending ? (
            <span className="flex items-center gap-2">
              Resolving
              <span className="dot-pulse flex gap-1" aria-hidden>
                <span>·</span>
                <span>·</span>
                <span>·</span>
              </span>
            </span>
          ) : (
            "Resolve"
          )}
        </button>
      </div>
      <p className="mt-2 min-h-4 text-xs text-paper-dim" aria-live="polite">{error}</p>
    </form>
  );
}
