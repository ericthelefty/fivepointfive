-- Areas of effect on battle maps.
-- Anyone on a map (the GM, or a player while the GM shows the map) can lay out a spell's area (a Sphere, Cone, Line
-- and so on) to try it out. It stays on their own screen until they show it; a shown area is kept here, so everyone in
-- the campaign sees it, until its owner hides it. The owner changes or removes their own areas; the campaign's GM can
-- remove anyone's. Changes are announced on the realtime topic "fivepointfive:m:<campaign id>" (see 0014_maps.sql).
-- Safe to run more than once.

create table if not exists fivepointfive.map_areas (
  id text primary key,
  encounter_id text not null references fivepointfive.encounters (id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- { kind, x, y, angle, size, width, color, label, token, x2, y2 } in grid squares and feet (see src/lib/areas.ts)
  area jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists map_areas_encounter on fivepointfive.map_areas (encounter_id);

-- may the signed-in member use this encounter's map: its GM, or anyone in its campaign while the GM shows it
create or replace function fivepointfive.on_map(eid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select fivepointfive.gm_of(fivepointfive.encounter_campaign(eid))
    or (fivepointfive.in_campaign(fivepointfive.encounter_campaign(eid))
        and exists (select 1 from fivepointfive.encounter_maps em where em.encounter_id = eid and em.shown));
$$;
revoke execute on function fivepointfive.on_map(text) from anon, public;
grant execute on function fivepointfive.on_map(text) to authenticated;

alter table fivepointfive.map_areas enable row level security;
grant select, insert, update, delete on fivepointfive.map_areas to authenticated, service_role;

drop policy if exists "map users see shown areas" on fivepointfive.map_areas;
create policy "map users see shown areas" on fivepointfive.map_areas for select to authenticated
  using (fivepointfive.on_map(encounter_id));
drop policy if exists "map users show their areas" on fivepointfive.map_areas;
create policy "map users show their areas" on fivepointfive.map_areas for insert to authenticated
  with check (owner = (select auth.uid()) and fivepointfive.on_map(encounter_id));
drop policy if exists "owners change their areas" on fivepointfive.map_areas;
create policy "owners change their areas" on fivepointfive.map_areas for update to authenticated
  using (owner = (select auth.uid()) and fivepointfive.on_map(encounter_id))
  with check (owner = (select auth.uid()) and fivepointfive.on_map(encounter_id));
drop policy if exists "owners and the GM remove areas" on fivepointfive.map_areas;
create policy "owners and the GM remove areas" on fivepointfive.map_areas for delete to authenticated
  using (owner = (select auth.uid()) or fivepointfive.gm_of(fivepointfive.encounter_campaign(encounter_id)));
