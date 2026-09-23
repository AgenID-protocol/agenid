import Link from "next/link";
import type { ReactNode } from "react";
import type { ContentPage, ContentSection } from "@/lib/content/types";
import { labelFor } from "@/lib/content";
import { DEPLOYMENT_CEILING, IDENTITY_IS_NOT_PERMISSION } from "@/lib/content/disclosures";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Toc } from "@/components/ui/Toc";
import { findEntry } from "@/lib/scenarios";
import { getPartnerDoc } from "@/lib/partners";
import { Inline } from "./Inline";

/**
 * The one renderer for every long-form content page (/glossary, /learn, /compare,
 * /use-cases, /blog, /state-of-agent-identity, /why-agent-identity).
 *
 * Two disclosures are rendered unconditionally, below the article rather than in a
 * tooltip: the deployment ceiling and the identity-is-not-permission boundary. They are
 * not per-page options because an option is something a future page can forget.
 */

function label(path: string): string {
  const [, section, slug] = path.split("/");
  if (section === "how-it-works" && slug) return findEntry(slug)?.title ?? path;
  if (section === "docs" && slug === "partners" && path.split("/")[3]) {
    return getPartnerDoc(path.split("/")[3]!)?.title ?? path;
  }
  return labelFor(path);
}

/** Stable fragment id for a section heading, used by the table of contents. */
export function sectionId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function Section({ s }: { s: ContentSection }) {
  return (
    <section id={sectionId(s.heading)} className="mt-11 scroll-mt-24 first:mt-0">
      <h2 className="text-2xl font-semibold leading-tight tracking-tight text-balance">{s.heading}</h2>
      {s.body.map((p, i) => (
        <p key={i} className="mt-3.5 text-base leading-7 text-muted text-pretty">
          <Inline text={p} />
        </p>
      ))}
      {s.bullets && s.bullets.length > 0 && (
        <ul className="mt-3.5 list-disc space-y-1.5 pl-5 text-base leading-7 text-muted">
          {s.bullets.map((b, i) => (
            <li key={i}>
              <Inline text={b} />
            </li>
          ))}
        </ul>
      )}
      {s.table && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            {s.table.caption && <caption className="px-4 pt-3 text-left text-xs text-muted">{s.table.caption}</caption>}
            <thead>
              <tr className="border-b border-line">
                {s.table.columns.map((c) => (
                  <th key={c} scope="col" className="px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-muted">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0 align-top">
                  {r.map((cell, j) => (
                    <td key={j} className={`px-4 py-3 leading-relaxed ${j === 0 ? "text-paper" : "text-muted"}`}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ContentArticle({
  page,
  crumbs,
  kicker,
  jsonLd,
  intro,
  children,
  byline,
}: {
  page: ContentPage;
  /** Trail below "AgenID"; the last item is the current page. */
  crumbs: Crumb[];
  kicker: string;
  jsonLd: unknown;
  /** Rendered between the lead and the sections: a definition box, a comparison matrix. */
  intro?: ReactNode;
  /** Rendered after the FAQ. */
  children?: ReactNode;
  byline?: ReactNode;
}) {
  const toc = [
    ...page.sections.map((s) => ({ id: sectionId(s.heading), label: s.heading })),
    ...(page.faqs.length > 0 ? [{ id: "faq", label: "FAQ" }] : []),
    ...(page.sources && page.sources.length > 0 ? [{ id: "sources", label: "Sources" }] : []),
  ];
  return (
    <main className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:px-8">
      <div className="min-w-0 max-w-3xl">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={crumbs} className="mb-6" />

      <div className="eyebrow">{kicker}</div>
      <h1 className="mt-1 text-3xl font-bold leading-[1.1] tracking-tight text-balance">{page.h1}</h1>
      <div className="mt-3 font-mono text-xs text-muted">
        {byline ?? (
          <>
            Updated <time dateTime={page.updated}>{page.updated}</time>
          </>
        )}
      </div>
      {page.lead.map((p, i) => (
        <p key={i} className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
          <Inline text={p} />
        </p>
      ))}

      {intro && <div className="mt-8">{intro}</div>}

      <article className="mt-12">
        {page.sections.map((s) => (
          <Section key={s.heading} s={s} />
        ))}
      </article>

      {page.faqs.length > 0 && (
        <section className="mt-14" aria-labelledby="faq">
          <h2 id="faq" className="scroll-mt-24 text-2xl font-semibold leading-tight tracking-tight">
            Frequently asked questions
          </h2>
          <div className="mt-5 divide-y divide-line rounded-2xl border border-line">
            {page.faqs.map((f) => (
              <div key={f.q} className="p-5">
                <h3 className="text-base font-medium leading-snug text-paper">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted text-pretty">
                  <Inline text={f.a} />
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {children}

      <div className="mt-12 grid gap-3.5 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-paper/[0.012] p-5">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-amber">What agenid.com issues today</div>
          <p className="mt-2.5 text-sm leading-relaxed text-muted text-pretty">{DEPLOYMENT_CEILING}</p>
        </div>
        <div className="rounded-2xl border border-line bg-paper/[0.012] p-5">
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Identity is not permission</div>
          <p className="mt-2.5 text-sm leading-relaxed text-muted text-pretty">{IDENTITY_IS_NOT_PERMISSION}</p>
        </div>
      </div>

      {page.sources && page.sources.length > 0 && (
        <section className="mt-12" aria-labelledby="sources">
          <h2 id="sources" className="scroll-mt-24 text-lg font-semibold tracking-tight">
            Sources
          </h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
            {page.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noopener noreferrer" target="_blank" className="underline underline-offset-2 hover:text-paper">
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      {page.related.length > 0 && (
        <section className="mt-12" aria-labelledby="related">
          <h2 id="related" className="text-lg font-semibold tracking-tight">
            Related
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {page.related.map((r) => (
              <Link key={r} href={r} className="card block p-4 transition card-hover">
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{r.split("/")[1] || "home"}</div>
                <div className="mt-1.5 text-sm font-medium leading-snug tracking-tight">{label(r)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-14 p-6">
        <h2 className="text-xl font-semibold leading-tight tracking-tight">Give your agent an identity</h2>
        <p className="mt-2.5 text-sm leading-relaxed text-muted text-pretty">
          Register an agent in the browser — the signing key is generated on your device and never sent to AgenID — or
          resolve an existing AgenID and re-check its signature yourself.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/issue" className="btn btn-primary">
            Register an agent
          </Link>
          <Link href="/verify" className="btn btn-ghost">
            Verify an AgenID
          </Link>
        </div>
      </section>
      </div>
      {toc.length >= 4 && (
        <aside className="hidden lg:block">
          <Toc items={toc} />
        </aside>
      )}
    </main>
  );
}
