/**
 * Four static diagrams: Identity Lifecycle, Trust Model, Cryptographic Chain, Two-Path Key
 * Discovery. Plain flex/CSS, no chart library.
 *
 * Design pass (2026-09-23): these describe the PROTOCOL, so none of them uses a trust
 * colour. The lifecycle used to draw VerificationAssertion in emerald, as if the step were
 * live; it cannot run on this deployment until the root authority key exists. Steps that
 * need the authority are now dashed and say so. Live steps are solid.
 */

type Tone = "live" | "pending";

function Step({ n, label, sub, tone = "live" }: { n?: number; label: string; sub?: string; tone?: Tone }) {
  return (
    <div
      className={`card flex-1 px-4 py-3 text-center ${tone === "pending" ? "!border-dashed !border-line-strong !bg-transparent !shadow-none" : ""}`}
    >
      {n !== undefined && <div className="text-xs text-muted">{String(n).padStart(2, "0")}</div>}
      <div className="font-mono text-xs text-paper">{label}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
      {tone === "pending" && (
        <div className="mt-2 inline-block rounded border border-dashed border-line-strong px-2 py-1 text-xs text-muted">
          requires root authority key
        </div>
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center px-1 text-muted">
      <span className="md:hidden">↓</span>
      <span className="hidden md:inline">→</span>
    </div>
  );
}

export function LifecycleDiagram() {
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      <Step n={1} label="Agent" sub="agenid:<ULID> minted" />
      <Arrow />
      <Step n={2} label="Manifest" sub="operator self-declaration" />
      <Arrow />
      <Step n={3} label="ManifestProof" sub="operator-signed, DECLARED" />
      <Arrow />
      <Step n={4} label="Authority checks evidence" sub="DNS TXT, org registry, …" tone="pending" />
      <Arrow />
      <Step n={5} label="VerificationAssertion" sub="authority-signed, VERIFIED" tone="pending" />
      <Arrow />
      <Step n={6} label="Independent verification" sub="anyone re-checks offline" />
    </div>
  );
}

export function TrustModelDiagram() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="card p-4">
        <div className="font-mono text-xs text-paper">DECLARED</div>
        <div className="mt-1 text-sm text-muted">Manifest + ManifestProof, operator key. Signed, not checked.</div>
      </div>
      <div className="card !border-dashed !border-line-strong !bg-transparent p-4">
        <div className="font-mono text-xs text-paper">VERIFIED</div>
        <div className="mt-1 text-sm text-muted">VerificationAssertion, authority key. Bound to one manifest digest.</div>
        <div className="mt-2 text-xs text-muted">Not issued on agenid.com today — requires the root authority key.</div>
      </div>
      <div className="card !border-dashed !border-line !bg-transparent p-4">
        <div className="font-mono text-xs text-muted">AUTHORIZED</div>
        <div className="mt-1 text-sm text-muted">Reserved, v1.2. No signed object exists for it in v1.1.1.</div>
      </div>
      <div className="col-span-full font-mono text-xs text-muted">
        operator-signed ⇏ VERIFIED &nbsp;·&nbsp; authority-signed ⇏ DECLARED &nbsp;·&nbsp; enforced by key <span className="text-paper">role</span>, not convention
      </div>
    </div>
  );
}

export function CryptoChainDiagram() {
  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
      <Step n={1} label="Manifest" sub="canonical JSON" />
      <Arrow />
      <Step n={2} label="RFC 8785 JCS" sub="deterministic bytes" />
      <Arrow />
      <Step n={3} label="SHA-256" sub="manifest_digest" />
      <Arrow />
      <Step n={4} label="Signed object" sub="ManifestProof / Assertion" />
      <Arrow />
      <Step n={5} label="Ed25519 (pure)" sub="RFC 8032, no pre-hash" />
      <Arrow />
      <Step n={6} label="Verify()" sub="anyone, offline" />
    </div>
  );
}

/**
 * Two independent paths converge on one rule: they must return the same key. Both exits
 * are drawn. The mismatch exit is a hard failure, drawn in neutral dark rather than red:
 * this is a diagram of the rule, not a verdict about any agent.
 */
export function TwoPathDiagram() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="card p-4">
        <div className="eyebrow !mb-0">Registry path</div>
        <div className="mt-2 font-mono text-xs text-paper-dim">GET agenid.com/v1/keys/&#123;key-ULID&#125;</div>
        <div className="mt-2 text-sm text-muted">
          Registry-hosted key document, by key ULID. Read-only, unauthenticated, and returns the identical
          document for <span className="font-mono">?key_id=</span> with the percent-encoded logical identifier.
        </div>
      </div>
      <div className="card p-4">
        <div className="eyebrow !mb-0">Domain path</div>
        <div className="mt-2 font-mono text-xs text-paper-dim">GET &lt;domain&gt;/.well-known/agenid/keys.json</div>
        <div className="mt-2 text-sm text-muted">Operator- or authority-hosted, served over HTTPS.</div>
      </div>
      <div aria-hidden className="col-span-full hidden grid-cols-2 text-center text-muted md:grid">
        <span>↘</span>
        <span>↙</span>
      </div>
      <div className="col-span-full mx-auto w-full max-w-md rounded-lg border border-line-strong bg-ink-3 px-4 py-3 text-center">
        <div className="text-sm font-semibold text-paper">Both MUST resolve to the same key</div>
      </div>
      <div className="col-span-full grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line px-4 py-3 text-sm text-paper-dim">
          <span aria-hidden>→ </span>Match: continue verification
        </div>
        <div className="rounded-lg border border-line bg-ink px-4 py-3 text-sm text-paper-dim">
          <span aria-hidden>→ </span>Mismatch: hard fail, <span className="font-mono text-paper">trust_anchor_mismatch</span>
        </div>
      </div>
    </div>
  );
}
