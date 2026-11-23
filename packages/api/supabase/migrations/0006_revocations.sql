-- AgenID — operator-signed agent revocation.
--
-- Spec v1.1.1 §12: REVOKED identities are permanent and publicly resolvable. This adds
-- the storage for the signed object that proves a revocation was the operator's act,
-- and one function that records it atomically.
--
-- WHY A TABLE AND NOT A COLUMN. The revocation is a complete signed object
-- (v1.2-draft `Revocation`, schema https://agenid.com/schemas/v1.2/revocation.json),
-- and a verifier must be able to fetch and re-check it without trusting this registry.
-- The event ledger is not the place for it: §13 keeps the ledger to hashes and
-- references, so the ledger event points at this row by revocation_id and digest.
--
-- WHY A FUNCTION. PostgREST cannot run several statements in one transaction. A
-- revocation that was stored while the status write failed (or the reverse) would leave
-- the public record disagreeing with the signed object it depends on. revoke_agent does
-- all three writes in one transaction, and is a no-op on an agent already REVOKED, so a
-- retried request can neither append a second event nor replace the first revocation.
--
-- SECURITY. SECURITY INVOKER (the default): it runs with the caller's rights, and only
-- the service role can write these tables. EXECUTE is still revoked from PUBLIC so the
-- function is not even reachable at /rest/v1/rpc/ with the publishable key.
--
-- Reversible: `drop function public.revoke_agent(...)` and `drop table public.revocations`.
-- Revoked agents' status would remain REVOKED, which is the protocol's rule anyway.

create table if not exists public.revocations (
  revocation_id text primary key check (revocation_id ~ '^revocation:[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
  revokes       text not null,
  revokes_type  text not null check (revokes_type in ('agent', 'grant', 'key', 'assertion')),
  document      jsonb not null,
  -- The signed instant, from the document. Plain column, not generated: text ->
  -- timestamptz is not IMMUTABLE (the 42P17 lesson from 0001).
  revoked_at    timestamptz not null,
  recorded_at   timestamptz not null
);

-- One revocation per agent. Grants, keys and assertions are not written by this
-- registry yet; when they are, they get their own uniqueness rule.
create unique index if not exists revocations_one_per_agent
  on public.revocations (revokes) where revokes_type = 'agent';

alter table public.revocations enable row level security;

-- Public read, like every registry table: a revocation exists to be checked by anyone.
-- No write policies; writes go through the service role only.
drop policy if exists "revocations_public_read" on public.revocations;
create policy "revocations_public_read" on public.revocations for select using (true);

create or replace function public.revoke_agent(
  p_agent_id      text,
  p_revocation_id text,
  p_document      jsonb,
  p_revoked_at    timestamptz,
  p_recorded_at   timestamptz,
  p_event_id      text,
  p_detail_ref    jsonb
) returns text
language plpgsql
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.agents where agent_id = p_agent_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_status = 'REVOKED' then
    return 'already_revoked';
  end if;

  insert into public.revocations (revocation_id, revokes, revokes_type, document, revoked_at, recorded_at)
  values (p_revocation_id, p_agent_id, 'agent', p_document, p_revoked_at, p_recorded_at);

  update public.agents set status = 'REVOKED', updated_at = p_recorded_at where agent_id = p_agent_id;

  insert into public.events (event_id, agent_id, type, occurred_at, detail_ref)
  values (p_event_id, p_agent_id, 'agent.revoked', p_recorded_at, p_detail_ref);

  return 'revoked';
end;
$$;

revoke all on function public.revoke_agent(text, text, jsonb, timestamptz, timestamptz, text, jsonb) from public, anon, authenticated;
grant execute on function public.revoke_agent(text, text, jsonb, timestamptz, timestamptz, text, jsonb) to service_role;
