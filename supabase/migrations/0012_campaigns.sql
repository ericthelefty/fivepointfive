-- Campaigns: a way to divide the players of one instance, and the characters they can see.
-- The admin creates campaigns, adds members to them and can make a member the GM of one. A member can be in several.
-- A campaign's GM can add other members of the instance to it as players (and take players out), and take a character
-- out of it; the admin can move characters between campaigns.
-- A character belongs to one campaign (or none: then only its owner and admins see it). Members see only the members,
-- characters, shared rolls, encounters and loot of their own campaigns; a campaign's GM runs its encounters and loot
-- and can edit its characters. Admins still see and manage everything.
-- Everything that exists when this runs goes into a first campaign named after the instance, with every member in it.

-- ---------------------------------------------------------------- tables
create table if not exists fivepointfive.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists fivepointfive.campaign_members (
  campaign_id uuid not null references fivepointfive.campaigns (id) on delete cascade,
  user_id uuid not null references fivepointfive.members (user_id) on delete cascade,
  role text not null default 'player' check (role in ('player', 'gm')),
  added_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index if not exists campaign_members_user on fivepointfive.campaign_members (user_id);

alter table fivepointfive.characters add column if not exists campaign_id uuid references fivepointfive.campaigns (id) on delete set null;
alter table fivepointfive.log add column if not exists campaign_id uuid references fivepointfive.campaigns (id) on delete cascade;
alter table fivepointfive.encounters add column if not exists campaign_id uuid references fivepointfive.campaigns (id) on delete cascade;
alter table fivepointfive.loot add column if not exists campaign_id uuid references fivepointfive.campaigns (id) on delete cascade;
alter table fivepointfive.invites add column if not exists campaign_id uuid references fivepointfive.campaigns (id) on delete set null;
create index if not exists characters_campaign on fivepointfive.characters (campaign_id);
create index if not exists log_campaign on fivepointfive.log (campaign_id, id desc);

-- --------------------------------------------------------------- helpers
-- is the signed-in member in this campaign (admins are in every campaign)
create or replace function fivepointfive.in_campaign(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select cid is not null and (fivepointfive.is_admin() or exists (
    select 1 from fivepointfive.campaign_members where campaign_id = cid and user_id = (select auth.uid())));
$$;
-- is the signed-in member this campaign's GM (admins are GM of every campaign)
create or replace function fivepointfive.gm_of(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select cid is not null and (fivepointfive.is_admin() or exists (
    select 1 from fivepointfive.campaign_members where campaign_id = cid and user_id = (select auth.uid()) and role = 'gm'));
$$;
-- is this member someone the signed-in member may see: themselves, or someone in one of their campaigns
create or replace function fivepointfive.shares_campaign(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select uid = (select auth.uid()) or fivepointfive.is_admin() or exists (
    select 1 from fivepointfive.campaign_members a join fivepointfive.campaign_members b on a.campaign_id = b.campaign_id
    where a.user_id = (select auth.uid()) and b.user_id = uid);
$$;
-- is the signed-in member the GM of any campaign (they may see the instance's members, to add them to it)
create or replace function fivepointfive.is_any_gm() returns boolean
language sql stable security definer set search_path = '' as $$
  select fivepointfive.is_admin() or exists (select 1 from fivepointfive.campaign_members where user_id = (select auth.uid()) and role = 'gm');
$$;
create or replace function fivepointfive.character_campaign(cid text) returns uuid
language sql stable security definer set search_path = '' as $$
  select campaign_id from fivepointfive.characters where id = cid;
$$;
create or replace function fivepointfive.loot_campaign(lid text) returns uuid
language sql stable security definer set search_path = '' as $$
  select campaign_id from fivepointfive.loot where id = lid;
$$;
revoke execute on function fivepointfive.in_campaign(uuid), fivepointfive.gm_of(uuid), fivepointfive.shares_campaign(uuid), fivepointfive.is_any_gm(),
  fivepointfive.character_campaign(text), fivepointfive.loot_campaign(text) from anon, public;
grant execute on function fivepointfive.in_campaign(uuid), fivepointfive.gm_of(uuid), fivepointfive.shares_campaign(uuid), fivepointfive.is_any_gm(),
  fivepointfive.character_campaign(text), fivepointfive.loot_campaign(text) to authenticated;

-- who can see or edit a character (used by the game log, loot and backgrounds)
create or replace function fivepointfive.can_see_character(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select fivepointfive.is_member() and exists (
    select 1 from fivepointfive.characters c
    where c.id = cid and (c.owner = (select auth.uid()) or fivepointfive.is_admin()
      or (fivepointfive.in_campaign(c.campaign_id) and (not c.hidden or fivepointfive.gm_of(c.campaign_id)))));
$$;
create or replace function fivepointfive.can_edit_character(cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select fivepointfive.is_member() and exists (
    select 1 from fivepointfive.characters c
    where c.id = cid and (c.owner = (select auth.uid()) or fivepointfive.gm_of(c.campaign_id)));
$$;

-- ------------------------------------------------------------- the start
-- every existing member, character, shared roll, encounter and loot goes into a first campaign
do $$
declare first uuid;
begin
  if not exists (select 1 from fivepointfive.campaigns) and exists (select 1 from fivepointfive.members) then
    insert into fivepointfive.campaigns (name)
      values (coalesce(nullif((select value #>> '{}' from fivepointfive.settings where key = 'instance_name'), ''), 'First campaign'))
      returning id into first;
    insert into fivepointfive.campaign_members (campaign_id, user_id) select first, user_id from fivepointfive.members;
    update fivepointfive.characters set campaign_id = first where campaign_id is null;
    update fivepointfive.log set campaign_id = first where campaign_id is null;
    update fivepointfive.encounters set campaign_id = first where campaign_id is null;
    update fivepointfive.loot set campaign_id = first where campaign_id is null;
  end if;
end $$;

-- a shared roll belongs to its character's campaign
create or replace function fivepointfive.log_campaign() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.campaign_id := (select campaign_id from fivepointfive.characters where id = new.character_id);
  return new;
end;
$$;
drop trigger if exists log_campaign on fivepointfive.log;
create trigger log_campaign before insert on fivepointfive.log for each row execute function fivepointfive.log_campaign();

-- joining with an invite: into the invite's campaign too, and a character given with it moves there
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
  if inv.campaign_id is not null then
    insert into fivepointfive.campaign_members (campaign_id, user_id) values (inv.campaign_id, (select auth.uid())) on conflict do nothing;
  end if;
  if inv.character_id is not null then
    update fivepointfive.characters c set owner = (select auth.uid()), campaign_id = coalesce(inv.campaign_id, c.campaign_id)
      where c.id = inv.character_id
        and exists (select 1 from fivepointfive.members m where m.user_id = c.owner and m.role = 'admin')
      returning c.id into given;
  end if;
  return case when given is not null then 'member:' || given else 'member' end;
end;
$$;
revoke execute on function fivepointfive.accept_invite(text, text) from anon, public;
grant execute on function fivepointfive.accept_invite(text, text) to authenticated;

-- a campaign's GM (or the admin) takes a character out of the campaign: it stays with its player, in no campaign
create or replace function fivepointfive.remove_from_campaign(cid text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  update fivepointfive.characters set campaign_id = null
    where id = cid and campaign_id is not null and fivepointfive.gm_of(campaign_id)
    returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke execute on function fivepointfive.remove_from_campaign(text) from anon, public;
grant execute on function fivepointfive.remove_from_campaign(text) to authenticated;

-- only the campaign's GM closes its loot
create or replace function fivepointfive.close_loot(lid text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not fivepointfive.gm_of(fivepointfive.loot_campaign(lid)) then raise exception 'Only the GM can close the loot'; end if;
  perform fivepointfive.finish_loot(lid);
end;
$$;
revoke execute on function fivepointfive.close_loot(text) from anon, public;
grant execute on function fivepointfive.close_loot(text) to authenticated;

-- ------------------------------------------------------------------ RLS
alter table fivepointfive.campaigns enable row level security;
alter table fivepointfive.campaign_members enable row level security;

drop policy if exists "members see their campaigns" on fivepointfive.campaigns;
create policy "members see their campaigns" on fivepointfive.campaigns for select to authenticated using (fivepointfive.in_campaign(id));
drop policy if exists "admin manages campaigns" on fivepointfive.campaigns;
create policy "admin manages campaigns" on fivepointfive.campaigns for all to authenticated
  using ((select fivepointfive.is_admin())) with check ((select fivepointfive.is_admin()));

drop policy if exists "members see who is in their campaigns" on fivepointfive.campaign_members;
create policy "members see who is in their campaigns" on fivepointfive.campaign_members for select to authenticated using (fivepointfive.in_campaign(campaign_id));
drop policy if exists "admin manages campaign members" on fivepointfive.campaign_members;
create policy "admin manages campaign members" on fivepointfive.campaign_members for all to authenticated
  using ((select fivepointfive.is_admin())) with check ((select fivepointfive.is_admin()));
-- a campaign's GM adds members of the instance to it as players, and takes players out
drop policy if exists "the GM adds players" on fivepointfive.campaign_members;
create policy "the GM adds players" on fivepointfive.campaign_members for insert to authenticated
  with check (fivepointfive.gm_of(campaign_id) and role = 'player');
drop policy if exists "the GM removes players" on fivepointfive.campaign_members;
create policy "the GM removes players" on fivepointfive.campaign_members for delete to authenticated
  using (fivepointfive.gm_of(campaign_id) and role = 'player');

-- members: yourself, and the members of your campaigns (a GM sees everyone, to add them to their campaign)
drop policy if exists "members see members" on fivepointfive.members;
create policy "members see members" on fivepointfive.members for select to authenticated
  using ((select fivepointfive.is_member()) and (fivepointfive.shares_campaign(user_id) or (select fivepointfive.is_any_gm())));

-- characters: your own, and the shown characters of your campaigns (their GM sees the hidden ones too)
drop policy if exists "members see shown characters" on fivepointfive.characters;
create policy "members see shown characters" on fivepointfive.characters for select to authenticated
  using ((select fivepointfive.is_member()) and (owner = (select auth.uid()) or (select fivepointfive.is_admin())
    or (fivepointfive.in_campaign(campaign_id) and (not hidden or fivepointfive.gm_of(campaign_id)))));
drop policy if exists "members add characters" on fivepointfive.characters;
create policy "members add characters" on fivepointfive.characters for insert to authenticated
  with check ((select fivepointfive.is_member()) and owner = (select auth.uid()) and (campaign_id is null or fivepointfive.in_campaign(campaign_id)));
drop policy if exists "owner or admin edits characters" on fivepointfive.characters;
create policy "owner or admin edits characters" on fivepointfive.characters for update to authenticated
  using (owner = (select auth.uid()) or fivepointfive.gm_of(campaign_id))
  with check (
    (campaign_id is null or fivepointfive.in_campaign(campaign_id))
    and (
      owner = (select auth.uid())
      or ((select fivepointfive.is_admin()) and exists (select 1 from fivepointfive.members m where m.user_id = characters.owner))
      -- a campaign's GM edits its characters, but only those of its own players
      or (fivepointfive.gm_of(campaign_id) and exists (select 1 from fivepointfive.campaign_members cm where cm.campaign_id = characters.campaign_id and cm.user_id = characters.owner))
    ));

-- shared rolls: your own, and those of your campaigns (not a hidden character's, except for its GM)
drop policy if exists "members read log" on fivepointfive.log;
create policy "members read log" on fivepointfive.log for select to authenticated
  using ((select fivepointfive.is_member()) and (user_id = (select auth.uid()) or (select fivepointfive.is_admin())
    or (fivepointfive.in_campaign(campaign_id) and (not fivepointfive.character_hidden(character_id) or fivepointfive.gm_of(campaign_id)))));

-- encounters: the campaign's GM
drop policy if exists "admins manage encounters" on fivepointfive.encounters;
create policy "admins manage encounters" on fivepointfive.encounters for all to authenticated
  using (fivepointfive.gm_of(campaign_id) or (campaign_id is null and (select fivepointfive.is_admin())))
  with check (fivepointfive.gm_of(campaign_id) or (campaign_id is null and (select fivepointfive.is_admin())));

-- loot: the campaign's members see it, its GM hands it out
drop policy if exists "members see loot" on fivepointfive.loot;
create policy "members see loot" on fivepointfive.loot for select to authenticated using (fivepointfive.in_campaign(campaign_id) or (select fivepointfive.is_admin()));
drop policy if exists "the GM hands out loot" on fivepointfive.loot;
create policy "the GM hands out loot" on fivepointfive.loot for all to authenticated
  using (fivepointfive.gm_of(campaign_id) or (campaign_id is null and (select fivepointfive.is_admin())))
  with check (fivepointfive.gm_of(campaign_id) or (campaign_id is null and (select fivepointfive.is_admin())));
drop policy if exists "members see loot items" on fivepointfive.loot_items;
create policy "members see loot items" on fivepointfive.loot_items for select to authenticated using (fivepointfive.in_campaign(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));
drop policy if exists "the GM lists loot items" on fivepointfive.loot_items;
create policy "the GM lists loot items" on fivepointfive.loot_items for insert to authenticated with check (fivepointfive.gm_of(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));
drop policy if exists "the GM removes loot items" on fivepointfive.loot_items;
create policy "the GM removes loot items" on fivepointfive.loot_items for delete to authenticated using (fivepointfive.gm_of(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));
drop policy if exists "members see loot choices" on fivepointfive.loot_choices;
create policy "members see loot choices" on fivepointfive.loot_choices for select to authenticated using (fivepointfive.in_campaign(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));
drop policy if exists "only the GM sees hidden loot" on fivepointfive.loot_hidden;
create policy "only the GM sees hidden loot" on fivepointfive.loot_hidden for all to authenticated
  using (fivepointfive.gm_of(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()))
  with check (fivepointfive.gm_of(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));
drop policy if exists "members see searches" on fivepointfive.loot_searches;
create policy "members see searches" on fivepointfive.loot_searches for select to authenticated using (fivepointfive.in_campaign(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));
drop policy if exists "the GM clears searches" on fivepointfive.loot_searches;
create policy "the GM clears searches" on fivepointfive.loot_searches for delete to authenticated using (fivepointfive.gm_of(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));
drop policy if exists "members see payouts" on fivepointfive.loot_payouts;
create policy "members see payouts" on fivepointfive.loot_payouts for select to authenticated using (fivepointfive.in_campaign(fivepointfive.loot_campaign(loot_id)) or (select fivepointfive.is_admin()));

-- live character changes go out on one channel per campaign (and one per owner for characters in no campaign)
drop policy if exists "fivepointfive members receive character changes" on realtime.messages;
create policy "fivepointfive members receive character changes" on realtime.messages for select to authenticated
  using ((select fivepointfive.is_member()) and (
    (realtime.topic() like 'fivepointfive:c:%' and fivepointfive.in_campaign(nullif(substr(realtime.topic(), 17), '')::uuid))
    or realtime.topic() = 'fivepointfive:u:' || (select auth.uid())::text));
drop policy if exists "fivepointfive members send character changes" on realtime.messages;
create policy "fivepointfive members send character changes" on realtime.messages for insert to authenticated
  with check ((select fivepointfive.is_member()) and (
    (realtime.topic() like 'fivepointfive:c:%' and fivepointfive.in_campaign(nullif(substr(realtime.topic(), 17), '')::uuid))
    or realtime.topic() = 'fivepointfive:u:' || (select auth.uid())::text
    or (realtime.topic() like 'fivepointfive:u:%' and (select fivepointfive.is_admin()))));

grant select, insert, update, delete on fivepointfive.campaigns, fivepointfive.campaign_members to authenticated, service_role;
