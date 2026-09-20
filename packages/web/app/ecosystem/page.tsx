import type { Metadata } from "next";
import Link from "next/link";
import { EcosystemMatrix, type MatrixEntry } from "@/components/ecosystem/EcosystemMatrix";
import { IdentityFlow } from "@/components/ecosystem/IdentityFlow";
import { SITE_URL } from "@/lib/api";
import { ECOSYSTEM_CATEGORIES, ECOSYSTEM_STATUSES, getEcosystem, readLogoSvg } from "@/lib/ecosystem";

export const metadata: Metadata = {
  title: "The Agent Ecosystem — Compatibility Matrix",
  description:
    "Voice platforms, model providers, infrastructure, agent frameworks, enterprise identity systems, and the payment and telephony rails an agent acts through — every surface an agenid:<ULID> identity can be carried across. Technical compatibility only: every entry states exactly what was reviewed.",
  alternates: { canonical: "/ecosystem" },
};

/** Spelled from the registry so the heading cannot drift from the cards below it. */
const STATUS_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six"] as const;
const STATUS_COUNT = STATUS_WORDS[Object.keys(ECOSYSTEM_STATUSES).length] ?? Object.keys(ECOSYSTEM_STATUSES).length;

export default function EcosystemPage() {
  const all = getEcosystem();
  const labelOf = (id: string) => ECOSYSTEM_CATEGORIES.find((c) => c.id === id)?.label ?? id;

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

      <section className="grid-bg border-b border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="mb-2 font-mono text-[11px] text-muted">
            <Link href="/" className="hover:text-paper">
              AgenID
            </Link>{" "}
            / The agent ecosystem
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight">The Agent Ecosystem</h1>
          <p className="mt-5 max-w-3xl text-lg text-muted">
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
      <section className="border-b border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="mb-3 font-mono text-[11px] text-muted">WHAT A LISTING MEANS</div>
          {/* Count derived, not typed — this read "Three statuses" until a fourth was added. */}
          <h2 className="text-2xl font-bold tracking-tight">
            {STATUS_COUNT} statuses. Only one of them is currently issued.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(ECOSYSTEM_STATUSES) as (keyof typeof ECOSYSTEM_STATUSES)[]).map((key) => {
              const n = countFor(key);
              return (
                <div key={key} className="card p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="pill !py-0.5 !text-[10px]">{ECOSYSTEM_STATUSES[key].label}</span>
                    <span className="font-mono text-[11px] text-muted">
                      {n} {n === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{ECOSYSTEM_STATUSES[key].definition}</p>
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
      <section className="border-b border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="mb-3 font-mono text-[11px] text-muted">ONE IDENTITY, MANY PLATFORMS</div>
          <h2 className="mb-8 text-2xl font-bold tracking-tight">The platforms change. The identity doesn&rsquo;t.</h2>
          <IdentityFlow />
        </div>
      </section>

      {/* MATRIX */}
      <section>
        <div className="mx-auto max-w-6xl px-5 py-14">
          <div className="mb-3 font-mono text-[11px] text-muted">COMPATIBILITY MATRIX</div>
          <h2 className="mb-8 text-2xl font-bold tracking-tight">
            {all.length} platforms across {ECOSYSTEM_CATEGORIES.length} layers.
          </h2>
          <EcosystemMatrix entries={entries} categories={ECOSYSTEM_CATEGORIES.map((c) => ({ ...c }))} />

          <div className="card mt-10 p-6">
            <h3 className="text-base font-semibold">Building on a platform that isn&rsquo;t listed?</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
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
