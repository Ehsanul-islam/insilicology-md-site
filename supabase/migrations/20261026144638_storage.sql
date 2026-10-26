-- Storage buckets and policies.
--   record-files : private. Files live under <owner id>/<record id>/ and are only visible to the owner
--                  and administrators. Public downloads are served by the app with short-lived signed URLs,
--                  after it checks the file belongs to a published snapshot.
--   blog-images  : public read. Writes only under the author's own folder.
-- Supabase's project-wide upload limit also applies (50 MB on the free plan); raise it in
-- Project Settings > Storage if you accept trajectory files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('record-files', 'record-files', false, 524288000, null),
  ('blog-images', 'blog-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The record folder in the path must be a record the caller may edit.
create or replace function public.can_write_record_path(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when (storage.foldername(object_name))[1] is null or (storage.foldername(object_name))[2] is null then false
    when (storage.foldername(object_name))[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then false
    when public.is_admin() then true
    else (storage.foldername(object_name))[1] = auth.uid()::text
         and public.can_edit_record(((storage.foldername(object_name))[2])::uuid)
  end
$$;

create policy record_files_select on storage.objects for select to authenticated
  using (bucket_id = 'record-files' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy record_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'record-files' and public.can_write_record_path(name));
create policy record_files_update on storage.objects for update to authenticated
  using (bucket_id = 'record-files' and public.can_write_record_path(name))
  with check (bucket_id = 'record-files' and public.can_write_record_path(name));
create policy record_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'record-files' and public.can_write_record_path(name));

create policy blog_images_select on storage.objects for select to anon, authenticated
  using (bucket_id = 'blog-images');
create policy blog_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'blog-images' and public.is_active()
              and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy blog_images_update on storage.objects for update to authenticated
  using (bucket_id = 'blog-images' and public.is_active() and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()))
  with check (bucket_id = 'blog-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy blog_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'blog-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
