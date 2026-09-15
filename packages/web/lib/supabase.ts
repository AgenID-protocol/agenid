/**
 * Supabase client for server-side API routes (service role).
 *
 * All writes go through the service role key, which bypasses RLS.
 * The onboarding tables have RLS policies for future direct-client access;
 * API routes use this privileged client for atomic multi-table writes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseServiceClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
