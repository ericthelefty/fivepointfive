-- Coins and hidden finds in loot.
-- The GM gives each monster coins and hidden tiers ("a roll of 15 finds 10 GP, 20 also finds a ring"). When the loot
-- goes out, the coins the fallen carried go into a shared pot; the hidden tiers go into loot_hidden, which only the GM
-- can read. A player searches a body (an Investigation or Perception check rolled on their sheet) and the database
-- hands them what their roll uncovers, once: a find can't be found twice. The finder keeps each find or shares it:
-- a shared item joins the loot list, shared coins join the pot. When the loot closes (every item settled and every
-- find decided, or the GM closes it) the pot is split evenly between the characters in the fight.

alter table fivepointfive.loot add column if not exists bodies jsonb not null default '[]'::jsonb;  -- [{id, name, status, check}]
alter table fivepointfive.loot add column if not exists coins jsonb not null default '{}'::jsonb;   -- coins the fallen carried
alter table fivepointfive.loot add column if not exists shared_coins jsonb not null default '{}'::jsonb; -- coins finders shared
alter table fivepointfive.loot_items add column if not exists found_by text;

create table if not exists fivepointfive.loot_hidden (
  loot_id text not null references fivepointfive.loot(id) on delete cascade,
  body_id text not null,
  tiers jsonb not null default '[]'::jsonb, -- [{dc, finds: [{kind: 'coins', coins} | {kind: 'item', line}]}]
  primary key (loot_id, body_id)
);

create table if not exists fivepointfive.loot_searches (
  id text primary key,
  loot_id text not null references fivepointfive.loot(id) on delete cascade,
  body_id text not null,
  character_id text not null,
  total int not null,
  detail text,
  finds jsonb not null default '[]'::jsonb, -- [{key, kind, coins?, line?, choice: null|'keep'|'share', taken}]
  created_at timestamptz not null default now(),
  unique (loot_id, body_id, character_id)
);

create table if not exists fivepointfive.loot_payouts (
  loot_id text not null references fivepointfive.loot(id) on delete cascade,
  character_id text not null,
  coins jsonb not null,
  delivered boolean not null default false,
  primary key (loot_id, character_id)
);

alter table fivepointfive.loot_hidden enable row level security;
alter table fivepointfive.loot_searches enable row level security;
alter table fivepointfive.loot_payouts enable row level security;

drop policy if exists "only the GM sees hidden loot" on fivepointfive.loot_hidden;
create policy "only the GM sees hidden loot" on fivepointfive.loot_hidden for all to authenticated
  using ((select fivepointfive.is_admin())) with check ((select fivepointfive.is_admin()));
drop policy if exists "members see searches" on fivepointfive.loot_searches;
create policy "members see searches" on fivepointfive.loot_searches for select to authenticated using ((select fivepointfive.is_member()));
drop policy if exists "the GM clears searches" on fivepointfive.loot_searches;
create policy "the GM clears searches" on fivepointfive.loot_searches for delete to authenticated using ((select fivepointfive.is_admin()));
drop policy if exists "members see payouts" on fivepointfive.loot_payouts;
create policy "members see payouts" on fivepointfive.loot_payouts for select to authenticated using ((select fivepointfive.is_member()));

grant select, insert, update, delete on fivepointfive.loot_hidden, fivepointfive.loot_searches, fivepointfive.loot_payouts to authenticated, service_role;

-- coins as copper pieces, and back
create or replace function fivepointfive.coins_cp(c jsonb) returns bigint
language sql immutable set search_path = '' as $$
  select coalesce((c->>'cp')::bigint, 0) + 10 * coalesce((c->>'sp')::bigint, 0) + 50 * coalesce((c->>'ep')::bigint, 0)
       + 100 * coalesce((c->>'gp')::bigint, 0) + 1000 * coalesce((c->>'pp')::bigint, 0);
$$;
create or replace function fivepointfive.cp_coins(n bigint) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('cp', n % 10, 'sp', (n / 10) % 10, 'ep', 0, 'gp', n / 100, 'pp', 0);
$$;
create or replace function fivepointfive.add_coins(a jsonb, b jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'cp', coalesce((a->>'cp')::bigint, 0) + coalesce((b->>'cp')::bigint, 0),
    'sp', coalesce((a->>'sp')::bigint, 0) + coalesce((b->>'sp')::bigint, 0),
    'ep', coalesce((a->>'ep')::bigint, 0) + coalesce((b->>'ep')::bigint, 0),
    'gp', coalesce((a->>'gp')::bigint, 0) + coalesce((b->>'gp')::bigint, 0),
    'pp', coalesce((a->>'pp')::bigint, 0) + coalesce((b->>'pp')::bigint, 0));
$$;

-- close the loot: settle what's open, undecided finds stay with their finder, split the coin pot
create or replace function fivepointfive.finish_loot(lid text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  lt fivepointfive.loot;
  i record;
  total bigint;
  n int;
  each_cp bigint;
  rem int;
  lucky text[];
  p text;
begin
  update fivepointfive.loot set status = 'closed', closed_at = now() where id = lid and status = 'open' returning * into lt;
  if not found then return; end if;
  for i in select id from fivepointfive.loot_items where loot_id = lid and status = 'open' order by seq loop
    perform fivepointfive.settle_loot_item(i.id);
  end loop;
  update fivepointfive.loot_searches s set finds = (
    select coalesce(jsonb_agg(case when f->>'choice' is null or f->>'choice' = 'null' then f || '{"choice":"keep"}'::jsonb else f end), '[]'::jsonb)
    from jsonb_array_elements(s.finds) f)
  where s.loot_id = lid;
  total := fivepointfive.coins_cp(lt.coins) + fivepointfive.coins_cp(lt.shared_coins);
  n := jsonb_array_length(lt.players);
  if total <= 0 or n = 0 then return; end if;
  each_cp := total / n;
  rem := (total - each_cp * n)::int;
  -- a copper or two that won't split evenly goes to random players, one each
  select array_agg(x) into lucky from (select x from jsonb_array_elements_text(lt.players) x order by random() limit rem) r;
  for p in select jsonb_array_elements_text(lt.players) loop
    insert into fivepointfive.loot_payouts (loot_id, character_id, coins)
    values (lid, p, fivepointfive.cp_coins(each_cp + case when lucky is not null and p = any(lucky) then 1 else 0 end))
    on conflict do nothing;
  end loop;
end;
$$;
revoke execute on function fivepointfive.finish_loot(text) from anon, public, authenticated;

-- the loot closes by itself once every item is settled and every find decided
create or replace function fivepointfive.maybe_finish_loot(lid text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from fivepointfive.loot where id = lid and status = 'open')
     and exists (select 1 from fivepointfive.loot_items where loot_id = lid)
     and not exists (select 1 from fivepointfive.loot_items where loot_id = lid and status = 'open')
     and not exists (select 1 from fivepointfive.loot_searches s, jsonb_array_elements(s.finds) f
                     where s.loot_id = lid and (f->>'choice' is null or f->>'choice' = 'null')) then
    perform fivepointfive.finish_loot(lid);
  end if;
end;
$$;
revoke execute on function fivepointfive.maybe_finish_loot(text) from anon, public, authenticated;

create or replace function fivepointfive.loot_choice_made() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform fivepointfive.settle_loot_item(new.item_id);
  perform fivepointfive.maybe_finish_loot(new.loot_id);
  return new;
end;
$$;

create or replace function fivepointfive.close_loot(lid text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not fivepointfive.is_admin() then raise exception 'Only the GM can close the loot'; end if;
  perform fivepointfive.finish_loot(lid);
end;
$$;

-- a character searches a body: what their roll uncovers that nobody has found yet
create or replace function fivepointfive.search_body(lid text, bid text, cid text, total int, detail text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_keys text[];
  out jsonb := '[]'::jsonb;
  t record;
  f record;
  k text;
begin
  if not fivepointfive.can_choose_loot(lid, cid) then raise exception 'This character can’t search this loot'; end if;
  if not exists (select 1 from fivepointfive.loot l, jsonb_array_elements(l.bodies) b where l.id = lid and b->>'id' = bid) then
    raise exception 'No such body';
  end if;
  if exists (select 1 from fivepointfive.loot_searches where loot_id = lid and body_id = bid and character_id = cid) then
    raise exception 'Already searched';
  end if;
  perform 1 from fivepointfive.loot where id = lid for update; -- one search at a time, so a find goes to one finder
  select coalesce(array_agg(x->>'key'), '{}') into found_keys
    from fivepointfive.loot_searches s, jsonb_array_elements(s.finds) x where s.loot_id = lid and s.body_id = bid;
  for t in select h.value as tier, h.ordinality as ti from fivepointfive.loot_hidden lh, jsonb_array_elements(lh.tiers) with ordinality h
           where lh.loot_id = lid and lh.body_id = bid loop
    if coalesce((t.tier->>'dc')::int, 0) > total then continue; end if;
    for f in select x.value as find, x.ordinality as fi from jsonb_array_elements(t.tier->'finds') with ordinality x loop
      k := 't' || t.ti || 'f' || f.fi;
      if k = any(found_keys) then continue; end if;
      out := out || jsonb_build_array(f.find || jsonb_build_object('key', k, 'choice', null, 'taken', false));
    end loop;
  end loop;
  insert into fivepointfive.loot_searches (id, loot_id, body_id, character_id, total, detail, finds)
  values (lid || '-s-' || bid || '-' || cid, lid, bid, cid, total, detail, out);
  return out;
end;
$$;
revoke execute on function fivepointfive.search_body(text, text, text, int, text) from anon, public;
grant execute on function fivepointfive.search_body(text, text, text, int, text) to authenticated;

-- the finder keeps a find or shares it with the party
create or replace function fivepointfive.decide_find(sid text, k text, pick text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s fivepointfive.loot_searches;
  f jsonb;
  nseq int;
begin
  if pick not in ('keep', 'share') then raise exception 'Keep or share'; end if;
  select * into s from fivepointfive.loot_searches where id = sid for update;
  if not found or not fivepointfive.can_edit_character(s.character_id) then raise exception 'Not your find'; end if;
  if not exists (select 1 from fivepointfive.loot where id = s.loot_id and status = 'open') then raise exception 'The loot is closed'; end if;
  select x into f from jsonb_array_elements(s.finds) x where x->>'key' = k;
  if f is null or (f->>'choice' is not null and f->>'choice' <> 'null') then return; end if;
  update fivepointfive.loot_searches set finds = (
    select jsonb_agg(case when x->>'key' = k then x || jsonb_build_object('choice', pick) else x end) from jsonb_array_elements(finds) x)
  where id = sid;
  if pick = 'share' then
    if f->>'kind' = 'coins' then
      update fivepointfive.loot set shared_coins = fivepointfive.add_coins(shared_coins, f->'coins') where id = s.loot_id;
    else
      select coalesce(max(seq), -1) + 1 into nseq from fivepointfive.loot_items where loot_id = s.loot_id;
      insert into fivepointfive.loot_items (id, loot_id, seq, item, found_by)
      values (sid || '-' || k, s.loot_id, nseq, f->'line', s.character_id);
    end if;
  end if;
  perform fivepointfive.maybe_finish_loot(s.loot_id);
end;
$$;
revoke execute on function fivepointfive.decide_find(text, text, text) from anon, public;
grant execute on function fivepointfive.decide_find(text, text, text) to authenticated;

-- hand a kept find over once (true for the one screen that adds it to the finder's sheet)
create or replace function fivepointfive.take_find(sid text, k text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare ok boolean := false;
begin
  update fivepointfive.loot_searches set finds = (
    select jsonb_agg(case when x->>'key' = k then x || '{"taken":true}'::jsonb else x end) from jsonb_array_elements(finds) x)
  where id = sid and fivepointfive.can_edit_character(character_id)
    and exists (select 1 from jsonb_array_elements(finds) x where x->>'key' = k and x->>'choice' = 'keep' and not coalesce((x->>'taken')::boolean, false))
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke execute on function fivepointfive.take_find(text, text) from anon, public;
grant execute on function fivepointfive.take_find(text, text) to authenticated;

-- hand a share of the coins over once
create or replace function fivepointfive.take_payout(lid text, cid text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare ok boolean;
begin
  update fivepointfive.loot_payouts set delivered = true
  where loot_id = lid and character_id = cid and not delivered and fivepointfive.can_edit_character(cid)
  returning true into ok;
  return coalesce(ok, false);
end;
$$;
revoke execute on function fivepointfive.take_payout(text, text) from anon, public;
grant execute on function fivepointfive.take_payout(text, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['loot_searches', 'loot_payouts'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'fivepointfive' and tablename = t) then
      execute format('alter publication supabase_realtime add table fivepointfive.%I', t);
    end if;
  end loop;
end $$;
