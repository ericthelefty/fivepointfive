-- Players label their own tokens.
-- A player can put a line of text on their own character's token on a map the GM is showing (the GM can label any
-- token, and keep a label to themselves; see 0015_token_notes.sql). A player's label is always seen by everyone.
-- Safe to run more than once.

create or replace function fivepointfive.set_token_note(eid text, tuid text, p_note text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  em fivepointfive.encounter_maps;
  cid uuid := fivepointfive.encounter_campaign(eid);
  idx int;
  tok jsonb;
  n text := left(btrim(coalesce(p_note, '')), 40);
begin
  select * into em from fivepointfive.encounter_maps where encounter_id = eid for update;
  if not found or not fivepointfive.in_campaign(cid) then return false; end if;
  select i - 1, t into idx, tok from jsonb_array_elements(em.tokens) with ordinality as a(t, i) where t ->> 'uid' = tuid;
  if idx is null then return false; end if;
  if not fivepointfive.gm_of(cid) then
    if not em.shown or tok ->> 'kind' <> 'pc'
       or not exists (select 1 from fivepointfive.characters c where c.id = tok ->> 'char' and c.owner = (select auth.uid())) then
      return false;
    end if;
  end if;
  tok := tok - 'noteGm';
  tok := case when n = '' then tok - 'note' else jsonb_set(tok, '{note}', to_jsonb(n)) end;
  update fivepointfive.encounter_maps set tokens = jsonb_set(tokens, array[idx::text], tok), updated_at = now() where encounter_id = eid;
  return true;
end;
$$;
revoke execute on function fivepointfive.set_token_note(text, text, text) from anon, public;
grant execute on function fivepointfive.set_token_note(text, text, text) to authenticated;
