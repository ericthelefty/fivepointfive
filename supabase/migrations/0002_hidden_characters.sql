-- Hidden characters: the owner (or an admin) can hide a character from the rest of the instance, for example a
-- GM keeping an NPC or a surprise character out of sight until it appears. A hidden character is visible only to
-- its owner and the instance admins, and its rolls stay out of everyone else's table log.

alter table fivepointfive.characters add column if not exists hidden boolean not null default false;

-- whether a character is hidden, readable from the log policy (which can't see hidden rows itself)
create or replace function fivepointfive.character_hidden(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select hidden from fivepointfive.characters where id = cid), false);
$$;
revoke execute on function fivepointfive.character_hidden(text) from anon, public;
grant execute on function fivepointfive.character_hidden(text) to authenticated;

drop policy if exists "members see characters" on fivepointfive.characters;
create policy "members see shown characters" on fivepointfive.characters for select to authenticated
  using ((select fivepointfive.is_member()) and (not hidden or owner = (select auth.uid()) or (select fivepointfive.is_admin())));

drop policy if exists "members read log" on fivepointfive.log;
create policy "members read log" on fivepointfive.log for select to authenticated
  using ((select fivepointfive.is_member())
    and (user_id = (select auth.uid()) or (select fivepointfive.is_admin()) or not fivepointfive.character_hidden(character_id)));
