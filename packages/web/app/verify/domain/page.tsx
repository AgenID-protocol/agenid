import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { DomainFlow } from "@/components/DomainFlow";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = pageMetadata({
  title: "Verify Domain Control for AI Agents",
  description:
    "Publish one DNS TXT record to prove you control a domain, so AI agents registered under it can be attributed to you. Domain control is evidence, not a level.",
  path: "/verify/domain",
});

export default function VerifyDomainPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ label: "Verify an agent", href: "/verify" }, { label: "Prove domain control" }]} className="mb-8" />
      <DomainFlow />
      <p className="mt-10 text-center text-xs text-muted">
        Registering an agent takes about a minute and does not require a domain.{" "}
        <Link href="/issue" className="text-paper underline hover:no-underline">
          Register an agent →
        </Link>
      </p>
    </div>
    </main>
  );
}
