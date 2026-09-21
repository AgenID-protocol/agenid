-- AgenID — close the SECURITY DEFINER exposure left by 0003 as first applied.
--
-- 0003 ran `revoke all ... from anon, authenticated`. Postgres grants EXECUTE on every
-- new function to PUBLIC by default, and anon/authenticated inherit through PUBLIC, so
-- that revoke removed nothing. Verified in production on Sept 20 via
-- has_function_privilege(): anon, authenticated and public could all EXECUTE both
-- functions, and the Supabase security advisor flagged them (lints 0028 / 0029).
--
-- Impact while open: both functions were reachable at /rest/v1/rpc/* with the project's
-- publishable key. rate_limit_sweep(<future>) deletes every counter, resetting the
-- durable limiter; rate_limit_hit(<any bucket>) inflates any bucket, locking out
-- legitimate callers and growing the table without bound. A publishable key is not a
-- secret by design, so no control may rest on it staying private.
--
-- Only the service role calls these functions (packages/web/lib/rate-limit.ts).
-- Idempotent: safe to re-run, and a no-op on an environment built from the corrected 0003.

revoke all on function public.rate_limit_hit(text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.rate_limit_sweep(timestamptz) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer, timestamptz) to service_role;
grant execute on function public.rate_limit_sweep(timestamptz) to service_role;
