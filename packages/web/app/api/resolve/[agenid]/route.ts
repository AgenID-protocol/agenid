import { fetchEnvelope } from "@/lib/api";

export const dynamic = "force-dynamic";

/** JSON representation of /a/<agenid>. Also what badge.js calls. */
export async function GET(_req: Request, ctx: { params: Promise<{ agenid: string }> }) {
  const { agenid } = await ctx.params;
  const { status, envelope, error } = await fetchEnvelope(decodeURIComponent(agenid));
  const headers = { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" };
  if (!envelope) return new Response(JSON.stringify({ error, agent_id: agenid }), { status, headers });
  return new Response(JSON.stringify(envelope), { status: 200, headers });
}
