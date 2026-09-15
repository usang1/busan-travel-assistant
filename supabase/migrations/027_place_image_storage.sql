insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-images',
  'place-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads place images" on storage.objects;
create policy "Public reads place images"
on storage.objects for select to public
using (bucket_id = 'place-images');

drop policy if exists "Admins upload place images" on storage.objects;
create policy "Admins upload place images"
on storage.objects for insert to authenticated
with check (bucket_id = 'place-images' and public.is_admin());

drop policy if exists "Admins update place images" on storage.objects;
create policy "Admins update place images"
on storage.objects for update to authenticated
using (bucket_id = 'place-images' and public.is_admin())
with check (bucket_id = 'place-images' and public.is_admin());

drop policy if exists "Admins delete place images" on storage.objects;
create policy "Admins delete place images"
on storage.objects for delete to authenticated
using (bucket_id = 'place-images' and public.is_admin());
