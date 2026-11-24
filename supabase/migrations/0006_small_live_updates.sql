-- Small live updates. Two changes make each live update a fraction of the size:
-- 1. Each character's game log moves out of the character into its own table, so a roll adds one small row instead
--    of resaving the whole character with its log.
-- 2. Characters get a version number that goes up on every save. Sheets send each other only what changed, tagged
--    with the version it applies to, over a private channel only members can use; a sheet that misses one sees the
--    gap and fetches a fresh copy. Sheets also compare version numbers now and then, which costs a few bytes.
-- Safe to run on an instance that already has data: existing game logs are copied over, nothing is lost.

-- ------------------------------------------------------------- game logs
create table if not exists fivepointfive.character_log (
  character_id text not null references fivepointfive.characters (id) on delete cascade,
  id text not null,
  seq bigint generated always as identity,
  entry jsonb not null,
  created_at timestamptz not null default now(),
  primary key (character_id, id)
);
create index if not exists character_log_recent on fivepointfive.character_log (character_id, seq desc);

-- who may see and change a character, readable from the log's policies
create or replace function fivepointfive.can_see_character(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select fivepointfive.is_member() and exists (
    select 1 from fivepointfive.characters c
    where c.id = cid and (not c.hidden or c.owner = (select auth.uid()) or fivepointfive.is_admin()));
$$;
create or replace function fivepointfive.can_edit_character(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select fivepointfive.is_member() and exists (
    select 1 from fivepointfive.characters c
    where c.id = cid and (c.owner = (select auth.uid()) or fivepointfive.is_admin()));
$$;
revoke execute on function fivepointfive.can_see_character(text), fivepointfive.can_edit_character(text) from anon, public;
grant execute on function fivepointfive.can_see_character(text), fivepointfive.can_edit_character(text) to authenticated;

alter table fivepointfive.character_log enable row level security;
drop policy if exists "see the logs of characters you can see" on fivepointfive.character_log;
create policy "see the logs of characters you can see" on fivepointfive.character_log for select to authenticated
  using (fivepointfive.can_see_character(character_id));
drop policy if exists "write the logs of characters you can edit" on fivepointfive.character_log;
create policy "write the logs of characters you can edit" on fivepointfive.character_log for insert to authenticated
  with check (fivepointfive.can_edit_character(character_id));
drop policy if exists "clear the logs of characters you can edit" on fivepointfive.character_log;
create policy "clear the logs of characters you can edit" on fivepointfive.character_log for delete to authenticated
  using (fivepointfive.can_edit_character(character_id));
grant select, insert, delete on fivepointfive.character_log to authenticated, service_role;

-- move every existing game log out of its character, oldest entry first so the order is kept
insert into fivepointfive.character_log (character_id, id, entry, created_at)
select c.id, coalesce(x.e ->> 'id', md5(x.e::text)), x.e, now() - make_interval(secs => x.n)
from fivepointfive.characters c
cross join lateral jsonb_array_elements(case when jsonb_typeof(c.data -> 'play' -> 'log') = 'array' then c.data -> 'play' -> 'log' else '[]'::jsonb end)
  with ordinality as x(e, n)
order by c.id, x.n desc
on conflict do nothing;
-- (the copy left inside each character is dropped by the app the next time that character is saved, so a sheet still
-- open from before the update keeps working until it reloads)

-- the newest entries of each character's log (the sheet shows the latest 150)
create or replace function fivepointfive.recent_log(per_character int default 150, ids text[] default null)
returns table (character_id text, id text, seq bigint, entry jsonb)
language sql stable security invoker set search_path = '' as $$
  select r.character_id, r.id, r.seq, r.entry from (
    select l.character_id, l.id, l.seq, l.entry, row_number() over (partition by l.character_id order by l.seq desc) as rn
    from fivepointfive.character_log l
    where ids is null or l.character_id = any (ids)
  ) r where r.rn <= per_character
  order by r.character_id, r.seq desc;
$$;
-- the newest entry number of each log: how a sheet checks it hasn't missed any
create or replace function fivepointfive.log_heads()
returns table (character_id text, head bigint)
language sql stable security invoker set search_path = '' as $$
  select l.character_id, max(l.seq) from fivepointfive.character_log l group by l.character_id;
$$;
revoke execute on function fivepointfive.recent_log(int, text[]), fivepointfive.log_heads() from anon, public;
grant execute on function fivepointfive.recent_log(int, text[]), fivepointfive.log_heads() to authenticated;

-- ------------------------------------------------------------- versions
alter table fivepointfive.characters add column if not exists version bigint not null default 0;
create or replace function fivepointfive.bump_version() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;
drop trigger if exists characters_version on fivepointfive.characters;
create trigger characters_version before update on fivepointfive.characters for each row execute function fivepointfive.bump_version();

-- ------------------------------------------------------------- live
-- new log entries reach open sheets as they're written
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'fivepointfive' and tablename = 'character_log'
  ) then
    alter publication supabase_realtime add table fivepointfive.character_log;
  end if;
end $$;

-- the private channel sheets use to send each other what changed: members only
drop policy if exists "fivepointfive members receive character changes" on realtime.messages;
create policy "fivepointfive members receive character changes" on realtime.messages for select to authenticated
  using (realtime.topic() = 'fivepointfive:characters' and (select fivepointfive.is_member()));
drop policy if exists "fivepointfive members send character changes" on realtime.messages;
create policy "fivepointfive members send character changes" on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'fivepointfive:characters' and (select fivepointfive.is_member()));
