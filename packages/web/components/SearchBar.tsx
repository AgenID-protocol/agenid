"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const AGENT_ID_RE = /^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = value.trim();
    const id = v.startsWith("agenid:") ? v : `agenid:${v}`;
    if (!AGENT_ID_RE.test(id.toUpperCase().replace(/^AGENID:/, "agenid:"))) {
      setError("Expected agenid:<26-char ULID> — e.g. agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y");
      return;
    }
    setError(null);
    router.push(`/a/${id.replace(/^agenid:/, "agenid:").replace(/^agenid:(.*)$/, (_m, u: string) => `agenid:${u.toUpperCase()}`)}`);
  }

  return (
    <form onSubmit={submit} className={compact ? "w-full" : "mx-auto w-full max-w-2xl"} role="search" aria-label="Resolve an AgenID">
      <div className="flex items-stretch gap-2">
        <label htmlFor="agenid-search" className="sr-only">AgenID to resolve</label>
        <input
          id="agenid-search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink-2 px-4 py-3 font-mono text-sm text-paper placeholder:text-muted/60 focus:border-blue focus:outline-none"
        />
        <button type="submit" className="btn btn-primary">Resolve</button>
      </div>
      {error && <p className="mt-2 text-xs text-red">{error}</p>}
    </form>
  );
}
