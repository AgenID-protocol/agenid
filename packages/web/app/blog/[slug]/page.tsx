import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentArticle } from "@/components/content/ContentArticle";
import { BLOG, findPost } from "@/lib/content";
import { articleNode, faqPage, graph } from "@/lib/content/jsonld";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = findPost(slug);
  if (!p) return {};
  return pageMetadata({ title: p.title, description: p.description, path: `/blog/${p.slug}`, type: "article", keywords: p.keywords });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = findPost(slug);
  if (!p) notFound();
  const path = `/blog/${p.slug}`;
  const crumbs = [
    { label: "Blog", href: "/blog" },
    { label: p.h1 },
  ];
  return (
    <ContentArticle
      page={p}
      crumbs={crumbs}
      kicker={`Release notes · ${p.tags.join(" · ")}`}
      jsonLd={graph(articleNode(p, path, "BlogPosting", { datePublished: p.published }), faqPage(p))}
      byline={
        <>
          Shipped <time dateTime={p.published}>{p.published}</time> · commits{" "}
          {p.commits.map((c, i) => (
            <span key={c}>
              {i > 0 && ", "}
              <code>{c}</code>
            </span>
          ))}
        </>
      }
    />
  );
}
