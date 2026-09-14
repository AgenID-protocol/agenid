import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  generateKeyPair, generateAgentId, generateKeyId, makeKeyDocument,
  signManifestProof, verifyManifestProof,
} from "@agenid/core";
import { buildRetellManifest, normalizeRetellList } from "../lib/retell-manifest";

const ATT = {
  operator: "AI Venture Holdings LLC",
  operatorDomain: "aiventureholdings.com",
  disclosesToUser: false,
  humanEscalation: false,
  purposeSummary: "Inbound scheduling for a dental practice.",
};

describe("normalizeRetellList", () => {
  it("accepts a bare array", () => {
    expect(normalizeRetellList([{ agent_id: "a" }])).toHaveLength(1);
  });
  it("accepts the object-wrapped shapes that broke the original stub", () => {
    expect(normalizeRetellList({ agents: [{ agent_id: "a" }] })).toHaveLength(1);
    expect(normalizeRetellList({ data: [{ agent_id: "a" }] })).toHaveLength(1);
  });
  it("returns [] rather than throwing on junk", () => {
    expect(normalizeRetellList(null)).toEqual([]);
    expect(normalizeRetellList("nope")).toEqual([]);
  });
});

describe("buildRetellManifest", () => {
  it("never infers a disclosure claim the operator did not make", () => {
    const { manifest } = buildRetellManifest({ agent_name: "Sunny" }, ATT);
    expect(manifest.disclosure.discloses_to_user).toBe(false);
    expect(manifest.disclosure.human_escalation).toBe(false);
    expect(manifest.disclosure.is_ai).toBe(true);
  });

  it("carries operator attestations through verbatim", () => {
    const { manifest } = buildRetellManifest(
      { agent_name: "Sunny" },
      { ...ATT, disclosesToUser: true, humanEscalation: true },
    );
    expect(manifest.disclosure.discloses_to_user).toBe(true);
    expect(manifest.ownership.operator_domain).toBe("aiventureholdings.com");
  });

  it("rejects an invalid operator domain instead of signing it", () => {
    expect(() => buildRetellManifest({ agent_name: "x" }, { ...ATT, operatorDomain: "not a host" })).toThrow();
  });

  it("produces a manifest that round-trips through real sign + verify", () => {
    const agentId = generateAgentId();
    const { manifest } = buildRetellManifest({ agent_name: "Sunny" }, ATT, agentId);
    const kp = generateKeyPair();
    const now = new Date().toISOString();
    const doc = makeKeyDocument({
      keyId: generateKeyId(), publicKey: kp.publicKey,
      role: "operator", controller: agentId, createdAt: now,
    });
    const proof = signManifestProof(manifest, { privateKey: kp.privateKey, document: doc }, {
      createdAt: now,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(verifyManifestProof(proof, manifest, doc, { now }).ok).toBe(true);
  });

  it("fails verification when the manifest is tampered after signing", () => {
    const agentId = generateAgentId();
    const { manifest } = buildRetellManifest({ agent_name: "Sunny" }, ATT, agentId);
    const kp = generateKeyPair();
    const now = new Date().toISOString();
    const doc = makeKeyDocument({
      keyId: generateKeyId(), publicKey: kp.publicKey,
      role: "operator", controller: agentId, createdAt: now,
    });
    const proof = signManifestProof(manifest, { privateKey: kp.privateKey, document: doc }, {
      createdAt: now,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const tampered = { ...manifest, disclosure: { ...manifest.disclosure, discloses_to_user: true } };
    expect(verifyManifestProof(proof, tampered, doc, { now }).ok).toBe(false);
  });
});

// --- Honesty contract -------------------------------------------------------
// A stub that returned `status: 'ORGANIZATION_VERIFIED'` with no signature check
// was shipped into this repo once. This makes that regression fail the build.

/** Strip comments so the contract is asserted against executable code, not prose.
 *  (The routes deliberately *describe* the removed fabrications in their docblocks.) */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") || p.endsWith(".tsx") ? [p] : [];
  });
}

describe("honesty contract", () => {
  const files = walk(join(__dirname, "..", "app"));

  it("no route asserts a level above DECLARED", () => {
    const offenders = files.filter((f) => {
      const src = code(f);
      // Allowed only in prose explaining why it is NOT issued.
      const asserts = /(level|status)\s*:\s*["'](ORGANIZATION_VERIFIED|VERIFIED|AUTHORIZED|L[2-5])["']/;
      return asserts.test(src);
    });
    expect(offenders).toEqual([]);
  });

  it("the declare route states DECLARED and discloses its limits", () => {
    const src = readFileSync(join(__dirname, "..", "app/api/retell/declare/route.ts"), "utf8");
    expect(src).toContain('level: "DECLARED"');
    expect(src).toContain("root authority key ceremony has not been performed");
    expect(src).toContain("persisted: false");
  });

  it("no hardcoded DNS verification token exists anywhere in the app", () => {
    const offenders = files.filter((f) => /agenid-site-verification=[A-Za-z0-9_-]{8,}/.test(code(f)));
    expect(offenders).toEqual([]);
  });
});
