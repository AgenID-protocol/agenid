import { BLOG } from "@/lib/content";
import { SITE_URL } from "@/lib/api";

/** RSS 2.0 feed of the blog, generated at build time from the same data as the pages. */
export const dynamic = "force-static";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function GET() {
  const items = BLOG.map(
    (p) => `    <item>
      <title>${esc(p.h1)}</title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${p.slug}</guid>
      <pubDate>${new Date(`${p.published}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(p.description)}</description>
    </item>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AgenID Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Release notes and engineering from the AgenID agent identity protocol.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}
