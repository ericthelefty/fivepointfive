-- Battle maps.
-- A campaign's GM uploads map images to the campaign's map library and sets each one's grid: a grid drawn over the
-- image, or lined up with a grid already printed on it (the same cells, not drawn). The files sit in a private Storage
-- bucket at "<campaign id>/<file>"; the campaign's members can see them, its GM adds and removes them.
-- An encounter can use one of its campaign's maps. Its state (where each token stands, which squares the fog covers,
-- whether the players can see it) is in encounter_maps, which only the GM reads directly. Players read it through
-- encounter_map(), which leaves out hidden tokens and monsters under the fog, and move their own character's token
-- with move_token(). Changes are announced on the realtime topic "fivepointfive:m:<campaign id>".
-- Safe to run more than once.

-- a uuid from text, or null (folder names in Storage are text)
create or replace function fivepointfive.try_uuid(t text) returns uuid
language sql immutable set search_path = '' as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end;
$$;

create table if not exists fivepointfive.maps (
  id text primary key,
  campaign_id uuid not null references fivepointfive.campaigns (id) on delete cascade,
  name text not null default '',
  path text not null,
  width int not null,
  height int not null,
  -- { show: bool, size: px per square, ox, oy: where the grid starts, color, opacity }
  grid jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maps_campaign on fivepointfive.maps (campaign_id);

create table if not exists fivepointfive.encounter_maps (
  encounter_id text primary key references fivepointfive.encounters (id) on delete cascade,
  map_id text references fivepointfive.maps (id) on delete set null,
  -- what players see it called (the encounter's name)
  title text not null default '',
  shown boolean not null default false,
  -- [{ uid, name, kind, char, x, y, size, hidden, out }] in grid squares; a token with no x isn't on the map yet
  tokens jsonb not null default '[]'::jsonb,
  -- { on: bool, cells: ["x,y", ...] squares uncovered }
  fog jsonb not null default '{"on": false, "cells": []}'::jsonb,
  turn text,
  round int not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function fivepointfive.encounter_campaign(eid text) returns uuid
language sql stable security definer set search_path = '' as $$
  select campaign_id from fivepointfive.encounters where id = eid;
$$;
revoke execute on function fivepointfive.encounter_campaign(text) from anon, public;
grant execute on function fivepointfive.encounter_campaign(text) to authenticated;

alter table fivepointfive.maps enable row level security;
alter table fivepointfive.encounter_maps enable row level security;
grant select, insert, update, delete on fivepointfive.maps, fivepointfive.encounter_maps to authenticated, service_role;

drop policy if exists "members see their campaign maps" on fivepointfive.maps;
create policy "members see their campaign maps" on fivepointfive.maps for select to authenticated using (fivepointfive.in_campaign(campaign_id));
drop policy if exists "the GM manages campaign maps" on fivepointfive.maps;
create policy "the GM manages campaign maps" on fivepointfive.maps for all to authenticated
  using (fivepointfive.gm_of(campaign_id)) with check (fivepointfive.gm_of(campaign_id));

drop policy if exists "the GM runs encounter maps" on fivepointfive.encounter_maps;
create policy "the GM runs encounter maps" on fivepointfive.encounter_maps for all to authenticated
  using (fivepointfive.gm_of(fivepointfive.encounter_campaign(encounter_id))
    or (fivepointfive.encounter_campaign(encounter_id) is null and (select fivepointfive.is_admin())))
  with check (fivepointfive.gm_of(fivepointfive.encounter_campaign(encounter_id))
    or (fivepointfive.encounter_campaign(encounter_id) is null and (select fivepointfive.is_admin())));

-- is a token visible to players: not hidden, and (for anyone but a character) not under the fog
create or replace function fivepointfive.token_seen(t jsonb, fog jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select not coalesce((t ->> 'hidden')::boolean, false) and (
    t ->> 'kind' = 'pc' or t ->> 'x' is null or not coalesce((fog ->> 'on')::boolean, false)
    or exists (
      select 1 from generate_series(0, greatest(coalesce((t ->> 'size')::int, 1), 1) - 1) dx,
                    generate_series(0, greatest(coalesce((t ->> 'size')::int, 1), 1) - 1) dy
      where coalesce(fog -> 'cells', '[]'::jsonb) ? (((t ->> 'x')::int + dx)::text || ',' || ((t ->> 'y')::int + dy)::text)));
$$;

-- what a player sees of an encounter's map (the GM sees everything)
create or replace function fivepointfive.encounter_map(eid text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  em fivepointfive.encounter_maps;
  cid uuid := fivepointfive.encounter_campaign(eid);
  gm boolean := fivepointfive.gm_of(cid);
  m fivepointfive.maps;
begin
  select * into em from fivepointfive.encounter_maps where encounter_id = eid;
  if not found or not fivepointfive.in_campaign(cid) or (not em.shown and not gm) then return null; end if;
  select * into m from fivepointfive.maps where id = em.map_id;
  return jsonb_build_object(
    'encounterId', em.encounter_id, 'campaignId', cid, 'title', em.title, 'shown', em.shown, 'gm', gm,
    'map', case when m.id is null then null else jsonb_build_object('id', m.id, 'name', m.name, 'path', m.path, 'width', m.width, 'height', m.height, 'grid', m.grid) end,
    'tokens', coalesce((select jsonb_agg(t) from jsonb_array_elements(em.tokens) t where gm or fivepointfive.token_seen(t, em.fog)), '[]'::jsonb),
    'fog', em.fog, 'turn', em.turn, 'round', em.round, 'updated', em.updated_at,
    -- the characters this member plays, so the page knows which tokens they can move
    'mine', coalesce((select jsonb_agg(c.id) from fivepointfive.characters c where c.owner = (select auth.uid())), '[]'::jsonb));
end;
$$;

-- the maps the GM is showing in a campaign right now
create or replace function fivepointfive.live_maps(cid uuid) returns table (encounter_id text, title text)
language sql stable security definer set search_path = '' as $$
  select em.encounter_id, em.title from fivepointfive.encounter_maps em
  join fivepointfive.encounters e on e.id = em.encounter_id
  where e.campaign_id = cid and em.shown and em.map_id is not null and fivepointfive.in_campaign(cid)
  order by em.updated_at desc;
$$;

-- a player moves their own character's token (the GM can move any)
create or replace function fivepointfive.move_token(eid text, tuid text, nx int, ny int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  em fivepointfive.encounter_maps;
  cid uuid := fivepointfive.encounter_campaign(eid);
  idx int;
  tok jsonb;
begin
  select * into em from fivepointfive.encounter_maps where encounter_id = eid for update;
  if not found or not fivepointfive.in_campaign(cid) then return false; end if;
  select i - 1, t into idx, tok from jsonb_array_elements(em.tokens) with ordinality as a(t, i) where t ->> 'uid' = tuid;
  if idx is null then return false; end if;
  if not fivepointfive.gm_of(cid) then
    if not em.shown or tok ->> 'kind' <> 'pc' or coalesce((tok ->> 'out')::boolean, false)
       or not exists (select 1 from fivepointfive.characters c where c.id = tok ->> 'char' and c.owner = (select auth.uid())) then
      return false;
    end if;
  end if;
  update fivepointfive.encounter_maps
    set tokens = jsonb_set(jsonb_set(tokens, array[idx::text, 'x'], to_jsonb(nx)), array[idx::text, 'y'], to_jsonb(ny)), updated_at = now()
    where encounter_id = eid;
  return true;
end;
$$;

revoke execute on function fivepointfive.encounter_map(text), fivepointfive.live_maps(uuid), fivepointfive.move_token(text, text, int, int) from anon, public;
grant execute on function fivepointfive.encounter_map(text), fivepointfive.live_maps(uuid), fivepointfive.move_token(text, text, int, int) to authenticated;

-- ---------------------------------------------------------------- files
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fivepointfive-maps', 'fivepointfive-maps', false, 15728640, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fivepointfive members see maps" on storage.objects;
drop policy if exists "fivepointfive GMs add maps" on storage.objects;
drop policy if exists "fivepointfive GMs remove maps" on storage.objects;
create policy "fivepointfive members see maps" on storage.objects for select to authenticated
  using (bucket_id = 'fivepointfive-maps' and fivepointfive.in_campaign(fivepointfive.try_uuid((storage.foldername(name))[1])));
create policy "fivepointfive GMs add maps" on storage.objects for insert to authenticated
  with check (bucket_id = 'fivepointfive-maps' and fivepointfive.gm_of(fivepointfive.try_uuid((storage.foldername(name))[1])));
create policy "fivepointfive GMs remove maps" on storage.objects for delete to authenticated
  using (bucket_id = 'fivepointfive-maps' and fivepointfive.gm_of(fivepointfive.try_uuid((storage.foldername(name))[1])));

-- ------------------------------------------------------------- realtime
drop policy if exists "fivepointfive members receive map changes" on realtime.messages;
create policy "fivepointfive members receive map changes" on realtime.messages for select to authenticated
  using ((select fivepointfive.is_member()) and realtime.topic() like 'fivepointfive:m:%'
    and fivepointfive.in_campaign(fivepointfive.try_uuid(substr(realtime.topic(), 17))));
drop policy if exists "fivepointfive members send map changes" on realtime.messages;
create policy "fivepointfive members send map changes" on realtime.messages for insert to authenticated
  with check ((select fivepointfive.is_member()) and realtime.topic() like 'fivepointfive:m:%'
    and fivepointfive.in_campaign(fivepointfive.try_uuid(substr(realtime.topic(), 17))));
