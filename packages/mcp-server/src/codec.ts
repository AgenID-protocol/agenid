/**
 * Pure encode/decode helpers shared by the MCP tools. Split out from index.ts so
 * they can be unit-tested without spinning up the stdio server (index.ts connects
 * a transport at module load, which a test import must never trigger).
 */
import { fromHex, b64uDecode } from "@agenid/core";

export function decodeSignature(signature: string): Uint8Array {
  if (/^[0-9a-fA-F]+$/.test(signature) && signature.length === 128) return fromHex(signature);
  return b64uDecode(signature);
}

export function decodePublicKey(publicKey: string): Uint8Array {
  if (/^[0-9a-fA-F]{64}$/.test(publicKey)) return fromHex(publicKey);
  return b64uDecode(publicKey);
}
