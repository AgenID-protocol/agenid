/**
 * Live Identity Flow Visualizer.
 *
 * Shows the actual claim, not a vibe: one agenid:<ULID> and one manifest_digest move
 * across a voice platform, a model provider, and an edge runtime, and neither value
 * changes. The platforms change. The identity doesn't.
 *
 * Deliberately CSS-only (keyframes in app/globals.css) — a server component with no
 * JavaScript, no animation library, and a static fallback under prefers-reduced-motion.
 * The three stages are illustrative of the layers in the registry, not a claim that
 * this specific hand-off has been executed end to end; the digest shown is the §8
 * specimen value, not a live lookup.
 */
const STAGES = [
  { layer: "VOICE", name: "Retell", detail: "custom-LLM webhook" },
  { layer: "MODELS", name: "OpenAI", detail: "model call" },
  { layer: "INFRASTRUCTURE", name: "Cloudflare", detail: "edge verify" },
];

const AGENT_ID = "agenid:01J8Z3K3F2QZ9X6V7R4T8N2W5Y";
const DIGEST = "sha-256:9f2c…a41d";

export function IdentityFlow() {
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-mono text-[11px] text-muted">IDENTITY PERSISTENCE</div>
        <div className="font-mono text-[11px] text-muted">
          manifest_digest <span className="text-paper">{DIGEST}</span> · unchanged at every hop
        </div>
      </div>

      {/* rail — md and up */}
      <div className="relative mt-10 hidden md:block">
        <div className="absolute left-[16.666%] right-[16.666%] top-[13px] h-px bg-line" aria-hidden />
        <div className="flow-token absolute -top-1 z-10 -translate-x-1/2" aria-hidden>
          <span className="rounded-md border border-mint/40 bg-mint-deep px-2.5 py-1 font-mono text-[11px] whitespace-nowrap text-mint">
            {AGENT_ID}
          </span>
        </div>
        <div className="grid grid-cols-3 pt-10">
          {STAGES.map((s, i) => (
            <div key={s.name} className="px-2">
              <div className={`flow-stage flow-stage-${i + 1} rounded-xl border border-line bg-ink-3 px-4 py-3 text-center`}>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{s.layer}</div>
                <div className="mt-1 text-sm font-semibold text-paper">{s.name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* stacked — below md */}
      <div className="mt-6 space-y-2 md:hidden">
        <div className="rounded-md border border-mint/40 bg-mint-deep px-2.5 py-1.5 text-center font-mono text-[11px] text-mint">
          {AGENT_ID}
        </div>
        {STAGES.map((s) => (
          <div key={s.name} className="rounded-xl border border-line bg-ink-3 px-4 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">{s.layer}</div>
            <div className="mt-0.5 text-sm font-semibold text-paper">
              {s.name} <span className="font-mono text-[10px] font-normal text-muted">· {s.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm leading-relaxed text-muted">
        The identifier and the signed <span className="font-mono">manifest_digest</span> are the same bytes at every hop —
        the operator&rsquo;s manifest names the agent and who is accountable for it, never the vendor underneath. Each hop can
        re-verify the Ed25519 signature offline before it acts, without calling AgenID and without trusting the platform it
        received the identity from. Stages are illustrative of the layers in the registry below, not a record of an executed
        hand-off.
      </p>
    </div>
  );
}
