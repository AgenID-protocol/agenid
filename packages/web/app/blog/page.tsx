import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { BLOG } from "@/lib/content";
import { graph } from "@/lib/content/jsonld";
import { SITE_URL } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "AgenID Blog: Release Notes & Engineering",
    description:
      "One post per shipped AgenID capability: what changed, why, how it works and what it does not do yet. Engineering notes from the open agent identity protocol.",
    path: "/blog",
  }),
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/feed.xml" } },
};

export default function BlogIndexPage() {
  const crumbs = [
    { label: "Blog", href: "/blog" },
  ];
  const jsonLd = graph(
    {
      "@type": "Blog",
      name: "AgenID Blog",
      url: `${SITE_URL}/blog`,
      blogPost: BLOG.map((p) => ({ "@type": "BlogPosting", headline: p.h1, url: `${SITE_URL}/blog/${p.slug}`, datePublished: p.published })),
    }
  );
  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={crumbs} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">Release notes and engineering</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        One post per shipped capability, written from the commit record: what changed, why, how it works, and what it
        still does not do. Subscribe with the <a href="/blog/feed.xml" className="underline underline-offset-2">RSS feed</a>.
      </p>
      <ol className="mt-10 space-y-4">
        {BLOG.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="card block p-5 transition card-hover">
              <div className="font-mono text-xs uppercase tracking-[0.16em] text-muted">
                <time dateTime={p.published}>{p.published}</time> · {p.tags.join(" · ")}
              </div>
              <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight">{p.h1}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.description}</p>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
