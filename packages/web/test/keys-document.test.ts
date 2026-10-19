/**
 * The keys.json /issue hands an operator must be exactly what the protocol and this
 * deployment's own probe accept — checked against @agenid/core's strict KeysDocument and
 * against probeKeyDiscovery, the function behind /api/domain/status and the Verification
 * Card. If either side changes shape, this fails before an operator publishes a file the
 * registry then reports as "invalid".
 */
import { describe, it, expect } from "vitest";
import { KeysDocument, KEYS_SCHEMA_ID } from "@agenid/core";
import { buildKeysDocument, keysDocumentUrl, KEYS_DOCUMENT_SCHEMA_ID } from "../lib/keys-document";
import { generateKeyPair, signAgent } from "../lib/client-crypto";
import { probeKeyDiscovery } from "../lib/key-discovery";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const INPUT = {
  operator: "Acme Health, Inc.",
  operatorDomain: "AcmeHealth.com",
  purposeSummary: "Books appointments.",
  contact: "ops@acmehealth.com",
  disclosesToUser: false,
  humanEscalation: false,
};

const serve = (body: string) => (async () =>
  new Response(body, { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

describe("buildKeysDocument", () => {
  it("is pinned to core's schema id", () => {
    expect(KEYS_DOCUMENT_SCHEMA_ID).toBe(KEYS_SCHEMA_ID);
  });

  it("produces a strict KeysDocument for the browser-generated key, lowercasing the domain", async () => {
    const s = await signAgent(generateKeyPair(), "Desk", INPUT);
    const json = buildKeysDocument(INPUT.operatorDomain, [s.keyDocument]);
    const parsed = KeysDocument.safeParse(JSON.parse(json));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.controller_domain).toBe("acmehealth.com");
      expect(parsed.data.keys[0]!.key_id).toBe(s.keyId);
    }
  });

  it("is reported 'published' by the same probe /api/domain/status uses", async () => {
    const s = await signAgent(generateKeyPair(), "Desk", INPUT);
    const json = buildKeysDocument("acmehealth.com", [s.keyDocument]);
    const r = await probeKeyDiscovery("acmehealth.com", { timeoutMs: 1000, fetchImpl: serve(json) });
    expect(r.state).toBe("published");
    expect(r.key_count).toBe(1);
  });

  it("holds several agents' keys for one domain", async () => {
    const a = await signAgent(generateKeyPair(), "A", INPUT);
    const b = await signAgent(generateKeyPair(), "B", INPUT);
    const json = buildKeysDocument("acmehealth.com", [a.keyDocument, b.keyDocument]);
    const r = await probeKeyDiscovery("acmehealth.com", { timeoutMs: 1000, fetchImpl: serve(json) });
    expect(r.state).toBe("published");
    expect(r.key_count).toBe(2);
  });

  it("never carries private material", async () => {
    const kp = generateKeyPair();
    const s = await signAgent(kp, "Desk", INPUT);
    const json = buildKeysDocument("acmehealth.com", [s.keyDocument]);
    const hexPriv = Array.from(kp.privateKey, (x) => x.toString(16).padStart(2, "0")).join("");
    expect(json).not.toContain(hexPriv);
    expect(json).not.toMatch(/private/i);
  });

  it("refuses an empty domain or an empty key list", () => {
    expect(() => buildKeysDocument(" ", [{}])).toThrow();
    expect(() => buildKeysDocument("acme.com", [])).toThrow();
  });

  it("points at the spec §9.3 location", () => {
    expect(keysDocumentUrl("Acme.com")).toBe("https://acme.com/.well-known/agenid/keys.json");
  });

  it("the /issue result offers it, built from the accepted key document only", () => {
    const src = readFileSync(join(__dirname, "..", "components", "IssueWizard.tsx"), "utf8");
    expect(src).toMatch(/buildKeysDocument\(operatorDomain, \[signed\.keyDocument\]\)/);
  });
});
