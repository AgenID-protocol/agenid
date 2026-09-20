import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { Terminal } from "@/components/Terminal";
import { IdentityStory } from "@/components/IdentityStory";
import { LifecycleDiagram, TrustModelDiagram, CryptoChainDiagram, TwoPathDiagram } from "@/components/Diagrams";
import { EcosystemHub, type CloudCluster } from "@/components/ecosystem/EcosystemHub";
import { buildCloudClusters, getEcosystem } from "@/lib/ecosystem";

import type { Metadata } from "next";
import { SITE_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "AgenID — AI Agents Need an Identity",
  description:
    "AgenID gives every AI agent a permanent, portable identity that people, businesses, and other AI agents can independently verify. Open protocol · cryptographically verifiable · platform independent.",
  alternates: { canonical: "/" },
};

const PILLARS = [
  {
    n: "01",
    title: "Portable Identity",
    body: "Every agent gets an agenid:<ULID> that never changes — not when it moves platforms, not when its config changes, not when a deployment is retired. Revoked identities stay on record forever.",
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

const LEVELS = [
  { l: "L1", name: "Registered", claim: "registration", evidence: "schema_validation", issuable: true },
  { l: "L2", name: "Domain Verified", claim: "domain_control", evidence: "dns_txt_challenge / http_wellknown_challenge", issuable: true },
  { l: "L3", name: "Organization Verified", claim: "organization_identity", evidence: "business_registry_match / document_review", issuable: true },
  { l: "L4", name: "Deployment Verified", claim: "deployment_conformance", evidence: "deployment_sample_review", issuable: true },
  { l: "L5", name: "Continuously Monitored", claim: "—", evidence: "—", issuable: false },
];

const AUDIENCES = [
  { title: "Developers", body: "SDK, API, MCP server, and docs to attach a verifiable identity to an agent you're building.", cta: "Read the Quick Start", href: "/docs/onboarding" },
  { title: "Businesses", body: "Give the agents you deploy a permanent identity and accountability trail — and verify agents you didn't build.", cta: "Verify an Agent", href: "/verify" },
  { title: "AI Platforms", body: "Identity infrastructure for the agents built on your platform — see what's actually integrated today.", cta: "See the Ecosystem", href: "/ecosystem" },
  { title: "Enterprise", body: "Verification methodology, key management, and conformance — everything the Trust Center discloses openly.", cta: "Open the Trust Center", href: "/trust" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 font-mono text-[11px] text-muted">{children}</div>;
}

export default function Home() {
  const ecosystemCount = getEcosystem().length;
  const layerCount = new Set(getEcosystem().map((e) => e.category)).size;
  // Props come finished out of the registry — see buildCloudClusters()'s note on why the
  // page does not map entries to labels itself.
  const clusters: CloudCluster[] = buildCloudClusters();

  return (
    <main>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "AgenID",
            applicationCategory: "SecurityApplication",
            operatingSystem: "Any",
            url: SITE_URL,
            description: metadata.description,
            about: {
              "@type": "DefinedTermSet",
              name: "AgenID Identifiers",
              hasDefinedTerm: {
                "@type": "DefinedTerm",
                name: "agenid:<ULID>",
                description:
                  "A permanent, portable identifier for an AI agent, bound to a signed operator manifest.",
              },
            },
          }),
        }}
      />

      {/* HERO — "AI agents need an identity." */}
      <section className="grid-bg border-b border-line/70">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-20 text-center">
          <p className="pill mx-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Protocol v1.1.1 · Locked · MIT
          </p>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">AI agents need an identity.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            AgenID gives every AI agent a permanent, portable identity that people, businesses, and other AI agents
            can independently verify.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/verify" className="btn btn-primary">Verify an Agent</Link>
            <Link href="/issue" className="btn btn-ghost">Give Your Agent an Identity</Link>
          </div>
          <p className="mt-4 font-mono text-[11px] text-muted">Open protocol · Cryptographically verifiable · Platform independent</p>

          <IdentityStory />
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="border-b border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>YOU CAN TALK TO AN AI AGENT. BUT WHO IS IT?</Eyebrow>
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Agents act. Nothing identifies them.</h2>
              <p className="mt-4 text-muted">
                A production AI agent can book, pay, escalate, and speak for an organization — but it usually has no identity that outlives its session token or API key. When it moves platforms, changes configuration, or gets rebuilt, any accountability attached to it disappears with it. There is nothing permanent to point to.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Any claim can be made. Few can be checked.</h2>
              <p className="mt-4 text-muted">
                A support agent can claim to represent your bank. A vendor can claim its bot is &ldquo;verified&rdquo; with nothing behind the word. Without a cryptographic proof that a specific party made a specific claim about a specific agent, verification is just a label — and labels can be forged, copied, or asserted by anyone.
              </p>
            </div>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2 font-mono text-[11px] text-muted">
            {["Who operates it?", "Is the identity persistent?", "What does it claim to do?", "What has actually been verified?", "Can another system verify it?"].map((q) => (
              <li key={q} className="pill !py-1">{q}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* GIVE EVERY AGENT A PERMANENT IDENTITY */}
      <section id="identity" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
        <Eyebrow>GIVE EVERY AI AGENT A PERMANENT IDENTITY</Eyebrow>
        <h2 className="max-w-2xl text-2xl font-bold tracking-tight">
          A permanent, portable identity that isn&rsquo;t tied to one AI platform.
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="card p-6">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-muted">{p.n}</span>
                <span className="font-mono text-[11px] text-muted">{p.tag}</span>
              </div>
              <h3 className="text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* IDENTITY LIFECYCLE (technical depth, for the reader who scrolls this far) */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>HOW IT WORKS</Eyebrow>
          <h2 className="mb-8 text-2xl font-bold tracking-tight">Identity lifecycle.</h2>
          <LifecycleDiagram />
          <p className="mt-6 max-w-3xl text-sm text-muted">
            A Deployment (one platform-scoped run of an Agent) is bound to the Agent by <span className="font-mono">agent_id</span> but never mutates it: retiring a deployment or migrating platforms creates a new deployment under the same permanent identity — accountability survives the move.
          </p>
        </div>
      </section>

      {/* DECLARED VS VERIFIED */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>FROM DECLARATION TO VERIFICATION</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">Cryptography proves signatures. It does not prove behavior.</h2>
          <div className="mt-6"><TrustModelDiagram /></div>
          <p className="mt-6 max-w-3xl text-xs text-muted">None of these three states is ever inferred from another. That rule is enforced by key role at verification time, not by convention.</p>
          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-mint">Proven, by signature</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>· A specific operator key signed a specific manifest, at a specific digest (ManifestProof).</li>
                <li>· A specific authority key signed a specific claim, against specific evidence, for a specific manifest version and validity window (VerificationAssertion).</li>
                <li>· The signature is over RFC 8785 canonical bytes — reproducible by any independent implementation.</li>
                <li>· A tampered payload, wrong key, or wrong key <em>role</em> (operator signing an assertion, or vice versa) fails verification, not just convention.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-paper">Not proven — by design or not yet built</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>· Verification ≠ compliance. A VERIFIED claim is bound to what its evidence type actually checked (domain control, org identity, a deployment sample) — never a general safety or legal guarantee.</li>
                <li>· L5 (<span className="font-mono">L5_CONTINUOUSLY_MONITORED</span>) is a reserved name only. No continuous-integrity claim exists in v1.1.1 — it cannot be issued.</li>
                <li>· AUTHORIZED (what an agent is permitted to do) is reserved for protocol v1.2. No signed object for it exists yet.</li>
                <li>· The production root authority key has not completed its HSM ceremony. The verification <em>mechanism</em> for trust anchors is fully specified and testable (§9.5) — the root key itself is a pre-launch operational step, not a protocol gap.</li>
              </ul>
            </div>
          </div>

          <div className="mt-12">
            <h3 className="text-lg font-semibold">Verification levels</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left font-mono text-[11px] uppercase text-muted">
                    <th className="py-2 pr-4">Level</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Claim type</th>
                    <th className="py-2 pr-4">Typical evidence</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {LEVELS.map((row) => (
                    <tr key={row.l} className="border-b border-line/60 last:border-b-0">
                      <td className="py-2.5 pr-4 font-mono">{row.l}</td>
                      <td className="py-2.5 pr-4">{row.name}</td>
                      <td className="py-2.5 pr-4 font-mono text-[12px] text-muted">{row.claim}</td>
                      <td className="py-2.5 pr-4 text-muted">{row.evidence}</td>
                      <td className="py-2.5">
                        {row.issuable ? (
                          <span className="pill pill-ok !py-0.5 !text-[11px]">issuable in v1.1.1</span>
                        ) : (
                          <span className="pill pill-warn !py-0.5 !text-[11px]">reserved name · not issuable</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* VERIFY — real, interactive, calls the live registry */}
      <section id="verify" className="scroll-mt-20 border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <Eyebrow>VERIFY AN AGENT</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">Who is this AI agent?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Paste any <span className="font-mono">agenid:&lt;ULID&gt;</span> below. This calls the live registry, not a
            mock — an unregistered identifier returns a clean &ldquo;not found,&rdquo; not a fabricated result.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <SearchBar />
          </div>
          <p className="mt-4 text-xs text-muted">
            No agent yet?{" "}
            <Link href="/issue" className="text-paper underline hover:no-underline">Register one</Link> to get an
            identifier you can resolve here.
          </p>
        </div>
      </section>

      {/* CRYPTOGRAPHIC PROOF + BADGES */}
      <section id="badges" className="scroll-mt-20 border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>CRYPTOGRAPHIC PROOF</Eyebrow>
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Manifest to verified signature — every step reproducible.</h2>
          <CryptoChainDiagram />
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="text-sm text-muted">
              <p><span className="font-mono text-paper">RFC 8785 JSON Canonicalization Scheme (JCS)</span> — signing_input = JCS(signed_object minus &ldquo;signature&rdquo;). The <span className="font-mono">$schema</span> field is part of the signed bytes.</p>
            </div>
            <div className="text-sm text-muted">
              <p><span className="font-mono text-paper">Pure Ed25519 (RFC 8032)</span> — the exact canonical bytes go to Ed25519 directly. No Ed25519ph, no external pre-hash. The only SHA-256 in the protocol is the <span className="font-mono">manifest_digest</span> data value, bound <em>by</em> the signature, not <em>what is</em> signed.</p>
            </div>
          </div>
          <div className="mt-8 grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="text-muted">
                <span className="font-mono text-paper">@agenid/core</span> gives you identifiers, RFC 8785 canonicalization, the normative schemas, and the Ed25519 proof engine — the same code that passes the specification&apos;s deterministic test vectors byte-for-byte.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a className="btn btn-primary" href="https://github.com/AgenID-protocol/agenid">Get @agenid/core</a>
                <a className="btn btn-ghost" href="https://github.com/AgenID-protocol/spec">Read the spec</a>
              </div>
              <div className="mt-6 rounded-lg border border-line bg-ink-2 p-4 text-sm text-muted">
                <div className="mb-2 font-semibold text-paper">Put your agent&rsquo;s identity where people can see it</div>
                <code className="block overflow-x-auto font-mono text-[12px] text-paper/90">
                  {'<script src="https://agenid.com/badge.js" data-agent="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y"></script>'}
                </code>
                <p className="mt-2 text-xs">
                  Renders the current verification level, live — a suspended or revoked identity changes everywhere it&apos;s embedded. The badge is the human-facing UI; the signed record underneath is what actually carries trust.
                </p>
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
                  <span className="text-xs text-muted">Live example (points at an unregistered example ID, so it honestly shows &ldquo;unavailable&rdquo;):</span>
                </div>
                <div className="mt-2" suppressHydrationWarning>
                  <script src="/badge.js" data-agent="agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y" />
                </div>
              </div>
            </div>
            <Terminal />
          </div>
        </div>
      </section>

      {/* AGENT-TO-AGENT / MCP */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>AI CAN VERIFY AI</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">One URL, two representations.</h2>
          <p className="mt-4 max-w-3xl text-muted">
            <span className="font-mono">GET /a/&lt;agenid&gt;</span> answers a browser with the verification card UI and answers a request sent with <span className="font-mono">Accept: application/json</span> with the raw resolution envelope — manifest, proof, assertions, and key-discovery pointers, ready for a program or another agent to parse and re-verify before it transacts.
          </p>
          <p className="mt-4 max-w-3xl text-muted">
            <span className="font-mono text-paper">@agenid/mcp-server</span> puts that same resolution and verification behind a stdio MCP tool — an agent running in Claude Desktop, Cursor, Windsurf, or a custom MCP client can call <span className="font-mono">resolve_agent_identity</span> and <span className="font-mono">verify_agent_manifest</span> directly, no HTTP client required.
          </p>
          <div className="mt-6">
            <Link href="/docs/partners/mcp-server-integration" className="btn btn-primary">Use AgenID with MCP</Link>
          </div>
        </div>
      </section>

      {/* TWO-PATH KEY DISCOVERY */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>VERIFY WITHOUT TRUSTING AGENID</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">The registry is for discovery, not trust.</h2>
          <p className="mt-4 max-w-3xl text-muted">
            AgenID&apos;s registry helps you find a manifest and its proofs. It is never the thing you have to trust: every proof is a signature over canonical JSON that you can re-verify yourself, offline, with any RFC 8785 + Ed25519 implementation — including one that shares no code with AgenID&apos;s own. The <a className="text-paper hover:underline" href="https://github.com/AgenID-protocol/conformance">independent conformance suite</a> exists to prove exactly that: the spec holds up when nobody is trusting AgenID&apos;s word for it.
          </p>
          <h3 className="mt-10 text-lg font-semibold">Two-path key discovery</h3>
          <p className="mt-2 max-w-3xl text-sm text-muted">A key resolves two independent ways. Both must agree — a verifier that only checks TLS is trusting AgenID&apos;s infrastructure; a verifier that also checks the pinned root key is doing independent verification.</p>
          <div className="mt-6"><TwoPathDiagram /></div>
        </div>
      </section>

      {/* THE AGENT ECOSYSTEM */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>THE AGENT ECOSYSTEM</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">The platforms change. The identity doesn&apos;t.</h2>
          <p className="mt-4 max-w-3xl text-muted">
            AgenID is designed to work across the platforms where AI agents live. An <span className="font-mono">agenid:&lt;ULID&gt;</span> identifies the agent, never the model or platform underneath it — nothing in the protocol references OpenAI, Anthropic, Google, an open-source model, or any specific runtime. The identity survives a change of model provider, agent framework, or hosting infrastructure.
          </p>

          <div className="mt-10">
            <EcosystemHub clusters={clusters} />
          </div>

          <p className="mt-8 max-w-3xl text-sm text-muted">
            {/* Counts are read from the registry, never typed. This sentence said "five layers"
                until a sixth was added, which is the whole argument for deriving it. */}
            {ecosystemCount} platforms across {layerCount} layers are listed as{" "}
            <span className="font-mono">Compatible</span> &mdash; a
            technical statement about carrying an identity through each platform&apos;s existing, documented API surface. None
            of them ships AgenID code, none is a partner, and no adapter package exists for any of them.{" "}
            <Link href="/ecosystem" className="text-paper underline underline-offset-2 hover:no-underline">
              See the full compatibility matrix
            </Link>
            .
          </p>

          <p className="mt-4 max-w-3xl text-muted">
            Interoperability is tested, not assumed: the §8 deterministic test vectors — real Ed25519 signatures over RFC 8785 canonical bytes — let any language implementation prove it produces byte-identical output, independent of AgenID&apos;s own TypeScript reference implementation.
          </p>
        </div>
      </section>

      {/* BUILT FOR THE AGENTIC INTERNET */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>BUILT FOR THE AGENTIC INTERNET</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">AI agents are becoming participants.</h2>
          <p className="mt-4 max-w-3xl text-muted">
            Human → Agent. Agent → Agent. Agent → API. Agent → Business. Agent → Transaction. As agents take on more of these roles, a persistent, independently verifiable identity stops being optional infrastructure and starts being load-bearing. <Link href="/why-agent-identity" className="text-paper underline hover:no-underline">Why agent identity, and why now →</Link>
          </p>
        </div>
      </section>

      {/* OPEN BY DESIGN */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>OPEN BY DESIGN</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">The spec is the source of truth. Code follows it.</h2>
          <p className="mt-4 max-w-3xl text-muted">
            <a className="text-paper hover:underline" href="https://github.com/AgenID-protocol/spec">AgenID-protocol/spec</a> is public and MIT-licensed — the protocol specification, five normative JSON Schemas, deterministic test vectors, and a public errata log. Changes to identity, cryptography, serialization, or verification semantics require a published erratum before any implementation follows. Two are on record: a key-identifier URI fix and a number-domain canonicalization rule (E1), and the namespace unification onto a single <span className="font-mono">agenid.com</span> domain (E2) — both applied, both re-verified against regenerated test vectors.
          </p>
          <p className="mt-4 max-w-3xl text-muted">
            <a className="text-paper hover:underline" href="https://github.com/AgenID-protocol/conformance">AgenID-protocol/conformance</a> is a separate, public, MIT-licensed test runner with zero AgenID knowledge — 34 of 34 checks pass, verified in CI on every push.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px] text-muted">
            {["Open protocol", "Open-source specification", "Machine-readable", "Platform independent", "Cryptographically verifiable", "Independent verification"].map((t) => (
              <span key={t} className="pill !py-1">{t}</span>
            ))}
          </div>
          <div className="mt-6">
            <a className="btn btn-ghost" href="https://github.com/AgenID-protocol">View on GitHub</a>
          </div>
        </div>
      </section>

      {/* AUDIENCE ROUTING */}
      <section className="border-t border-line/70">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Eyebrow>BUILT FOR DEVELOPERS. DESIGNED FOR EVERYONE.</Eyebrow>
          <h2 className="text-2xl font-bold tracking-tight">What brings you here?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="card flex flex-col p-5">
                <h3 className="text-sm font-semibold">{a.title}</h3>
                <p className="mt-2 flex-1 text-xs text-muted">{a.body}</p>
                <Link href={a.href} className="btn btn-ghost mt-4 !py-1.5 !text-[12px]">{a.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GET AGENID — registration flow, real */}
      <section id="get-agenid" className="scroll-mt-20 border-t border-line/70 bg-ink-2/40">
        <div className="mx-auto max-w-6xl px-5 py-20 text-center">
          <Eyebrow>GIVE YOUR AI AGENT AN IDENTITY</Eyebrow>
          <h2 className="text-3xl font-bold tracking-tight">Get AgenID.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Name your agent and your browser does the rest: it generates an Ed25519 key, signs the operator manifest
            locally, and registers the public half. You get a resolvable identifier and a Verification Card in about a
            minute — no account, and no private key ever leaves your machine.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/issue" className="btn btn-primary">Give Your Agent an Identity</Link>
            <Link href="/docs/onboarding" className="btn btn-ghost">Do it from a terminal</Link>
          </div>
          <p className="mx-auto mt-5 max-w-2xl text-xs text-muted">
            Issues L1_REGISTERED — registered here, operator self-declaration verified. Not a third-party check of the
            operator, the domain, or the organization.
          </p>
        </div>
      </section>
    </main>
  );
}
