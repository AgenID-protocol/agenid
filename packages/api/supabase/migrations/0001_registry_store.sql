-- AgenID Registry — durable Supabase-backed implementation of the storage-independent
-- RegistryStore interface (packages/api/src/store.ts). The protocol itself never
-- assumes Postgres/Supabase (spec: storage independence) — this is one pluggable
-- backend behind that seam, used in production via SupabaseStore.
--
-- Every table ships with RLS enabled and its policies in this same migration.
-- The registry is a PUBLIC directory by design (spec §14/§15: anyone must be able
-- to verify an identity without trusting AgenID) — so anon/authenticated roles get
-- read-only SELECT. All writes (register, publish key, issue assertion, append
-- event) happen server-side through @agenid/api using the Supabase service role,
-- which bypasses RLS entirely — no write policies are granted to anon/authenticated.

create table if not exists agents (
  agent_id       text primary key,
  manifest       jsonb not null,
  manifest_digest text not null,
  proof          jsonb not null,
  status         text not null check (status in ('ACTIVE', 'CHANGED', 'STALE', 'SUSPENDED', 'REVOKED')),
  registered_at  timestamptz not null,
  updated_at     timestamptz not null
);

create table if not exists keys (
  key_id    text primary key,
  document  jsonb not null,
  role      text not null generated always as (document->>'role') stored,
  controller text generated always as (document->>'controller') stored
);
create index if not exists keys_role_idx on keys (role);

create table if not exists assertions (
  assertion_id     text primary key,
  subject          text not null,
  level            text not null,
  key_id           text not null,
  manifest_digest  text not null generated always as (document->'manifest_digest'->>'value') stored,
  document         jsonb not null,
  verified_at      timestamptz not null generated always as (((document->>'verified_at'))::timestamptz) stored
);
create index if not exists assertions_subject_idx on assertions (subject);

create table if not exists events (
  event_id    text primary key,
  agent_id    text not null,
  type        text not null,
  occurred_at timestamptz not null,
  detail_ref  jsonb not null default '{}'::jsonb
);
create index if not exists events_agent_id_idx on events (agent_id);

alter table agents     enable row level security;
alter table keys       enable row level security;
alter table assertions enable row level security;
alter table events     enable row level security;

create policy "agents_public_read"     on agents     for select using (true);
create policy "keys_public_read"       on keys       for select using (true);
create policy "assertions_public_read" on assertions for select using (true);
create policy "events_public_read"     on events     for select using (true);

-- No insert/update/delete policies for anon/authenticated on purpose: all writes
-- go through @agenid/api's SupabaseStore using SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS. Client-side/anon keys therefore have read-only access, matching
-- the same read/write split the Fastify routes already enforce at the app layer.
