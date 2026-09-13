import { SearchBar } from "@/components/SearchBar";
import { Terminal } from "@/components/Terminal";

const PILLARS = [
  {
    title: "A permanent identity",
    body: "Every agent gets an agenid:<ULID> that never changes — not when it moves platforms, not when its config changes, not when a deployment is retired. Revoked identities stay on record forever.",
    tag: "agenid:01J…",
  },
  {
    title: "An accountable operator",
    body: "The operator signs a manifest — name, purpose, channels, disclosure posture — with an Ed25519 key that is discoverable from their own domain. That is a DECLARED claim, and the protocol never lets it masquerade as more.",
    tag: "ManifestProof",
  },
  {
    title: "Independent verification",
    body: "An authority verifies one claim against one piece of evidence and signs a VerificationAssertion bound to that exact manifest version. Levels L1–L4. Anyone can re-check the math without trusting AgenID's database.",
    tag: "VerificationAssertion",
  },
  {
    title: "Machine resolution",
    body: "The same URL answers a browser with a verification card and a program with the canonical envelope. Agents can ask other agents who they are — and get a signed answer.",
    tag: "Accept: application/json",
  },
];

export default function Home() {
  return (
    <main>
      <section className="grid-bg border-b border-line/70">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 text-center">
          <p className="pill mx-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Protocol v1.1.1 · Locked · MIT
          </p>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            Identity Infrastructure for Production AI Agents
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            A permanent, portable, independently verifiable identity for every AI agent — who it is, who is accountable for it, what it declares, and what has actually been verified.
          </p>
          <div className="mt-10">
            <SearchBar />
            <p className="mt-3 text-xs text-muted">
              Paste any <span className="font-mono">agenid:&lt;ULID&gt;</span> to open its verification card. Programs get JSON from the same URL.
            </p>
          </div>
          <div className="mx-auto mt-10 flex flex-wrap justify-center gap-2">
            {["agenid:<ULID>", "RFC 8785 JCS", "Ed25519 (pure)", "L1–L4 verification", "Two-path key discovery"].map((t) => (
              <span key={t} className="pill">{t}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-5 md:grid-cols-2">
          {PILLARS.map((p) => (
            <div key={p.title} className="card p-6">
              <div className="mb-3 font-mono text-[11px] text-muted">{p.tag}</div>
              <h2 className="text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="mb-3 font-mono text-[11px] text-muted">DEVELOPERS</div>
            <h2 className="text-3xl font-bold tracking-tight">Three commands to a verifiable agent.</h2>
            <p className="mt-4 text-muted">
              <span className="font-mono text-paper">@agenid/core</span> gives you identifiers, RFC 8785 canonicalization, the normative schemas, and the Ed25519 proof engine — the same code that passes the specification&apos;s deterministic test vectors byte-for-byte.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn btn-primary" href="https://github.com/AgenID-protocol/agenid">Get @agenid/core</a>
              <a className="btn btn-ghost" href="https://github.com/AgenID-protocol/spec">Read the spec</a>
            </div>
            <div className="mt-6 rounded-lg border border-line bg-ink-2 p-4 text-sm text-muted">
              <div className="mb-2 font-semibold text-paper">Embed a live badge</div>
              <code className="block overflow-x-auto font-mono text-[12px] text-paper/90">
                {'<script src="https://agenid.com/badge.js" data-agent="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"></script>'}
              </code>
              <p className="mt-2 text-xs">Renders the current verification level, live — a suspended or revoked identity changes everywhere it&apos;s embedded.</p>
            </div>
          </div>
          <Terminal />
        </div>
      </section>

      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <div>
              <div className="font-mono text-[11px] text-muted">DECLARED</div>
              <p className="mt-2 text-sm text-muted">The operator asserts it. Signed, but not checked. Every manifest starts here.</p>
            </div>
            <div>
              <div className="font-mono text-[11px] text-mint">VERIFIED</div>
              <p className="mt-2 text-sm text-muted">An independent authority checked a specific claim against specific evidence, and signed that — bound to the exact manifest version.</p>
            </div>
            <div>
              <div className="font-mono text-[11px] text-muted">AUTHORIZED</div>
              <p className="mt-2 text-sm text-muted">What the operator explicitly permits the agent to do. Reserved for v1.2 — never inferred from platform configuration.</p>
            </div>
          </div>
          <p className="mt-8 text-xs text-muted">None of these three states is ever inferred from another. That rule is enforced by key role at verification time, not by convention.</p>
        </div>
      </section>
    </main>
  );
}
