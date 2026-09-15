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

const FIELD =
  "w-full rounded-lg border border-line bg-ink-3 px-3 py-2.5 text-sm text-paper placeholder:text-muted/60 focus:border-mint/60 focus:outline-none";
const LABEL = "block font-mono text-[11px] uppercase tracking-wider text-muted";

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
                setTimeout(() => setCopied(false), 1600);
              },
              () => setCopied(false),
            );
          }}
          className="font-mono text-[11px] text-muted underline hover:text-paper"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <textarea
        readOnly
        rows={lines}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1.5 w-full resize-y rounded-lg border border-line bg-ink-3 p-3 font-mono text-[11px] leading-relaxed text-paper focus:border-mint/60 focus:outline-none"
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
  const [discloses, setDiscloses] = useState(true);
  const [escalation, setEscalation] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<Issued | null>(null);
  const [keyTaken, setKeyTaken] = useState(false);

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
        return;
      }

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
    } finally {
      setBusy(false);
    }
  }

  if (issued) {
    return <Result issued={issued} siteUrl={siteUrl} keyTaken={keyTaken} onKeyTaken={() => setKeyTaken(true)} />;
  }

  return (
    <form onSubmit={onSubmit} className="card mt-10 p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="agent-name">Agent name</label>
          <input
            id="agent-name" className={`${FIELD} mt-1.5`} required maxLength={200}
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Sunny — Front Desk Scheduler"
          />
        </div>

        <div>
          <label className={LABEL} htmlFor="operator">Operator</label>
          <input
            id="operator" className={`${FIELD} mt-1.5`} required maxLength={300}
            value={operator} onChange={(e) => setOperator(e.target.value)}
            placeholder="Acme Health, Inc."
          />
          <p className="mt-1.5 text-xs text-muted">Who is accountable for this agent.</p>
        </div>

        <div>
          <label className={LABEL} htmlFor="domain">Operator domain</label>
          <input
            id="domain" className={`${FIELD} mt-1.5 font-mono`} required
            value={domain} onChange={(e) => setDomain(e.target.value)}
            placeholder="acmehealth.com" inputMode="url" autoCapitalize="none" spellCheck={false}
          />
          <p className="mt-1.5 text-xs text-muted">Declared now. Proving you control it is a separate, later step.</p>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="purpose">What it does</label>
          <input
            id="purpose" className={`${FIELD} mt-1.5`} required maxLength={500}
            value={purpose} onChange={(e) => setPurpose(e.target.value)}
            placeholder="Books and reschedules patient appointments."
          />
        </div>

        <div className="sm:col-span-2">
          <span className={LABEL}>Channels</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CHANNELS.map((c) => {
              const on = channels.includes(c);
              return (
                <button
                  key={c} type="button" onClick={() => toggleChannel(c)} aria-pressed={on}
                  className={`rounded-md border px-3 py-1.5 font-mono text-xs transition ${
                    on ? "border-mint/50 bg-mint-deep/60 text-mint" : "border-line bg-ink-3 text-muted hover:border-muted"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2.5 rounded-lg border border-line bg-ink-3 p-3 text-sm">
            <input type="checkbox" checked={discloses} onChange={(e) => setDiscloses(e.target.checked)} className="mt-0.5 accent-[var(--color-mint)]" />
            <span>Discloses it is AI to the person<span className="block text-xs text-muted">disclosure.discloses_to_user</span></span>
          </label>
          <label className="flex items-start gap-2.5 rounded-lg border border-line bg-ink-3 p-3 text-sm">
            <input type="checkbox" checked={escalation} onChange={(e) => setEscalation(e.target.checked)} className="mt-0.5 accent-[var(--color-mint)]" />
            <span>Can hand off to a human<span className="block text-xs text-muted">disclosure.human_escalation</span></span>
          </label>
        </div>

        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="contact">Contact email <span className="normal-case tracking-normal">(optional)</span></label>
          <input
            id="contact" type="email" className={`${FIELD} mt-1.5`}
            value={contact} onChange={(e) => setContact(e.target.value)} placeholder="ops@acmehealth.com"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red/40 bg-red/10 p-4 text-sm text-paper">
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
        {/* Amber, not emerald. The brand guide reserves emerald for independently
            verified state, and L1 is a self-declaration. badge.js renders L1 amber for
            the same reason; a green pill here would contradict the badge the operator
            is about to embed. */}
        <div className="pill pill-warn">L1_REGISTERED</div>
        <h2 className="mt-4 text-2xl font-bold tracking-tight">{String((signed.manifest.identity as Record<string, unknown>).name)} has an identity.</h2>
        <p className="mt-3 font-mono text-sm break-all text-mint">{agentId}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/a/${agentId}`} className="btn btn-primary">Open the Verification Card</Link>
          <a href={`/api/resolve/${agentId}`} className="btn btn-ghost">View the JSON envelope</a>
        </div>
      </div>

      {/* The private key panel comes before everything else, because it is the only
          thing on this page that cannot be recovered by reloading. */}
      <div className={`card mt-6 p-6 sm:p-8 ${keyTaken ? "" : "border-amber/50"}`}>
        <div className="font-mono text-[11px] uppercase tracking-wider text-amber">Save your private key now</div>
        <p className="mt-3 text-sm text-muted">
          This key is how you prove you still control this agent — to re-sign an updated manifest, to rotate keys, or
          to claim a higher verification level later. It was generated in this browser tab.{" "}
          <span className="text-paper">AgenID never received it and cannot reset it.</span> Close this tab without
          saving and the identity stays resolvable, but you can never change it.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button type="button" onClick={downloadKey} className="btn btn-primary">Download key file</button>
          {keyTaken && <span className="font-mono text-xs text-mint">saved ✓</span>}
        </div>
        <details className="mt-5">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-muted">Show the raw key instead</summary>
          <div className="mt-3">
            <Copyable label="Ed25519 private key (hex, 32-byte seed)" value={privateKeyHex} lines={2} />
          </div>
        </details>
      </div>

      <div className="card mt-6 grid gap-6 p-6 sm:p-8">
        <div>
          <h3 className="text-lg font-semibold">Show it</h3>
          <p className="mt-1.5 text-sm text-muted">
            The badge resolves live against the registry every time it renders — it reads current status, it does not
            cache a picture of it.
          </p>
        </div>
        <Copyable label="HTML embed" value={badgeSnippet} lines={2} />
        <Copyable label="Markdown (README)" value={markdown} lines={2} />
        <Copyable label="Verify from a terminal" value={curl} lines={2} />
      </div>

      <div className="card mt-6 p-6 sm:p-8">
        <h3 className="text-lg font-semibold">What L1 does and does not mean</h3>
        <ul className="mt-4 space-y-3 text-sm text-muted">
          {issued.disclosures.map((d) => (
            <li key={d} className="flex gap-2.5">
              <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
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
