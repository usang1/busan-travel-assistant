drop policy if exists "Public can read active place sources" on public.place_sources;
create policy "Public can read active place sources"
on public.place_sources for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_sources.place_id
      and places.is_active = true
      and places.status in ('PUBLISHED', 'ACTIVE')
  )
);

notify pgrst, 'reload schema';
