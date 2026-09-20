/**
 * Attach the OBSERVED, non-protocol evidence to the pilot record.
 *
 * This block is deliberately separate from the signed objects. v1.1.1 has no manifest
 * field for a provider, a model, a deployment or a capability — `platform`,
 * `permissions` and `configuration_fingerprint` are RESERVED keys that `.strict()`
 * rejects — so none of this is signed, none of it is protocol, and it must never be
 * presented as verified state. It is recorded here so a reader can re-derive it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const p = join(process.cwd(), "packages", "web", "data", "pilot", "grok-bot.json");
const record = JSON.parse(readFileSync(p, "utf8"));

record.observed = {
  disclaimer:
    "Non-protocol evidence. v1.1.1 has no signed representation for provider, model, deployment or capability, so nothing in this block is signed, verified, or part of any AgenID object. It is recorded so a third party can re-derive it independently.",
  observed_at: "2026-09-20",
  host: { platform: "darwin", arch: "arm64", role: "operator-controlled workstation" },

  /**
   * THE FINDING. The product is branded "Grok Bot" and is described by xAI's docs as an
   * xAI product, but the binary running on this host is code-signed and notarized by
   * Anysphere Incorporated, and every signed executable inside the bundle carries the
   * same authority. Nothing on this machine cryptographically attests to xAI.
   *
   * Re-derive with:
   *   codesign -dv --verbose=2 "/Applications/Grok Bot.app"
   *   spctl -a -vvv -t execute "/Applications/Grok Bot.app"
   */
  vendor_of_running_binary: {
    claim: "Anysphere Incorporated",
    team_identifier: "DCNK4UB866",
    bundle_identifier: "com.anysphere.sand",
    bundle_version: "0.57.1",
    evidence: "Apple Developer ID code signature, valid on disk, satisfies its Designated Requirement, Gatekeeper source=Notarized Developer ID",
    independently_reverifiable: true,
  },
  brand_named_by_product: {
    claim: "xAI Grok",
    evidence: "product branding and vendor documentation only",
    independently_reverifiable: false,
    note: "AgenID asserts nothing about xAI. No xAI-signed component exists in the installed bundle.",
  },
  model_identifier: {
    claim: null,
    note: "Not determinable from local configuration. No model identifier is claimed, because none is known from the running bot.",
  },
  deployment: {
    mechanism: "sand-local-exec-daemon, serving local exec over the vendor gateway",
    note: "v1.1.1 has no deployment-binding object. The identity is NOT bound to this deployment by any cryptographic means.",
  },

  /**
   * CAPABILITY is what the agent can technically do. AUTHORIZATION is what it may do.
   * They are different columns on purpose, and the rows where they disagree are the
   * reason this pilot exists.
   */
  capabilities: [
    { capability: "host:execute", present: true, authorized: true, constraint: "requires_human_confirmation", evidence: "local-exec daemon serving local exec over the gateway; settings.localToolPermission=\"ask\"" },
    { capability: "repo:read", present: true, authorized: true, constraint: "requires_human_confirmation", evidence: "filesystem reach on an operator-controlled host, same daemon, same confirmation gate" },
    { capability: "network:egress", present: true, authorized: true, constraint: "requires_human_confirmation", evidence: "settings.localEgressAllowed=true" },
    { capability: "network:tunnel", present: true, authorized: false, constraint: null, evidence: "settings.egressTunnelEnabled=false — shipped by the vendor, disabled in this deployment" },
    { capability: "messages:send", present: true, authorized: false, constraint: null, evidence: "settings.messagesEnabled=false" },
    { capability: "mcp:invoke", present: true, authorized: false, constraint: null, evidence: "settings.mcpBoxServers=[] — no tool server configured" },
  ],
  authorization_source:
    "settings.json on the operator-controlled host: localToolPermission=\"ask\", autoReviewInstructions.isEnabled=true with two enumerated standing allowances and zero block rules.",
};

writeFileSync(p, JSON.stringify(record, null, 2) + "\n");
const present = record.observed.capabilities.filter((c) => c.present).length;
const authed = record.observed.capabilities.filter((c) => c.authorized).length;
console.log(`observed block written: ${present} capabilities present, ${authed} authorized, ${present - authed} present-but-not-authorized`);
