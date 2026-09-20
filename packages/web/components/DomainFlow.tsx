"use client";

/**
 * The domain-control flow: add a domain, authorize the record at your own DNS provider
 * in one click, watch it go live.
 *
 * TRUST-STATE DISCIPLINE (this is the part that is easy to get wrong in a status UI):
 * every state this component renders comes from the server response. It maps a status
 * string to a colour; it never decides what the status is. And there is no red in here
 * anywhere. A record that has not propagated yet is amber "Pending", not a failure —
 * the same rule the badges follow, for the same reason: absence of verification is not
 * a negative finding, and a status screen that flashes red while DNS propagates teaches
 * operators that AgenID's colours mean "impatient" rather than "unverified".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { verificationRecord } from "@/lib/domain-connect";

// ---------------------------------------------------------------------------
// Response shape (mirrors app/api/domain/status/route.ts)
// ---------------------------------------------------------------------------

type RecordStatus = "pending" | "verified";

interface DomainStatus {
  ok: true;
  domain: string;
  checked_at: string;
  provider: {
    name: string | null;
    nameservers: string[];
    domain_connect: boolean;
    domain_connect_host: string | null;
    provider_name: string | null;
    apply_url: string | null;
    reason: "no_domain_connect" | "no_sync_ux" | "template_unregistered" | null;
  };
  records: {
    type: "TXT";
    name: string;
    value: string;
    ttl: number;
    status: RecordStatus;
    observed_count: number;
    other_records_present: boolean;
  }[];
  key_discovery: { url: string; status: RecordStatus; http_status: number | null; note: string };
  domain_control: boolean;
  disclosures: string[];
}

// ---------------------------------------------------------------------------
// Small primitives
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: RecordStatus }) {
  return status === "verified" ? (
    <span className="pill pill-ok">Verified</span>
  ) : (
    <span className="pill pill-warn">Pending</span>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          // Clipboard blocked (insecure context, or permission denied). The value is
          // fully visible and selectable in the table either way, so this is a silent
          // no-op rather than an error state.
        }
      }}
      className="shrink-0 rounded border border-line px-2 py-1 font-mono text-[11px] text-muted transition hover:border-muted hover:text-paper"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Event timeline — the three-node strip
// ---------------------------------------------------------------------------

type NodeState = "done" | "active" | "waiting";

function TimelineNode({ state, label, sub }: { state: NodeState; label: string; sub?: string }) {
  const ring =
    state === "done"
      ? "border-mint/50 bg-mint-deep text-mint"
      : state === "active"
        ? "border-amber/50 bg-amber/10 text-amber"
        : "border-line bg-ink-3 text-muted/50";

  return (
    <div className="relative z-10 flex flex-col items-center gap-2.5">
      <div className={`relative grid h-11 w-11 place-items-center rounded-xl border ${ring}`}>
        {state === "active" && (
          <span className="motion-safe:animate-ping absolute inset-0 rounded-xl border border-amber/40" aria-hidden="true" />
        )}
        {state === "done" ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : state === "active" ? (
          <Spinner className="h-5 w-5" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          </svg>
        )}
      </div>
      <div className="text-center">
        <div
          className={`rounded-md px-2 py-1 font-mono text-[11px] ${
            state === "done"
              ? "bg-mint-deep/60 text-mint"
              : state === "active"
                ? "bg-amber/10 text-amber"
                : "text-muted/60"
          }`}
        >
          {label}
        </div>
        {sub && <div className="mt-1 font-mono text-[10px] text-muted/70">{sub}</div>}
      </div>
    </div>
  );
}

function Timeline({ status, addedAt }: { status: DomainStatus | null; addedAt: string }) {
  const verified = status?.domain_control ?? false;
  const states: NodeState[] = verified ? ["done", "done", "done"] : ["done", "active", "waiting"];

  return (
    <div className="relative mt-5 overflow-hidden rounded-xl border border-line bg-ink-3/40 px-6 py-7">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-lg items-start justify-between">
        {/* Connector sits behind the nodes and fills as the flow completes. */}
        <div className="absolute left-[11%] right-[11%] top-[22px] h-px" aria-hidden="true">
          <div className="h-px w-full border-t border-dashed border-line" />
          <div
            className="absolute inset-y-0 left-0 border-t border-mint/50 transition-[width] duration-700 ease-out"
            style={{ width: verified ? "100%" : "50%" }}
          />
        </div>
        <TimelineNode state={states[0]} label="Domain added" sub={addedAt} />
        <TimelineNode state={states[1]} label={verified ? "DNS found" : "Checking DNS"} />
        <TimelineNode state={states[2]} label={verified ? "Domain verified" : "Verifying domain"} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 1 — add a domain
// ---------------------------------------------------------------------------

function AddDomain({ onSubmit }: { onSubmit: (domain: string) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalize = (raw: string) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const domain = normalize(value);
        // Mirrors isValidHostname on the server; the server check is the real one.
        if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
          setError("Enter a domain you own, like acme.com");
          return;
        }
        setError(null);
        onSubmit(domain);
      }}
      className="card p-6 sm:p-8"
    >
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-line bg-ink-3">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-muted" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add a domain</h1>
          <p className="mt-1 text-sm text-muted">
            Prove you control a domain, so agents registered under it can be attributed to you.
          </p>
        </div>
      </div>

      <label htmlFor="domain" className="mt-8 block font-mono text-[11px] uppercase tracking-wider text-muted">
        Domain
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id="domain"
          name="domain"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="acme.com"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="w-full rounded-lg border border-line bg-ink-3 px-3.5 py-2.5 font-mono text-sm text-paper outline-none placeholder:text-muted/50 focus:border-muted"
        />
        <button type="submit" className="btn btn-primary shrink-0">
          Continue
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-amber">{error}</p>}

      <p className="mt-6 border-t border-line pt-5 text-xs leading-5 text-muted">
        Domain control is <span className="text-paper">evidence</span>, not a verification level. It is what an
        authority would weigh when issuing <span className="font-mono">L2_DOMAIN_VERIFIED</span> — a level nothing in
        this system can issue yet, because the root authority key does not exist.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — live status
// ---------------------------------------------------------------------------

const POLL_MS = 6000;

function DomainDetail({ domain, token, onReset }: { domain: string; token: string; onReset: () => void }) {
  const [status, setStatus] = useState<DomainStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const addedAt = useMemo(
    () => new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
    [],
  );
  const stop = useRef(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/domain/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain, token }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.message ?? "Could not check this domain right now.");
      } else {
        setError(null);
        setStatus(body as DomainStatus);
        if ((body as DomainStatus).domain_control) stop.current = true;
      }
    } catch {
      setError("Could not reach the status endpoint. Retrying.");
    } finally {
      setChecking(false);
    }
  }, [domain, token]);

  useEffect(() => {
    stop.current = false;
    void check();
    const id = setInterval(() => {
      // Stop polling once control is proven — a satisfied check does not need re-asking,
      // and an endless poll against someone's DNS is rude.
      if (stop.current) return;
      void check();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  const verified = status?.domain_control ?? false;
  const record = status?.records[0];
  /**
   * What the records table displays. Prefer the server's copy; before the first
   * response lands, fall back to the one authoritative builder rather than to
   * hand-written literals. See the table below for why that distinction matters.
   */
  const shownRecord = record ?? verificationRecord(domain, token);
  const applyUrl = status?.provider.apply_url ?? null;
  const reason = status?.provider.reason ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`grid h-14 w-14 place-items-center rounded-2xl border ${
                verified ? "border-mint/40 bg-mint-deep" : "border-line bg-ink-3"
              }`}
            >
              <svg viewBox="0 0 24 24" className={`h-7 w-7 ${verified ? "text-mint" : "text-muted"}`} fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Domain</div>
              <h1 className="text-2xl font-bold tracking-tight">{domain}</h1>
            </div>
          </div>
          <button type="button" onClick={onReset} className="btn btn-ghost text-xs">
            Use a different domain
          </button>
        </div>

        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">Status</dt>
            <dd className="mt-2">
              {verified ? <span className="pill pill-ok">Control confirmed</span> : <span className="pill pill-warn">Pending</span>}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">DNS provider</dt>
            <dd className="mt-2 text-sm">
              {status?.provider.provider_name ?? (status ? "Not detected" : "Detecting…")}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">Proves</dt>
            <dd className="mt-2 text-sm">{verified ? "Domain control" : "—"}</dd>
          </div>
        </dl>

        {/* Events */}
        <div className="mt-8">
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Domain events</div>
          <div
            className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
              verified ? "border-mint/40 bg-mint-deep/40 text-mint" : "border-amber/40 bg-amber/5 text-amber"
            }`}
            role="status"
            aria-live="polite"
          >
            {verified ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <Spinner className="h-4 w-4 shrink-0" />
            )}
            <span>
              {verified ? (
                <>
                  <span className="font-semibold">Domain control confirmed.</span>{" "}
                  <span className="text-mint/80">The TXT record resolves and matches your token.</span>
                </>
              ) : (
                <>
                  <span className="font-semibold">Looking for DNS records:</span>{" "}
                  <span className="text-amber/80">
                    this can take a few minutes depending on your provider&apos;s propagation time.
                  </span>
                </>
              )}
            </span>
          </div>
          <Timeline status={status} addedAt={addedAt} />
        </div>
      </div>

      {/* Records */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">DNS records</h2>
          <div className="flex items-center gap-2">
            {applyUrl ? (
              <a href={applyUrl} className="btn btn-primary text-xs">
                Auto configure
              </a>
            ) : null}
            <button type="button" onClick={() => void check()} disabled={checking} className="btn btn-ghost text-xs">
              {checking ? "Checking…" : "Check now"}
            </button>
          </div>
        </div>

        {/* One-click availability — stated plainly either way. */}
        {reason && (
          <p className="mt-3 rounded-lg border border-line bg-ink-3/60 px-4 py-3 text-xs leading-5 text-muted">
            {reason === "template_unregistered" ? (
              <>
                <span className="text-paper">One-click setup is not live yet.</span> Your provider supports Domain
                Connect, but AgenID&apos;s service template is still going through provider registration. Until it is
                accepted, add the record below by hand — it is one record.
              </>
            ) : reason === "no_domain_connect" ? (
              <>
                <span className="text-paper">This provider does not support Domain Connect</span>, so there is no
                one-click path for it. Add the record below by hand.
              </>
            ) : (
              <>
                <span className="text-paper">This provider supports Domain Connect</span> but publishes no browser
                redirect endpoint, so the record has to be added by hand.
              </>
            )}
          </p>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted">
                <th className="py-2 pr-4 font-normal">Type</th>
                <th className="py-2 pr-4 font-normal">Name</th>
                <th className="py-2 pr-4 font-normal">Value</th>
                <th className="py-2 pr-4 font-normal">TTL</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {/*
                Before the first response lands, every cell falls back to the SAME
                builder the server uses — never to a hand-written copy of the record.
                Each field here used to be its own literal ("TXT", `_agenid.${domain}`,
                the verification string, 300). A fallback that quietly disagrees with
                the source of truth is worse than no fallback: the operator copies a
                record AgenID no longer asks for, publishes it, and the flow waits
                forever for something it told them to create.
              */}
              <tr className="border-b border-line/60 align-top">
                <td className="py-3.5 pr-4 font-mono text-xs">{shownRecord.type}</td>
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs break-all">{shownRecord.name}</span>
                    <CopyButton value={shownRecord.name} label="record name" />
                  </div>
                </td>
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs break-all">{shownRecord.value}</span>
                    <CopyButton value={shownRecord.value} label="record value" />
                  </div>
                </td>
                <td className="py-3.5 pr-4 font-mono text-xs text-muted">{shownRecord.ttl}</td>
                <td className="py-3.5">
                  <StatusPill status={record?.status ?? "pending"} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {record?.other_records_present && (
          <p className="mt-4 text-xs leading-5 text-muted">
            A TXT record already exists at <span className="font-mono">{record.name}</span> but carries a different
            value. Add this one alongside it — multiple TXT records at one host are fine.
          </p>
        )}

        {error && <p className="mt-4 text-xs text-amber">{error}</p>}
      </div>

      {/* Optional second path */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Key document (optional)</h2>
          <StatusPill status={status?.key_discovery.status ?? "pending"} />
        </div>
        <p className="mt-2 text-sm text-muted">
          Publish your operator key document at{" "}
          <span className="font-mono text-xs break-all text-paper">
            {status?.key_discovery.url ?? `https://${domain}/.well-known/agenid/keys.json`}
          </span>
          . A verifier can then compare the registry&apos;s copy of your key against your own — which is what makes the
          registry non-authoritative rather than something you have to trust.
        </p>
      </div>

      {/* The ceiling, stated. */}
      <div className="rounded-lg border border-line bg-ink-2 p-5 text-xs leading-5 text-muted">
        <span className="font-semibold text-paper">What this does and does not get you.</span> Confirming control
        records evidence about this domain. It does not raise any agent above{" "}
        <span className="font-mono">L1_REGISTERED</span>: <span className="font-mono">L2_DOMAIN_VERIFIED</span> is an
        assertion signed by the root authority key, and that key has not been created. L1 is the ceiling on this
        deployment today, and every surface here says so.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

/** 32 hex chars. Public by design — this value is published in DNS. */
function newToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function DomainFlow({ initialDomain }: { initialDomain?: string }) {
  const [domain, setDomain] = useState<string | null>(initialDomain ?? null);
  const [token, setToken] = useState<string | null>(null);

  // Token is minted in the browser on first need. It is not persisted anywhere: it is
  // carried in the URL so the page is resumable and shareable, and it is public anyway.
  useEffect(() => {
    if (domain && !token) setToken(newToken());
  }, [domain, token]);

  useEffect(() => {
    if (!domain || !token) return;
    const url = new URL(window.location.href);
    url.searchParams.set("domain", domain);
    url.searchParams.set("token", token);
    window.history.replaceState(null, "", url.toString());
  }, [domain, token]);

  // Resume from the URL when the provider redirects back.
  useEffect(() => {
    if (domain) return;
    const params = new URLSearchParams(window.location.search);
    const d = params.get("domain");
    const t = params.get("token");
    if (d) {
      setDomain(d);
      if (t && t.length >= 16) setToken(t);
    }
  }, [domain]);

  if (!domain || !token) return <AddDomain onSubmit={setDomain} />;

  return (
    <DomainDetail
      domain={domain}
      token={token}
      onReset={() => {
        setDomain(null);
        setToken(null);
        window.history.replaceState(null, "", window.location.pathname);
      }}
    />
  );
}
