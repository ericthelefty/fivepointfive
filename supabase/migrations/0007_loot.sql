-- Loot after an encounter. The GM reviews the gear the defeated monsters carried and sends it; every player with a
-- character in the fight then marks each item "I want it" or "Leave". When everyone has answered an item (or the
-- GM closes the loot), it goes to its only taker, or the takers roll a d20 for it. The roll happens here in the
-- database, so every screen sees the same result. Safe to run on an instance that already has data.

create table if not exists fivepointfive.loot (
  id text primary key,
  encounter_id text,
  name text not null default '',
  status text not null default 'open' check (status in ('open', 'closed')),
  -- the characters in the fight: who gets to choose
  players jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists fivepointfive.loot_items (
  id text primary key,
  loot_id text not null references fivepointfive.loot (id) on delete cascade,
  seq int not null default 0,
  -- what the players see and what the winner gets: name, detail, value, weight, source and the inventory item
  item jsonb not null,
  status text not null default 'open' check (status in ('open', 'won', 'left')),
  winner text,
  -- a contested roll: each round of d20s, until one taker is highest
  rolls jsonb,
  delivered boolean not null default false,
  settled_at timestamptz
);
create index if not exists loot_items_loot on fivepointfive.loot_items (loot_id, seq);

create table if not exists fivepointfive.loot_choices (
  item_id text not null references fivepointfive.loot_items (id) on delete cascade,
  character_id text not null,
  loot_id text not null references fivepointfive.loot (id) on delete cascade,
  choice text not null check (choice in ('want', 'leave')),
  at timestamptz not null default now(),
  primary key (item_id, character_id)
);
create index if not exists loot_choices_loot on fivepointfive.loot_choices (loot_id);

-- may this person choose for this character on this loot? (they can edit the character, it's in the fight, the loot is open)
create or replace function fivepointfive.can_choose_loot(lid text, cid text) returns boolean
language sql stable security definer set search_path = '' as $$
  select fivepointfive.can_edit_character(cid) and exists (
    select 1 from fivepointfive.loot l where l.id = lid and l.status = 'open' and l.players ? cid);
$$;
revoke execute on function fivepointfive.can_choose_loot(text, text) from anon, public;
grant execute on function fivepointfive.can_choose_loot(text, text) to authenticated;

alter table fivepointfive.loot enable row level security;
alter table fivepointfive.loot_items enable row level security;
alter table fivepointfive.loot_choices enable row level security;

drop policy if exists "members see loot" on fivepointfive.loot;
create policy "members see loot" on fivepointfive.loot for select to authenticated using ((select fivepointfive.is_member()));
drop policy if exists "the GM hands out loot" on fivepointfive.loot;
create policy "the GM hands out loot" on fivepointfive.loot for all to authenticated
  using ((select fivepointfive.is_admin())) with check ((select fivepointfive.is_admin()));

drop policy if exists "members see loot items" on fivepointfive.loot_items;
create policy "members see loot items" on fivepointfive.loot_items for select to authenticated using ((select fivepointfive.is_member()));
drop policy if exists "the GM lists loot items" on fivepointfive.loot_items;
create policy "the GM lists loot items" on fivepointfive.loot_items for insert to authenticated with check ((select fivepointfive.is_admin()));
drop policy if exists "the GM removes loot items" on fivepointfive.loot_items;
create policy "the GM removes loot items" on fivepointfive.loot_items for delete to authenticated using ((select fivepointfive.is_admin()));

drop policy if exists "members see loot choices" on fivepointfive.loot_choices;
create policy "members see loot choices" on fivepointfive.loot_choices for select to authenticated using ((select fivepointfive.is_member()));
drop policy if exists "players choose loot" on fivepointfive.loot_choices;
create policy "players choose loot" on fivepointfive.loot_choices for insert to authenticated
  with check (fivepointfive.can_choose_loot(loot_id, character_id));
drop policy if exists "players change their loot choices" on fivepointfive.loot_choices;
create policy "players change their loot choices" on fivepointfive.loot_choices for update to authenticated
  using (fivepointfive.can_choose_loot(loot_id, character_id)) with check (fivepointfive.can_choose_loot(loot_id, character_id));

grant select, insert, update, delete on fivepointfive.loot, fivepointfive.loot_items, fivepointfive.loot_choices to authenticated, service_role;

-- settle one item if it's ready: everyone has answered it, or the loot is closed
create or replace function fivepointfive.settle_loot_item(iid text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  it fivepointfive.loot_items;
  lt fivepointfive.loot;
  takers text[];
  rounds jsonb := '[]'::jsonb;
  this_round jsonb;
  top int;
  r int;
  t text;
  still text[];
begin
  select * into it from fivepointfive.loot_items where id = iid for update;
  if not found or it.status <> 'open' then return; end if;
  select * into lt from fivepointfive.loot where id = it.loot_id;
  if lt.status = 'open' and exists (
    select 1 from jsonb_array_elements_text(lt.players) p(cid)
    where not exists (select 1 from fivepointfive.loot_choices c where c.item_id = iid and c.character_id = p.cid)
  ) then return; end if;
  select array_agg(c.character_id order by c.at) into takers from fivepointfive.loot_choices c where c.item_id = iid and c.choice = 'want';
  if takers is null then
    update fivepointfive.loot_items set status = 'left', settled_at = now() where id = iid;
    return;
  end if;
  if array_length(takers, 1) = 1 then
    update fivepointfive.loot_items set status = 'won', winner = takers[1], settled_at = now() where id = iid;
    return;
  end if;
  -- a contested roll: everyone who wants it rolls a d20; ties for the highest roll again
  still := takers;
  loop
    this_round := '{}'::jsonb;
    top := 0;
    foreach t in array still loop
      r := 1 + floor(random() * 20)::int;
      this_round := this_round || jsonb_build_object(t, r);
      top := greatest(top, r);
    end loop;
    rounds := rounds || jsonb_build_array(this_round);
    select array_agg(k) into still from jsonb_each_text(this_round) e(k, v) where v::int = top;
    exit when array_length(still, 1) = 1;
  end loop;
  update fivepointfive.loot_items set status = 'won', winner = still[1], rolls = rounds, settled_at = now() where id = iid;
end;
$$;
revoke execute on function fivepointfive.settle_loot_item(text) from anon, public, authenticated;

create or replace function fivepointfive.loot_choice_made() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform fivepointfive.settle_loot_item(new.item_id);
  return new;
end;
$$;
drop trigger if exists loot_choice_settles on fivepointfive.loot_choices;
create trigger loot_choice_settles after insert or update on fivepointfive.loot_choices
  for each row execute function fivepointfive.loot_choice_made();

-- the GM closes the loot: whatever is still open settles with the answers given (no answer counts as Leave)
create or replace function fivepointfive.close_loot(lid text) returns void
language plpgsql security definer set search_path = '' as $$
declare i record;
begin
  if not fivepointfive.is_admin() then raise exception 'Only the GM can close the loot'; end if;
  update fivepointfive.loot set status = 'closed', closed_at = now() where id = lid and status = 'open';
  for i in select id from fivepointfive.loot_items where loot_id = lid and status = 'open' order by seq loop
    perform fivepointfive.settle_loot_item(i.id);
  end loop;
end;
$$;
revoke execute on function fivepointfive.close_loot(text) from anon, public;
grant execute on function fivepointfive.close_loot(text) to authenticated;

-- hand a won item over once: true for the one screen that gets to add it to the winner's Inventory
create or replace function fivepointfive.take_delivery(iid text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  update fivepointfive.loot_items set delivered = true
  where id = iid and status = 'won' and not delivered and fivepointfive.can_edit_character(winner)
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke execute on function fivepointfive.take_delivery(text) from anon, public;
grant execute on function fivepointfive.take_delivery(text) to authenticated;

-- open screens hear about loot as it changes
do $$
declare t text;
begin
  foreach t in array array['loot', 'loot_items', 'loot_choices'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'fivepointfive' and tablename = t) then
      execute format('alter publication supabase_realtime add table fivepointfive.%I', t);
    end if;
  end loop;
end $$;
