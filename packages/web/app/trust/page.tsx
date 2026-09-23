import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { TwoPathDiagram } from "@/components/Diagrams";

export const metadata: Metadata = pageMetadata({
  title: "Trust Center: Security, Keys & Verification Methodology",
  description:
    "AgenID's protocol, cryptography, key management and verification methodology, including what is not complete yet, disclosed plainly rather than marketed over.",
  path: "/trust",
});

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line/70 py-10 first:border-t-0 first:pt-0">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function TrustPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <div className="mb-2 font-mono text-[11px] text-muted">
        <Link href="/" className="hover:text-paper">AgenID</Link> / Trust Center
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Trust Center</h1>
      <p className="mt-4 text-muted">
        Everything on this page is either a fact about the shipped protocol, a fact about what is not yet complete, or
        a link to the primary source. Nothing here is marketing language standing in for a technical claim.
      </p>

      <nav className="mt-6 flex flex-wrap gap-2 text-xs">
        {[
          ["#protocol", "Protocol"],
          ["#cryptography", "Cryptography"],
          ["#keys", "Key Management"],
          ["#verification", "Verification Methodology"],
          ["#root-key", "Root Authority Key — Status"],
          ["#open-source", "Open Source & Conformance"],
          ["#privacy", "Privacy"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="pill !py-1">{label}</a>
        ))}
      </nav>

      <Section id="protocol" title="Protocol">
        <p>
          AgenID v1.1.1 is the current locked specification, published and MIT-licensed at{" "}
          <a href="https://github.com/AgenID-protocol/spec" className="text-paper underline hover:no-underline">AgenID-protocol/spec</a>.
          Two errata are on record — a key-identifier URI fix and a number-domain canonicalization rule (E1), and the
          namespace unification onto a single <span className="font-mono">agenid.com</span> domain (E2). Any future
          change to identity, cryptography, serialization, or verification semantics requires a published erratum
          before any implementation follows it; the spec is the source of truth, not the code.
        </p>
      </Section>

      <Section id="cryptography" title="Cryptography">
        <p>
          Manifests and assertions are canonicalized with RFC 8785 JSON Canonicalization Scheme (JCS) before signing —
          the signing input is the JCS bytes of the signed object minus its <span className="font-mono">signature</span> field,
          and the <span className="font-mono">$schema</span> field is part of what&rsquo;s signed.
        </p>
        <p>
          Signatures are pure Ed25519 (RFC 8032) over those canonical bytes directly — no Ed25519ph, no external
          pre-hash step. The only SHA-256 in the protocol produces the <span className="font-mono">manifest_digest</span>{" "}
          data value, which the signature binds; SHA-256 is never itself the signed input.
        </p>
        <p>
          The §8.7 number-domain rule rejects non-finite values and rejects integer-literal canonical tokens with
          magnitude greater than 2⁵³−1 — documented as a rejection case, never as a silently-accepted edge case.
        </p>
      </Section>

      <Section id="keys" title="Key Management">
        <p>
          Every key has its own ULID. A key&rsquo;s <span className="font-mono">role</span> is exactly{" "}
          <span className="font-mono">operator</span> or <span className="font-mono">authority</span> — an operator
          key can never produce a valid VerificationAssertion, and an authority key can never produce a valid
          ManifestProof. That separation is enforced at verification time, not by convention.
        </p>
        {/* This read as a description of a working lifecycle. The KeyDocument schema
            defines active/retired/revoked and the resolver serves whatever is stored, but
            nothing on this deployment writes a retirement or a revocation — every key
            published here is active. Saying what the schema supports and what the
            deployment does are two statements, so they are two sentences. */}
        <p>
          Nothing is ever deleted: a key stays resolvable forever, so a signature made years ago can still be
          checked against the key that made it. The <span className="font-mono">KeyDocument</span> schema defines{" "}
          <span className="font-mono">active</span>, <span className="font-mono">retired</span> and{" "}
          <span className="font-mono">revoked</span> states and the resolver serves whichever is stored — but this
          deployment has no key-rotation or key-revocation flow yet, so every key published here is{" "}
          <span className="font-mono">active</span>. The same is true one level up: agent status transitions
          (<span className="font-mono">CHANGED</span>, <span className="font-mono">STALE</span>,{" "}
          <span className="font-mono">SUSPENDED</span>, <span className="font-mono">REVOKED</span>) are defined in the
          protocol and stored in the registry&rsquo;s schema, and no write path sets them. There is no revocation
          flow today, and this page will say so until there is.
        </p>
        <div className="pt-2"><TwoPathDiagram /></div>
      </Section>

      <Section id="verification" title="Verification Methodology">
        <p>
          Verification is a distinct, signed act — a VerificationAssertion, made by an authority key, bound to one
          specific manifest digest and evidence type. It is never inferred from an operator&rsquo;s own declaration.
        </p>
        {/*
          These five lines said "Issuable." three times and meant it in the SPECIFICATION
          sense — the level is defined, a conforming implementation could issue it. On a
          Trust Center, next to a deployed product, a reader has every reason to read
          "Issuable" as "available to me". It is not: issuing any of L2, L3 or L4 requires
          a VerificationAssertion signed by the root authority key, and that key does not
          exist yet. Defined and issued are now two separate statements per level.
        */}
        <p>
          Two different questions, kept apart deliberately: <em>defined in v1.1.1</em> is a fact about the
          specification, and <em>issued by AgenID today</em> is a fact about this deployment. They are not the same
          answer for any level above L1.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-mono">L1_REGISTERED</span> — schema_validation.{" "}
            <strong className="font-semibold text-paper/90">Defined in v1.1.1 · Issued by AgenID today.</strong>
          </li>
          <li>
            <span className="font-mono">L2_DOMAIN_VERIFIED</span> — dns_txt_challenge / http_wellknown_challenge.{" "}
            <strong className="font-semibold text-paper/90">Defined in v1.1.1 · Not issued by AgenID today.</strong>{" "}
            The evidence can be collected now at <Link href="/verify/domain" className="text-paper underline hover:no-underline">/verify/domain</Link>; what cannot happen yet is signing the assertion.
          </li>
          <li>
            <span className="font-mono">L3_ORGANIZATION_VERIFIED</span> — business_registry_match / document_review.{" "}
            <strong className="font-semibold text-paper/90">Defined in v1.1.1 · Not issued by AgenID today.</strong>{" "}
            Deferred behind a written evidence standard as well as the root key.
          </li>
          <li>
            <span className="font-mono">L4_DEPLOYMENT_VERIFIED</span> — deployment_conformance via
            deployment_sample_review.{" "}
            <strong className="font-semibold text-paper/90">Defined in v1.1.1 · Not issued by AgenID today.</strong>{" "}
            The sampling methodology is also still open — see below.
          </li>
          <li>
            <span className="font-mono">L5_CONTINUOUSLY_MONITORED</span> — a reserved name only. No
            continuous-integrity claim exists in v1.1.1.{" "}
            <strong className="font-semibold text-paper/90">Not defined · Not issued.</strong>
          </li>
        </ul>
        <p className="rounded-lg border border-amber/40 bg-amber/10 p-4 text-paper/90">
          <span className="font-semibold">The ceiling on this deployment is L1_REGISTERED.</span> Every level above it
          is a VerificationAssertion signed by the root authority key, and that key has not been generated — see below.
          An operator can complete every step that exists today and will still hold an L1 identity. Nothing on this
          site is an offer of L2, L3 or L4.
        </p>
        <p>
          A VERIFIED claim is scoped to exactly what its evidence type checked. It is never a general safety,
          behavioral, or legal guarantee — verification is not compliance.
        </p>
      </Section>

      <Section id="root-key" title="Root Authority Key — Current Status">
        <p className="rounded-lg border border-amber/40 bg-amber/10 p-4 text-paper/90">
          <span className="font-semibold">Not yet complete.</span> The production root authority key has not
          completed its HSM ceremony. The verification <em>mechanism</em> for trust anchors — two-path key discovery,
          key roles, revocation — is fully specified and testable today (spec §9.5). What has not happened yet is the
          operational step of generating and ceremonially sealing the actual production root key. This is disclosed
          here rather than implied to be finished, and this page will be updated the day it is.
        </p>
        <p>
          The L4 <span className="font-mono">deployment_sample_review</span> methodology and the CI sync step between
          the spec repository and this site&rsquo;s mirrored schemas/docs are also open items, tracked internally and
          not yet resolved.
        </p>
      </Section>

      <Section id="open-source" title="Open Source &amp; Conformance">
        <p>
          The protocol specification is public and MIT-licensed:{" "}
          <a href="https://github.com/AgenID-protocol/spec" className="text-paper underline hover:no-underline">AgenID-protocol/spec</a>.
          The independent conformance suite is also public and MIT-licensed:{" "}
          <a href="https://github.com/AgenID-protocol/conformance" className="text-paper underline hover:no-underline">AgenID-protocol/conformance</a>{" "}
          — it never imports <span className="font-mono">@agenid/core</span> or calls AgenID&rsquo;s own registry, and
          currently passes 34 of 34 checks in CI on every push.
        </p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p>
          A registered manifest&rsquo;s declared fields (identity, operator, purpose, disclosure) are public by design
          — that is what makes independent verification possible.
          {/* "does not publish a directory … yet" reads as a shipping roadmap, which is a
              claim about a thing nobody has built. State the deployed behaviour instead. */}{" "}
          AgenID publishes no directory of registered agents. Resolution is by identifier only: there is no browse,
          search, enumeration or listing endpoint on this deployment, and no such endpoint is deployed anywhere. If
          that ever changes it will be a disclosed change on this page, not a silent one.
        </p>
      </Section>
    </main>
  );
}
