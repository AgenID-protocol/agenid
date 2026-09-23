import type { Metadata } from "next";
import { JsonInspector } from "@/components/JsonInspector";
import { SearchBar } from "@/components/SearchBar";
import { fetchEnvelope, SITE_URL, type Envelope } from "@/lib/api";
import { pageMetadata } from "@/lib/seo";
import { presentEnvelopeTrust, presentTrustLevel, TRUST_GLYPH, TRUST_SURFACE } from "@/lib/trust-presentation";
import { probeKeyDiscovery } from "@/lib/key-discovery";
import { CopyButton } from "@/components/ui/CopyButton";
import Link from "next/link";

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
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-line py-3 text-sm last:border-b-0">
      <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{k}</div>
      <div className={mono ? "break-all font-mono text-sm" : ""}>{v}</div>
    </div>
  );
}

/** `neutral` renders the not-ok state as absence (muted), not failure (red): "not verified" is not a negative finding (spec §10). */
function StatusPill({ ok, okText, badText, neutral = false }: { ok: boolean; okText: string; badText: string; neutral?: boolean }) {
  const cls = ok ? "pill-ok" : neutral ? "" : "pill-bad";
  return <span className={`pill ${cls}`}>{ok ? "✓" : neutral ? "–" : "✗"} {ok ? okText : badText}</span>;
}

type KeyState = Awaited<ReturnType<typeof probeKeyDiscovery>> | null;

function Card({ env, id, keyState }: { env: Envelope; id: string; keyState: KeyState }) {
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
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
      <div className="mb-6"><SearchBar compact /></div>

      {/* Surface comes from the trust module, keyed on the tone it decided — the card never
          picks its own border or glow. */}
      <div className={`card result-in overflow-hidden ${TRUST_SURFACE[trust.tone]}`}>
        <div className="border-b border-line bg-ink-3/60 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="eyebrow !mb-0">Agent Identity Record</div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{m.identity.name}</h1>
              <div className="mt-1 break-all font-mono text-sm text-muted">{id}</div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`pill chip-set ${bad ? "pill-bad" : levelOk ? "pill-ok" : trust.tone === "declared" ? "pill-warn" : ""} !text-sm`}>
                <span aria-hidden>{TRUST_GLYPH[trust.tone]}</span>
                {trust.pillLabel}
              </span>
              <span className="font-mono text-xs text-muted">{levelLabel(level)} · status {env.status}</span>
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
            <Row
              k="Key · registry"
              v={<StatusPill ok okText="published at this registry" badText="" />}
            />
            <Row
              k="Key · operator domain"
              v={
                keyState?.state === "published" ? (
                  <span className="pill">– published at the operator&rsquo;s domain · compare the two copies yourself</span>
                ) : (
                  // Neutral, never red: an operator who has not published their own copy has
                  // not done anything wrong. It just means a verifier has one source, not two.
                  <span className="pill">
                    – {!keyState || keyState.state === "unreachable" ? "could not be checked just now" : keyState?.state === "invalid" ? "a document is there, but it is not a valid key document" : "not published"} · a verifier then has one source, not two
                  </span>
                )
              }
            />
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

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-sm font-semibold">Re-verify it yourself</h2>
          <p className="mt-2 text-sm text-paper-dim">Fetch the signed envelope and check the proof with any RFC 8785 + Ed25519 implementation. You do not have to trust this page.</p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-ink-3 p-3 font-mono text-xs text-paper-dim">{`curl -s ${SITE_URL}/a/${id} -H 'Accept: application/json'`}</code>
          <div className="mt-3"><CopyButton text={`curl -s ${SITE_URL}/a/${id} -H 'Accept: application/json'`} label="Copy command" /></div>
        </div>
        <div className="card p-5">
          <h2 className="text-sm font-semibold">Embed this badge</h2>
          <p className="mt-2 text-sm text-paper-dim">Re-resolves from the registry every time it renders, so it always shows the current state — never a static image.</p>
          <code className="mt-3 block overflow-x-auto rounded-md bg-ink-3 p-3 font-mono text-xs text-paper-dim">{`<script src="${SITE_URL}/badge.js" data-agent="${id}"></script>`}</code>
          <div className="mt-3"><CopyButton text={`<script src="${SITE_URL}/badge.js" data-agent="${id}"></script>`} label="Copy embed" /></div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <JsonInspector title="Raw proof (ManifestProof)" data={env.proof} />
        <JsonInspector title={`Assertions (${env.assertions.length})`} data={env.assertions} />
        <JsonInspector title="Full resolution envelope" data={env} />
      </div>
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
      <main className="mx-auto max-w-6xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
        <div className="mb-6"><SearchBar compact /></div>
        <div className="card result-in p-8 text-center">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{status === 404 ? "Not registered" : status === 400 ? "Invalid identifier" : "Registry unavailable"}</div>
          <h1 className="mt-2 break-all font-mono text-lg">{id}</h1>
          <p className="mt-3 text-sm text-muted">
            {status === 404 && "No agent with this identifier is registered in this registry. An unregistered identifier is not evidence of anything — it simply has no record."}
            {status === 400 && "An AgenID is agenid: followed by a 26-character Crockford Base32 ULID (no I, L, O, or U)."}
            {status >= 500 && `The registry could not be reached (${error ?? "unknown"}). Nothing about this identity can be concluded from an outage.`}
          </p>
          {/* Two ways forward, and deliberately not "register this identifier": an
              identifier is minted by its operator, never claimed by whoever resolves it. */}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href="#agenid-search" className="btn btn-ghost btn-sm">Resolve another</a>
            <Link href="/#identity" className="btn btn-ghost btn-sm">What is an AgenID?</Link>
          </div>
        </div>
        </div>
      </main>
    );
  }
  // The operator's own copy of the key, probed server-side with a hard bound so a slow or
  // hostile domain cannot hold the card. Failure to check is "could not be checked", never
  // a negative finding.
  let keyState: KeyState = null;
  try {
    keyState = await probeKeyDiscovery(envelope.manifest.ownership.operator_domain, { timeoutMs: 3000 });
  } catch {
    keyState = null;
  }
  return <Card env={envelope} id={id} keyState={keyState} />;
}
