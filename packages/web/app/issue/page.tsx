import type { Metadata } from "next";
import { pageMetadata, webApplicationJsonLd } from "@/lib/seo";
import Link from "next/link";
import { IssueWizard } from "@/components/IssueWizard";
import { SITE_URL } from "@/lib/api";

export const metadata: Metadata = pageMetadata({
  title: "Give Your AI Agent a Verifiable Identity",
  description:
    "Generate an Ed25519 key in your browser, sign an operator manifest, and get a permanent agenid:<ULID> with a public Verification Card. No account, no key upload.",
  path: "/issue",
});

const STEPS = [
  { n: "01", t: "Describe the agent", d: "Who operates it, what it does, which channels it runs on." },
  { n: "02", t: "Your browser signs it", d: "An Ed25519 key is generated in this tab and signs the manifest locally." },
  { n: "03", t: "Register the public parts", d: "Only the manifest, the signature, and the public key are sent." },
];

export default function IssuePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            webApplicationJsonLd({
              name: "AgenID Issuance",
              path: "/issue",
              description: String(metadata.description),
              siteUrl: SITE_URL,
            }),
          ),
        }}
      />
      <div className="text-center">
        <div className="mb-3 font-mono text-[11px] text-muted">GIVE YOUR AGENT AN IDENTITY</div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">One agent. One minute. No account.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Your agent gets a permanent identifier, a public Verification Card anyone can resolve, and a badge you can
          embed. You keep the only copy of the signing key.
        </p>
      </div>

      <ol className="mt-10 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.n} className="card p-4">
            <div className="font-mono text-[11px] text-mint">{s.n}</div>
            <div className="mt-1.5 text-sm font-semibold">{s.t}</div>
            <p className="mt-1 text-xs text-muted">{s.d}</p>
          </li>
        ))}
      </ol>

      <IssueWizard siteUrl={SITE_URL} />

      <div className="mt-10 rounded-lg border border-line bg-ink-2 p-5 text-sm text-muted">
        <span className="font-semibold text-paper">What you get is L1_REGISTERED.</span> It means this agent is
        registered here and its operator self-declaration verifies — not that AgenID checked the operator, the domain,
        or the organization. Levels above L1 require an authority-signed assertion, and the root authority key ceremony
        has not been performed, so none can be issued yet.{" "}
        <Link href="/trust" className="text-paper underline hover:no-underline">Trust Center →</Link>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Prefer a terminal?{" "}
        <Link href="/docs/onboarding" className="text-paper underline hover:no-underline">
          Do the same thing with @agenid/core
        </Link>
        .
      </p>
    </main>
  );
}
