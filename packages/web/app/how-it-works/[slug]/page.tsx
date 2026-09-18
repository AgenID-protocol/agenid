import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioPlayer } from "@/components/scenarios/ScenarioPlayer";
import { TodayVsAgentic, TODAY_VS_PROVES } from "@/components/scenarios/TodayVsAgentic";
import { CHALLENGE_IS_PROPOSED, findEntry, findScenario, ISSUANCE_CEILING, nextEntry, scenarioSlugs } from "@/lib/scenarios";

export function generateStaticParams() {
  return scenarioSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.summary,
    alternates: { canonical: `/how-it-works/${entry.slug}` },
  };
}

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) notFound();

  const scenario = findScenario(slug);
  const proves = scenario?.proves ?? TODAY_VS_PROVES;
  const next = nextEntry(slug);

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      <div className="mb-2 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">
          AgenID
        </Link>{" "}
        /{" "}
        <Link href="/how-it-works" className="hover:text-paper">
          How it works
        </Link>{" "}
        / {entry.title}
      </div>

      <div className="flex items-center gap-2.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-mint" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mint">Example verification flow</span>
        <span className="text-muted/50" aria-hidden="true">
          &middot;
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{entry.kicker}</span>
      </div>

      <h1 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight text-balance">{entry.title}</h1>
      <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted text-pretty">{entry.summary}</p>

      <div className="mt-8">
        {scenario ? <ScenarioPlayer scenario={scenario} /> : <TodayVsAgentic />}
      </div>

      {/*
        Two disclosures, on every scenario page, below the player rather than tucked in a
        tooltip. `proves` is the scoped statement for this scenario; ISSUANCE_CEILING is
        the one that applies to all of them. test/scenarios.test.ts asserts both reach
        this page — a disclosure a future author can forget is one a future author will.
      */}
      <div className="mt-10 rounded-2xl border border-line bg-paper/[0.012] p-5">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">What AgenID proves here</div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted text-pretty">{proves}</p>
      </div>

      <div className="mt-3.5 rounded-2xl border border-line bg-paper/[0.012] p-5">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber">Illustration, not deployment</div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted text-pretty">{ISSUANCE_CEILING}</p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted text-pretty">{CHALLENGE_IS_PROPOSED}</p>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <Link
          href="/how-it-works"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-paper"
        >
          &larr; All scenarios
        </Link>
        {next && (
          <Link
            href={`/how-it-works/${next.slug}`}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted hover:text-paper"
          >
            {next.title} &rarr;
          </Link>
        )}
      </div>
    </main>
  );
}
