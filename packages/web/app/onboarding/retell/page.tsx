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
  const [showConfetti, setShowConfetti] = useState(false);

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
          operator: "AI Venture Holdings LLC",
          operatorDomain: domain,
          disclosesToUser: true,
          humanEscalation: true,
          purposeSummary: "AI-powered voice agents for customer engagement",
          contact: "ops@aiventureholdings.com",
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
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [domain, agents]);

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
            <span className="pill">app.agenid.ai</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-paper">Retell AI Identity Verification</h1>
          <p className="text-muted text-sm">
            Bind your Retell voice fleet to cryptographic domain signatures using Ed25519.
            Private keys are generated in your browser and never leave your device.
          </p>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}

        {/* Wizard Card */}
        <div className="card p-6 space-y-6">
          <div className="grid grid-cols-3 gap-2 border-b border-line pb-4">
            <StepIndicator current={step} stepNum={1} label="Retell Auth" />
            <StepIndicator current={step} stepNum={2} label="DNS Verification" />
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
                      {capabilities.domain_connect && <span className="pill pill-ok">Domain Connect</span>}
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
                  {/* Status badge — protocol-honest DECLARED */}
                  <div className="relative bg-mint-deep/40 border border-mint/40 p-6 rounded-xl text-center space-y-3 overflow-hidden">
                    {showConfetti && (
                      <div className="absolute inset-0 pointer-events-none" aria-hidden>
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div
                            key={i}
                            className="absolute w-1.5 h-1.5 rounded-full animate-bounce"
                            style={{
                              left: `${10 + Math.random() * 80}%`,
                              top: `${Math.random() * 100}%`,
                              backgroundColor: ["#10b981", "#34d399", "#6ee7b7", "#f59e0b", "#fbbf24"][i % 5],
                              animationDelay: `${Math.random() * 0.5}s`,
                              animationDuration: `${0.5 + Math.random() * 1}s`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <div className="text-mint text-2xl font-bold tracking-tight">DECLARED</div>
                    <div className="font-mono text-xs text-mint/70">{bindResult.domain}</div>
                    <div className="text-xs text-paper/60">
                      {bindResult.agents.length} agent{bindResult.agents.length !== 1 ? "s" : ""} signed with Ed25519
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
                      <span className="text-mint">{bindResult.level}</span>
                    </div>
                    <div className="flex justify-between text-muted">
                      <span>Persisted to Registry</span>
                      <span className={bindResult.persisted ? "text-mint" : "text-amber"}>
                        {bindResult.persisted ? "Yes" : "No (registry not configured)"}
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
                    <span className="pill pill-ok">DNS Verified</span>
                    <span className="text-muted font-mono text-xs">{domain}</span>
                  </div>

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

                  <div className="p-3 rounded-lg border border-line bg-ink text-xs text-muted space-y-1">
                    <div className="text-paper/80 font-medium">What happens next:</div>
                    <div>1. An Ed25519 keypair is generated <strong className="text-paper">in your browser</strong></div>
                    <div>2. Each agent manifest is signed locally with your private key</div>
                    <div>3. Only <strong className="text-paper">public material</strong> (manifests, proofs, public key) is sent to the server</div>
                    <div>4. The server validates the signatures and registers the agents</div>
                  </div>

                  <button onClick={handleBind} disabled={loading} className="btn btn-primary w-full">
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

        {/* Privacy Escrow Guarantee */}
        <div className="card p-4 text-xs text-muted space-y-1">
          <div className="font-semibold text-paper/90">Privacy &amp; Key Custody</div>
          <div>
            Private keys are generated in your browser using Ed25519 (@noble/curves) and never leave your device.
            System prompts, LLM model choices, and Retell COGS unit costs remain 100% private.
            Only cryptographic identity assertions and public keys are published.
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-xs text-muted/50 border-t border-line pt-6">
        &copy; 2026 AI Venture Holdings LLC. All rights reserved.
      </footer>
    </div>
  );
}
