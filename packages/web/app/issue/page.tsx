import type { Metadata } from "next";
import { pageMetadata, webApplicationJsonLd } from "@/lib/seo";
import Link from "next/link";
import { IssueWizard } from "@/components/IssueWizard";
import { SITE_URL } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = pageMetadata({
  title: "Give Your AI Agent a Verifiable Identity",
  description:
    "Generate an Ed25519 key in your browser, sign an operator manifest, and get a permanent agenid:<ULID> with a public Verification Card. No account, no key upload.",
  path: "/issue",
});


export default function IssuePage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
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
        <Breadcrumbs items={[{ label: "Give your agent an identity" }]} className="mb-6" center />
        <div className="eyebrow">Give your agent an identity</div>
        <h1 className="display !text-4xl sm:!text-5xl">One agent. One minute. No account.</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-paper-dim">
          Your agent gets a permanent identifier, a public Verification Card anyone can resolve, and a badge you can
          embed. You keep the only copy of the signing key.
        </p>
      </div>

      {/* The three steps now live inside the wizard, driven by real events. */}

      <IssueWizard siteUrl={SITE_URL} />

      <div className="mt-10 rounded-lg border border-line bg-ink-2 p-5 text-sm leading-6 text-paper-dim">
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
    </div>
    </main>
  );
}
