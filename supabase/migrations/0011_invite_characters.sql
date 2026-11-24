-- Invites can come with a character.
-- An admin can attach a character to an invite link. When someone joins with that link, the character becomes theirs
-- (as if an admin had assigned it), and the app opens its sheet. The character is only handed over while an admin
-- still owns it, so an invite can't take a character away from a player who already has it (for example when the
-- same character was attached to two links).

alter table fivepointfive.invites
  add column if not exists character_id text references fivepointfive.characters (id) on delete set null;

create or replace function fivepointfive.accept_invite(p_token text, p_name text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare
  inv fivepointfive.invites;
  given text;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if exists (select 1 from fivepointfive.members where user_id = (select auth.uid())) then return 'already'; end if;
  select * into inv from fivepointfive.invites where token = p_token for update;
  if not found or inv.revoked or inv.used_by is not null or inv.expires_at < now() then
    return 'invalid';
  end if;
  update fivepointfive.invites set used_by = (select auth.uid()), used_at = now() where id = inv.id;
  insert into fivepointfive.members (user_id, role, display_name) values ((select auth.uid()), 'member', coalesce(p_name, ''));
  if inv.character_id is not null then
    update fivepointfive.characters c set owner = (select auth.uid())
      where c.id = inv.character_id
        and exists (select 1 from fivepointfive.members m where m.user_id = c.owner and m.role = 'admin')
      returning c.id into given;
  end if;
  return case when given is not null then 'member:' || given else 'member' end;
end;
$$;
revoke execute on function fivepointfive.accept_invite(text, text) from anon, public;
grant execute on function fivepointfive.accept_invite(text, text) to authenticated;
