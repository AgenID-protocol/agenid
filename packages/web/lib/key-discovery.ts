/**
 * The operator half of two-path key discovery, probed honestly.
 *
 * A verifier fetches an agent's operator key from the registry (`/v1/keys/<ulid>`) AND
 * from the operator's own domain (`/.well-known/agenid/keys.json`) and requires they
 * agree. That second fetch is what makes the registry non-authoritative, so what we tell
 * an operator about it has to be true.
 *
 * WHY THIS MODULE EXISTS — the defect it replaces. `/api/domain/status` used to report
 * `key_discovery.status: "verified"` for ANY 2xx response. Most marketing sites are
 * single-page apps whose hosting answers every unknown path with `200 text/html` and the
 * homepage, so the endpoint told operators — AIVH itself included — that a key document
 * was published when the server had returned a web page. A trust surface asserting an
 * outcome it never computed is the worst defect class this project has; the Sept 20
 * launch-readiness pass found it live against aiventureholdings.com.
 *
 * WHAT "published" MEANS, and what it does not. It means: the operator's domain served
 * JSON that parses as a strict `KeysDocument` from `@agenid/core`, naming this domain as
 * its controller. It does NOT mean the document agrees with the registry — this probe
 * knows a domain, not an agent, and never compares keys. That comparison is the
 * verifier's job. The word "verified" is therefore deliberately not one of the states.
 */
import { KeysDocument } from "@agenid/core";
import { keyDocumentUrl } from "@/lib/domain-connect";

export { keyDocumentUrl };

export type KeyDiscoveryState = "absent" | "invalid" | "published" | "unreachable";

export type KeyDiscoveryReason =
  | "not_json"
  | "malformed_json"
  | "schema_invalid"
  | "controller_domain_mismatch"
  | "too_large"
  | `http_${number}`;

export interface KeyDiscoveryResult {
  state: KeyDiscoveryState;
  /** Why the state is not "published". Null when published or absent. */
  reason: KeyDiscoveryReason | null;
  url: string;
  http_status: number | null;
  /** Number of keys in a published document; null otherwise. */
  key_count: number | null;
}

/** A key document is a handful of public keys. Anything larger is not one. */
export const MAX_KEYS_DOCUMENT_BYTES = 64 * 1024;

/** `application/json` or any `+json` structured-syntax type; parameters ignored. */
export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const essence = value.split(";")[0]!.trim().toLowerCase();
  return essence === "application/json" || /^application\/[a-z0-9.+-]+\+json$/.test(essence);
}

/** Read at most `limit` bytes. Returns null if the body is larger — and stops reading. */
async function readBounded(res: Response, limit: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(buf);
}

export async function probeKeyDiscovery(
  domain: string,
  opts: { timeoutMs: number; fetchImpl?: typeof fetch },
): Promise<KeyDiscoveryResult> {
  const url = keyDocumentUrl(domain);
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  const result = (
    state: KeyDiscoveryState,
    reason: KeyDiscoveryReason | null,
    http_status: number | null,
    key_count: number | null = null,
  ): KeyDiscoveryResult => ({ state, reason, url, http_status, key_count });

  try {
    let res: Response;
    try {
      res = await doFetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    } catch {
      return result("unreachable", null, null);
    }
    const status = res.status;

    if (status === 404 || status === 410) return result("absent", null, status);
    if (status >= 500) return result("unreachable", `http_${status}`, status);
    if (status < 200 || status >= 300) return result("invalid", `http_${status}`, status);

    // The SPA catch-all: a 200 whose body is a web page. This is the check that was missing.
    if (!isJsonContentType(res.headers.get("content-type"))) {
      await res.body?.cancel().catch(() => {});
      return result("invalid", "not_json", status);
    }

    let text: string | null;
    try {
      text = await readBounded(res, MAX_KEYS_DOCUMENT_BYTES);
    } catch {
      return result("unreachable", null, status);
    }
    if (text === null) return result("invalid", "too_large", status);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return result("invalid", "malformed_json", status);
    }

    const doc = KeysDocument.safeParse(parsed);
    if (!doc.success) return result("invalid", "schema_invalid", status);

    // A document that names a different controller domain is not this domain's document.
    if (doc.data.controller_domain.toLowerCase() !== domain.toLowerCase()) {
      return result("invalid", "controller_domain_mismatch", status);
    }

    return result("published", null, status, doc.data.keys.length);
  } finally {
    clearTimeout(timer);
  }
}
