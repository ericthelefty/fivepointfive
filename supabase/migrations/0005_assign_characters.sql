-- Assign a character to a player: an admin can give any character to another member of the instance (for example
-- a sheet imported on a player's behalf), who then owns it as if they had made it. Owners still can't give their
-- characters away, and a character can only go to someone who is a member. Safe to run on an instance with data.

drop policy if exists "owner or admin edits characters" on fivepointfive.characters;
create policy "owner or admin edits characters" on fivepointfive.characters for update to authenticated
  using (owner = (select auth.uid()) or (select fivepointfive.is_admin()))
  with check (
    owner = (select auth.uid())
    or ((select fivepointfive.is_admin()) and exists (select 1 from fivepointfive.members m where m.user_id = characters.owner))
  );
