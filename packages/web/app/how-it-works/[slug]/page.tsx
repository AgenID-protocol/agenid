import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScenarioPlayer } from "@/components/scenarios/ScenarioPlayer";
import { TodayVsAgentic, TODAY_VS_PROVES } from "@/components/scenarios/TodayVsAgentic";
import {
  CHALLENGE_IS_PROPOSED,
  findEntry,
  findScenario,
  ISSUANCE_CEILING,
  nextEntry,
  scenarioSlugs,
  seoFor,
} from "@/lib/scenarios";
import { SITE_URL } from "@/lib/api";

export function generateStaticParams() {
  return scenarioSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) return {};
  const seo = seoFor(slug);
  const title = seo?.title ?? entry.title;
  const description = seo?.description ?? entry.summary;
  const url = `/how-it-works/${entry.slug}`;
  return {
    title,
    description,
    keywords: seo ? [...seo.keywords] : undefined,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "AgenID", type: "article" },
    twitter: { card: "summary", title, description },
  };
}

/**
 * Structured data for the page: the article itself, its breadcrumb trail, and its FAQ.
 * Built only from content that is visibly rendered below, so the JSON-LD never says
 * anything the page does not.
 */
function jsonLdFor(slug: string, title: string, description: string, faqs: readonly { q: string; a: string }[]) {
  const url = `${SITE_URL}/how-it-works/${slug}`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "TechArticle",
      "@id": `${url}#article`,
      headline: title,
      description,
      url,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", name: "AgenID", url: SITE_URL },
      publisher: { "@type": "Organization", name: "AgenID", url: SITE_URL },
      about: ["AI agent identity", "AI agent verification"],
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "AgenID", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: "How it works", item: `${SITE_URL}/how-it-works` },
        { "@type": "ListItem", position: 3, name: title, item: url },
      ],
    },
  ];
  if (faqs.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

export default async function ScenarioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = findEntry(slug);
  if (!entry) notFound();

  const scenario = findScenario(slug);
  const seo = seoFor(slug);
  const proves = scenario?.proves ?? TODAY_VS_PROVES;
  const next = nextEntry(slug);
  const related = (seo?.related ?? []).map((s) => findEntry(s)).filter((e) => e !== undefined);
  const jsonLd = jsonLdFor(entry.slug, seo?.h1 ?? entry.title, seo?.description ?? entry.summary, seo?.faqs ?? []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-14">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-2 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">
          AgenID
        </Link>{" "}
        /{" "}
        <Link href="/how-it-works" className="hover:text-paper">
          How it works
        </Link>{" "}
        / {entry.title}
      </nav>

      <div className="flex items-center gap-2.5">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-mint" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mint">Example verification flow</span>
        <span className="text-muted/50" aria-hidden="true">
          &middot;
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{entry.kicker}</span>
      </div>

      <h1 className="mt-4 text-[32px] font-bold leading-[1.1] tracking-tight text-balance">{seo?.h1 ?? entry.title}</h1>
      {seo ? (
        seo.lead.map((p, i) => (
          <p key={i} className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted text-pretty">
            {p}
          </p>
        ))
      ) : (
        <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted text-pretty">{entry.summary}</p>
      )}

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

      {seo && (
        <article className="mt-14">
          {seo.sections.map((s) => (
            <section key={s.heading} className="mt-10 first:mt-0">
              <h2 className="text-[22px] font-semibold leading-tight tracking-tight text-balance">{s.heading}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-3.5 text-[15px] leading-7 text-muted text-pretty">
                  {p}
                </p>
              ))}
            </section>
          ))}

          <section className="mt-14" aria-labelledby="faq">
            <h2 id="faq" className="text-[22px] font-semibold leading-tight tracking-tight">
              Frequently asked questions
            </h2>
            <div className="mt-5 divide-y divide-line rounded-2xl border border-line">
              {seo.faqs.map((f) => (
                <div key={f.q} className="p-5">
                  <h3 className="text-[15.5px] font-medium leading-snug text-paper">{f.q}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted text-pretty">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        </article>
      )}

      {related.length > 0 && (
        <section className="mt-14" aria-labelledby="related">
          <h2 id="related" className="text-[22px] font-semibold leading-tight tracking-tight">
            Related scenarios
          </h2>
          <div className="mt-5 grid gap-3.5 sm:grid-cols-3">
            {related.map((e) => (
              <Link key={e.slug} href={`/how-it-works/${e.slug}`} className="card block p-4 transition hover:border-mint/40">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{e.kicker}</div>
                <div className="mt-2 text-[15px] font-medium leading-tight tracking-tight">{e.title}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-14 p-6">
        <h2 className="text-[20px] font-semibold leading-tight tracking-tight">Give your agent an identity</h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-muted text-pretty">
          Register an agent in the browser — the signing key is generated on your device and never sent to AgenID — or
          resolve an existing AgenID and re-check its signature yourself.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
          <Link href="/issue" className="text-paper underline underline-offset-2 hover:no-underline">
            Register an agent
          </Link>
          <Link href="/verify" className="text-paper underline underline-offset-2 hover:no-underline">
            Verify an AgenID
          </Link>
          <Link href="/trust" className="text-paper underline underline-offset-2 hover:no-underline">
            How the trust model works
          </Link>
          <Link href="/why-agent-identity" className="text-paper underline underline-offset-2 hover:no-underline">
            Why agents need identity
          </Link>
        </div>
      </section>

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
