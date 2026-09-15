import type { Metadata } from "next";
import Link from "next/link";
import { DomainFlow } from "@/components/DomainFlow";

export const metadata: Metadata = {
  title: "Verify a Domain",
  description:
    "Publish one TXT record to prove you control a domain, so AI agents registered under it can be attributed to you. Domain control is evidence an authority weighs — not a verification level.",
  alternates: { canonical: "/verify/domain" },
};

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
