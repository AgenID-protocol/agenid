"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavLink = { href: string; label: string; external?: boolean; note?: string };
type NavGroup = { label: string; links: NavLink[] };

const GROUPS: NavGroup[] = [
  {
    label: "Product",
    links: [
      { href: "/issue", label: "Get an AgenID", note: "Sign and register in your browser" },
      { href: "/verify", label: "Verify an Agent", note: "Resolve any agenid:<ULID>" },
      { href: "/#identity", label: "Agent Identity", note: "What agenid:<ULID> actually is" },
      { href: "/#badges", label: "Agent Badges", note: "Embed live verification status" },
      { href: "/docs/partners/mcp-server-integration", label: "Agent-to-Agent (MCP)", note: "Let an agent verify another agent" },
    ],
  },
  {
    label: "Ecosystem",
    links: [
      { href: "/ecosystem", label: "Ecosystem Overview" },
      { href: "/docs/partners", label: "Integration Briefs" },
      { href: "https://github.com/AgenID-protocol/conformance", label: "Conformance Suite", external: true },
    ],
  },
  {
    label: "Developers",
    links: [
      { href: "/docs/onboarding", label: "Quick Start" },
      { href: "/api/v1/openapi.json", label: "API (OpenAPI)", external: true },
      { href: "https://github.com/AgenID-protocol/spec", label: "Protocol Spec", external: true },
      { href: "https://github.com/AgenID-protocol/spec/tree/main/schemas", label: "JSON Schemas", external: true },
      { href: "https://github.com/AgenID-protocol/agenid", label: "@agenid/core (GitHub)", external: true },
    ],
  },
  {
    label: "Resources",
    links: [
      { href: "/why-agent-identity", label: "Why Agent Identity?" },
      { href: "/trust", label: "Trust Center" },
    ],
  },
];

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="ml-1 opacity-70">
      <path d="M1.5 3.5L5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Dropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center rounded-md px-3 py-1.5 text-sm text-muted transition hover:text-paper"
      >
        {group.label} <ChevronDown />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-line bg-ink-2 p-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)]">
          {group.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener" : undefined}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-paper/90 transition hover:bg-ink-3"
            >
              <div className="flex items-center justify-between">
                <span>{l.label}</span>
                {l.external && <span className="text-[10px] text-muted">↗</span>}
              </div>
              {l.note && <div className="mt-0.5 text-xs text-muted">{l.note}</div>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const [drawer, setDrawer] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 text-[15px] font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-3 font-mono text-xs text-mint" aria-hidden>
            ✓
          </span>
          AgenID
        </Link>

        <div className="hidden items-center gap-0.5 lg:flex">
          {GROUPS.map((g) => (
            <Dropdown key={g.label} group={g} />
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <Link href="/verify" className="btn btn-ghost !py-1.5 !text-[13px]">
            Verify an Agent
          </Link>
          <Link href="/issue" className="btn btn-primary !py-1.5 !text-[13px]">
            Give Your Agent an Identity
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="rounded-md border border-line p-2 text-paper lg:hidden"
          aria-label="Open menu"
          aria-expanded={drawer}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/80" onClick={() => setDrawer(false)} />
          <div className="absolute right-0 top-0 h-full w-[86%] max-w-sm overflow-y-auto border-l border-line bg-ink-2 p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded-md border border-line p-2">
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mb-6 flex flex-col gap-2">
              <Link href="/verify" onClick={() => setDrawer(false)} className="btn btn-primary w-full">
                Verify an Agent
              </Link>
              <Link href="/issue" onClick={() => setDrawer(false)} className="btn btn-ghost w-full">
                Give Your Agent an Identity
              </Link>
            </div>
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-5">
                <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">{g.label}</div>
                <div className="flex flex-col gap-0.5">
                  {g.links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noopener" : undefined}
                      onClick={() => setDrawer(false)}
                      className="rounded-md px-2 py-2 text-sm text-paper/90 hover:bg-ink-3"
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
