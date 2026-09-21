import type { Metadata } from "next";
import Link from "next/link";
import { groupedCatalogue, ISSUANCE_CEILING, NOT_BUILT } from "@/lib/scenarios";

export const metadata: Metadata = {
  title: "How AI Agent Identity Verification Works: 9 Scenarios",
  description:
    "See how businesses and other AI agents verify an agent's identity in nine real-world scenarios, from booking a dentist to B2B procurement and agent delegation.",
  keywords: [
    "how AI agent verification works",
    "AI agent identity examples",
    "AI agent use cases",
    "agent-to-agent verification",
    "agentic commerce identity",
  ],
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How AI Agent Identity Verification Works",
    description:
      "Nine real-world scenarios showing how a business or another agent verifies which AI agent it is dealing with.",
    url: "/how-it-works",
    siteName: "AgenID",
    type: "website",
  },
};

export default function HowItWorksPage() {
  const groups = groupedCatalogue();

  return (
    <main className="mx-auto max-w-4xl px-5 py-16">
      <div className="mb-2 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">
          AgenID
        </Link>{" "}
        / How it works
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-balance">
        How AI agent identity verification works
      </h1>
      <p className="mt-5 max-w-2xl text-[15px] leading-7 text-muted text-pretty">
        An agent saying its AgenID is not the same thing as proving it. Nine scenarios, one visual language: the same identity object, the same verification handshake, the same
        point at which a counterparty stops and asks for proof. Every one of them also plays{" "}
        <span className="text-paper">without</span> a portable identity layer, because that comparison is the
        argument.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {["Loops continuously", "Pauses off-screen", "Reduced-motion fallback", "L1–L4 labels", "No private keys, ever"].map(
          (t) => (
            <span key={t} className="pill !text-[10px] !uppercase !tracking-wider">
              {t}
            </span>
          ),
        )}
      </div>

      {/*
        The ceiling, stated before anyone opens a scenario rather than after.
        Several of these illustrate L2, L3 and L4; the reference deployment issues none
        of them, and a reader should learn that from the index rather than discover it
        by trying to get one.
      */}
      <div className="card mt-8 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber">What these are, and are not</div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted text-pretty">{ISSUANCE_CEILING}</p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted text-pretty">
          The challenge–response exchange each scenario shows is a proposed interaction pattern. Protocol v1.1.1
          defines the signed objects — manifest, proof, key document, assertion — not this exchange. What you can do
          today is{" "}
          <Link href="/issue" className="text-paper underline underline-offset-2 hover:no-underline">
            register an identity
          </Link>{" "}
          and{" "}
          <Link href="/verify" className="text-paper underline underline-offset-2 hover:no-underline">
            resolve one
          </Link>
          .
        </p>
      </div>

      {groups.map(({ group, entries }) => (
        <section key={group} className="mt-12">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{group}</div>
          <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
            {entries.map((e) => (
              <Link
                key={e.slug}
                href={`/how-it-works/${e.slug}`}
                className="card block p-5 transition hover:border-mint/40"
              >
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{e.kicker}</div>
                <div className="mt-2.5 text-[18px] font-medium leading-tight tracking-tight">{e.title}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted text-pretty">{e.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/*
        Named rather than omitted. The set sketched sixteen scenarios and built nine; a
        reader who came looking for insurance should find out it is missing, not assume
        the protocol does not reach it.
      */}
      <div className="mt-14 rounded-2xl border border-line bg-paper/[0.012] p-5">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">Same system, not built yet</div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted text-pretty">
          {NOT_BUILT.join(", ")}. Each is a configuration of the same handshake rather than a different mechanism —
          they are simply not drawn.
        </p>
      </div>
    </main>
  );
}
