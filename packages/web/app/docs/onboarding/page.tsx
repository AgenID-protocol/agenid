import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOnboardingDoc } from "@/lib/onboarding";
import { DocCodeCopy } from "@/components/DocCodeCopy";
import { SITE_URL } from "@/lib/api";

const DESCRIPTION =
  "How to register an AI agent with the AgenID registry: generate an Ed25519 keypair, build and sign a manifest, register it, embed the verification badge, and request independent verification.";

export function generateMetadata(): Metadata {
  const doc = getOnboardingDoc();
  return {
    title: doc?.title ?? "Operator Onboarding Guide",
    description: DESCRIPTION,
    alternates: { canonical: "/docs/onboarding" },
  };
}

export default function OnboardingPage() {
  const doc = getOnboardingDoc();
  if (!doc) return notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.title,
    description: DESCRIPTION,
    url: `${SITE_URL}/docs/onboarding`,
    about: { "@type": "DefinedTerm", name: "agenid:<ULID>", url: `${SITE_URL}/#identity` },
    license: "https://github.com/AgenID-protocol/spec/blob/main/LICENSE",
  };

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <DocCodeCopy />

      <div className="mb-6 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">AgenID</Link> / Operator onboarding
      </div>

      {/* eslint-disable-next-line react/no-danger */}
      <article className="prose-agenid" dangerouslySetInnerHTML={{ __html: doc.html }} />

      <div className="mt-10 border-t border-line/70 pt-6 text-sm">
        <Link href="/docs/partners" className="underline hover:text-paper">
          Partner integration briefs →
        </Link>
      </div>
    </main>
  );
}
