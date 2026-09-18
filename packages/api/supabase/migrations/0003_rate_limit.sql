-- AgenID rate limiting — durable fixed-window counters.
--
-- WHY THIS IS IN POSTGRES AND NOT IN PROCESS MEMORY
-- The deployment is serverless: each request may land on a different instance, and
-- instances are created and destroyed constantly. A counter held in module scope
-- therefore bounds one instance's traffic, not the caller's. That in-memory bound is
-- still applied first (lib/rate-limit.ts) because it cannot fail and costs nothing,
-- but it is a floor, not the limit. This table is the limit.
--
-- WHY A FUNCTION AND NOT AN UPSERT FROM THE CLIENT
-- Read-then-write from the application races itself under exactly the conditions a
-- rate limiter exists for. `rate_limit_hit` performs the increment and the decision in
-- one statement, inside the database, so concurrent requests serialize on the row.
--
-- RLS: enabled with NO POLICIES for anon/authenticated, deliberately. Every other
-- table in this schema is public-read because the registry is a public directory
-- (spec §14/§15). This one is not registry data — it is operational telemetry, and
-- publishing per-caller request counts would leak traffic patterns and make the
-- limiter's own state a reconnaissance surface. Writes happen through the service
-- role, which bypasses RLS; anon and authenticated get nothing.

create table if not exists rate_limit_counters (
  bucket       text        not null,
  window_start timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, window_start)
);

-- Sweeping index: the only non-key access pattern is deleting expired windows.
create index if not exists rate_limit_counters_window_idx
  on rate_limit_counters (window_start);

alter table rate_limit_counters enable row level security;
-- No policies. See the header note. Service role bypasses RLS.

-- Atomically record one hit against `p_bucket` and report whether it is allowed.
--
-- Fixed window rather than sliding: a sliding window needs either per-request rows
-- (unbounded growth on exactly the traffic this defends against) or a second counter
-- and interpolation. A fixed window's worst case is 2x the limit across a boundary,
-- which is a known and acceptable property for an abuse bound — it is not a quota
-- system and does not need to be exact.
create or replace function rate_limit_hit(
  p_bucket  text,
  p_window_seconds integer,
  p_limit   integer,
  p_now     timestamptz default now()
)
returns table (allowed boolean, hits integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count        integer;
begin
  -- Align to a deterministic window boundary so every instance computes the same
  -- bucket for the same instant without coordinating.
  v_window_start := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );

  insert into rate_limit_counters (bucket, window_start, count)
  values (p_bucket, v_window_start, 1)
  on conflict (bucket, window_start)
  do update set count = rate_limit_counters.count + 1
  returning rate_limit_counters.count into v_count;

  return query select
    (v_count <= p_limit),
    v_count,
    (v_window_start + make_interval(secs => p_window_seconds));
end;
$$;

-- Housekeeping. Not scheduled here: pg_cron is not assumed to be enabled, and a
-- migration that silently depends on an extension is how 0001 became unappliable.
-- Called opportunistically from the application instead (lib/rate-limit.ts).
create or replace function rate_limit_sweep(p_older_than timestamptz)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from rate_limit_counters where window_start < p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function rate_limit_hit(text, integer, integer, timestamptz) from anon, authenticated;
revoke all on function rate_limit_sweep(timestamptz) from anon, authenticated;
