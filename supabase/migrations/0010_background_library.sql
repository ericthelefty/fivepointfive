-- Admin-managed sheet backgrounds.
-- Admins can add images to a shared library that every member can pick for their character sheets. The files sit in
-- the same private bucket as character uploads, under "library/<file>", and are listed in fivepointfive.backgrounds.
-- Admins can also see and remove any character's uploaded image (including files left over from deleted characters),
-- and hide the built-in images from the picker (setting "hidden_backgrounds").

create table if not exists fivepointfive.backgrounds (
  id text primary key,
  name text not null,
  path text not null,
  thumb text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table fivepointfive.backgrounds enable row level security;
grant select, insert, update, delete on fivepointfive.backgrounds to authenticated;

drop policy if exists "members see library backgrounds" on fivepointfive.backgrounds;
drop policy if exists "admin adds library backgrounds" on fivepointfive.backgrounds;
drop policy if exists "admin changes library backgrounds" on fivepointfive.backgrounds;
drop policy if exists "admin removes library backgrounds" on fivepointfive.backgrounds;
create policy "members see library backgrounds" on fivepointfive.backgrounds for select to authenticated
  using ((select fivepointfive.is_member()));
create policy "admin adds library backgrounds" on fivepointfive.backgrounds for insert to authenticated
  with check ((select fivepointfive.is_admin()));
create policy "admin changes library backgrounds" on fivepointfive.backgrounds for update to authenticated
  using ((select fivepointfive.is_admin())) with check ((select fivepointfive.is_admin()));
create policy "admin removes library backgrounds" on fivepointfive.backgrounds for delete to authenticated
  using ((select fivepointfive.is_admin()));

insert into fivepointfive.settings (key, value) values ('hidden_backgrounds', '[]'::jsonb) on conflict (key) do nothing;

-- Character folders never include "library", even if a character were given that id.
drop policy if exists "fivepointfive members see sheet backgrounds" on storage.objects;
drop policy if exists "fivepointfive editors add sheet backgrounds" on storage.objects;
drop policy if exists "fivepointfive editors change sheet backgrounds" on storage.objects;
drop policy if exists "fivepointfive editors remove sheet backgrounds" on storage.objects;
drop policy if exists "fivepointfive members see library backgrounds" on storage.objects;
drop policy if exists "fivepointfive admins manage sheet backgrounds" on storage.objects;

create policy "fivepointfive members see sheet backgrounds" on storage.objects for select to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and (storage.foldername(name))[1] <> 'library'
    and fivepointfive.can_see_character((storage.foldername(name))[1]));
create policy "fivepointfive editors add sheet backgrounds" on storage.objects for insert to authenticated
  with check (bucket_id = 'fivepointfive-backgrounds' and (storage.foldername(name))[1] <> 'library'
    and fivepointfive.can_edit_character((storage.foldername(name))[1]));
create policy "fivepointfive editors change sheet backgrounds" on storage.objects for update to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and (storage.foldername(name))[1] <> 'library'
    and fivepointfive.can_edit_character((storage.foldername(name))[1]))
  with check (bucket_id = 'fivepointfive-backgrounds' and (storage.foldername(name))[1] <> 'library'
    and fivepointfive.can_edit_character((storage.foldername(name))[1]));
create policy "fivepointfive editors remove sheet backgrounds" on storage.objects for delete to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and (storage.foldername(name))[1] <> 'library'
    and fivepointfive.can_edit_character((storage.foldername(name))[1]));

-- every member can see the library
create policy "fivepointfive members see library backgrounds" on storage.objects for select to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and (storage.foldername(name))[1] = 'library' and (select fivepointfive.is_member()));
-- admins can do anything in the bucket: add to the library, and see or remove any image
create policy "fivepointfive admins manage sheet backgrounds" on storage.objects for all to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and (select fivepointfive.is_admin()))
  with check (bucket_id = 'fivepointfive-backgrounds' and (select fivepointfive.is_admin()));
