-- Encounters: the DM's encounter builder and combat tracker. Only instance admins (the DM) can see or change them;
-- players don't see encounters at all. An encounter's monsters, initiative order, round and turn, and its roll log
-- are kept in `data`; the characters in it are referenced by id, and their HP stays on their own sheets.
-- Safe to run on an instance that already has data.

create table if not exists fivepointfive.encounters (
  id text primary key,
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table fivepointfive.encounters enable row level security;

drop policy if exists "admins manage encounters" on fivepointfive.encounters;
create policy "admins manage encounters" on fivepointfive.encounters for all to authenticated
  using ((select fivepointfive.is_admin()))
  with check ((select fivepointfive.is_admin()));

grant select, insert, update, delete on fivepointfive.encounters to authenticated, service_role;
