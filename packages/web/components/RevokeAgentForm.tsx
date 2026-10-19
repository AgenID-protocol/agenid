"use client";

import { useState } from "react";
import Link from "next/link";
import { parseKeyFile, type KeyFile } from "@/components/DirectoryConsent";
import {
  keyPairFromPrivateHex,
  signAgentRevocation,
  REVOCATION_REASONS,
  type ClientKeyPair,
  type ClientRevocationReason,
} from "@/lib/client-crypto";

/**
 * Permanent agent revocation, signed in the browser.
 *
 * The key file is read in this tab; the private key signs a Revocation and is never
 * uploaded. Only the signed object is sent. Nothing is pre-selected and nothing acts on
 * its own: the operator chooses a reason, types the identifier, and confirms that the
 * action is permanent before the button enables. A revocation cannot be undone, so the
 * form asks for each of those as a separate, deliberate act.
 */

const REASON_LABEL: Record<ClientRevocationReason, string> = {
  key_compromise: "The operator key may be compromised",
  agent_retired: "The agent has been retired",
  superseded: "Replaced by a new identity",
  no_longer_authorized: "The operator no longer runs this agent",
  operator_request: "Operator request (no further reason)",
  issued_in_error: "Registered in error",
  unspecified: "Prefer not to say",
};

type State =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "done"; agentId: string; revocationId: string }
  | { kind: "error"; message: string };

async function submit(keyPair: ClientKeyPair, file: KeyFile, reason: ClientRevocationReason): Promise<State> {
  const revocation = signAgentRevocation(keyPair, file.agent_id, file.key_id, reason);
  try {
    const res = await fetch(`/api/v1/agents/${encodeURIComponent(file.agent_id)}/revocation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(revocation),
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string; revocation_id?: string };
    if (!res.ok) return { kind: "error", message: body.message ?? body.error ?? `request failed (${res.status})` };
    return { kind: "done", agentId: file.agent_id, revocationId: body.revocation_id ?? revocation.revocation_id };
  } catch {
    return { kind: "error", message: "The registry could not be reached. Nothing was changed." };
  }
}

export function RevokeAgentForm() {
  const [file, setFile] = useState<KeyFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reason, setReason] = useState<ClientRevocationReason | "">("");
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  const ready = file !== null && reason !== "" && typed.trim() === file.agent_id && understood && state.kind !== "busy";

  if (state.kind === "done") {
    return (
      <div className="card p-6" role="status">
        <h2 className="text-xl font-semibold tracking-tight">Revoked</h2>
        <p className="mt-2 text-sm text-muted">
          The identity is permanently revoked. Its card and badges now read REVOKED, and the signed revocation is part of
          its public record so anyone can check that you, not the registry, made this change.
        </p>
        <p className="mt-3 break-all font-mono text-xs text-paper-dim">{state.revocationId}</p>
        <p className="mt-4 text-sm">
          <Link href={`/a/${state.agentId}`} className="text-paper underline hover:no-underline">
            Open the Verification Card
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      className="card p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return; // `ready` narrows file and reason (aliased condition)
        setState({ kind: "busy" });
        let keyPair: ClientKeyPair;
        try {
          keyPair = keyPairFromPrivateHex(file.private_key_hex);
        } catch {
          setState({ kind: "error", message: "The key in that file could not be read." });
          return;
        }
        setState(await submit(keyPair, file, reason));
      }}
    >
      <label className="block text-xs font-medium uppercase tracking-[0.08em] text-muted" htmlFor="revoke-key-file">
        1. Key file
      </label>
      <input
        id="revoke-key-file"
        type="file"
        accept="application/json,.json"
        className="field mt-2 w-full"
        onChange={async (e) => {
          setState({ kind: "idle" });
          setTyped("");
          const f = e.target.files?.[0];
          if (!f) return setFile(null);
          const parsed = parseKeyFile(await f.text());
          if (typeof parsed === "string") {
            setFile(null);
            setFileError(parsed);
          } else {
            setFile(parsed);
            setFileError(null);
          }
        }}
      />
      {fileError && (
        <p className="mt-2 text-sm text-muted" role="alert">
          {fileError}
        </p>
      )}
      {file && <p className="mt-2 break-all font-mono text-xs text-paper-dim">{file.agent_id}</p>}

      <label className="mt-6 block text-xs font-medium uppercase tracking-[0.08em] text-muted" htmlFor="revoke-reason">
        2. Reason
      </label>
      <select
        id="revoke-reason"
        className="field mt-2 w-full"
        value={reason}
        onChange={(e) => setReason(e.target.value as ClientRevocationReason | "")}
        required
      >
        <option value="">Choose a reason</option>
        {REVOCATION_REASONS.map((r) => (
          <option key={r} value={r}>
            {REASON_LABEL[r]}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-muted">The reason is signed and public. It is your statement; the registry does not check it.</p>

      <label className="mt-6 block text-xs font-medium uppercase tracking-[0.08em] text-muted" htmlFor="revoke-confirm-id">
        3. Type the identifier to confirm
      </label>
      <input
        id="revoke-confirm-id"
        className="field mt-2 w-full font-mono text-sm"
        autoComplete="off"
        spellCheck={false}
        placeholder={file ? file.agent_id : "agenid:…"}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        disabled={!file}
      />

      <label className="mt-6 flex items-start gap-3 text-sm text-paper-dim">
        <input type="checkbox" className="mt-1" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
        <span>I understand revocation is permanent. This identifier can never be reactivated or reissued.</span>
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-ghost" disabled={!ready}>
          {state.kind === "busy" ? "Signing…" : "Revoke this agent permanently"}
        </button>
        {state.kind === "error" && (
          <span className="text-sm text-muted" role="alert">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
