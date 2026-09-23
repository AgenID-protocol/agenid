import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { graph } from "@/lib/content/jsonld";
import { DEPLOYMENT_CEILING } from "@/lib/content/disclosures";
import { EXAMPLE_AGENID } from "@/lib/scenarios";
import {
  NOT_REGISTERED_TRUST,
  PROOF_INVALID_TRUST,
  UNAVAILABLE_TRUST,
  UNKNOWN_TRUST,
  presentTrustLevel,
} from "@/lib/trust-presentation";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Verified AI Agent Badge: Embed Live Status",
  description:
    "Embed a live AgenID badge for your AI agent: a script badge for web pages and an SVG shield for READMEs. Both link back to the public Verification Card.",
  path: "/badge",
});

/**
 * Documentation for the two badge surfaces. Every snippet uses the specification's own
 * example identifier, which is not registered — so anyone who pastes it unchanged sees
 * the neutral NOT REGISTERED state, never a verified one. The level shown by a real
 * badge is read from the registry at render time and routed through
 * lib/trust-presentation.ts; nothing on this page decides a trust state.
 */
const SCRIPT = `<script src="${SITE_URL}/badge.js" data-agent="${EXAMPLE_AGENID}"></script>`;
const SHIELD_MD = `[![AgenID](${SITE_URL}/badge/${EXAMPLE_AGENID}/shield.svg)](${SITE_URL}/a/${EXAMPLE_AGENID})`;
const SHIELD_HTML = `<a href="${SITE_URL}/a/${EXAMPLE_AGENID}"><img src="${SITE_URL}/badge/${EXAMPLE_AGENID}/shield.svg" alt="AgenID status"></a>`;

/** Labels come from the one module that decides what a trust state looks like. */
const STATES: { state: string; reads: string; means: string }[] = [
  { state: "L1_REGISTERED", reads: presentTrustLevel("L1_REGISTERED").embedLabel, means: "The operator registered the agent and signed its manifest. A self-declaration, not a third-party check. Renders amber." },
  { state: "Not registered", reads: NOT_REGISTERED_TRUST.embedLabel, means: "The identifier is unknown to this registry. Absence of registration is not evidence of anything, so it renders neutral grey, never red." },
  { state: "Unrecognized level", reads: UNKNOWN_TRUST.embedLabel, means: "The badge fails closed: anything it cannot recognize renders as the weakest state, never as verified." },
  { state: "Registry unreachable", reads: UNAVAILABLE_TRUST.embedLabel, means: "Status is unknown at this moment. It is not a negative finding." },
  { state: "Signature does not verify", reads: PROOF_INVALID_TRUST.embedLabel, means: "The stored manifest proof failed re-verification. This is the one state that describes a real defect in the record." },
];

function Code({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-2xl border border-line bg-ink-2 p-4 font-mono text-xs leading-relaxed text-paper">
      <code>{code}</code>
    </pre>
  );
}

export default function BadgePage() {
  const crumbs = [
    { label: "Badge", href: "/badge" },
  ];
  const jsonLd = graph(
    {
      "@type": "TechArticle",
      headline: "Verified AI agent badge",
      url: `${SITE_URL}/badge`,
      description: "How to embed a live AgenID status badge for an AI agent.",
      publisher: { "@id": `${SITE_URL}/#organization` },
    }
  );
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={crumbs} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">Embed a live AgenID badge</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        A badge shows what the registry currently reports for one agent and links to that agent&rsquo;s public
        Verification Card, where a person can read the signed record and a program can fetch the JSON envelope and
        re-verify it. The badge is a convenience for humans; the signature underneath is what carries trust.
      </p>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">For web pages: the script badge</h2>
      <p className="mt-3 text-base leading-7 text-muted">
        Paste this where the badge should appear and replace the identifier with your agent&rsquo;s. It resolves the
        agent each time the page loads, so it never shows a stale result.
      </p>
      <div className="mt-4"><Code code={SCRIPT} /></div>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">For READMEs and Markdown: the SVG shield</h2>
      <p className="mt-3 text-base leading-7 text-muted">
        GitHub and most Markdown renderers strip scripts, so use the static shield. It always returns an image (never a
        broken one), and the link takes readers to the Verification Card.
      </p>
      <div className="mt-4"><Code code={SHIELD_MD} /></div>
      <p className="mt-4 text-base leading-7 text-muted">Or in HTML:</p>
      <div className="mt-2"><Code code={SHIELD_HTML} /></div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        The identifier in these snippets is the specification&rsquo;s own example and is not registered, so pasted
        unchanged it renders the neutral NOT REGISTERED state. Register your agent at{" "}
        <Link href="/issue" className="underline underline-offset-2">/issue</Link> to get your own identifier.
      </p>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">What a badge can say</h2>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[520px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line">
              {["Registry state", "Badge reads", "What it means"].map((c) => (
                <th key={c} scope="col" className="px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-muted">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STATES.map((s) => (
              <tr key={s.state} className="border-b border-line/60 last:border-0 align-top">
                <td className="px-4 py-3 font-mono text-xs text-paper">{s.state}</td>
                <td className="px-4 py-3 text-muted">{s.reads}</td>
                <td className="px-4 py-3 leading-relaxed text-muted">{s.means}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        The protocol defines agent status transitions and the badge renders them, but no write path on this deployment
        sets them yet: every registered agent is ACTIVE, and there is no revocation flow today.
      </p>

      <div className="mt-10 rounded-2xl border border-line bg-paper/[0.012] p-5">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-amber">What agenid.com issues today</div>
        <p className="mt-2.5 text-sm leading-relaxed text-muted text-pretty">{DEPLOYMENT_CEILING}</p>
      </div>

      <h2 className="mt-12 text-2xl font-semibold tracking-tight">A badge is not a permission</h2>
      <p className="mt-3 text-base leading-7 text-muted">
        A badge tells a visitor which agent this is and who declared it. It does not say what the agent is allowed to
        do, and it is not a safety or compliance claim. See{" "}
        <Link href="/learn/how-to-verify-an-ai-agent" className="underline underline-offset-2">how to verify an AI agent</Link>{" "}
        for the full check a program should run, and the{" "}
        <Link href="/glossary/verification-card" className="underline underline-offset-2">Verification Card</Link> entry for
        what the card shows.
      </p>
    </main>
  );
}
