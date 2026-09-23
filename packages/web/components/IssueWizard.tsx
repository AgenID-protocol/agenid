"use client";

/**
 * The 60-second issuance flow: name an agent, get a signed, resolvable AgenID.
 *
 * KEY CUSTODY IS THE WHOLE POINT. The Ed25519 keypair is generated in this browser by
 * lib/client-crypto.ts. The private key lives in this component's state and in the file
 * the operator downloads. It is never placed in a form field that is submitted, never
 * logged, and never a member of the request body — POST /api/v1/agents receives only the
 * manifest, the signed ManifestProof, and the public KeyDocument. A registry that can
 * sign on your behalf is a registry whose signatures mean nothing.
 *
 * It is also never written to localStorage or sessionStorage. A one-time download is the
 * only persistence offered, because browser storage would quietly turn "your key" into
 * "your key, plus anything else running on this origin".
 *
 * WHAT THE RESULT CLAIMS. L1_REGISTERED and nothing above it: this agent is registered
 * here and its operator self-declaration verifies. That is not a check of the operator,
 * the domain, or the organization. The success panel says so in those words.
 */

import { useState } from "react";
import Link from "next/link";
import { generateKeyPair, signAgent, hexEncode, type ClientKeyPair, type SignedAgent } from "@/lib/client-crypto";
import { presentTrustLevel } from "@/lib/trust-presentation";
import { ListInDirectory } from "@/components/DirectoryConsent";

/** What issuance produces, resolved through the one module that decides how it looks. */
const L1 = presentTrustLevel("L1_REGISTERED");

const CHANNELS = ["voice", "sms", "chat", "email", "api"] as const;
type Channel = (typeof CHANNELS)[number];

type Issued = {
  agentId: string;
  keyId: string;
  signed: SignedAgent;
  keyPair: ClientKeyPair;
  registeredAt: string;
  disclosures: string[];
};

/** `.field` (globals.css): line-strong boundary for WCAG 1.4.11, paper focus, never mint. */
const FIELD = "field";
const LABEL = "block text-xs font-medium uppercase tracking-[0.08em] text-muted";

/**
 * The three steps, driven by what has actually happened — never by a timer. A timer here
 * would be theatrical progress on a cryptographic operation. `stage` advances only when
 * the key pair exists and the manifest is signed locally (2), and when the registry has
 * answered 201 (3).
 */
const STEPS = [
  { n: "01", t: "Describe the agent", d: "Who operates it, what it does, which channels it runs on." },
  { n: "02", t: "Your browser signs it", d: "An Ed25519 key is generated in this tab and signs the manifest locally." },
  { n: "03", t: "Register the public parts", d: "Only the manifest, the signature, and the public key are sent." },
];

export function IssueSteps({ stage }: { stage: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="mt-10 grid grid-cols-3 gap-2 sm:gap-3" aria-label="Progress">
      {STEPS.map((s, i) => {
        // i done once stage has passed it; active while stage sits on it.
        const state = stage > i ? "done" : stage === i ? "active" : "idle";
        return (
          <li
            key={s.n}
            data-state={state}
            aria-current={state === "active" ? "step" : undefined}
            className={`card p-3 transition-colors duration-200 sm:p-4 ${state === "active" ? "!border-line-strong" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{s.n}</span>
              {state === "done" && (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-label="done" role="img" className="text-paper">
                  <path className="check-draw" d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="mt-2 text-sm font-semibold">{s.t}</div>
            <p className="mt-1 hidden text-sm text-paper-dim sm:block">{s.d}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Copyable({ label, value, lines = 3 }: { label: string; value: string; lines?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className={LABEL}>{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              },
              () => setCopied(false),
            );
          }}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-xs font-medium text-paper-dim transition-colors hover:text-paper"
        >
          <span aria-hidden>{copied ? "✓" : "⧉"}</span>
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? `${label} copied to clipboard` : ""}</span>
      </div>
      <textarea
        readOnly
        rows={lines}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="field mt-2 resize-y !p-3 font-mono !text-xs leading-relaxed"
      />
    </div>
  );
}

export function IssueWizard({ siteUrl }: { siteUrl: string }) {
  const [name, setName] = useState("");
  const [operator, setOperator] = useState("");
  const [domain, setDomain] = useState("");
  const [purpose, setPurpose] = useState("");
  const [contact, setContact] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["voice"]);
  /**
   * Both start FALSE. These are behavioral claims about a real deployment, they are not
   * discoverable from any API, and they go under the operator's own Ed25519 signature —
   * so a pre-checked box would sign a claim the operator never made. Pre-checking is the
   * quiet version of hardcoding; it was hardcoded `true` in the Retell wizard and
   * pre-checked `true` here, which is the same defect at two different volumes.
   */
  const [discloses, setDiscloses] = useState(false);
  const [escalation, setEscalation] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [keyTaken, setKeyTaken] = useState(false);
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);

  function toggleChannel(c: Channel) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (channels.length === 0) {
      setError("Pick at least one channel — the protocol requires purpose.channels to be non-empty.");
      return;
    }

    setBusy(true);
    setStage(1);
    try {
      // 1. Keys are born here, in this tab, and stay here.
      const keyPair = generateKeyPair();

      // 2. Manifest + ManifestProof are built and signed locally.
      const signed = await signAgent(keyPair, name.trim(), {
        operator: operator.trim(),
        operatorDomain: domain.trim().toLowerCase(),
        purposeSummary: purpose.trim(),
        disclosesToUser: discloses,
        humanEscalation: escalation,
        channels,
        ...(contact.trim() ? { contact: contact.trim() } : {}),
      });

      setStage(2);

      // 3. Only public material crosses the wire.
      const res = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manifest: signed.manifest,
          proof: signed.proof,
          key_document: signed.keyDocument,
        }),
      });
      const body = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const issues = Array.isArray(body.issues) ? ` (${body.issues.length} schema issue(s))` : "";
        setError(`${String(body.message ?? body.error ?? "registration failed")}${issues}`);
        setStage(0);
        return;
      }

      setStage(3);
      setIssued({
        agentId: String(body.agent_id),
        keyId: signed.keyId,
        signed,
        keyPair,
        registeredAt: String(body.registered_at ?? ""),
        disclosures: Array.isArray(body.disclosures) ? (body.disclosures as string[]) : [],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "registration failed");
      setStage(0);
    } finally {
      setBusy(false);
    }
  }

  if (issued) {
    return (
      <>
        <IssueSteps stage={3} />
        <Result issued={issued} siteUrl={siteUrl} keyTaken={keyTaken} onKeyTaken={() => setKeyTaken(true)} />
      </>
    );
  }

  return (
    <>
    <IssueSteps stage={stage} />
    <form onSubmit={onSubmit} className="card mt-10 p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="agent-name">Agent name</label>
          <input
            id="agent-name" className={`${FIELD} mt-2`} required maxLength={200}
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunny — Front Desk Scheduler"
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="operator">Operator</label>
          <input
            id="operator" className={`${FIELD} mt-2`} required maxLength={300}
            value={operator} onChange={(e) => setOperator(e.target.value)}
            placeholder="e.g. Acme Health, Inc."
          />
          <p className="mt-2 text-xs text-muted">Who is accountable for this agent.</p>
        </div>

        <div>
          <label className={LABEL} htmlFor="domain">Operator domain</label>
          <input
            id="domain" className={`${FIELD} mt-2 font-mono`} required
            value={domain} onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. acmehealth.com" inputMode="url" autoCapitalize="none" spellCheck={false}
          />
          <p className="mt-2 text-xs text-muted">Declared now. Proving you control it is a separate, later step.</p>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="purpose">What it does</label>
          <input
            id="purpose" className={`${FIELD} mt-2`} required maxLength={500}
            value={purpose} onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Books and reschedules patient appointments."
          />
        </div>

        <div className="sm:col-span-2">
          <span className={LABEL} id="channels-label">Channels</span>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="channels-label">
            {CHANNELS.map((c) => {
              const on = channels.includes(c);
              return (
                <button
                  key={c} type="button" onClick={() => toggleChannel(c)} aria-pressed={on}
                  // Selection is not a trust state, so it is paper, not mint.
                  className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 font-mono text-xs transition-colors ${
                    on ? "border-paper bg-paper/[0.08] text-paper" : "border-line-strong bg-ink-3 text-muted hover:text-paper"
                  }`}
                >
                  {on && <span aria-hidden>✓</span>}
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-3 rounded-lg border border-line-strong bg-ink-3 p-3 text-sm">
            <input type="checkbox" checked={discloses} onChange={(e) => setDiscloses(e.target.checked)} className="mt-1 accent-[var(--color-mint)]" />
            <span>Discloses it is AI to the person<span className="block text-xs text-muted">disclosure.discloses_to_user</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-line-strong bg-ink-3 p-3 text-sm">
            <input type="checkbox" checked={escalation} onChange={(e) => setEscalation(e.target.checked)} className="mt-1 accent-[var(--color-mint)]" />
            <span>Can hand off to a human<span className="block text-xs text-muted">disclosure.human_escalation</span></span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="contact">Contact email <span className="normal-case tracking-normal">(optional)</span></label>
          <input
            id="contact" type="email" className={`${FIELD} mt-2`}
            value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g. ops@acmehealth.com"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-line-strong bg-ink-3 p-4 text-sm text-paper">
          {error}
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-60">
          {busy ? "Signing in your browser…" : "Generate key & register"}
        </button>
        <p className="text-xs text-muted">
          Your private key is generated in this tab and never sent to AgenID.
        </p>
      </div>
    </form>
    </>
  );
}

function Result({
  issued, siteUrl, keyTaken, onKeyTaken,
}: { issued: Issued; siteUrl: string; keyTaken: boolean; onKeyTaken: () => void }) {
  const { agentId, keyId, signed, keyPair } = issued;
  const cardUrl = `${siteUrl}/a/${agentId}`;
  const privateKeyHex = hexEncode(keyPair.privateKey);

  const keyFile = JSON.stringify(
    {
      _warning: "PRIVATE KEY. Anyone holding this can sign as this agent. AgenID does not have a copy and cannot reset it.",
      agent_id: agentId,
      key_id: keyId,
      key_type: "Ed25519",
      private_key_hex: privateKeyHex,
      public_key_b64u: keyPair.publicKeyB64u,
      created_at: signed.keyDocument.created_at,
    },
    null,
    2,
  );

  function downloadKey() {
    const blob = new Blob([keyFile], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenid-key-${agentId.replace("agenid:", "")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onKeyTaken();
  }

  const badgeSnippet = `<script src="${siteUrl}/badge.js" data-agent="${agentId}"></script>`;
  // README badge is the <img> route, not badge.js — Markdown renderers strip scripts.
  const markdown = `[![AgenID](${siteUrl}/badge/${agentId}/shield.svg)](${cardUrl})`;
  const curl = `curl -H 'Accept: application/json' ${cardUrl}`;

  return (
    <div className="mt-10">
      <div className="card p-6 sm:p-8">
        {/* Amber, not emerald — but the decision is not made here. The canonical
            presentation module owns it, so this pill, the shield and /badge.js cannot
            drift: L1 is a self-declaration and the brand guide reserves emerald for
            independently verified state. */}
        <div className={`pill ${L1.verified ? "pill-ok" : L1.tone === "declared" ? "pill-warn" : ""}`}>{L1.level ?? L1.badgeLabel}</div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">{String((signed.manifest.identity as Record<string, unknown>).name)} has an identity.</h2>
        <p className="mt-3 font-mono text-sm break-all text-paper">{agentId}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/a/${agentId}`} className="btn btn-primary">Open the Verification Card</Link>
          <a href={`/api/resolve/${agentId}`} className="btn btn-ghost">View the JSON envelope</a>
        </div>
      </div>

      {/* The private key panel comes before everything else, because it is the only
          thing on this page that cannot be recovered by reloading. */}
      <div className={`card mt-6 p-6 sm:p-8 ${keyTaken ? "" : "!border-paper-dim"}`}>
        {/* Paper, not amber: amber means a self-declared L1 on this site, and this is an
            instruction, not a trust state. */}
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-paper">Save your private key now</div>
        <p className="mt-3 text-sm text-muted">
          This key is how you prove you still control this agent — to re-sign an updated manifest, to rotate keys, or
          to claim a higher verification level later. It was generated in this browser tab.{" "}
          <span className="text-paper">AgenID never received it and cannot reset it.</span> Close this tab without
          saving and the identity stays resolvable, but you can never change it.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" onClick={downloadKey} className="btn btn-primary">Download key file</button>
          {keyTaken && <span className="text-xs text-paper-dim" role="status">Saved ✓</span>}
        </div>
        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.08em] text-muted">Show the raw key instead</summary>
          <div className="mt-3">
            <Copyable label="Ed25519 private key (hex, 32-byte seed)" value={privateKeyHex} lines={2} />
          </div>
        </details>
      </div>

      {/* Where this agent is, what is next, and exactly where the ceiling is. Step 3 is
          labelled honestly: it cannot be completed on this deployment until the root
          authority key exists. No trust colour on the rail — it is a path, not a state. */}
      <nav aria-label="Next steps for this agent" className="card mt-6 p-6 sm:p-8">
        <div className="eyebrow">What happens next</div>
        <ol className="grid gap-3 md:grid-cols-3">
          <li className="rounded-lg border border-line-strong p-4" aria-current="step">
            <div className="text-xs text-muted">① Done</div>
            <div className="mt-1 text-sm font-semibold text-paper">Registered · L1 <span aria-hidden>✓</span></div>
            <p className="mt-1 text-sm text-paper-dim">Resolvable now. Self-declared by you; not a third-party check.</p>
          </li>
          <li className="rounded-lg border border-line-strong p-4">
            <div className="text-xs text-muted">② Next</div>
            <div className="mt-1 text-sm font-semibold text-paper">Prove domain control</div>
            <p className="mt-1 text-sm text-paper-dim">Publish one DNS record at your provider. It records evidence; it does not raise the level.</p>
            <Link href={`/verify/domain?domain=${encodeURIComponent(String((signed.manifest.ownership as Record<string, unknown>)?.operator_domain ?? ""))}`} className="btn btn-ghost btn-sm mt-3">Prove domain control</Link>
          </li>
          <li className="rounded-lg border border-dashed border-line-strong p-4">
            <div className="text-xs text-muted">③ Pending</div>
            <div className="mt-1 text-sm font-semibold text-paper-dim">L2 · Domain Verified</div>
            <p className="mt-1 text-sm text-muted">Not issuable yet: it needs an assertion signed by the root authority key, which has not been generated.</p>
          </li>
        </ol>
      </nav>

      <div className="card mt-6 grid gap-6 p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-semibold">Show it</h3>
          <p className="mt-2 text-sm text-muted">
            The badge resolves live against the registry every time it renders — it reads current status, it does not
            cache a picture of it.
          </p>
        </div>
        <Copyable label="HTML embed" value={badgeSnippet} lines={2} />
        <Copyable label="Markdown (README)" value={markdown} lines={2} />
        <Copyable label="Verify from a terminal" value={curl} lines={2} />
      </div>

      {/* Opt-in, and only on a click: registration never lists an agent by itself. */}
      <div className="card mt-6 p-6 sm:p-8">
        <ListInDirectory agentId={agentId} keyId={keyId} keyPair={keyPair} />
      </div>

      <div className="card mt-6 p-6 sm:p-8">
        <h3 className="text-lg font-semibold">What L1 does and does not mean</h3>
        <ul className="mt-4 space-y-3 text-sm text-muted">
          {issued.disclosures.map((d) => (
            <li key={d} className="flex gap-3">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-muted">
          Next step:{" "}
          <Link href="/docs/onboarding" className="text-paper underline hover:no-underline">
            sign an updated manifest with @agenid/core
          </Link>{" "}
          when what this agent does changes. The identifier stays the same; the declaration is versioned.
        </p>
      </div>

      <details className="card mt-6 p-6 sm:p-8">
        <summary className="cursor-pointer font-semibold">Inspect exactly what was sent</summary>
        <p className="mt-3 text-sm text-muted">
          Three public objects. There is no fourth field, and no private key among them.
        </p>
        <div className="mt-5 grid gap-5">
          <Copyable label="manifest" value={JSON.stringify(signed.manifest, null, 2)} lines={12} />
          <Copyable label="proof (operator-signed)" value={JSON.stringify(signed.proof, null, 2)} lines={12} />
          <Copyable label="key_document (public key only)" value={JSON.stringify(signed.keyDocument, null, 2)} lines={12} />
        </div>
      </details>
    </div>
  );
}
