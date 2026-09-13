import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Why Agent Identity?",
  description:
    "AI agents are becoming participants — they communicate, access APIs and systems, run workflows, and act on behalf of organizations. Identity becomes infrastructure once that's true.",
  alternates: { canonical: "/why-agent-identity" },
};

export default function WhyAgentIdentityPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="mb-2 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">AgenID</Link> / Why Agent Identity?
      </div>
      <h1 className="text-3xl font-bold tracking-tight">AI agents are becoming participants.</h1>

      <div className="mt-8 space-y-5 text-muted">
        <p>
          An AI agent today can communicate directly with people, call APIs, act inside internal systems, run
          multi-step workflows, talk to customers, and act on behalf of a company. None of that requires a human in
          the loop for every step. As more of it happens without one, a simple question starts to matter more than it
          used to: <span className="text-paper">who, exactly, is this agent — and who answers for it?</span>
        </p>
        <p>
          A session token or an API key answers that question for exactly as long as the session lasts. It says
          nothing about whether the agent making a request today is the same one that made a similar request last
          week, whether it moved to a different platform in between, or who is accountable if it acts outside its
          stated purpose. That gap doesn&rsquo;t show up while agents are experimental. It shows up the moment an
          agent is trusted with something that matters — a payment, an escalation, a commitment made on someone
          else&rsquo;s behalf.
        </p>
        <p>Identity becomes infrastructure once an agent can act like this in each of these directions:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><span className="font-mono text-paper">Human → Agent</span> — a person needs to know who they&rsquo;re actually talking to.</li>
          <li><span className="font-mono text-paper">Agent → Agent</span> — one agent needs to check who it&rsquo;s transacting with before it does.</li>
          <li><span className="font-mono text-paper">Agent → API</span> — a system needs to know which agent is calling it, independent of the credential it presents.</li>
          <li><span className="font-mono text-paper">Agent → Business</span> — an organization needs a durable record of what its agents claimed and what was actually checked.</li>
          <li><span className="font-mono text-paper">Agent → Transaction</span> — anything with real consequences needs a party behind it that outlives the session.</li>
        </ul>
        <p>
          This is a claim about incentives and architecture, not a claim about law. AgenID does not assert that any
          specific regulation requires an identity layer like this — where a rule or standard is relevant, it should
          be cited by name and clearly separated from AgenID&rsquo;s own interpretation, not blended into it.
        </p>
        <p>
          What AgenID adds is narrow and specific: a permanent identifier, bound to a signed operator manifest, that
          survives a platform change; a way to separate what an operator declares from what an independent party has
          actually checked; and a machine-readable resolution so another program — or another agent — can verify that
          distinction itself, without taking AgenID&rsquo;s word for it.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/verify" className="btn btn-primary">Verify an Agent</Link>
        <Link href="/#get-agenid" className="btn btn-ghost">Give Your Agent an Identity</Link>
      </div>
    </main>
  );
}
