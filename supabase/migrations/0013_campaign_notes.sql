-- A campaign's description and GM notes, like a campaign page: the description and the public notes are read by everyone
-- in the campaign; the private notes only by its GM (and admins). The campaign's GM (or an admin) writes all three.

alter table fivepointfive.campaigns add column if not exists description text not null default '';
alter table fivepointfive.campaigns add column if not exists public_notes text not null default '';

create table if not exists fivepointfive.campaign_private_notes (
  campaign_id uuid primary key references fivepointfive.campaigns (id) on delete cascade,
  notes text not null default '',
  updated_at timestamptz not null default now()
);
alter table fivepointfive.campaign_private_notes enable row level security;
drop policy if exists "only the GM keeps private notes" on fivepointfive.campaign_private_notes;
create policy "only the GM keeps private notes" on fivepointfive.campaign_private_notes for all to authenticated
  using (fivepointfive.gm_of(campaign_id)) with check (fivepointfive.gm_of(campaign_id));
grant select, insert, update, delete on fivepointfive.campaign_private_notes to authenticated, service_role;

-- the campaign's GM writes its description and public notes (renaming and the rest stay with the admin)
create or replace function fivepointfive.set_campaign_notes(cid uuid, p_description text, p_public_notes text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not fivepointfive.gm_of(cid) then raise exception 'Only the campaign’s GM can change its description and notes'; end if;
  update fivepointfive.campaigns set description = coalesce(p_description, description), public_notes = coalesce(p_public_notes, public_notes) where id = cid;
end;
$$;
revoke execute on function fivepointfive.set_campaign_notes(uuid, text, text) from anon, public;
grant execute on function fivepointfive.set_campaign_notes(uuid, text, text) to authenticated;
