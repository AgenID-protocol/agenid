/**
 * Four static diagrams referenced by the website-alignment pass:
 * Identity Lifecycle, Trust Model, Cryptographic Chain, Two-Path Key Discovery.
 * Plain flex/CSS, no chart library — Verified Emerald reserved for the
 * VERIFIED node only, per Brand Guide (never decorative).
 */

function Step({ label, sub, tone = "line" }: { label: string; sub?: string; tone?: "line" | "mint" }) {
  return (
    <div className={`card px-4 py-3 text-center ${tone === "mint" ? "border-mint/40 bg-mint-deep/50" : ""}`}>
      <div className={`font-mono text-[11px] ${tone === "mint" ? "text-mint" : "text-paper"}`}>{label}</div>
      {sub && <div className="mt-1 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function Arrow() {
  return <div className="hidden shrink-0 items-center px-1 text-muted md:flex">→</div>;
}

export function LifecycleDiagram() {
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      <Step label="Agent" sub="agenid:<ULID> minted" />
      <Arrow />
      <Step label="Manifest" sub="operator self-declaration" />
      <Arrow />
      <Step label="ManifestProof" sub="operator-signed, DECLARED" />
      <Arrow />
      <Step label="Authority checks evidence" sub="DNS TXT, org registry, …" />
      <Arrow />
      <Step label="VerificationAssertion" sub="authority-signed, VERIFIED" tone="mint" />
      <Arrow />
      <Step label="Independent verification" sub="anyone re-checks offline" />
    </div>
  );
}

export function TrustModelDiagram() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="card p-4">
        <div className="font-mono text-[11px] text-muted">DECLARED</div>
        <div className="mt-1 text-xs text-muted">Manifest + ManifestProof, operator key. Signed, not checked.</div>
      </div>
      <div className="card border-mint/40 bg-mint-deep/50 p-4">
        <div className="font-mono text-[11px] text-mint">VERIFIED</div>
        <div className="mt-1 text-xs text-muted">VerificationAssertion, authority key. Bound to one manifest digest.</div>
      </div>
      <div className="card p-4 opacity-70">
        <div className="font-mono text-[11px] text-muted">AUTHORIZED</div>
        <div className="mt-1 text-xs text-muted">Reserved, v1.2. No signed object exists for it in v1.1.1.</div>
      </div>
      <div className="col-span-full font-mono text-[11px] text-muted">
        operator-signed ⇏ VERIFIED &nbsp;·&nbsp; authority-signed ⇏ DECLARED &nbsp;·&nbsp; enforced by key <span className="text-paper">role</span>, not convention
      </div>
    </div>
  );
}

export function CryptoChainDiagram() {
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      <Step label="Manifest" sub="canonical JSON" />
      <Arrow />
      <Step label="RFC 8785 JCS" sub="deterministic bytes" />
      <Arrow />
      <Step label="SHA-256" sub="manifest_digest" />
      <Arrow />
      <Step label="Signed object" sub="ManifestProof / Assertion" />
      <Arrow />
      <Step label="Ed25519 (pure)" sub="RFC 8032, no pre-hash" />
      <Arrow />
      <Step label="Verify()" sub="anyone, offline" tone="mint" />
    </div>
  );
}

export function TwoPathDiagram() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="card p-4">
        <div className="font-mono text-[11px] text-muted">
          WIRE PATH <span className="text-amber">&middot; not deployed yet</span>
        </div>
        <div className="mt-2 font-mono text-[12px] text-paper/90">GET agenid.com/v1/keys/&#123;key-ULID&#125;</div>
        <div className="mt-2 text-xs text-muted">
          Registry-hosted key document, by key ULID. Defined by the spec; this deployment does not serve it yet
          — the registry&rsquo;s copy of the key currently travels inside the resolution envelope.
        </div>
      </div>
      <div className="card p-4">
        <div className="font-mono text-[11px] text-muted">DOMAIN PATH</div>
        <div className="mt-2 font-mono text-[12px] text-paper/90">GET &lt;domain&gt;/.well-known/agenid/keys.json</div>
        <div className="mt-2 text-xs text-muted">Operator- or authority-hosted, served over HTTPS.</div>
      </div>
      <div className="col-span-full font-mono text-[11px] text-muted">
        Both MUST resolve to the same key. Disagreement is a hard fail: <span className="text-paper">trust_anchor_mismatch</span>.
      </div>
    </div>
  );
}
