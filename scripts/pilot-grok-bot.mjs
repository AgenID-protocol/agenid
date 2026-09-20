/**
 * Mint, sign and register the AgenID pilot identity for the AIVH Grok Bot deployment.
 *
 * WHAT THIS DOES NOT DO: it does not assert a verification level, it does not write a
 * private key into the repository, and it does not invent a manifest field. Levels come
 * only from the registry's own response; private keys are written 0600 outside the repo;
 * the manifest is exactly the v1.1.1 shape and nothing more.
 *
 * Run:  node scripts/pilot-grok-bot.mjs --mint     (generate keys + sign, write public material)
 *       node scripts/pilot-grok-bot.mjs --register (POST the signed material to the registry)
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  generateAgentId,
  generateKeyId,
  generatePrincipalId,
  generateGrantId,
  generateKeyPair,
  makeKeyDocument,
  signManifestProof,
  verifyManifestProof,
  signAuthorizationGrant,
  evaluateAuthorization,
  manifestDigestHex,
  GRANT_SCHEMA_ID,
} from "../packages/core/dist/index.js";

const SECRETS = join(homedir(), ".aivh", "agenid-pilot");
const PUBLIC = join(process.cwd(), "packages", "web", "data", "pilot");
const REGISTRY = process.env.AGENID_REGISTRY ?? "https://www.agenid.com";

const iso = (d) => new Date(d).toISOString();

function mint() {
  mkdirSync(SECRETS, { recursive: true });
  mkdirSync(PUBLIC, { recursive: true });

  const now = Date.now();
  const createdAt = iso(now);
  const agentId = generateAgentId();
  const principalId = generatePrincipalId();

  const op = generateKeyPair();
  const operatorKey = {
    privateKey: op.privateKey,
    document: makeKeyDocument({
      keyId: generateKeyId(),
      publicKey: op.publicKey,
      role: "operator",
      controller: agentId,
      createdAt,
    }),
  };

  const pr = generateKeyPair();
  const principalKey = {
    privateKey: pr.privateKey,
    document: makeKeyDocument({
      keyId: generateKeyId(),
      publicKey: pr.publicKey,
      role: "principal",
      controller: principalId,
      createdAt,
    }),
  };

  /**
   * Every value here is a SELF-DECLARATION by the operator. No third party has checked
   * any of it, which is exactly what L1 means. The two disclosure booleans are supplied
   * explicitly from observed configuration — never defaulted (standing rule).
   *
   * `discloses_to_user`: false. The Grok Bot surface carries the vendor's own branding;
   * AIVH publishes no AgenID disclosure to an end user on that surface today.
   * `human_escalation`: true. `localToolPermission: "ask"` means every local tool call
   * stops for a human. That is an escalation path, observed in configuration.
   */
  const manifest = {
    manifest_version: "1.0",
    agent_id: agentId,
    identity: {
      name: "AIVH Grok Bot",
      description:
        "Persistent autonomous assistant deployed by AI Venture Holdings LLC on an operator-controlled macOS host, executing local commands through a vendor-brokered gateway.",
    },
    ownership: {
      operator: "AI Venture Holdings LLC",
      operator_domain: "aiventureholdings.com",
    },
    purpose: {
      summary:
        "Software engineering and operations assistance on operator-controlled infrastructure: repository inspection, local command execution and research, under per-action human confirmation.",
      channels: ["api"],
    },
    disclosure: { is_ai: true, discloses_to_user: false, human_escalation: true },
  };

  const proof = signManifestProof(manifest, operatorKey, {
    createdAt,
    expiresAt: iso(now + 365 * 24 * 3600 * 1000),
  });

  // Re-verify before reporting anything, the same way the CLI does.
  const check = verifyManifestProof(proof, manifest, operatorKey.document, { now: createdAt });
  if (!check.ok) throw new Error(`self-verification failed: ${check.code}`);

  /**
   * The v1.2-DRAFT authorization grant. NOT NORMATIVE, NOT ISSUABLE, and deliberately
   * narrower than what the agent can technically do — that gap is the point.
   */
  const grant = signAuthorizationGrant(
    {
      $schema: GRANT_SCHEMA_ID,
      grant_id: generateGrantId(),
      principal: principalId,
      subject: agentId,
      scopes: ["host:execute", "repo:read", "network:egress"],
      constraints: [{ type: "requires_human_confirmation" }],
      not_before: createdAt,
      expires_at: iso(now + 90 * 24 * 3600 * 1000),
      key_id: principalKey.document.key_id,
    },
    principalKey,
  );

  const decision = evaluateAuthorization({
    grant,
    principalKey: principalKey.document,
    manifest,
    operatorKey: operatorKey.document,
    scope: "host:execute",
    revocations: [],
    now: createdAt,
  });
  if (decision.decision !== "PERMITTED") throw new Error(`grant self-check failed: ${decision.reasonCode}`);

  writeFileSync(join(SECRETS, "operator.key"), Buffer.from(operatorKey.privateKey).toString("base64"), { mode: 0o600 });
  writeFileSync(join(SECRETS, "principal.key"), Buffer.from(principalKey.privateKey).toString("base64"), { mode: 0o600 });
  chmodSync(join(SECRETS, "operator.key"), 0o600);
  chmodSync(join(SECRETS, "principal.key"), 0o600);

  const record = {
    manifest,
    proof,
    key_document: operatorKey.document,
    principal_key_document: principalKey.document,
    authorization_grant: grant,
    manifest_digest: manifestDigestHex(manifest),
  };
  writeFileSync(join(PUBLIC, "grok-bot.json"), JSON.stringify(record, null, 2) + "\n");

  console.log(`agent_id       ${agentId}`);
  console.log(`principal_id   ${principalId}`);
  console.log(`digest         ${record.manifest_digest}`);
  console.log(`proof          verified locally -> ${check.claimState}`);
  console.log(`grant          host:execute -> ${decision.decision} (obligations: ${decision.obligations.map((o) => o.type).join(", ")})`);
  console.log(`private keys   ${SECRETS} (0600, never committed)`);
}

async function register() {
  const p = join(PUBLIC, "grok-bot.json");
  if (!existsSync(p)) throw new Error("mint first");
  const r = JSON.parse(readFileSync(p, "utf8"));
  const res = await fetch(`${REGISTRY}/api/v1/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ manifest: r.manifest, proof: r.proof, key_document: r.key_document }),
  });
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}

const mode = process.argv[2];
if (mode === "--mint") mint();
else if (mode === "--register") await register();
else console.error("usage: --mint | --register");
