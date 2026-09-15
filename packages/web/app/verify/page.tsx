import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { isValidAgentId } from "@agenid/core";

export const metadata: Metadata = {
  title: "Verify an Agent",
  description:
    "Resolve any agenid:<ULID> against the live AgenID registry. See what's declared, what's actually been verified, and by whom — separated, never collapsed into one generic \"trusted\" badge.",
  alternates: { canonical: "/verify" },
};

const DISTINCTIONS = [
  { k: "Identity", v: "The permanent agenid:<ULID> itself — not a platform-internal account ID." },
  { k: "Operator", v: "Who is accountable for this agent, and their verified domain." },
  { k: "Declarations", v: "What the operator says the agent does. Signed, but self-asserted." },
  { k: "Verification", v: "What an independent authority actually checked, against what evidence, bound to which manifest version." },
  { k: "Deployment", v: "Where this agent is actually running." },
  { k: "Status", v: "Active, suspended, or revoked — checked live, not cached." },
];

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ agent?: string; id?: string }> }) {
  const params = await searchParams;
  const raw = params.agent ?? params.id;
  if (raw) {
    const id = raw.startsWith("agenid:") ? raw : `agenid:${raw}`;
    if (isValidAgentId(id)) redirect(`/a/${encodeURIComponent(id)}`);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="text-center">
        <div className="mb-3 font-mono text-[11px] text-muted">VERIFY AN AGENT</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Who is this AI agent?</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Enter an AgenID to resolve it against the live registry. This is the same lookup a program gets when it
          requests <span className="font-mono">Accept: application/json</span> from the same URL.
        </p>
        <div className="mx-auto mt-8">
          <SearchBar />
        </div>
        <p className="mt-3 text-xs text-muted">
          Format: <span className="font-mono">agenid:&lt;26-character ULID&gt;</span>, e.g.{" "}
          <span className="font-mono">agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y</span>
        </p>
      </div>

      <div className="mt-14 grid gap-3 sm:grid-cols-2">
        {DISTINCTIONS.map((d) => (
          <div key={d.k} className="card p-4">
            <div className="font-mono text-[11px] uppercase tracking-wider text-mint">{d.k}</div>
            <p className="mt-1.5 text-sm text-muted">{d.v}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-line bg-ink-2 p-5 text-sm text-muted">
        <span className="font-semibold text-paper">Operate agents yourself?</span> Proving you control a domain records
        evidence that ties your agents to you.{" "}
        <Link href="/verify/domain" className="text-paper underline hover:no-underline">Verify a domain &rarr;</Link>
      </div>

      <div className="mt-10 rounded-lg border border-line bg-ink-2 p-5 text-sm text-muted">
        <span className="font-semibold text-paper">No result?</span> An unregistered identifier is not evidence of
        anything — it simply has no record yet.{" "}
        <Link href="/issue" className="text-paper underline hover:no-underline">Register an agent →</Link>
      </div>
    </main>
  );
}
