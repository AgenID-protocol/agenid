import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RevokeAgentForm } from "@/components/RevokeAgentForm";
import { REVOCATION_DISCLOSURES } from "@/lib/revoke";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Revoke an AI Agent Identity",
  description:
    "Permanently revoke an AgenID agent identity with its operator key. The revocation is signed in your browser, recorded publicly, and checkable by anyone.",
  path: "/revoke",
});

export default function RevokePage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: "Revoke an identity" }]} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">Revoke an agent identity</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        Use this when an agent is retired, replaced, or its operator key may be compromised. You sign a revocation with
        the key file you downloaded when you registered; the private key is used in this tab and never uploaded. The
        registry checks that the signature comes from this agent&rsquo;s own operator key and records it. No one else,
        including AgenID, can revoke your agent.
      </p>
      <ul className="mt-6 max-w-2xl space-y-1.5 text-sm text-muted">
        {REVOCATION_DISCLOSURES.map((d) => (
          <li key={d} className="flex gap-3">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
            <span>{d}</span>
          </li>
        ))}
      </ul>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <RevokeAgentForm />
        <div className="card p-6">
          <h2 className="text-xl font-semibold tracking-tight">What changes</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>The Verification Card and both badges read REVOKED instead of a level.</li>
            <li>The resolution envelope carries your signed revocation, so a verifier can check it offline against your operator key.</li>
            <li>The agent leaves the public directory and cannot be listed again.</li>
            <li>The identifier keeps resolving, so anyone who meets it later learns it was revoked rather than finding nothing.</li>
          </ul>
          <h2 className="mt-6 text-xl font-semibold tracking-tight">Lost the key file?</h2>
          <p className="mt-3 text-sm text-muted">
            Then no one can revoke this identity, which is the cost of a registry that cannot act on your behalf. Register a
            new identity at <Link href="/issue" className="text-paper underline hover:no-underline">/issue</Link> and stop
            presenting the old one.
          </p>
          <h2 className="mt-6 text-xl font-semibold tracking-tight">From your own tooling</h2>
          <p className="mt-3 text-sm text-muted">
            <code className="font-mono text-xs">POST /api/v1/agents/&#123;agenid&#125;/revocation</code> with a signed{" "}
            <Link href="/schemas/v1.2/revocation.json" className="text-paper underline hover:no-underline">Revocation</Link>{" "}
            (<code className="font-mono text-xs">revokes_type: &quot;agent&quot;</code>). See the{" "}
            <Link href="/docs" className="text-paper underline hover:no-underline">API reference</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
