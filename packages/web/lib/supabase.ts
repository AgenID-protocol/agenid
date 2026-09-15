/**
 * Supabase client for server-side API routes (service role).
 *
 * All writes go through the service role key, which bypasses RLS.
 * The onboarding tables have RLS policies for future direct-client access;
 * API routes use this privileged client for atomic multi-table writes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

class RealtimeUnused {
  constructor() {
    throw new Error("AgenID does not use Supabase Realtime; no channel should be opened.");
  }
}

let _client: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
    // See packages/api/src/supabase-store.ts: AgenID never opens a realtime
    // channel, and createClient's eager RealtimeClient probes for a global
    // WebSocket that does not exist before Node 22. Supplying a transport
    // short-circuits the probe; it is never constructed.
    realtime: { transport: RealtimeUnused as never },
  });
  return _client;
}
