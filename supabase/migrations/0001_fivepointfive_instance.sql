-- fivepointfive instance schema
-- One instance = one group. The first person to sign in becomes the admin;
-- everyone else joins with an invite. Members can see everything in the
-- instance and edit their own characters and packs; admins can edit anything.

create schema if not exists fivepointfive;

-- ---------------------------------------------------------------- tables
create table fivepointfive.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  display_name text not null default '',
  created_at timestamptz not null default now()
);

create table fivepointfive.invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  note text not null default '',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false
);

create table fivepointfive.characters (
  id text primary key,
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table fivepointfive.packs (
  id text primary key,
  owner uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  files jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table fivepointfive.log (
  id bigint generated always as identity primary key,
  character_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  entry jsonb not null,
  created_at timestamptz not null default now()
);
create index log_created_at on fivepointfive.log (created_at desc);

create table fivepointfive.settings (
  key text primary key,
  value jsonb not null
);
insert into fivepointfive.settings (key, value) values ('shared_log', 'false'::jsonb), ('instance_name', '"fivepointfive"'::jsonb);

-- --------------------------------------------------------------- helpers
create or replace function fivepointfive.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from fivepointfive.members where user_id = (select auth.uid()));
$$;

create or replace function fivepointfive.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from fivepointfive.members where user_id = (select auth.uid()) and role = 'admin');
$$;

create or replace function fivepointfive.my_role() returns text
language sql stable security definer set search_path = '' as $$
  select role from fivepointfive.members where user_id = (select auth.uid());
$$;

-- First person to sign in on an empty instance becomes its admin.
create or replace function fivepointfive.claim_instance(p_name text default '') returns text
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if exists (select 1 from fivepointfive.members where user_id = (select auth.uid())) then
    return (select role from fivepointfive.members where user_id = (select auth.uid()));
  end if;
  if exists (select 1 from fivepointfive.members) then
    return 'none';
  end if;
  lock table fivepointfive.members in exclusive mode;
  if exists (select 1 from fivepointfive.members) then return 'none'; end if;
  insert into fivepointfive.members (user_id, role, display_name) values ((select auth.uid()), 'admin', coalesce(p_name, ''));
  return 'admin';
end;
$$;

-- Join with an invite token.
create or replace function fivepointfive.accept_invite(p_token text, p_name text default '') returns text
language plpgsql security definer set search_path = '' as $$
declare inv fivepointfive.invites;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if exists (select 1 from fivepointfive.members where user_id = (select auth.uid())) then return 'already'; end if;
  select * into inv from fivepointfive.invites where token = p_token for update;
  if not found or inv.revoked or inv.used_by is not null or inv.expires_at < now() then
    return 'invalid';
  end if;
  update fivepointfive.invites set used_by = (select auth.uid()), used_at = now() where id = inv.id;
  insert into fivepointfive.members (user_id, role, display_name) values ((select auth.uid()), 'member', coalesce(p_name, ''));
  return 'member';
end;
$$;

-- Is the instance set up yet? (callable before joining)
create or replace function fivepointfive.instance_status() returns text
language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from fivepointfive.members) then 'ready' else 'empty' end;
$$;

-- ------------------------------------------------------------------ RLS
alter table fivepointfive.members enable row level security;
alter table fivepointfive.invites enable row level security;
alter table fivepointfive.characters enable row level security;
alter table fivepointfive.packs enable row level security;
alter table fivepointfive.log enable row level security;
alter table fivepointfive.settings enable row level security;

create policy "members see members" on fivepointfive.members for select to authenticated using ((select fivepointfive.is_member()));
create policy "edit own name" on fivepointfive.members for update to authenticated
  using (user_id = (select auth.uid()) or (select fivepointfive.is_admin()))
  with check ((user_id = (select auth.uid()) and role = (select fivepointfive.my_role())) or (select fivepointfive.is_admin()));
create policy "admin removes members" on fivepointfive.members for delete to authenticated using ((select fivepointfive.is_admin()) and user_id <> (select auth.uid()));

create policy "admin manages invites" on fivepointfive.invites for all to authenticated
  using ((select fivepointfive.is_admin())) with check ((select fivepointfive.is_admin()) and created_by = (select auth.uid()));

create policy "members see characters" on fivepointfive.characters for select to authenticated using ((select fivepointfive.is_member()));
create policy "members add characters" on fivepointfive.characters for insert to authenticated with check ((select fivepointfive.is_member()) and owner = (select auth.uid()));
create policy "owner or admin edits characters" on fivepointfive.characters for update to authenticated
  using (owner = (select auth.uid()) or (select fivepointfive.is_admin()))
  with check ((owner = (select auth.uid()) or (select fivepointfive.is_admin())));
create policy "owner or admin deletes characters" on fivepointfive.characters for delete to authenticated using (owner = (select auth.uid()) or (select fivepointfive.is_admin()));

create policy "members see packs" on fivepointfive.packs for select to authenticated using ((select fivepointfive.is_member()));
create policy "members add packs" on fivepointfive.packs for insert to authenticated with check ((select fivepointfive.is_member()) and owner = (select auth.uid()));
create policy "owner or admin edits packs" on fivepointfive.packs for update to authenticated
  using (owner = (select auth.uid()) or (select fivepointfive.is_admin()))
  with check ((owner = (select auth.uid()) or (select fivepointfive.is_admin())));
create policy "owner or admin deletes packs" on fivepointfive.packs for delete to authenticated using (owner = (select auth.uid()) or (select fivepointfive.is_admin()));

create policy "members read log" on fivepointfive.log for select to authenticated using ((select fivepointfive.is_member()));
create policy "members write log" on fivepointfive.log for insert to authenticated with check ((select fivepointfive.is_member()) and user_id = (select auth.uid()));
create policy "admin clears log" on fivepointfive.log for delete to authenticated using ((select fivepointfive.is_admin()));

create policy "members read settings" on fivepointfive.settings for select to authenticated using ((select fivepointfive.is_member()));
create policy "admin edits settings" on fivepointfive.settings for update to authenticated using ((select fivepointfive.is_admin())) with check ((select fivepointfive.is_admin()));

-- ---------------------------------------------------------------- grants
grant usage on schema fivepointfive to authenticated, service_role;
grant select, insert, update, delete on all tables in schema fivepointfive to authenticated, service_role;
grant execute on function fivepointfive.claim_instance(text), fivepointfive.accept_invite(text, text), fivepointfive.instance_status() to authenticated;
revoke execute on function fivepointfive.claim_instance(text), fivepointfive.accept_invite(text, text), fivepointfive.instance_status() from anon, public;
revoke execute on function fivepointfive.is_member(), fivepointfive.is_admin(), fivepointfive.my_role() from anon, public;
grant execute on function fivepointfive.is_member(), fivepointfive.is_admin(), fivepointfive.my_role() to authenticated;

-- live table log
alter publication supabase_realtime add table fivepointfive.log;
