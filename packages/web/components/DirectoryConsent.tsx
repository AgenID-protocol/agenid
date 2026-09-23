"use client";

import { useState } from "react";
import Link from "next/link";
import { keyPairFromPrivateHex, signDirectoryConsent, type ClientKeyPair } from "@/lib/client-crypto";

/**
 * Directory consent, signed in the browser.
 *
 * Both controls below sign a small consent object with the agent's operator key and POST
 * only the signed object. The private key is used in this tab and never sent — the same
 * invariant /issue holds. Neither control ever acts on its own: listing happens only when
 * the operator presses the button, and nothing is pre-selected.
 */

type State = { kind: "idle" } | { kind: "busy" } | { kind: "done"; listed: boolean } | { kind: "error"; message: string };

async function submit(keyPair: ClientKeyPair, agentId: string, keyId: string, listed: boolean): Promise<State> {
  const consent = signDirectoryConsent(keyPair, agentId, keyId, listed);
  try {
    const res = await fetch("/api/v1/directory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(consent),
    });
    const body = (await res.json().catch(() => ({}))) as { listed?: boolean; message?: string; error?: string };
    if (!res.ok) return { kind: "error", message: body.message ?? body.error ?? `request failed (${res.status})` };
    return { kind: "done", listed: Boolean(body.listed) };
  } catch {
    return { kind: "error", message: "the registry could not be reached; nothing was changed" };
  }
}

/** On the /issue result, while the freshly generated key is still in this tab. */
export function ListInDirectory({ agentId, keyId, keyPair }: { agentId: string; keyId: string; keyPair: ClientKeyPair }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  return (
    <div>
      <h3 className="text-lg font-semibold">List it in the public directory (optional)</h3>
      <p className="mt-2 text-sm text-muted">
        Registration does not list your agent anywhere; it is found only by its identifier. If you want it browsable at{" "}
        <Link href="/agents" className="text-paper underline hover:no-underline">/agents</Link>, sign a listing consent
        with this agent&rsquo;s key. A listing is not an endorsement and changes no verification level. You can remove it
        later with the key file.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {state.kind === "done" ? (
          <span className="text-sm text-paper" role="status">
            {state.listed ? "Listed. " : "Not listed. "}
            <Link href="/agents" className="underline hover:no-underline">Open the directory</Link>
          </span>
        ) : (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={state.kind === "busy"}
            onClick={async () => {
              setState({ kind: "busy" });
              setState(await submit(keyPair, agentId, keyId, true));
            }}
          >
            {state.kind === "busy" ? "Signing…" : "List this agent"}
          </button>
        )}
        {state.kind === "error" && (
          <span className="text-sm text-muted" role="alert">
            {state.message}
          </span>
        )}
      </div>
    </div>
  );
}

type KeyFile = { agent_id: string; key_id: string; private_key_hex: string };

function parseKeyFile(text: string): KeyFile | string {
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    if (typeof o.agent_id !== "string" || typeof o.key_id !== "string" || typeof o.private_key_hex !== "string") {
      return "That file is not an AgenID key file (agent_id, key_id and private_key_hex are required).";
    }
    if (!/^[0-9a-f]{64}$/i.test(o.private_key_hex)) return "private_key_hex must be 64 hex characters.";
    return { agent_id: o.agent_id, key_id: o.key_id, private_key_hex: o.private_key_hex };
  } catch {
    return "That file is not valid JSON.";
  }
}

/** On /agents: list or delist an agent later, from the key file /issue offered for download. */
export function DirectoryKeyFileForm() {
  const [file, setFile] = useState<KeyFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function act(listed: boolean) {
    if (!file) return;
    setState({ kind: "busy" });
    let keyPair: ClientKeyPair;
    try {
      keyPair = keyPairFromPrivateHex(file.private_key_hex);
    } catch {
      setState({ kind: "error", message: "The key in that file could not be read." });
      return;
    }
    setState(await submit(keyPair, file.agent_id, file.key_id, listed));
  }

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold tracking-tight">List or remove your agent</h2>
      <p className="mt-2 text-sm text-muted">
        Choose the key file you downloaded when you registered. It is read in this tab and used to sign a consent; the
        private key is never uploaded. Only the signed consent is sent.
      </p>
      <label className="mt-4 block text-xs font-medium uppercase tracking-[0.08em] text-muted" htmlFor="agenid-key-file">
        Key file
      </label>
      <input
        id="agenid-key-file"
        type="file"
        accept="application/json,.json"
        className="field mt-2 w-full"
        onChange={async (e) => {
          setState({ kind: "idle" });
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
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" disabled={!file || state.kind === "busy"} onClick={() => act(true)}>
          List this agent
        </button>
        <button type="button" className="btn btn-ghost" disabled={!file || state.kind === "busy"} onClick={() => act(false)}>
          Remove the listing
        </button>
      </div>
      {state.kind === "done" && (
        <p className="mt-3 text-sm text-paper" role="status">
          {state.listed ? "Listed. It appears in the directory within a few minutes." : "Removed. It no longer appears in the directory."}
        </p>
      )}
      {state.kind === "error" && (
        <p className="mt-3 text-sm text-muted" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
