-- Text on map tokens.
-- The GM can put a line of text on a token ("Blessed", "Leader", "Prone"). Players see it, unless the GM marks it
-- GM only ("noteGm" on the token), in which case encounter_map() leaves the text out of what players receive.
-- Safe to run more than once.

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
    'tokens', coalesce((select jsonb_agg(case when gm or not coalesce((t ->> 'noteGm')::boolean, false) then t else t - 'note' - 'noteGm' end)
      from jsonb_array_elements(em.tokens) t where gm or fivepointfive.token_seen(t, em.fog)), '[]'::jsonb),
    'fog', em.fog, 'turn', em.turn, 'round', em.round, 'updated', em.updated_at,
    -- the characters this member plays, so the page knows which tokens they can move
    'mine', coalesce((select jsonb_agg(c.id) from fivepointfive.characters c where c.owner = (select auth.uid())), '[]'::jsonb));
end;
$$;

revoke execute on function fivepointfive.encounter_map(text) from anon, public;
grant execute on function fivepointfive.encounter_map(text) to authenticated;
