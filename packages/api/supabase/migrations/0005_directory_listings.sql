-- 0005 — the public agent directory (opt-in).
--
-- One row per agent whose operator has ever signed a directory consent. `listed` is the
-- operator's current choice; `consent` is the operator-signed object that set it, kept
-- verbatim so anyone with read access can re-verify it against the operator key.
--
-- An agent with no row, or with listed = false, is never enumerated. Registration alone
-- does not create a row.
--
-- RLS: enabled in the same migration, per the standing rule. Public read is limited to
-- listed rows, so a delisted agent's history is not browsable through the publishable key.
-- There are no insert/update/delete policies: writes happen server-side with the service
-- role after the consent signature has been verified (packages/web/lib/directory.ts).

create table if not exists directory_listings (
  agent_id            text primary key references agents (agent_id) on delete cascade,
  listed              boolean not null,
  consent             jsonb not null,
  consent_created_at  timestamptz not null,
  updated_at          timestamptz not null
);

create index if not exists directory_listings_listed_idx
  on directory_listings (updated_at desc)
  where listed;

alter table directory_listings enable row level security;

create policy "directory_listings_public_read_listed"
  on directory_listings for select
  using (listed = true);
