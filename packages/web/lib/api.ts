/** Server-side helpers for talking to the Registry API. Never imported by client components. */
export const API_URL = (process.env.AGENID_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://agenid.com").replace(/\/$/, "");

export const AGENT_ID_RE = /^agenid:[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export type Envelope = {
  agenid_envelope_version: "1.0";
  agent_id: string;
  status: string;
  registered_at: string;
  manifest: {
    manifest_version: string;
    agent_id: string;
    identity: { name: string; description?: string };
    ownership: { operator: string; operator_domain: string; contact?: string };
    purpose: { summary: string; channels: string[] };
    disclosure: { is_ai: boolean; discloses_to_user: boolean; human_escalation: boolean };
  };
  manifest_digest: { alg: string; value: string };
  proof: { key_id: string; created_at: string; expires_at: string; signature: string; [k: string]: unknown };
  proof_check: { ok: boolean; code?: string };
  operator_key: { key_id: string; document: unknown; discovery: { registry_path: string; well_known_url: string } };
  verification: { level: string; valid_assertions: number; total_assertions: number };
  assertions: { assertion: { assertion_id: string; level: string; claim: Record<string, unknown>; authority: string; verified_at: string; expires_at: string; scope: string }; check: { ok: boolean; code?: string } }[];
  verify_instructions: string;
};

export async function fetchEnvelope(agentId: string): Promise<{ status: number; envelope: Envelope | null; error?: string }> {
  if (!AGENT_ID_RE.test(agentId)) return { status: 400, envelope: null, error: "invalid_agent_id" };
  const r = await fetch(`${API_URL}/v1/agents/${agentId}`, { cache: "no-store", headers: { accept: "application/json" } });
  if (!r.ok) {
    let error = "registry_error";
    try { error = (await r.json()).error ?? error; } catch { /* ignore */ }
    return { status: r.status, envelope: null, error };
  }
  return { status: 200, envelope: (await r.json()) as Envelope };
}
