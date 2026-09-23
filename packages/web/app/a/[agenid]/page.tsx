import type { Metadata } from "next";
import { JsonInspector } from "@/components/JsonInspector";
import { SearchBar } from "@/components/SearchBar";
import { fetchEnvelope, SITE_URL, type Envelope } from "@/lib/api";
import { presentEnvelopeTrust, presentTrustLevel } from "@/lib/trust-presentation";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ agenid: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { agenid } = await params;
  const id = decodeURIComponent(agenid);
  const { status, envelope } = await fetchEnvelope(id);
  if (!envelope && status >= 500) {
    // A registry outage says nothing about the identity, so it must not deindex a real
    // card either: no robots directive, no claim.
    return { title: id, description: "The AgenID registry could not be reached for this identifier." };
  }
  if (!envelope) {
    // Any string resolves to this route, so without this every typo, probe and made-up
    // identifier was an indexable 31-word page with a self-canonical — an unbounded thin
    // URL space. The page itself still returns 200 and renders the neutral card (an
    // unregistered identifier is not evidence of anything, spec §10); only search
    // indexing is withheld. `follow` stays on so the card's links still count.
    return {
      title: `${id} — not registered`,
      description: "No agent with this identifier is registered in the AgenID registry.",
      robots: { index: false, follow: true },
    };
  }
  const name = envelope.manifest.identity.name;
  // Level text comes from the canonical trust-presentation module, never the raw field.
  return pageMetadata({
    title: `${name} · ${id}`,
    description: `Verification Card for ${name}, operated by ${envelope.manifest.ownership.operator}. Verification: ${levelLabel(envelope.verification.level)}. Re-verify it yourself.`,
    path: `/a/${agenid}`,
  });
}

/**
 * Label only — the canonical module owns the mapping. This used to be a local table
 * ending in `?? level`, which echoed an attacker-supplied string straight onto the card.
 */
function levelLabel(level: unknown) {
  return presentTrustLevel(level).cardLabel;
}

function Row({ k, v, mono = false }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 border-b border-line/60 py-2.5 text-sm last:border-b-0">
      <div className="font-mono text-[11px] uppercase tracking-wider text-muted">{k}</div>
      <div className={mono ? "break-all font-mono text-[13px]" : ""}>{v}</div>
    </div>
  );
}

/** `neutral` renders the not-ok state as absence (muted), not failure (red): "not verified" is not a negative finding (spec §10). */
function StatusPill({ ok, okText, badText, neutral = false }: { ok: boolean; okText: string; badText: string; neutral?: boolean }) {
  const cls = ok ? "pill-ok" : neutral ? "" : "pill-bad";
  return <span className={`pill ${cls}`}>{ok ? "✓" : neutral ? "–" : "✗"} {ok ? okText : badText}</span>;
}

function Card({ env, id }: { env: Envelope; id: string }) {
  const m = env.manifest;
  const level = env.verification.level;
  // Every trust-presentation decision on this card comes from one canonical call.
  //
  // `levelOk` used to be `level !== "L1_REGISTERED"`, so every unrecognized level took the
  // verified branch and the card said AGENID VERIFIED. `bad` used to be the card's OWN
  // copy of `status === "SUSPENDED" || status === "REVOKED"` — a second status mapping,
  // which is how a lowercase "revoked" reached the level branch here too (F-2/F-3).
  //
  // Both now read the canonical result. `tone === "alert"` covers a revoked or suspended
  // identity AND a failed operator proof, which is what both badges already did; the card
  // was the surface that rendered a broken proof as if nothing were wrong.
  const trust = presentEnvelopeTrust(env);
  const levelOk = trust.verified;
  const bad = trust.tone === "alert";
  const has = (l: string) => env.assertions.some((a) => a.assertion.level === l && a.check.ok);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="mb-6"><SearchBar compact /></div>

      <div className={`card overflow-hidden ${bad ? "border-red/50" : ""}`}>
        <div className="border-b border-line bg-ink-3/60 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Agent Identity Record</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{m.identity.name}</h1>
              <div className="mt-1 break-all font-mono text-[13px] text-muted">{id}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`pill ${bad ? "pill-bad" : levelOk ? "pill-ok" : trust.tone === "declared" ? "pill-warn" : ""} !text-sm`}>
                {trust.pillLabel}
              </span>
              <span className="font-mono text-[11px] text-muted">{levelLabel(level)} · status {env.status}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 px-6 py-6 md:grid-cols-2">
          <div>
            <h2 className="mb-2 text-sm font-semibold">Declared by the operator</h2>
            <Row k="Operator" v={m.ownership.operator} />
            <Row k="Domain" v={<a className="text-paper hover:underline" href={`https://${m.ownership.operator_domain}`} rel="nofollow noopener">{m.ownership.operator_domain}</a>} mono />
            <Row k="Purpose" v={m.purpose.summary} />
            <Row k="Channels" v={m.purpose.channels.join(", ")} mono />
            <Row k="AI disclosed" v={m.disclosure.is_ai && m.disclosure.discloses_to_user ? "Yes — declares itself as AI to users" : "No"} />
            <Row k="Human escalation" v={m.disclosure.human_escalation ? "Available" : "Not available"} />
            {m.ownership.contact && <Row k="Contact" v={m.ownership.contact} mono />}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold">Verification</h2>
            <Row k="Ed25519 proof" v={<StatusPill ok={env.proof_check.ok} okText="signature valid" badText={`invalid · ${env.proof_check.code ?? ""}`} />} />
            <Row k="L2 domain" v={<StatusPill ok={has("L2_DOMAIN_VERIFIED")} okText="domain control verified" badText="not verified" neutral />} />
            <Row k="L3 organization" v={<StatusPill ok={has("L3_ORGANIZATION_VERIFIED")} okText="legal entity verified" badText="not verified" neutral />} />
            <Row k="Assertions" v={`${env.verification.valid_assertions} valid of ${env.verification.total_assertions}`} mono />
            <Row k="Manifest digest" v={env.manifest_digest.value} mono />
            <Row k="Operator key" v={env.operator_key.key_id} mono />
            <Row k="Registered" v={env.registered_at} mono />
          </div>
        </div>

        <div className="border-t border-line bg-ink-3/40 px-6 py-4 text-xs text-muted">
          <span className="font-semibold text-paper">Verify this yourself.</span> {env.verify_instructions}
          <div className="mt-2 flex flex-wrap gap-3 font-mono">
            <a className="text-paper hover:underline" href={`${SITE_URL}/a/${id}`} rel="alternate" type="application/json">GET this URL with Accept: application/json</a>
            <a className="text-paper hover:underline" href={env.operator_key.discovery.well_known_url}>operator keys.json</a>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <JsonInspector title="Raw proof (ManifestProof)" data={env.proof} />
        <JsonInspector title={`Assertions (${env.assertions.length})`} data={env.assertions} />
        <JsonInspector title="Full resolution envelope" data={env} />
      </div>
    </main>
  );
}

export default async function ResolverPage({ params }: Params) {
  const { agenid } = await params;
  const id = decodeURIComponent(agenid);
  const { status, envelope, error } = await fetchEnvelope(id);

  if (!envelope) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <div className="mb-6"><SearchBar compact /></div>
        <div className="card p-8 text-center">
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted">{status === 404 ? "Not registered" : status === 400 ? "Invalid identifier" : "Registry unavailable"}</div>
          <h1 className="mt-2 break-all font-mono text-lg">{id}</h1>
          <p className="mt-3 text-sm text-muted">
            {status === 404 && "No agent with this identifier is registered in this registry. An unregistered identifier is not evidence of anything — it simply has no record."}
            {status === 400 && "An AgenID is agenid: followed by a 26-character Crockford Base32 ULID (no I, L, O, or U)."}
            {status >= 500 && `The registry could not be reached (${error ?? "unknown"}). Nothing about this identity can be concluded from an outage.`}
          </p>
        </div>
      </main>
    );
  }
  return <Card env={envelope} id={id} />;
}
