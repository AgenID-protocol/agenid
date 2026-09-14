#!/usr/bin/env node
/**
 * AgenID operator CLI.
 *
 * Every line of output below corresponds to work this program actually performed.
 * It does not print a status it did not compute. In particular it never prints
 * VERIFIED or ORGANIZATION_VERIFIED: under protocol v1.1.1 those require an
 * authority-signed VerificationAssertion, and AgenID's root authority key ceremony
 * has not been performed, so no such assertion can be issued by anyone today.
 */
import { parseArgs } from "node:util";
import { randomBytes } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import {
  generateKeyPair,
  generateAgentId,
  generateKeyId,
  makeKeyDocument,
  signManifestProof,
  verifyManifestProof,
  manifestDigestHex,
  b64uEncode,
  Manifest,
  isValidHostname,
} from "@agenid/core";

const PROOF_TTL_DAYS = 90;

function die(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

function usage(): never {
  process.stdout.write(
    [
      "",
      "AgenID operator CLI",
      "",
      "Usage:",
      "  agenid init --domain <hostname> --operator <name> --name <agent name> \\",
      "              --purpose <summary> [--discloses] [--escalates] [--out <dir>]",
      "",
      "  agenid dns-token                     Generate a per-domain DNS verification token",
      "",
      "Flags for init:",
      "  --discloses    Attest the agent tells users it is AI (EU AI Act Art. 50)",
      "  --escalates    Attest a user can reach a human from this agent",
      "",
      "Both are attestations about YOUR agent's real behavior. They are false unless you",
      "pass them, and they are signed — do not pass them unless they are true.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const { positionals, values } = parseArgs({
  options: {
    domain: { type: "string" },
    operator: { type: "string" },
    name: { type: "string" },
    purpose: { type: "string" },
    contact: { type: "string" },
    out: { type: "string" },
    discloses: { type: "boolean", default: false },
    escalates: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const command = positionals[0];

if (command === "dns-token") {
  const token = `aid_${b64uEncode(randomBytes(24))}`;
  process.stdout.write(
    [
      "",
      "Add this TXT record, then verify it with POST /api/verify-dns:",
      "",
      `  Host:  _agenid.${values.domain ?? "<your-domain>"}`,
      `  Value: agenid-site-verification=${token}`,
      "",
      "This token is random and unique to this invocation. Keep it — you must pass the",
      "same value to the verify endpoint. Domain control is evidence only; it does not",
      "by itself raise an agent above DECLARED.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

if (command !== "init") usage();

const domain = values.domain ?? die("--domain is required");
const operator = values.operator ?? die("--operator is required");
const agentName = values.name ?? die("--name is required");
const purpose = values.purpose ?? die("--purpose is required");
if (!isValidHostname(domain)) die(`--domain "${domain}" is not a valid hostname`);

const nowIso = new Date().toISOString();
const expiresIso = new Date(Date.now() + PROOF_TTL_DAYS * 86_400_000).toISOString();

// 1. Real Ed25519 keypair, generated here, on this machine.
const kp = generateKeyPair();
const agentId = generateAgentId();
const keyId = generateKeyId();
const keyDocument = makeKeyDocument({
  keyId,
  publicKey: kp.publicKey,
  role: "operator",
  controller: agentId,
  createdAt: nowIso,
});

// 2. Manifest built from explicit operator attestations — nothing inferred.
const manifest = Manifest.parse({
  manifest_version: "1.0",
  agent_id: agentId,
  identity: { name: agentName },
  ownership: {
    operator,
    operator_domain: domain,
    ...(values.contact ? { contact: values.contact } : {}),
  },
  purpose: { summary: purpose, channels: ["voice"] },
  disclosure: {
    is_ai: true,
    discloses_to_user: Boolean(values.discloses),
    human_escalation: Boolean(values.escalates),
  },
});

// 3. Real signature over RFC 8785 canonical bytes.
const proof = signManifestProof(manifest, { privateKey: kp.privateKey, document: keyDocument }, {
  createdAt: nowIso,
  expiresAt: expiresIso,
});

// 4. Re-verify locally before claiming anything. If this fails, we say so.
const check = verifyManifestProof(proof, manifest, keyDocument, { now: nowIso });
if (!check.ok) die(`self-verification failed (${check.code}): ${check.message ?? "unknown"}`);

const outDir = resolvePath(values.out ?? ".agenid");
mkdirSync(outDir, { recursive: true });
writeFileSync(resolvePath(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(resolvePath(outDir, "manifest-proof.json"), JSON.stringify(proof, null, 2) + "\n");
writeFileSync(resolvePath(outDir, "key-document.json"), JSON.stringify(keyDocument, null, 2) + "\n");
writeFileSync(resolvePath(outDir, "operator-private-key.b64u"), b64uEncode(kp.privateKey) + "\n", { mode: 0o600 });

process.stdout.write(
  [
    "",
    `Agent ID       ${agentId}`,
    `Key ID         ${keyId}`,
    `Manifest sha256 ${manifestDigestHex(manifest)}`,
    `Signature      verified locally (Ed25519 over RFC 8785 JCS)`,
    "",
    `Written to ${outDir}/`,
    "  manifest.json, manifest-proof.json, key-document.json",
    "  operator-private-key.b64u  (mode 0600 — never share or commit this)",
    "",
    "Level: DECLARED.",
    "  DECLARED means you signed a statement about your own agent. It attests who",
    "  signed, not that anyone checked you. Nothing above DECLARED can be issued",
    "  today: that requires an authority-signed VerificationAssertion, and AgenID's",
    "  root authority key ceremony has not been performed.",
    "",
  ].join("\n"),
);
