-- Custom sheet backgrounds.
-- Each character can have one uploaded background image, stored in a private Storage bucket at
-- "<character id>/<file>". The browser shrinks the image and converts it to WebP before uploading, so files stay small.
-- Whoever can see a character can see its image; whoever can edit the character (its owner or an admin) can upload,
-- replace or remove it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fivepointfive-backgrounds', 'fivepointfive-backgrounds', false, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fivepointfive members see sheet backgrounds" on storage.objects;
drop policy if exists "fivepointfive editors add sheet backgrounds" on storage.objects;
drop policy if exists "fivepointfive editors change sheet backgrounds" on storage.objects;
drop policy if exists "fivepointfive editors remove sheet backgrounds" on storage.objects;

create policy "fivepointfive members see sheet backgrounds" on storage.objects for select to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and fivepointfive.can_see_character((storage.foldername(name))[1]));
create policy "fivepointfive editors add sheet backgrounds" on storage.objects for insert to authenticated
  with check (bucket_id = 'fivepointfive-backgrounds' and fivepointfive.can_edit_character((storage.foldername(name))[1]));
create policy "fivepointfive editors change sheet backgrounds" on storage.objects for update to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and fivepointfive.can_edit_character((storage.foldername(name))[1]))
  with check (bucket_id = 'fivepointfive-backgrounds' and fivepointfive.can_edit_character((storage.foldername(name))[1]));
create policy "fivepointfive editors remove sheet backgrounds" on storage.objects for delete to authenticated
  using (bucket_id = 'fivepointfive-backgrounds' and fivepointfive.can_edit_character((storage.foldername(name))[1]));
