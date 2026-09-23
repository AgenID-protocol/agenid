"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CommandPalette, type PaletteLink } from "@/components/CommandPalette";

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
      // Was "@agenid/core (GitHub)" → AgenID-protocol/agenid, which is private: a logged-out
      // visitor got GitHub's 404. The org page lists what is actually public (spec,
      // conformance), so it is the honest destination until the monorepo opens.
      { href: "https://github.com/AgenID-protocol", label: "AgenID on GitHub", external: true },
    ],
  },
  {
    label: "Resources",
    links: [
      { href: "/why-agent-identity", label: "Why Agent Identity?" },
      { href: "/how-it-works", label: "How It Works", note: "Seventeen scenarios, with and without AgenID" },
      { href: "/learn", label: "Guides", note: "How to verify an AI agent, KYA, registries" },
      { href: "/glossary", label: "Glossary" },
      { href: "/compare", label: "Comparisons" },
      { href: "/use-cases/voice-agents", label: "Voice Agents" },
      { href: "/state-of-agent-identity", label: "State of Agent Identity 2026" },
      { href: "/blog", label: "Blog" },
      { href: "/trust", label: "Trust Center" },
    ],
  },
];

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className={`ml-1 opacity-70 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M1.5 3.5L5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A link is "current" when it is this page. Hash links on "/" are sections, never pages. */
function isCurrent(href: string, pathname: string) {
  if (href.startsWith("http") || href.includes("#") || href.endsWith(".json")) return false;
  return href === pathname;
}

function groupIsCurrent(group: NavGroup, pathname: string) {
  return group.links.some((l) => {
    if (l.href.startsWith("http") || l.href.includes("#") || l.href.endsWith(".json")) return false;
    return pathname === l.href || pathname.startsWith(`${l.href}/`);
  });
}

function Dropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = groupIsCurrent(group, pathname);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex h-9 items-center rounded-md px-3 text-sm transition-colors hover:text-paper ${
          current ? "text-paper underline decoration-line-strong decoration-2 underline-offset-[22px]" : "text-muted"
        }`}
      >
        {group.label} <ChevronDown open={open} />
      </button>
      {open && (
        <div className="pop-in absolute left-0 top-full z-30 mt-2 w-72 rounded-xl bg-ink-4/95 p-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] ring-1 ring-line backdrop-blur-xl">
          {group.links.map((l) => {
            const here = isCurrent(l.href, pathname);
            return (
              <a
                key={l.href}
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noopener" : undefined}
                aria-current={here ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors hover:bg-ink-3 ${here ? "bg-ink-3 text-paper" : "text-paper-dim"}`}
              >
                <div className="flex items-center justify-between">
                  <span>{l.label}</span>
                  {l.external && <span className="text-xs text-muted" aria-label="opens in a new tab">↗</span>}
                </div>
                {l.note && <div className="mt-1 text-xs text-muted">{l.note}</div>}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

const PALETTE_LINKS: PaletteLink[] = [
  { href: "/", label: "Home" },
  ...GROUPS.flatMap((g) => g.links.map((l) => ({ href: l.href, label: l.label, hint: g.label, external: l.external }))),
  { href: "/verify/domain", label: "Prove domain control", hint: "Product" },
];

export function Nav() {
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() ?? "/";
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Header is transparent over the hero and gains its surface once content scrolls under it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the drawer on navigation, and on Escape (returning focus to the trigger).
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <header
      data-scrolled={scrolled ? "" : undefined}
      className={`sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200 ${
        scrolled ? "border-line bg-ink/75 backdrop-blur-md backdrop-saturate-150" : "border-transparent bg-transparent"
      }`}
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-3 text-base font-semibold tracking-tight">
          {/* The check renders in paper, not emerald: this mark appears on every page,
              including a Verification Card that says "Not registered", and an emerald check
              is the product's "verified" glyph (design pass 2026-09-23, approved by Mike). */}
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-3 font-mono text-xs text-paper" aria-hidden>
            ✓
          </span>
          AgenID
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {GROUPS.map((g) => (
            <Dropdown key={g.label} group={g} pathname={pathname} />
          ))}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("agenid:open-palette"))}
            className="flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-xs text-muted transition-colors hover:text-paper"
            aria-label="Search or resolve an AgenID (Command K)"
          >
            <span>Search</span>
            <kbd className="kbd">⌘K</kbd>
          </button>
          <Link href="/verify" className="btn btn-ghost btn-sm" aria-current={pathname === "/verify" ? "page" : undefined}>
            Verify an Agent
          </Link>
          <Link href="/issue" className="btn btn-primary btn-sm" aria-current={pathname === "/issue" ? "page" : undefined}>
            Give Your Agent an Identity
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setDrawer(true)}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-line-strong text-paper lg:hidden"
          aria-label="Open menu"
          aria-expanded={drawer}
          aria-controls="mobile-menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      <CommandPalette links={PALETTE_LINKS} />

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" id="mobile-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/80" onClick={() => setDrawer(false)} />
          <div className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-l border-line bg-ink-2">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => {
                  setDrawer(false);
                  menuButtonRef.current?.focus();
                }}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-md border border-line-strong"
                autoFocus
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              {GROUPS.map((g) => (
                <details key={g.label} className="group border-b border-line py-1" open={groupIsCurrent(g, pathname)}>
                  <summary className="flex h-12 cursor-pointer list-none items-center justify-between text-sm font-medium text-paper">
                    {g.label}
                    <ChevronDown open={false} />
                  </summary>
                  <div className="flex flex-col pb-2">
                    {g.links.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        target={l.external ? "_blank" : undefined}
                        rel={l.external ? "noopener" : undefined}
                        aria-current={isCurrent(l.href, pathname) ? "page" : undefined}
                        onClick={() => setDrawer(false)}
                        className="flex min-h-12 items-center rounded-md px-2 text-sm text-paper-dim hover:bg-ink-3"
                      >
                        {l.label}
                        {l.external && <span className="ml-2 text-xs text-muted">↗</span>}
                      </a>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            {/* CTAs pinned to the bottom, same hierarchy as the header and hero. */}
            <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-ink-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <Link href="/issue" onClick={() => setDrawer(false)} className="btn btn-primary w-full">
                Give Your Agent an Identity
              </Link>
              <Link href="/verify" onClick={() => setDrawer(false)} className="btn btn-ghost w-full">
                Verify an Agent
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
