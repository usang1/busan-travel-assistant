create index if not exists places_public_slug_idx
on public.places(slug)
where is_active = true and status in ('PUBLISHED', 'ACTIVE');

create index if not exists places_public_featured_updated_idx
on public.places(is_featured desc, updated_at desc, id)
where is_active = true and status in ('PUBLISHED', 'ACTIVE');

create index if not exists places_public_coordinates_idx
on public.places(latitude, longitude)
where is_active = true
  and status in ('PUBLISHED', 'ACTIVE')
  and latitude is not null
  and longitude is not null;

create index if not exists guides_public_status_sort_idx
on public.guides(status, is_featured desc, sort_order, id)
where status = 'PUBLISHED';

notify pgrst, 'reload schema';
