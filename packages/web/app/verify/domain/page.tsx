import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { DomainFlow } from "@/components/DomainFlow";

export const metadata: Metadata = pageMetadata({
  title: "Verify Domain Control for AI Agents",
  description:
    "Publish one DNS TXT record to prove you control a domain, so AI agents registered under it can be attributed to you. Domain control is evidence, not a level.",
  path: "/verify/domain",
});

export default function VerifyDomainPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <div className="mb-8 font-mono text-[11px] text-muted">
        <Link href="/verify" className="underline hover:no-underline">
          Verify
        </Link>{" "}
        / DOMAIN
      </div>
      <DomainFlow />
      <p className="mt-10 text-center text-xs text-muted">
        Registering an agent takes about a minute and does not require a domain.{" "}
        <Link href="/issue" className="text-paper underline hover:no-underline">
          Register an agent →
        </Link>
      </p>
    </main>
  );
}
