import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { EcosystemMatrix, type MatrixEntry } from "@/components/ecosystem/EcosystemMatrix";
import { IdentityFlow } from "@/components/ecosystem/IdentityFlow";
import { SITE_URL } from "@/lib/api";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ECOSYSTEM_CATEGORIES, ECOSYSTEM_STATUSES, getEcosystem, readLogoSvg } from "@/lib/ecosystem";

export const metadata: Metadata = pageMetadata({
  title: "AI Agent Ecosystem Compatibility Matrix",
  description:
    "The voice platforms, models, frameworks and identity systems an agenid:<ULID> can travel across. Technical compatibility only; each entry states what was reviewed.",
  path: "/ecosystem",
});

/** Spelled from the registry so the heading cannot drift from the cards below it. */
const STATUS_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"] as const;
const STATUS_COUNT = STATUS_WORDS[Object.keys(ECOSYSTEM_STATUSES).length] ?? Object.keys(ECOSYSTEM_STATUSES).length;

export default function EcosystemPage() {
  const all = getEcosystem();
  const labelOf = (id: string) => ECOSYSTEM_CATEGORIES.find((c) => c.id === id)?.label ?? id;
  const documented = all.filter((e) => typeof e.docs === "string" && e.docs.startsWith("/docs/partners/"));

  const entries: MatrixEntry[] = all.map((e) => ({
    id: e.id,
    name: e.name,
    abbr: e.abbr,
    category: e.category,
    categoryLabel: labelOf(e.category),
    description: e.description,
    website: e.website,
    status: e.status,
    statusLabel: ECOSYSTEM_STATUSES[e.status].label,
    integration_type: e.integration_type,
    last_verified: e.last_verified,
    compatibility_note: e.compatibility_note,
    ...(e.docs ? { docs: e.docs } : {}),
    logoSvg: readLogoSvg(e),
  }));

  const countFor = (status: keyof typeof ECOSYSTEM_STATUSES) => all.filter((e) => e.status === status).length;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AgenID Compatibility Matrix",
    url: `${SITE_URL}/ecosystem`,
    description: metadata.description,
    hasPart: entries.map((e) => ({
      "@type": "SoftwareApplication",
      name: e.name,
      applicationCategory: e.categoryLabel,
      url: e.website,
      description: e.compatibility_note,
    })),
  };

  return (
    <main>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="hero-atmos border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ label: "The agent ecosystem" }]} className="mb-6" />
          <h1 className="display max-w-3xl">The Agent Ecosystem</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-paper-dim">
            AgenID is designed to work across the platforms where AI agents live. Your agent can change platforms. Its
            identity shouldn&rsquo;t have to.
          </p>
          <p className="mt-4 max-w-3xl text-sm text-muted">
            An <span className="font-mono">agenid:&lt;ULID&gt;</span> identifies the agent and the party accountable for
            it — never the model, framework, or host underneath. That is what makes this list possible: nothing in the
            protocol references any vendor on it.
          </p>
        </div>
      </section>

      {/* WHAT A LISTING MEANS — deliberately above the grid, not a footnote below it */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="eyebrow">What a listing means</div>
          {/* Count derived, not typed — this read "Three statuses" until a fourth was added. */}
          <h2 className="section-title">
            {STATUS_COUNT} statuses. Only one of them is currently issued.
          </h2>
          {/* Unit chart: one square per listed platform, grouped by layer. It replaces four
              equal-weight cards that gave "0 entries" the same visual mass as "27 entries".
              Every square is neutral — Compatible is not a trust state — and the empty
              statuses are stated as explicit zeros beside it. */}
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_18rem]">
            <figure
              role="img"
              aria-label={`${all.length} platforms listed across ${ECOSYSTEM_CATEGORIES.length} layers. ${(Object.keys(ECOSYSTEM_STATUSES) as (keyof typeof ECOSYSTEM_STATUSES)[]).map((k) => `${countFor(k)} ${ECOSYSTEM_STATUSES[k].label}`).join(", ")}.`}
              className="card p-5 sm:p-6"
            >
              <div aria-hidden className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                {ECOSYSTEM_CATEGORIES.map((c) => {
                  const inLayer = all.filter((e) => e.category === c.id);
                  return (
                    <div key={c.id}>
                      <div className="text-xs font-medium text-paper-dim">{c.label}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {inLayer.map((e) => (
                          <span key={e.id} title={e.name} className="h-4 w-4 rounded-sm border border-line-strong bg-paper/[0.08]" />
                        ))}
                      </div>
                      <div className="mt-1 text-xs text-muted">{inLayer.length}</div>
                    </div>
                  );
                })}
              </div>
              <figcaption className="mt-6 border-t border-line pt-4 text-sm text-paper-dim">
                {all.length} listed · {countFor("compatible")} Compatible · {countFor("verified-integration")} verified integrations · {countFor("official-partner")} partners
              </figcaption>
            </figure>
            <dl className="card divide-y divide-line p-0">
              {(Object.keys(ECOSYSTEM_STATUSES) as (keyof typeof ECOSYSTEM_STATUSES)[]).map((key) => (
                <div key={key} className="flex items-baseline justify-between gap-3 px-5 py-4">
                  <dt className="text-sm text-paper">{ECOSYSTEM_STATUSES[key].label}</dt>
                  <dd className="font-mono text-2xl text-paper">{countFor(key)}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-8 grid auto-rows-fr gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(ECOSYSTEM_STATUSES) as (keyof typeof ECOSYSTEM_STATUSES)[]).map((key) => {
              const n = countFor(key);
              return (
                <div key={key} className="rounded-lg border border-line p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="pill">{ECOSYSTEM_STATUSES[key].label}</span>
                    <span className="text-xs text-muted">
                      {n} {n === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-paper-dim">{ECOSYSTEM_STATUSES[key].definition}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-6 max-w-3xl text-sm text-muted">
            Every entry below is <strong className="font-semibold text-paper">Compatible</strong> and nothing more. No
            platform on this page ships AgenID code, and{" "}
            <Link href="/docs/partners" className="text-paper underline underline-offset-2 hover:no-underline">
              no adapter package exists for any of them
            </Link>
            . A listing is a technical statement about how an identity travels through a platform&rsquo;s existing,
            documented API surface — it is not an endorsement, a partnership, or a relationship of any kind. All product
            names and marks belong to their respective owners.
          </p>
        </div>
      </section>

      {/* IDENTITY FLOW */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="eyebrow">One identity, many platforms</div>
          <h2 className="section-title mb-10">The platforms change. The identity doesn&rsquo;t.</h2>
          <IdentityFlow />
        </div>
      </section>

      {/* MATRIX */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24 lg:px-8">
          <div className="eyebrow">Compatibility matrix</div>
          <h2 className="section-title mb-10">
            {all.length} platforms across {ECOSYSTEM_CATEGORIES.length} layers.
          </h2>
          <EcosystemMatrix entries={entries} categories={ECOSYSTEM_CATEGORIES.map((c) => ({ ...c }))} />

          {/* Server-rendered on purpose. The matrix is a client component whose docs links
              only exist in the browser after a tab is selected, so crawlers saw none of the
              eight briefs from this page. Built from the same registry `docs` field, so it
              lists exactly the entries that have one and cannot drift from the matrix. */}
          {documented.length > 0 && (
            <div className="mt-10">
              <h3 className="text-base font-semibold">Documented integration patterns</h3>
              <p className="mt-2 max-w-3xl text-sm text-muted">
                Patterns using each platform&rsquo;s own documented APIs, not shipped adapter packages.
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {documented.map((e) => (
                  <li key={e.id}>
                    <Link href={e.docs!} className="text-paper underline underline-offset-2 hover:no-underline">
                      {e.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card mt-10 p-6">
            <h3 className="text-base font-semibold">Building on a platform that isn&rsquo;t listed?</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-paper-dim">
              Absence from this list is not a compatibility claim in either direction. The pattern is the same
              everywhere: attach an <span className="font-mono">agenid:&lt;ULID&gt;</span> to the agent&rsquo;s existing
              config, sign a manifest with <span className="font-mono">@agenid/core</span>, and resolve it at{" "}
              <span className="font-mono">/a/&lt;agenid&gt;</span>. The registry itself lives at{" "}
              {/* This linked "AgenID-protocol/agenid" as though a reader could open it and
                  send a pull request. The monorepo is private — the link was a 404, and the
                  invitation behind it was not one this project can currently honour. */}
              <span className="font-mono">packages/web/data/ecosystem/</span> in the AgenID monorepo, one reviewable
              JSON file per platform, validated in CI. That repository is not public yet, so it does not take outside
              pull requests today; when it opens, a new entry will be one. Either way the rule does not change:
              raising an entry above <em>Compatible</em> requires evidence in the same change.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
