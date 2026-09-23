import Link from "next/link";
import { SITE_URL } from "@/lib/api";

export type Crumb = { label: string; href?: string };

/**
 * One breadcrumb trail for every page below the top level, with BreadcrumbList JSON-LD.
 * The last crumb is the current page: not a link, and `aria-current="page"`.
 */
export function Breadcrumbs({ items, className = "", jsonLd = true, center = false }: { items: Crumb[]; className?: string; jsonLd?: boolean; center?: boolean }) {
  const all: Crumb[] = [{ label: "AgenID", href: "/" }, ...items];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: all.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: new URL(c.href, SITE_URL).toString() } : {}),
    })),
  };
  return (
    <nav aria-label="Breadcrumb" className={`text-xs text-muted ${className}`}>
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />}
      <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${center ? "justify-center" : ""}`}>
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-2">
              {last || !c.href ? (
                <span aria-current={last ? "page" : undefined} className={last ? "text-paper-dim" : ""}>
                  {c.label}
                </span>
              ) : (
                <Link href={c.href} className="hover:text-paper">
                  {c.label}
                </Link>
              )}
              {!last && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
