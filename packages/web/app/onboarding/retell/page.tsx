"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { generateKeyPair, signAgentFleet, hexEncode, type ClientKeyPair, type AgentBinding } from "@/lib/client-crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RetellAgent {
  agent_id: string;
  agent_name: string | null;
}

interface DnsCapabilities {
  domain_connect: boolean;
  domain_connect_host: string | null;
  cloudflare: boolean;
  godaddy: boolean;
  nameservers: string[];
  recommended: "domain_connect" | "cloudflare" | "godaddy" | "manual";
}

interface BindResult {
  ok: boolean;
  domain: string;
  level: string;
  agents: Array<{
    agent_id: string;
    retell_agent_id: string;
    agent_name: string;
    manifest_digest: string;
    key_id: string;
    proof_expires_at: string;
  }>;
  persisted: boolean;
  registered_at: string;
  disclosures: string[];
}

type WizardStep = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function generateDnsToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `aid_${b64}`;
}

function StepIndicator({ current, label, stepNum }: { current: WizardStep; label: string; stepNum: WizardStep }) {
  const isActive = current === stepNum;
  const isDone = current > stepNum;
  return (
    <div
      className={`text-center py-2 rounded text-xs font-medium transition-all ${
        isActive
          ? "bg-mint/10 text-mint border border-mint/30"
          : isDone
            ? "bg-mint/5 text-mint/60 border border-mint/20"
            : "text-muted border border-transparent"
      }`}
    >
      {isDone ? "\u2713 " : ""}
      {stepNum}. {label}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="p-4 bg-red/10 border border-red/30 text-red rounded-lg text-sm flex justify-between items-start gap-3">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-red/60 hover:text-red shrink-0" aria-label="Dismiss error">
        &times;
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline-block mr-2" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function RetellOnboardingWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 state
  const [apiKey, setApiKey] = useState("");
  const [agents, setAgents] = useState<RetellAgent[]>([]);

  // Step 2 state
  const [domain, setDomain] = useState("");
  const [dnsToken] = useState(() => generateDnsToken());
  const [capabilities, setCapabilities] = useState<DnsCapabilities | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [autoAdding, setAutoAdding] = useState(false);
  const [dnsVerified, setDnsVerified] = useState(false);
  const [dnsCheckCount, setDnsCheckCount] = useState(0);

  // Step 3 state — client-side key custody
  const [keyPair, setKeyPair] = useState<ClientKeyPair | null>(null);
  const [bindings, setBindings] = useState<AgentBinding[] | null>(null);
  const [bindResult, setBindResult] = useState<BindResult | null>(null);

  /**
   * Operator attestations. These go under an Ed25519 signature and are claims
   * about the operator's real-world behavior, so they are NEVER defaulted:
   * the two booleans start `false` and the three strings start empty and are
   * required before signing. A default here would be a fabricated claim
   * carried under the operator's own signature.
   */
  const [operatorName, setOperatorName] = useState("");
  const [operatorContact, setOperatorContact] = useState("");
  const [purposeSummary, setPurposeSummary] = useState("");
  const [disclosesToUser, setDisclosesToUser] = useState(false);
  const [humanEscalation, setHumanEscalation] = useState(false);

  const attestationsComplete =
    operatorName.trim().length > 0 && operatorContact.trim().length > 0 && purposeSummary.trim().length > 0;

  // -------------------------------------------------------------------------
  // Step 1: Fetch Retell Agents
  // -------------------------------------------------------------------------
  const handleFetchAgents = useCallback(async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/retell/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Failed to fetch agents");
      if (!data.agents || data.agents.length === 0) throw new Error("No agents found in this Retell workspace");
      setAgents(data.agents);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  // -------------------------------------------------------------------------
  // Step 2: DNS Detection & Verification
  // -------------------------------------------------------------------------
  const handleDetectDns = useCallback(async () => {
    if (!domain.trim()) return;
    setDetecting(true);
    setCapabilities(null);
    setError("");
    try {
      const res = await fetch("/api/dns/detect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "DNS detection failed");
      setCapabilities(data.capabilities);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetecting(false);
    }
  }, [domain]);

  const domainTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (step !== 2 || !domain.trim() || domain.length < 4) return;
    clearTimeout(domainTimerRef.current);
    domainTimerRef.current = setTimeout(handleDetectDns, 800);
    return () => clearTimeout(domainTimerRef.current);
  }, [domain, step, handleDetectDns]);

  const handleAutoAdd = useCallback(
    async (provider: "cloudflare" | "godaddy") => {
      setAutoAdding(true);
      setError("");
      try {
        const res = await fetch("/api/dns/auto-add", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain, token: dnsToken, provider }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Auto-add failed");
        setTimeout(() => handleVerifyDns(), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setAutoAdding(false);
      }
    },
    [domain, dnsToken],
  );

  const handleVerifyDns = useCallback(async () => {
    setLoading(true);
    setError("");
    setDnsCheckCount((c) => c + 1);
    try {
      const res = await fetch("/api/dns/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, token: dnsToken }),
      });
      const data = await res.json();
      if (data.ok && data.matched) {
        setDnsVerified(true);
        setStep(3);
      } else if (data.found && !data.matched) {
        setError(`TXT record found at ${data.host} but value does not match. Ensure the record contains: agenid-site-verification=${dnsToken}`);
      } else {
        setError(`No TXT record found at _agenid.${domain}. DNS propagation can take up to 5 minutes.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setAutoAdding(false);
    }
  }, [domain, dnsToken]);

  // -------------------------------------------------------------------------
  // Step 3: Client-side key generation, signing, then server validation
  // -------------------------------------------------------------------------
  const handleBind = useCallback(async () => {
    if (!attestationsComplete) {
      setError("Operator name, contact and purpose are required — they are signed claims and cannot be defaulted.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // 1. Generate Ed25519 keypair IN THE BROWSER
      const kp = generateKeyPair();
      setKeyPair(kp);

      // 2. Build manifests and sign ManifestProofs CLIENT-SIDE
      const signed = await signAgentFleet(
        kp,
        agents.map((a) => ({ agent_id: a.agent_id, agent_name: a.agent_name ?? "Unnamed Agent" })),
        {
          operator: operatorName.trim(),
          operatorDomain: domain,
          disclosesToUser,
          humanEscalation,
          purposeSummary: purposeSummary.trim(),
          contact: operatorContact.trim(),
        },
      );
      setBindings(signed);

      // 3. POST only PUBLIC material to the server for validation + persistence
      const res = await fetch("/api/retell/bind", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain,
          agents: signed.map((b) => ({
            manifest: b.manifest,
            proof: b.proof,
            key_document: b.keyDocument,
            retell_agent_id: b.retellAgentId,
            agent_name: b.agentName,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Server validation failed");
      setBindResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [
    domain,
    agents,
    attestationsComplete,
    operatorName,
    operatorContact,
    purposeSummary,
    disclosesToUser,
    humanEscalation,
  ]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-3xl mx-auto w-full space-y-8">
        {/* Header */}
        <div className="space-y-2 border-b border-line pb-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs tracking-widest text-mint uppercase">AgenID Protocol Operator</span>
            <span className="pill">agenid.com</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-paper">Register your Retell agent fleet</h1>
          <p className="text-muted text-sm">
            Sign an AgenID manifest for each agent in your Retell workspace with an Ed25519 key generated in
            your browser. The result is a <strong className="text-paper">self-declaration</strong> — it records
            who signed, not that any third party checked them. Independent verification requires an
            authority-signed assertion, which this flow does not issue.
          </p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}

        {/* Wizard Card */}
        <div className="card p-6 space-y-6">
          <div className="grid grid-cols-3 gap-2 border-b border-line pb-4">
            <StepIndicator current={step} stepNum={1} label="Retell Auth" />
            <StepIndicator current={step} stepNum={2} label="Domain Control" />
            <StepIndicator current={step} stepNum={3} label="Sign & Register" />
          </div>

          {/* ============================================================= */}
          {/* STEP 1: Retell API Key */}
          {/* ============================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="block text-sm font-medium text-paper/80 mb-1.5">
                  Retell API Key
                </label>
                <input
                  id="apiKey"
                  type="password"
                  placeholder="key_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchAgents()}
                  autoComplete="off"
                  className="w-full bg-ink border border-line rounded-lg px-4 py-3 text-sm font-mono text-paper placeholder:text-muted/50 focus:outline-none focus:border-mint/50 transition"
                />
                <p className="mt-1.5 text-xs text-muted">
                  Your API key is used for a single read-only call and is never stored.
                </p>
              </div>

              <button
                onClick={handleFetchAgents}
                disabled={loading || !apiKey.trim()}
                className="btn btn-primary w-full"
              >
                {loading ? <><Spinner /> Fetching Workspace Agents...</> : "Fetch Retell Workspace Agents"}
              </button>
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 2: DNS Verification */}
          {/* ============================================================= */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="p-3 rounded-lg border border-mint/20 bg-mint-deep/30 text-xs font-mono text-mint/80">
                {agents.length} agent{agents.length !== 1 ? "s" : ""} ready &middot;{" "}
                {agents.map((a) => a.agent_name ?? a.agent_id).join(", ")}
              </div>

              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-paper/80 mb-1.5">
                  Organization Domain
                </label>
                <input
                  id="domain"
                  type="text"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => {
                    setDomain(e.target.value.toLowerCase().trim());
                    setDnsVerified(false);
                    setCapabilities(null);
                  }}
                  className="w-full bg-ink border border-line rounded-lg px-4 py-3 text-sm font-mono text-paper placeholder:text-muted/50 focus:outline-none focus:border-mint/50 transition"
                />
              </div>

              {detecting && (
                <div className="text-xs text-muted flex items-center gap-2">
                  <Spinner /> Detecting DNS provider...
                </div>
              )}

              {capabilities && !detecting && (
                <div className="space-y-3">
                  {(capabilities.recommended === "cloudflare" || capabilities.recommended === "godaddy") && (
                    <button
                      onClick={() => handleAutoAdd(capabilities.recommended as "cloudflare" | "godaddy")}
                      disabled={autoAdding}
                      className="btn btn-primary w-full"
                    >
                      {autoAdding ? (
                        <><Spinner /> Adding DNS Record via {capabilities.recommended === "cloudflare" ? "Cloudflare" : "GoDaddy"}...</>
                      ) : (
                        `1-Click Auto-Add DNS Record (${capabilities.recommended === "cloudflare" ? "Cloudflare" : "GoDaddy"})`
                      )}
                    </button>
                  )}

                  <div className="text-xs text-muted space-y-1">
                    <div>Nameservers: {capabilities.nameservers.slice(0, 2).join(", ") || "unknown"}</div>
                    <div className="flex gap-2 flex-wrap">
                      {capabilities.cloudflare && <span className="pill pill-ok">Cloudflare</span>}
                      {capabilities.godaddy && <span className="pill pill-ok">GoDaddy</span>}
                      {capabilities.domain_connect && (
                        <span className="pill" title="Detected on this domain. AgenID has no Domain Connect implementation — add the record manually.">
                          Domain Connect detected &middot; manual setup
                        </span>
                      )}
                      {!capabilities.cloudflare && !capabilities.godaddy && !capabilities.domain_connect && (
                        <span className="pill">Manual setup required</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-ink border border-line rounded-lg p-4 space-y-2 text-xs font-mono">
                <div className="text-muted border-b border-line pb-2 flex justify-between">
                  <span>Record Type: <strong className="text-paper">TXT</strong></span>
                  <span>Host: <strong className="text-paper">_agenid</strong></span>
                </div>
                <div className="text-mint break-all pt-1 select-all cursor-text">
                  agenid-site-verification={dnsToken}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`agenid-site-verification=${dnsToken}`)}
                  className="text-muted hover:text-paper transition text-[10px] uppercase tracking-wider"
                >
                  Copy to clipboard
                </button>
              </div>

              <button
                onClick={handleVerifyDns}
                disabled={loading || !domain.trim()}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <><Spinner /> Checking DNS Records...</>
                ) : dnsCheckCount > 0 ? (
                  "Re-check DNS Record"
                ) : (
                  "Verify DNS Record"
                )}
              </button>

              {dnsCheckCount > 0 && !dnsVerified && (
                <p className="text-xs text-muted text-center">
                  DNS propagation can take 30 seconds to 5 minutes. Try again shortly.
                </p>
              )}
            </div>
          )}

          {/* ============================================================= */}
          {/* STEP 3: Client-side signing & server registration */}
          {/* ============================================================= */}
          {step === 3 && (
            <div className="space-y-6">
              {bindResult ? (
                <div className="space-y-6">
                  {/*
                    DECLARED renders AMBER, never emerald. Verified Emerald is reserved for
                    third-party-verified state; DECLARED is a self-declaration and sits below
                    L1. The SVG badge, badge.js and /issue all agree on this — if this panel
                    used emerald, the same identity would read as verified here and unverified
                    everywhere else in the product.
                  */}
                  <div className="relative bg-amber/10 border border-amber/40 p-6 rounded-xl text-center space-y-3 overflow-hidden">
                    <div className="text-amber text-2xl font-bold tracking-tight">DECLARED</div>
                    <div className="font-mono text-xs text-amber/70">{bindResult.domain}</div>
                    <div className="text-xs text-paper/60">
                      {bindResult.agents.length} agent{bindResult.agents.length !== 1 ? "s" : ""} signed with Ed25519
                    </div>
                    <div className="text-xs text-paper/50">
                      Self-declared. No third party has checked these claims.
                    </div>
                  </div>

                  {/* Bound agents */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-paper/80">Registered Agent Fleet</div>
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-ink p-3 rounded-lg border border-line text-xs font-mono">
                      {bindResult.agents.map((a) => (
                        <div key={a.agent_id} className="flex justify-between py-1.5 border-b border-line last:border-0">
                          <div>
                            <span className="text-paper">{a.agent_name}</span>
                            <span className="text-muted ml-2">{a.retell_agent_id}</span>
                          </div>
                          <span className="text-mint/60 truncate max-w-[200px]" title={a.agent_id}>
                            {a.agent_id}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Crypto details */}
                  <div className="bg-ink border border-line rounded-lg p-4 space-y-2 text-xs font-mono">
                    {keyPair && (
                      <div className="flex justify-between text-muted">
                        <span>Public Key (hex)</span>
                        <span className="text-paper truncate max-w-[300px]">{keyPair.publicKeyHex}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted">
                      <span>Protocol Level</span>
                      <span className="text-amber">{bindResult.level}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Persisted to Registry</span>
                      <span className={bindResult.persisted ? "text-mint" : "text-amber"}>
                        {bindResult.persisted ? "Yes" : "No — registry write did not succeed"}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Key Custody</span>
                      <span className="text-mint">Client-side only</span>
                    </div>
                  </div>

                  {/* Disclosures */}
                  <div className="text-[11px] text-muted/70 leading-relaxed space-y-1">
                    {bindResult.disclosures.map((d, i) => (
                      <p key={i}>{d}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="pill pill-ok">Domain control confirmed</span>
                    <span className="text-muted font-mono text-xs">{domain}</span>
                  </div>
                  <p className="text-xs text-muted -mt-3">
                    The TXT record proves you control {domain}. It is evidence an authority would weigh — it is
                    not itself a verification level.
                  </p>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-paper/80">
                      Agents Ready for Signing ({agents.length})
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 bg-ink p-3 rounded-lg border border-line text-xs font-mono">
                      {agents.map((a, i) => (
                        <div key={i} className="flex justify-between py-1 border-b border-line last:border-0 text-muted">
                          <span className="text-paper">{a.agent_name ?? "Unnamed"}</span>
                          <span>{a.agent_id}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/*
                    Operator attestations. Every field here is signed, so nothing is
                    pre-filled and the two booleans start unchecked. See the standing
                    rule: never default a disclosure attestation.
                  */}
                  <div className="space-y-3 p-4 rounded-lg border border-line bg-ink">
                    <div className="text-sm font-medium text-paper/80">Your attestations</div>
                    <p className="text-xs text-muted">
                      These become part of each signed manifest. Only state what is true of your agents — a
                      signature over a false claim is worse than no signature.
                    </p>

                    <div>
                      <label htmlFor="operatorName" className="block text-xs text-paper/70 mb-1">
                        Operator legal name
                      </label>
                      <input
                        id="operatorName"
                        type="text"
                        value={operatorName}
                        onChange={(e) => setOperatorName(e.target.value)}
                        placeholder="Acme Corporation"
                        className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper placeholder:text-muted/50 focus:outline-none focus:border-mint/50 transition"
                      />
                    </div>

                    <div>
                      <label htmlFor="operatorContact" className="block text-xs text-paper/70 mb-1">
                        Contact for identity questions
                      </label>
                      <input
                        id="operatorContact"
                        type="text"
                        value={operatorContact}
                        onChange={(e) => setOperatorContact(e.target.value)}
                        placeholder="ops@acme.com"
                        className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-sm font-mono text-paper placeholder:text-muted/50 focus:outline-none focus:border-mint/50 transition"
                      />
                    </div>

                    <div>
                      <label htmlFor="purposeSummary" className="block text-xs text-paper/70 mb-1">
                        What these agents do
                      </label>
                      <textarea
                        id="purposeSummary"
                        value={purposeSummary}
                        onChange={(e) => setPurposeSummary(e.target.value)}
                        rows={2}
                        placeholder="Inbound support calls for Acme's retail customers."
                        className="w-full bg-ink border border-line rounded-lg px-3 py-2 text-sm text-paper placeholder:text-muted/50 focus:outline-none focus:border-mint/50 transition"
                      />
                    </div>

                    <label className="flex gap-2 items-start text-xs text-paper/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={disclosesToUser}
                        onChange={(e) => setDisclosesToUser(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        These agents tell the person they are speaking with that they are an AI.
                        <span className="block text-muted">Leave unchecked if they do not, or if you are unsure.</span>
                      </span>
                    </label>

                    <label className="flex gap-2 items-start text-xs text-paper/70 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={humanEscalation}
                        onChange={(e) => setHumanEscalation(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        A person can reach a human from these agents.
                        <span className="block text-muted">Leave unchecked if they cannot, or if you are unsure.</span>
                      </span>
                    </label>
                  </div>

                  <div className="p-3 rounded-lg border border-line bg-ink text-xs text-muted space-y-1">
                    <div className="text-paper/80 font-medium">What happens next:</div>
                    <div>1. An Ed25519 keypair is generated <strong className="text-paper">in your browser</strong></div>
                    <div>2. Each agent manifest is signed locally with your private key</div>
                    <div>3. Only <strong className="text-paper">public material</strong> (manifests, proofs, public key) is sent to the server</div>
                    <div>4. The server validates the signatures and registers the agents</div>
                  </div>

                  <button
                    onClick={handleBind}
                    disabled={loading || !attestationsComplete}
                    className="btn btn-primary w-full"
                  >
                    {loading ? (
                      <><Spinner /> Signing locally &amp; registering...</>
                    ) : (
                      "Generate Keys & Sign Locally"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* What this flow sends, and what it does not */}
        <div className="card p-4 text-xs text-muted space-y-1">
          <div className="font-semibold text-paper/90">Key custody and what gets sent</div>
          <div>
            Your Ed25519 keypair is generated in this browser tab using{" "}
            <span className="font-mono">@noble/curves</span> and the private key is never transmitted. The only
            things sent to AgenID are the signed manifests, their proofs, and your public key — plus your Retell
            API key, used for one read-only call to list your agents and not stored. This flow never reads your
            system prompts, model configuration, or Retell billing data, because it never asks Retell for them.
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-xs text-muted/50 border-t border-line pt-6">
        &copy; 2026 AI Venture Holdings LLC. All rights reserved.
      </footer>
    </div>
  );
}
