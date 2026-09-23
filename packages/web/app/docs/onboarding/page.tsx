import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOnboardingDoc } from "@/lib/onboarding";
import { DocCodeCopy } from "@/components/DocCodeCopy";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

// "…and request independent verification" was dropped from this description: the
// assertion write path is not deployed and the root authority key does not exist, so a
// search snippet promising it described a step nobody can take today.
const DESCRIPTION =
  "How to register an AI agent with AgenID: generate an Ed25519 keypair, sign an operator manifest, register it, and embed the live verification badge.";

export function generateMetadata(): Metadata {
  const doc = getOnboardingDoc();
  return pageMetadata({
    title: doc?.title ?? "Operator Onboarding Guide",
    description: DESCRIPTION,
    path: "/docs/onboarding",
    type: "article",
  });
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
