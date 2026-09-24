import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { Terminal } from "@/components/Terminal";
import { IdentityStory } from "@/components/IdentityStory";
import { LifecycleDiagram, TrustModelDiagram, CryptoChainDiagram, TwoPathDiagram } from "@/components/Diagrams";
import { EcosystemHub, type CloudCluster } from "@/components/ecosystem/EcosystemHub";
import { buildCloudClusters, getEcosystem } from "@/lib/ecosystem";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Tabs } from "@/components/ui/Tabs";
import { LevelLadder } from "@/components/LevelLadder";
import { BadgeStates } from "@/components/BadgeStates";

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/api";
import { HOME_DESCRIPTION, HOME_TITLE, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

/**
 * Organization + WebSite + SoftwareApplication in one graph. `sameAs` lists only the
 * public GitHub organization — the one external profile AgenID actually operates. No
 * logo URL beyond our own mark, no founding date, no address: nothing here is asserted
 * that the site does not itself show.
 */
const HOME_JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "AgenID",
      url: SITE_URL,
      logo: `${SITE_URL}/agenid-mark.png`,
      sameAs: ["https://github.com/AgenID-protocol"],
      parentOrganization: { "@type": "Organization", name: "AI Venture Holdings LLC" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "AgenID",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      name: "AgenID",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Any",
      url: SITE_URL,
      description: HOME_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      about: {
        "@type": "DefinedTermSet",
        name: "AgenID Identifiers",
        hasDefinedTerm: {
          "@type": "DefinedTerm",
          name: "agenid:<ULID>",
          description: "A permanent, portable identifier for an AI agent, bound to a signed operator manifest.",
        },
      },
    },
  ],
};

const PILLARS = [
  {
    n: "01",
    title: "Portable Identity",
    body: "Every agent gets an agenid:<ULID> that never changes — not when it moves platforms, not when its config changes, not when a deployment is retired. An identifier is never reissued or recycled, and a record once registered stays resolvable forever.",
    tag: "agenid:01J…",
  },
  {
    n: "02",
    title: "Cryptographic Proofs",
    body: "Operator manifests and authority assertions are bound by pure Ed25519 signatures over RFC 8785 canonical bytes. Anyone can re-verify offline, without trusting AgenID's database.",
    tag: "Ed25519 · RFC 8785 JCS",
  },
  {
    n: "03",
    title: "Machine-to-Machine",
    body: "The same URL answers a browser with a verification card and a program with the canonical JSON envelope. An agent can ask another agent who it is — and check the signed answer before it transacts.",
    tag: "Machine-readable by default",
  },
];

/**
 * Two separate questions, deliberately two separate columns.
 *
 * `definedInV111` is a fact about the SPECIFICATION: the level exists, with a claim type
 * and an evidence type, and a conforming implementation could issue it.
 * `issuedToday` is a fact about THIS DEPLOYMENT: whether agenid.com actually issues it
 * right now. They were one boolean called `issuable`, rendered as "issuable in v1.1.1",
 * which a reader has every reason to read as "available" — and L2, L3 and L4 are not
 * available, because issuing any of them requires the root authority key, which does not
 * exist yet. Collapsing a spec capability and a deployed capability into one word is the
 * defect; the two columns are the fix.
 */
const LEVELS = [
  { l: "L1", name: "Registered", claim: "registration", evidence: "schema_validation", definedInV111: true, issuedToday: true },
  { l: "L2", name: "Domain Verified", claim: "domain_control", evidence: "dns_txt_challenge / http_wellknown_challenge", definedInV111: true, issuedToday: false },
  { l: "L3", name: "Organization Verified", claim: "organization_identity", evidence: "business_registry_match / document_review", definedInV111: true, issuedToday: false },
  { l: "L4", name: "Deployment Verified", claim: "deployment_conformance", evidence: "deployment_sample_review", definedInV111: true, issuedToday: false },
  { l: "L5", name: "Continuously Monitored", claim: "—", evidence: "—", definedInV111: false, issuedToday: false },
];

const AUDIENCES = [
  { title: "Developers", body: "SDK, API, MCP server, and docs to attach a verifiable identity to an agent you're building.", cta: "Read the Quick Start", href: "/docs/onboarding" },
  { title: "Businesses", body: "Give the agents you deploy a permanent identity and accountability trail — and verify agents you didn't build.", cta: "Verify an Agent", href: "/verify" },
  { title: "AI Platforms", body: "Identity infrastructure for the agents built on your platform — see what's actually integrated today.", cta: "See the Ecosystem", href: "/ecosystem" },
  { title: "Enterprise", body: "Verification methodology, key management, and conformance — everything the Trust Center discloses openly.", cta: "Open the Trust Center", href: "/trust" },
];

/**
 * Chip for the verification-levels table. It describes the PROTOCOL, not an agent, so it
 * never uses a trust colour: mint and amber mean "verified" and "self-declared" on every
 * badge and card, and this table used to reuse them for "defined" and "not issued" — the
 * same colours meaning the opposite thing one scroll apart. Shape and words carry state.
 */
function LevelChip({ kind }: { kind: "issued" | "defined" | "not-issued" | "reserved" }) {
  const text = { issued: "issued today", defined: "defined", "not-issued": "not issued", reserved: "reserved name only" }[kind];
  return (
    <span className={`chip chip-${kind}`}>
      {kind === "issued" && <span aria-hidden>✓</span>}
      {text}
    </span>
  );
}

export default function Home() {
  const ecosystem = getEcosystem();
  const ecosystemCount = ecosystem.length;
  const layerCount = new Set(ecosystem.map((e) => e.category)).size;
  // Every number gets its denominator, and every count is read from the registry.
  const compatibleCount = ecosystem.filter((e) => e.status === "compatible").length;
  const verifiedIntegrationCount = ecosystem.filter((e) => e.status === "verified-integration").length;
  const partnerCount = ecosystem.filter((e) => e.status === "official-partner").length;
  // Props come finished out of the registry — see buildCloudClusters()'s note on why the
  // page does not map entries to labels itself.
  const clusters: CloudCluster[] = buildCloudClusters();

  const provenPanel = (
    <div>
      <TrustModelDiagram />
      <p className="mt-6 max-w-3xl text-sm text-muted">None of these three states is ever inferred from another. That rule is enforced by key role at verification time, not by convention.</p>
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-base font-semibold text-paper">Proven, by signature</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-paper-dim">
            <li>· A specific operator key signed a specific manifest, at a specific digest (ManifestProof).</li>
            <li>· A specific authority key signed a specific claim, against specific evidence, for a specific manifest version and validity window (VerificationAssertion).</li>
            <li>· The signature is over RFC 8785 canonical bytes — reproducible by any independent implementation.</li>
            <li>· A tampered payload, wrong key, or wrong key <em>role</em> (operator signing an assertion, or vice versa) fails verification, not just convention.</li>
          </ul>
        </div>
        <div>
          <h3 className="text-base font-semibold text-paper">Not proven — by design or not yet built</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-paper-dim">
            <li>· Verification ≠ compliance. A VERIFIED claim is bound to what its evidence type actually checked (domain control, org identity, a deployment sample) — never a general safety or legal guarantee.</li>
            <li>· L5 (<span className="font-mono">L5_CONTINUOUSLY_MONITORED</span>) is a reserved name only. No continuous-integrity claim exists in v1.1.1 — it cannot be issued.</li>
            <li>· AUTHORIZED (what an agent is permitted to do) is not part of v1.1.1. A signed authorization object exists in <span className="font-mono">@agenid/core</span> as <span className="font-mono">v1.2-DRAFT</span> — draft, not normative, not ratified, and not issuable. Nothing on this deployment issues or evaluates an authorization claim, and no agent here carries one.</li>
            <li>· The production root authority key has not completed its HSM ceremony. The verification <em>mechanism</em> for trust anchors is fully specified and testable (§9.5) — the root key itself is a pre-launch operational step, not a protocol gap. Until it is done, no VerificationAssertion can be signed, so L2, L3 and L4 are defined but not issued here.</li>
          </ul>
        </div>
      </div>

    </div>
  );

  const levelsPanel = (
    <div>
      <div>
        <h3 className="subhead">Verification levels</h3>
        <div className="mt-6">
          <LevelLadder />
        </div>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">
              AgenID verification levels: whether each is defined in protocol v1.1.1, and whether agenid.com issues it today.
            </caption>
            <thead>
              <tr className="border-b border-line-strong text-left text-xs font-medium uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="py-2 pr-4">Level</th>
                <th scope="col" className="py-2 pr-4">Name</th>
                <th scope="col" className="py-2 pr-4">Claim type</th>
                <th scope="col" className="py-2 pr-4">Typical evidence</th>
                <th scope="col" className="py-2 pr-4">Defined in v1.1.1</th>
                <th scope="col" className="py-2">Issued by AgenID today</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((row) => (
                <tr key={row.l} className="border-b border-line last:border-b-0">
                  <th scope="row" className="py-3 pr-4 text-left font-mono font-normal">{row.l}</th>
                  <td className="py-3 pr-4">{row.name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted">{row.claim}</td>
                  <td className="py-3 pr-4 text-paper-dim">{row.evidence}</td>
                  <td className="py-3 pr-4">
                    <LevelChip kind={row.definedInV111 ? "defined" : "reserved"} />
                  </td>
                  <td className="py-3">
                    <LevelChip kind={row.issuedToday ? "issued" : "not-issued"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm text-paper-dim">
          Defined and issued are different claims. L2, L3 and L4 are defined in v1.1.1 and a conforming
          implementation could issue them — but every one of them is a VerificationAssertion signed by the root
          authority key, and that key has not been generated yet. <strong className="font-semibold text-paper">The
          only level agenid.com issues today is L1_REGISTERED.</strong> Nothing on this deployment can raise an
          identity above it, and no page here should be read as offering L2, L3 or L4 now.
        </p>
      </div>
    </div>
  );

  const chainPanel = (
    <div>
      <CryptoChainDiagram />
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="text-sm leading-6 text-paper-dim">
          <p><span className="font-mono text-paper">RFC 8785 JSON Canonicalization Scheme (JCS)</span> — signing_input = JCS(signed_object minus &ldquo;signature&rdquo;). The <span className="font-mono">$schema</span> field is part of the signed bytes.</p>
        </div>
        <div className="text-sm leading-6 text-paper-dim">
          <p><span className="font-mono text-paper">Pure Ed25519 (RFC 8032)</span> — the exact canonical bytes go to Ed25519 directly. No Ed25519ph, no external pre-hash. The only SHA-256 in the protocol is the <span className="font-mono">manifest_digest</span> data value, bound <em>by</em> the signature, not <em>what is</em> signed.</p>
        </div>
      </div>
    </div>
  );

  const discoveryPanel = (
    <div>
      <h3 className="subhead">The registry is for discovery, not trust.</h3>
      <p className="mt-4 max-w-[68ch] leading-7 text-paper-dim">
        AgenID&apos;s registry helps you find a manifest and its proofs. It is never the thing you have to trust: every proof is a signature over canonical JSON that you can re-verify yourself, offline, with any RFC 8785 + Ed25519 implementation — including one that shares no code with AgenID&apos;s own. The <a className="text-paper underline underline-offset-2 hover:no-underline" href="https://github.com/AgenID-protocol/conformance">independent conformance suite</a> exists to prove exactly that: the spec holds up when nobody is trusting AgenID&apos;s word for it.
      </p>
      <h3 className="mt-10 text-lg font-semibold">Two-path key discovery</h3>
      <p className="mt-2 max-w-3xl text-sm text-paper-dim">A key resolves two independent ways. Both must agree — a verifier that only checks TLS is trusting AgenID&apos;s infrastructure; a verifier that also checks the pinned root key is doing independent verification.</p>
      <div className="mt-6"><TwoPathDiagram /></div>
    </div>
  );

  return (
    <main>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(HOME_JSON_LD),
        }}
      />

      {/* 1 · HERO — "AI agents need an identity." */}
      <section className="hero-atmos">
        <div className="mx-auto max-w-6xl px-5 pb-20 pt-20 text-center sm:px-6 lg:px-8">
          <p className="pill mx-auto">
            {/* "Locked · MIT" read as "the software is finished and open-source". Neither
                half was a claim this project can make: the spec is versioned and still
                taking errata, and the only MIT-licensed, publicly readable artifacts are
                the specification and the conformance suite (the reference implementation
                became public, MIT, on 2026-09-23, but is not a stable release). The dot is neutral: a version label is not a trust state. */}
            <span className="h-1.5 w-1.5 rounded-full bg-paper-dim" /> Protocol v1.1.1 · Specification public · MIT
          </p>
          <h1 className="display mt-6">AI agents need an identity.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-paper-dim">
            AgenID gives every AI agent a permanent, portable identity that people, businesses, and other AI agents
            can independently verify.
          </p>
          {/* One primary action, the same one the header uses: registering is the
              conversion. Verifying is the secondary path and jumps to the resolver. */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/issue" className="btn btn-primary btn-lg">Give Your Agent an Identity</Link>
            <Link href="#verify" className="btn btn-ghost btn-lg">Verify an Agent</Link>
          </div>
          <p className="mt-4 text-xs text-muted">Open protocol · Cryptographically verifiable · Platform independent</p>

          <IdentityStory />
        </div>
      </section>

      {/* 2 · THE PROBLEM (absorbs "AI agents are becoming participants") */}
      <Section eyebrow="You can talk to an AI agent. But who is it?">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="section-title">Agents act. Nothing identifies them.</h2>
            <p className="mt-4 leading-7 text-paper-dim">
              A production AI agent can book, pay, escalate, and speak for an organization — but it usually has no identity that outlives its session token or API key. When it moves platforms, changes configuration, or gets rebuilt, any accountability attached to it disappears with it. There is nothing permanent to point to.
            </p>
          </div>
          <div>
            <h2 className="section-title">Any claim can be made. Few can be checked.</h2>
            <p className="mt-4 leading-7 text-paper-dim">
              A support agent can claim to represent your bank. A vendor can claim its bot is &ldquo;verified&rdquo; with nothing behind the word. Without a cryptographic proof that a specific party made a specific claim about a specific agent, verification is just a label — and labels can be forged, copied, or asserted by anyone.
            </p>
          </div>
        </div>
        <ul className="mt-8 flex flex-wrap gap-2">
          {["Who operates it?", "Is the identity persistent?", "What does it claim to do?", "What has actually been verified?", "Can another system verify it?"].map((q) => (
            <li key={q} className="pill">{q}</li>
          ))}
        </ul>
        <p className="mt-8 max-w-[68ch] leading-7 text-paper-dim">
          Human → Agent. Agent → Agent. Agent → API. Agent → Business. Agent → Transaction. As agents take on more of these roles, a persistent, independently verifiable identity stops being optional infrastructure and starts being load-bearing. <Link href="/why-agent-identity" className="text-paper underline underline-offset-2 hover:no-underline">Why agent identity, and why now →</Link>
        </p>
      </Section>

      {/* 3 · AUDIENCE ROUTING — moved up from 13th of 14: it is the page's router. */}
      <Section eyebrow="Built for developers. Designed for everyone." title="What brings you here?">
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
          {AUDIENCES.map((a, i) => (
            <Reveal key={a.title} index={i} className="card card-hover flex flex-col p-5 sm:p-6">
              <h3 className="text-base font-semibold">{a.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-paper-dim">{a.body}</p>
              <Link href={a.href} className="btn btn-ghost btn-sm mt-6 self-start">{a.cta}</Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 4 · PERMANENT IDENTITY + LIFECYCLE */}
      <Section id="identity" eyebrow="Give every AI agent a permanent identity" title={<>A permanent, portable identity that isn&rsquo;t tied to one AI platform.</>}>
        <div className="grid auto-rows-fr gap-4 md:grid-cols-3 md:gap-6">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} index={i} className="card p-5 sm:p-6">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted">{p.n}</span>
                <span className="font-mono text-xs text-muted">{p.tag}</span>
              </div>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-6 text-paper-dim">{p.body}</p>
            </Reveal>
          ))}
        </div>
        <h3 className="subhead mt-16">Identity lifecycle.</h3>
        <div className="mt-6"><LifecycleDiagram /></div>
        <p className="mt-6 max-w-3xl text-sm leading-6 text-paper-dim">
          A Deployment (one platform-scoped run of an Agent) is bound to the Agent by <span className="font-mono">agent_id</span> but never mutates it: retiring a deployment or migrating platforms creates a new deployment under the same permanent identity — accountability survives the move.
        </p>
      </Section>

      {/* 5 · HOW VERIFICATION WORKS — three former sections as tabs. Every panel stays in
          the DOM (hidden, not unmounted), so no disclosure leaves the served page. */}
      <Section eyebrow="From declaration to verification" title="Cryptography proves signatures. It does not prove behavior.">
        <Tabs
          label="How verification works"
          tabs={[
            { id: "levels", label: "Levels", panel: levelsPanel },
            { id: "proven", label: "What is proven", panel: provenPanel },
            { id: "chain", label: "Signature chain", panel: chainPanel },
            { id: "discovery", label: "Key discovery", panel: discoveryPanel },
          ]}
        />
      </Section>

      {/* 6 · VERIFY — real, interactive, calls the live registry */}
      <Section
        id="verify"
        center
        eyebrow="Verify an agent"
        title="Who is this AI agent?"
        lede={
          <>
            Paste any <span className="font-mono">agenid:&lt;ULID&gt;</span> below. This calls the live registry, not a
            mock — an unregistered identifier returns a clean &ldquo;not found,&rdquo; not a fabricated result.
          </>
        }
      >
        <div className="mx-auto max-w-xl">
          <SearchBar />
        </div>
        <p className="mt-4 text-sm text-muted">
          No agent yet?{" "}
          <Link href="/issue" className="text-paper underline underline-offset-2 hover:no-underline">Register one</Link> to get an
          identifier you can resolve here.
        </p>
      </Section>

      {/* 7 · DEVELOPERS — proof engine, badges, terminal, MCP, open by design */}
      <Section id="badges" eyebrow="For developers" title="One URL, two representations.">
        <p className="max-w-[68ch] leading-7 text-paper-dim">
          <span className="font-mono">GET /a/&lt;agenid&gt;</span> answers a browser with the verification card UI and answers a request sent with <span className="font-mono">Accept: application/json</span> with the raw resolution envelope — manifest, proof, assertions, and key-discovery pointers, ready for a program or another agent to parse and re-verify before it transacts.
        </p>

        <div className="mt-12 grid items-start gap-10 md:grid-cols-2">
          <div>
            <p className="leading-7 text-paper-dim">
              <span className="font-mono text-paper">@agenid/core</span> gives you identifiers, RFC 8785 canonicalization, the normative schemas, and the Ed25519 proof engine — the same code that passes the specification&apos;s deterministic test vectors byte-for-byte.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {/* The package is not on npm yet, so there is nothing to "get": the primary
                  destination is the quick start. The source link is secondary and real — the
                  monorepo is public since 2026-09-23. Outline, not emerald: one emerald
                  action per viewport. */}
              <Link className="btn btn-ghost" href="/docs/onboarding">Build with AgenID</Link>
              <a className="btn btn-ghost" href="https://github.com/AgenID-protocol/agenid/tree/main/packages/core" rel="noopener noreferrer" target="_blank">
                Read the source
              </a>
              <a className="btn btn-ghost" href="https://github.com/AgenID-protocol/spec">Read the spec</a>
            </div>
          <div className="card mt-8 p-5 sm:p-6">
            <h3 className="text-base font-semibold text-paper">Put your agent&rsquo;s identity where people can see it</h3>
            <code className="mt-3 block overflow-x-auto rounded-md bg-ink-3 p-3 font-mono text-xs text-paper-dim">
              {'<script src="https://agenid.com/badge.js" data-agent="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"></script>'}
            </code>
            <p className="mt-3 max-w-[68ch] text-sm leading-6 text-paper-dim">
              Re-resolves from the registry every time it renders, so it always shows whatever the registry currently reports for that identifier — it is never a static image of a past result. The badge is the human-facing UI; the signed record underneath is what actually carries trust. The protocol defines agent status transitions (<span className="font-mono">CHANGED</span>, <span className="font-mono">STALE</span>, <span className="font-mono">SUSPENDED</span>, <span className="font-mono">REVOKED</span>) and the badge renders them, but no write path on this deployment sets them yet — every registered agent is <span className="font-mono">ACTIVE</span>, and there is no revocation flow today.
            </p>
            <div className="mt-6 border-t border-line pt-6">
              <div className="eyebrow">What the badge can say</div>
              <BadgeStates compact />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <span className="text-xs text-muted">Live example (points at an unregistered example ID, so it honestly shows &ldquo;unavailable&rdquo;):</span>
              <div suppressHydrationWarning>
                <script src="/badge.js" data-agent="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" />
              </div>
            </div>
          </div>
          </div>
          <Terminal />
        </div>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="subhead">AI can verify AI</h3>
            <p className="mt-4 leading-7 text-paper-dim">
              {/* This named three specific MCP client applications by brand. AgenID has not
                  run this server in any of them, and the ecosystem registry — the single
                  source of truth for which companies this site names — carries no entry for
                  any of them. A vendor name is a claim about that vendor; it needs evidence
                  or it does not belong on the page. */}
              <span className="font-mono text-paper">@agenid/mcp-server</span> puts that same resolution and verification behind a stdio MCP tool — an agent running in any MCP client can call <span className="font-mono">resolve_agent_identity</span> and <span className="font-mono">verify_agent_manifest</span> directly, no HTTP client required.
            </p>
            <p className="mt-4 text-sm leading-6 text-paper-dim">
              <strong className="font-semibold text-paper">Not yet installable.</strong>{" "}
              <span className="font-mono">@agenid/mcp-server</span> is not published to npm — neither it nor{" "}
              <span className="font-mono">@agenid/core</span> nor <span className="font-mono">@agenid/cli</span> has been
              published. The brief below documents the integration pattern and the tool surface; running the server
              today means building it from the public monorepo source. Nothing here is available to install from npm.
            </p>
            <div className="mt-6">
              <Link href="/docs/partners/mcp-server-integration" className="btn btn-ghost">Read the MCP integration brief</Link>
            </div>
          </div>
          <div>
            <h3 className="subhead">The spec is the source of truth. Code follows it.</h3>
            <p className="mt-4 leading-7 text-paper-dim">
              <a className="text-paper underline underline-offset-2 hover:no-underline" href="https://github.com/AgenID-protocol/spec">AgenID-protocol/spec</a> is public and MIT-licensed — the protocol specification, five normative JSON Schemas, deterministic test vectors, and a public errata log. Changes to identity, cryptography, serialization, or verification semantics require a published erratum before any implementation follows. Two are on record: a key-identifier URI fix and a number-domain canonicalization rule (E1), and the namespace unification onto a single <span className="font-mono">agenid.com</span> domain (E2) — both applied, both re-verified against regenerated test vectors.
            </p>
            <p className="mt-4 leading-7 text-paper-dim">
              <a className="text-paper underline underline-offset-2 hover:no-underline" href="https://github.com/AgenID-protocol/conformance">AgenID-protocol/conformance</a> is a separate, public, MIT-licensed test runner with zero AgenID knowledge — 34 of 34 checks pass, verified in CI on every push.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Open protocol", "Open-source specification", "Machine-readable", "Platform independent", "Cryptographically verifiable", "Independent verification"].map((t) => (
                <span key={t} className="pill">{t}</span>
              ))}
            </div>
            <div className="mt-6">
              <a className="btn btn-ghost" href="https://github.com/AgenID-protocol">View on GitHub</a>
            </div>
          </div>
        </div>
      </Section>

      {/* 8 · THE AGENT ECOSYSTEM */}
      <Section
        eyebrow="The agent ecosystem"
        title={<>The platforms change. The identity doesn&apos;t.</>}
        lede={
          <>
            AgenID is designed to work across the platforms where AI agents live. An <span className="font-mono">agenid:&lt;ULID&gt;</span> identifies the agent, never the model or platform underneath it — nothing in the protocol references OpenAI, Anthropic, Google, an open-source model, or any specific runtime. The identity survives a change of model provider, agent framework, or hosting infrastructure.
          </>
        }
      >
        <EcosystemHub clusters={clusters} />

        <p className="mt-8 max-w-3xl text-sm leading-6 text-paper-dim">
          {/* Counts are read from the registry, never typed. This sentence said "five layers"
              until a sixth was added, which is the whole argument for deriving it. Every
              number now carries its denominator. */}
          {ecosystemCount} platforms listed across {layerCount} layers · {compatibleCount} Compatible ·{" "}
          {verifiedIntegrationCount} verified integrations · {partnerCount} partners. Listed as{" "}
          <span className="font-mono">Compatible</span> &mdash; a
          technical statement about carrying an identity through each platform&apos;s existing, documented API surface. None
          of them ships AgenID code, none is a partner, and no adapter package exists for any of them.{" "}
          <Link href="/ecosystem" className="text-paper underline underline-offset-2 hover:no-underline">
            See the full compatibility matrix
          </Link>
          .
        </p>

        <p className="mt-4 max-w-3xl leading-7 text-paper-dim">
          Interoperability is tested, not assumed: the §8 deterministic test vectors — real Ed25519 signatures over RFC 8785 canonical bytes — let any language implementation prove it produces byte-identical output, independent of AgenID&apos;s own TypeScript reference implementation.
        </p>
      </Section>

      {/* 9 · GET AGENID — registration flow, real */}
      <Section
        id="get-agenid"
        center
        className="bg-ink-2/40"
        eyebrow="Give your AI agent an identity"
        title="Get AgenID."
        lede="Name your agent and your browser does the rest: it generates an Ed25519 key, signs the operator manifest locally, and registers the public half. You get a resolvable identifier and a Verification Card in about a minute — no account, and no private key ever leaves your machine."
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/issue" className="btn btn-primary btn-lg">Give Your Agent an Identity</Link>
          <Link href="/docs/onboarding" className="btn btn-ghost btn-lg">Do it from a terminal</Link>
        </div>
        <p className="mx-auto mt-5 max-w-2xl text-sm text-muted">
          Issues L1_REGISTERED — registered here, operator self-declaration verified. Not a third-party check of the
          operator, the domain, or the organization.
        </p>
      </Section>
    </main>
  );
}
