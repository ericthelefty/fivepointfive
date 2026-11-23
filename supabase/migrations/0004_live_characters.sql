-- Live characters: changes to a character reach every open sheet and the DM's encounter tracker within a second or
-- two (Supabase Realtime), instead of after a reload. Row-level security still applies: people only receive changes
-- to characters they can see. Safe to run on an instance that already has data.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'fivepointfive' and tablename = 'characters'
  ) then
    alter publication supabase_realtime add table fivepointfive.characters;
  end if;
end $$;
