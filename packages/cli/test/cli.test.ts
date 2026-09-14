/**
 * Integration tests: run the built CLI as a subprocess and verify its artifacts
 * with @agenid/core independently. These exist because the CLI this replaced
 * printed "Keypair generated" and "ORGANIZATION_VERIFIED" while doing neither.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyManifestProof } from "@agenid/core";

const BIN = join(fileURLToPath(new URL("../", import.meta.url)), "dist/index.js");
let dir: string;
let stdout: string;

const ARGS = [
  "init",
  "--domain", "aiventureholdings.com",
  "--operator", "AI Venture Holdings LLC",
  "--name", "Sunny",
  "--purpose", "Drive-through order taking.",
];

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "agenid-cli-"));
  stdout = execFileSync("node", [BIN, ...ARGS], { cwd: dir, encoding: "utf8" });
});

const read = (f: string) => JSON.parse(readFileSync(join(dir, ".agenid", f), "utf8"));

describe("agenid init", () => {
  it("writes all four artifacts", () => {
    for (const f of ["manifest.json", "manifest-proof.json", "key-document.json", "operator-private-key.b64u"]) {
      expect(existsSync(join(dir, ".agenid", f)), f).toBe(true);
    }
  });

  it("writes the private key with owner-only permissions", () => {
    const mode = statSync(join(dir, ".agenid", "operator-private-key.b64u")).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("produces a proof that verifies independently", () => {
    const r = verifyManifestProof(read("manifest-proof.json"), read("manifest.json"), read("key-document.json"), {
      now: new Date().toISOString(),
    });
    expect(r.ok).toBe(true);
    expect(r.claimState).toBe("DECLARED");
  });

  it("produces a proof that fails when the manifest is altered", () => {
    const m = read("manifest.json");
    m.identity.name = "Not Sunny";
    const r = verifyManifestProof(read("manifest-proof.json"), m, read("key-document.json"), {
      now: new Date().toISOString(),
    });
    expect(r.ok).toBe(false);
  });

  it("does not default an unstated disclosure attestation to true", () => {
    // --discloses / --escalates were NOT passed above.
    const m = read("manifest.json");
    expect(m.disclosure.discloses_to_user).toBe(false);
    expect(m.disclosure.human_escalation).toBe(false);
  });

  it("never prints a verification level above DECLARED", () => {
    expect(stdout).toContain("DECLARED");
    for (const banned of ["ORGANIZATION_VERIFIED", "Emerald Badge", "Authenticated with Retell"]) {
      expect(stdout).not.toContain(banned);
    }
  });

  it("does not print the private key to stdout", () => {
    const priv = readFileSync(join(dir, ".agenid", "operator-private-key.b64u"), "utf8").trim();
    expect(stdout).not.toContain(priv);
  });
});

describe("agenid dns-token", () => {
  it("emits a random token, not a constant", () => {
    const a = execFileSync("node", [BIN, "dns-token", "--domain", "example.com"], { encoding: "utf8" });
    const b = execFileSync("node", [BIN, "dns-token", "--domain", "example.com"], { encoding: "utf8" });
    const grab = (s: string) => s.match(/agenid-site-verification=(\S+)/)?.[1];
    expect(grab(a)).toBeTruthy();
    expect(grab(a)).not.toBe(grab(b));
    expect(a).not.toContain("aivh_7f9b8c2d1e9a3b5c7d8e");
  });
});
