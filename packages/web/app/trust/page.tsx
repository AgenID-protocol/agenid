import type { Metadata } from "next";
import Link from "next/link";
import { TwoPathDiagram } from "@/components/Diagrams";

export const metadata: Metadata = {
  title: "Trust Center",
  description:
    "Protocol, cryptography, key management, verification methodology, and open-source status for AgenID — including what is not yet complete, disclosed transparently rather than marketed over.",
  alternates: { canonical: "/trust" },
};

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
        <p>Retired or revoked keys stay resolvable forever — a revoked key&rsquo;s history is never deleted.</p>
        <div className="pt-2"><TwoPathDiagram /></div>
      </Section>

      <Section id="verification" title="Verification Methodology">
        <p>
          Verification is a distinct, signed act — a VerificationAssertion, made by an authority key, bound to one
          specific manifest digest and evidence type. It is never inferred from an operator&rsquo;s own declaration.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><span className="font-mono">L1_REGISTERED</span> — schema_validation. Issuable.</li>
          <li><span className="font-mono">L2_DOMAIN_VERIFIED</span> — dns_txt_challenge / http_wellknown_challenge. Issuable.</li>
          <li><span className="font-mono">L3_ORGANIZATION_VERIFIED</span> — business_registry_match / document_review. Issuable.</li>
          <li><span className="font-mono">L4_DEPLOYMENT_VERIFIED</span> — deployment_conformance via deployment_sample_review. Issuable, but the sampling methodology itself is still being finalized — see below.</li>
          <li><span className="font-mono">L5_CONTINUOUSLY_MONITORED</span> — a reserved name only. No continuous-integrity claim exists in v1.1.1; it cannot be issued.</li>
        </ul>
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
          — that is what makes independent verification possible. AgenID does not publish a directory of registered
          agents for open discovery yet; resolution is by identifier, not by browsing.
        </p>
      </Section>
    </main>
  );
}
