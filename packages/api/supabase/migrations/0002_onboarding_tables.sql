-- AgenID Onboarding Tables — operator-facing tables for the web onboarding flow.
--
-- These tables supplement the canonical protocol tables (0001_registry_store.sql).
-- The protocol tables (agents, keys, assertions, events) store verified public
-- material. These tables track onboarding-specific metadata: which domains have
-- been onboarded and the mapping from Retell agent IDs to AgenID protocol IDs.
--
-- SECURITY: No private key material is stored anywhere. Operator keypairs are
-- generated client-side and never leave the browser.

-- ---------------------------------------------------------------------------
-- organizations — tracks which domains have been onboarded
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id         text primary key,                    -- ULID
  domain     text not null unique,
  operator   text not null,                       -- legal/display name
  status     text not null default 'pending'
               check (status in ('pending', 'dns_verified', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

alter table organizations enable row level security;
create policy "organizations_public_read" on organizations for select using (true);

-- ---------------------------------------------------------------------------
-- retell_agent_map — maps Retell agent IDs to AgenID protocol identifiers
-- ---------------------------------------------------------------------------
create table if not exists retell_agent_map (
  retell_agent_id text primary key,
  agent_id        text not null,                  -- agenid:<ULID>, FK to agents(agent_id)
  org_id          text not null references organizations(id) on delete cascade,
  agent_name      text,
  created_at      timestamptz not null default now()
);
create index if not exists retell_agent_map_org_id_idx on retell_agent_map (org_id);
create index if not exists retell_agent_map_agent_id_idx on retell_agent_map (agent_id);

alter table retell_agent_map enable row level security;
create policy "retell_agent_map_public_read" on retell_agent_map for select using (true);
