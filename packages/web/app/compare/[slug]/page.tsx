import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content/ContentArticle";
import { Inline } from "@/components/content/Inline";
import { COMPARISONS, findComparison } from "@/lib/content";
import { articleNode, faqPage, graph } from "@/lib/content/jsonld";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = findComparison(slug);
  if (!c) return {};
  return pageMetadata({ title: c.title, description: c.description, path: `/compare/${c.slug}`, type: "article", keywords: c.keywords });
}

/**
 * A comparison page. Text only — no third-party mark is rendered, redrawn or implied
 * (see public/assets/ecosystem/README.md). Every claim about the other approach is
 * cited in `sources`, which test/content.test.ts requires.
 */
export default async function ComparisonPageRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = findComparison(slug);
  if (!c) notFound();
  const path = `/compare/${c.slug}`;
  const crumbs = [
    { label: "Comparisons", href: "/compare" },
    { label: c.subject },
  ];
  return (
    <ContentArticle
      page={c}
      crumbs={crumbs}
      kicker={`Comparison · ${c.owner}`}
      jsonLd={graph(articleNode(c, path, "TechArticle", { about: [{ "@type": "Thing", name: "AgenID" }, { "@type": "Thing", name: c.subject }] }), faqPage(c))}
      intro={
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-ink-2 p-5">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{c.subject}, in its owner&rsquo;s terms</div>
            <p className="mt-2.5 text-sm leading-relaxed text-paper text-pretty">
              <Inline text={c.subjectSummary} />
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <caption className="px-4 pt-3 text-left text-xs text-muted">
                Side by side, as each is described in its public documentation. Sources are listed below.
              </caption>
              <thead>
                <tr className="border-b border-line">
                  {c.matrix.columns.map((col) => (
                    <th key={col} scope="col" className="px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.matrix.rows.map((r) => (
                  <tr key={r[0]} className="border-b border-line/60 last:border-0 align-top">
                    <th scope="row" className="px-4 py-3 font-medium text-paper">{r[0]}</th>
                    <td className="px-4 py-3 leading-relaxed text-muted"><Inline text={r[1]} /></td>
                    <td className="px-4 py-3 leading-relaxed text-muted"><Inline text={r[2]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-2xl border border-line bg-paper/[0.012] p-5">
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Where they fit together</div>
            <p className="mt-2.5 text-sm leading-relaxed text-muted text-pretty">
              <Inline text={c.complementary} />
            </p>
          </div>
        </div>
      }
    >
      <p className="mt-10 text-xs leading-relaxed text-muted">
        Product names belong to their owners. This page is an independent, factual description based on public
        documentation as of {c.updated}; it implies no partnership, endorsement or affiliation. Corrections are welcome
        via the <a href="https://github.com/AgenID-protocol/spec" rel="noopener noreferrer" target="_blank" className="underline underline-offset-2">spec repository</a>.
      </p>
    </ContentArticle>
  );
}
