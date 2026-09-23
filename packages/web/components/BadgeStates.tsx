import { NOT_REGISTERED_TRUST, presentTrustLevel, type TrustPresentation } from "@/lib/trust-presentation";

/**
 * The badge's whole colour language in one row — small multiples of the three states a
 * reader will actually meet. Every label and colour comes from lib/trust-presentation.ts,
 * the one module that decides what a level looks like; nothing here maps a level itself.
 *
 * The verified state is shown because a reader needs to know what it will look like — but
 * no agent can reach it on this deployment, so it is captioned as an illustration.
 */
function Sample({ trust, caption, illustration = false }: { trust: TrustPresentation; caption: string; illustration?: boolean }) {
  const glyph = trust.tone === "verified" ? "✓" : trust.tone === "declared" ? "○" : "–";
  return (
    <figure className="flex flex-col items-start gap-2">
      <span
        className="inline-flex h-7 items-stretch overflow-hidden rounded-md border border-line-strong text-xs font-semibold"
        aria-label={`${trust.embedLabel}${illustration ? " (illustration)" : ""}`}
      >
        <span className="flex items-center bg-ink-3 px-2 text-paper">AGENID</span>
        <span className="flex items-center gap-1 px-2 text-ink" style={{ backgroundColor: trust.color }}>
          <span aria-hidden>{glyph}</span>
          {trust.badgeLabel}
        </span>
      </span>
      <figcaption className="text-xs text-muted">{caption}</figcaption>
    </figure>
  );
}

export function BadgeStates({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-3"}`}>
      <Sample trust={NOT_REGISTERED_TRUST} caption="No record in this registry. Neutral: absence is not a negative finding." />
      <Sample trust={presentTrustLevel("L1_REGISTERED")} caption="L1 · Registered. Self-declared by the operator — what agenid.com issues today." />
      <Sample
        trust={presentTrustLevel("L2_DOMAIN_VERIFIED")}
        caption="Illustration only: not issued by agenid.com today. Requires the root authority key."
        illustration
      />
    </div>
  );
}
