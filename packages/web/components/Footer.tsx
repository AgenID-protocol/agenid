import Link from "next/link";

type Col = { title: string; links: { href: string; label: string; external?: boolean }[] };

const COLUMNS: Col[] = [
  {
    title: "Product",
    links: [
      { href: "/verify", label: "Verify an Agent" },
      { href: "/#identity", label: "Agent Identity" },
      { href: "/#badges", label: "Badges" },
      { href: "/api/v1/openapi.json", label: "Verification API", external: true },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs/onboarding", label: "Quick Start" },
      // Was "@agenid/core" → AgenID-protocol/agenid, a private repository. Same fix as Nav.
      { href: "https://github.com/AgenID-protocol", label: "AgenID on GitHub", external: true },
      { href: "/docs/partners/mcp-server-integration", label: "MCP Server" },
      { href: "https://github.com/AgenID-protocol/spec", label: "Protocol Spec", external: true },
    ],
  },
  {
    title: "Ecosystem",
    links: [
      { href: "/ecosystem", label: "Overview" },
      { href: "/docs/partners", label: "Integration Briefs" },
      { href: "https://github.com/AgenID-protocol/conformance", label: "Conformance Suite", external: true },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/trust", label: "Security & Cryptography" },
      { href: "/why-agent-identity", label: "Why Agent Identity?" },
      // ERRATA.md does not exist at the repository root — that URL was a 404. The errata
      // log lives at docs/errata.md.
      { href: "https://github.com/AgenID-protocol/spec/blob/main/docs/errata.md", label: "Errata Log", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line/70">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-3 font-mono text-xs text-mint" aria-hidden>
                ✓
              </span>
              AgenID
            </Link>
            <p className="mt-3 max-w-[220px] text-xs leading-relaxed text-muted">
              The open identity, provenance, and machine-resolution standard for AI agents.
            </p>
            <Link href="/verify" className="btn btn-ghost mt-5 !py-1.5 !text-[12px]">
              Verify an Agent
            </Link>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted">{col.title}</div>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target={l.external ? "_blank" : undefined}
                      rel={l.external ? "noopener" : undefined}
                      className="text-sm text-paper/80 hover:text-paper hover:underline"
                    >
                      {l.label}
                      {l.external && <span className="ml-1 text-[10px] text-muted">↗</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line/70 pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          {/* "MIT" unqualified read as "this product is open-source". The MIT-licensed,
              publicly readable artifacts are the specification and the conformance suite. */}
          <span>AgenID Protocol v1.1.1 · Specification MIT-licensed · Maintained by AI Venture Holdings LLC</span>
          <span className="font-mono">agenid:&lt;ULID&gt; · RFC 8785 JCS · Ed25519</span>
        </div>
      </div>
    </footer>
  );
}
