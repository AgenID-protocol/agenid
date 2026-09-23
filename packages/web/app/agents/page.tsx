import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DirectoryKeyFileForm } from "@/components/DirectoryConsent";
import { DIRECTORY_DISCLOSURES, DIRECTORY_PAGE_MAX, getDirectoryStore } from "@/lib/directory";
import { fetchEnvelope, SITE_URL } from "@/lib/api";
import { presentEnvelopeTrust } from "@/lib/trust-presentation";
import { DEPLOYMENT_CEILING } from "@/lib/content/disclosures";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "AI Agent Directory: Registered, Opt-In Agents",
  description:
    "Browse AI agents registered with AgenID whose operators chose to be listed. Each links to a Verification Card you can re-verify yourself. Listing is not endorsement.",
  path: "/agents",
});

/** Rebuilt at most every five minutes; a new listing appears within that window. */
export const revalidate = 300;

type Row = {
  agentId: string;
  name: string;
  operator: string;
  operatorDomain: string;
  purpose: string;
  label: string;
  glyph: string;
  listedAt: string;
};

/**
 * The public agent directory: registered agents whose operators signed a listing consent,
 * and nobody else. Each row's trust state comes from that agent's resolution envelope via
 * lib/trust-presentation.ts — this page decides nothing about any agent.
 *
 * If the directory cannot be read, the page says so. It never renders an empty list in
 * that case, because "no agents" and "status unknown" are different claims.
 */
async function load(): Promise<{ ok: true; rows: Row[] } | { ok: false }> {
  try {
    const listed = await getDirectoryStore().listListed(DIRECTORY_PAGE_MAX);
    const rows: Row[] = [];
    for (const r of listed) {
      const { envelope } = await fetchEnvelope(r.agent_id);
      if (!envelope || envelope.status !== "ACTIVE") continue;
      const trust = presentEnvelopeTrust(envelope);
      rows.push({
        agentId: envelope.agent_id,
        name: envelope.manifest.identity.name,
        operator: envelope.manifest.ownership.operator,
        operatorDomain: envelope.manifest.ownership.operator_domain,
        purpose: envelope.manifest.purpose.summary,
        label: trust.cardLabel,
        glyph: trust.level ?? trust.badgeLabel,
        listedAt: r.updated_at.slice(0, 10),
      });
    }
    return { ok: true, rows };
  } catch {
    return { ok: false };
  }
}

export default async function AgentDirectoryPage() {
  const result = await load();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AgenID agent directory",
    url: `${SITE_URL}/agents`,
    ...(result.ok
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: result.rows.length,
            itemListElement: result.rows.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.name, url: `${SITE_URL}/a/${r.agentId}` })),
          },
        }
      : {}),
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={[{ label: "Agent directory" }]} className="mb-6" />
      <h1 className="text-3xl font-bold leading-[1.1] tracking-tight">Agent directory</h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted text-pretty">
        Registered agents whose operators chose to be listed. Registration alone never lists an agent; each entry here
        exists because the operator signed a listing consent with the agent&rsquo;s own key. Open any card to read the
        signed record and re-verify it yourself.
      </p>
      <ul className="mt-6 max-w-2xl space-y-1.5 text-sm text-muted">
        {DIRECTORY_DISCLOSURES.map((d) => (
          <li key={d} className="flex gap-3">
            <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
            <span>{d}</span>
          </li>
        ))}
      </ul>

      <section className="mt-10" aria-labelledby="listed">
        <h2 id="listed" className="text-xl font-semibold tracking-tight">
          Listed agents{result.ok ? ` (${result.rows.length})` : ""}
        </h2>
        {!result.ok ? (
          <p className="mt-4 text-sm text-muted" role="status">
            The directory could not be read just now. This is an availability problem, not an empty directory — try again
            shortly, or resolve an agent directly at <Link href="/verify" className="underline">/verify</Link>.
          </p>
        ) : result.rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No operator has listed an agent yet. Registered agents still resolve by identifier at{" "}
            <Link href="/verify" className="underline">/verify</Link>.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {result.rows.map((r) => (
              <Link key={r.agentId} href={`/a/${r.agentId}`} className="card card-hover block p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold leading-snug tracking-tight">{r.name}</h3>
                  <span className="pill shrink-0">{r.label}</span>
                </div>
                <p className="mt-1 text-sm text-paper-dim">
                  {r.operator} · {r.operatorDomain}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{r.purpose}</p>
                <p className="mt-3 break-all font-mono text-xs text-muted">{r.agentId}</p>
                <p className="mt-1 text-xs text-muted">Listed {r.listedAt} by its operator</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <DirectoryKeyFileForm />
        <div className="card p-6">
          <h2 className="text-xl font-semibold tracking-tight">Not registered yet?</h2>
          <p className="mt-2 text-sm text-muted">
            Register an agent in about a minute. The key is generated in your browser, and you can list the agent from the
            confirmation screen.
          </p>
          <Link href="/issue" className="btn btn-primary mt-4">
            Give your agent an identity
          </Link>
          <div className="mt-6 rounded-lg border border-line p-4">
            <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted">What agenid.com issues today</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{DEPLOYMENT_CEILING}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
