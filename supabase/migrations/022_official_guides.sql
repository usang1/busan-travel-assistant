-- Official editorial content is intentionally separate from trips/trip_places.
create table public.guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 100),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  guide_type text not null check (guide_type in ('AREA','FOOD','SITUATION','ITINERARY','PRACTICAL')),
  title_ko text not null default '' check (length(title_ko) <= 200),
  description_ko text not null default '' check (length(description_ko) <= 4000),
  title_zh text not null default '' check (length(title_zh) <= 200),
  description_zh text not null default '' check (length(description_zh) <= 4000),
  title_en text not null default '' check (length(title_en) <= 200),
  description_en text not null default '' check (length(description_en) <= 4000),
  title_ja text not null default '' check (length(title_ja) <= 200),
  description_ja text not null default '' check (length(description_ja) <= 4000),
  cover_image text not null default '' check (cover_image = '' or cover_image ~ '^https://'),
  area text not null default '' check (length(area) <= 100),
  estimated_duration integer check (estimated_duration between 0 and 43200),
  recommended_for jsonb not null default '{}' check (jsonb_typeof(recommended_for) = 'object'),
  weather_type text not null default 'ANY' check (weather_type in ('ANY','SUNNY','RAINY','INDOOR')),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_featured boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guides_published_translations check (status <> 'PUBLISHED' or (
    length(trim(title_ko)) > 0 and length(trim(description_ko)) > 0 and
    length(trim(title_zh)) > 0 and length(trim(description_zh)) > 0 and
    length(trim(title_en)) > 0 and length(trim(description_en)) > 0 and
    length(trim(title_ja)) > 0 and length(trim(description_ja)) > 0
  ))
);
create table public.guide_places (
  guide_id uuid not null references public.guides(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  sequence integer not null check (sequence between 0 and 79),
  custom_title jsonb not null default '{}' check (jsonb_typeof(custom_title) = 'object'),
  custom_description jsonb not null default '{}' check (jsonb_typeof(custom_description) = 'object'),
  stay_minutes integer check (stay_minutes between 0 and 10080),
  transportation_note jsonb not null default '{}' check (jsonb_typeof(transportation_note) = 'object'),
  tip jsonb not null default '{}' check (jsonb_typeof(tip) = 'object'),
  primary key (guide_id, place_id),
  unique (guide_id, sequence) deferrable initially deferred
);
create table public.guide_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  guide_id uuid not null references public.guides(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, guide_id)
);
create index guides_discovery_idx on public.guides(status, is_featured desc, sort_order, published_at desc);
create index guide_places_place_idx on public.guide_places(place_id);
create index guide_saves_guide_idx on public.guide_saves(guide_id);
alter table public.guides enable row level security;
alter table public.guide_places enable row level security;
alter table public.guide_saves enable row level security;

create policy "Public reads published guides" on public.guides for select to anon, authenticated
using (status = 'PUBLISHED');
create policy "Admins manage official guides" on public.guides for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Public reads published guide stops" on public.guide_places for select to anon, authenticated
using (
  exists (select 1 from public.guides g where g.id = guide_id and g.status = 'PUBLISHED')
  and exists (select 1 from public.places p where p.id = place_id and p.is_active and p.status in ('PUBLISHED','ACTIVE'))
);
create policy "Admins manage official guide stops" on public.guide_places for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Users read own guide saves" on public.guide_saves for select to authenticated
using (user_id = auth.uid());
create policy "Users save published guides" on public.guide_saves for insert to authenticated
with check (user_id = auth.uid() and exists (
  select 1 from public.guides g where g.id = guide_id and g.status = 'PUBLISHED'
));
create policy "Users remove own guide saves" on public.guide_saves for delete to authenticated
using (user_id = auth.uid());
grant select on public.guides, public.guide_places to anon;
grant select, insert, update, delete on public.guides, public.guide_places to authenticated;
grant select, insert, delete on public.guide_saves to authenticated;

create function public.stamp_official_guide() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  if new.status = 'PUBLISHED' then
    new.published_at := coalesce(new.published_at, now());
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;
create trigger stamp_official_guide before insert or update on public.guides
for each row execute function public.stamp_official_guide();

-- One invoker transaction: a stop failure rolls back the guide too.
-- The caller's JWT and RLS are retained; no service-role bypass.
create function public.save_official_guide(
  target_id uuid, payload jsonb, expected_updated_at timestamptz default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  draft public.guides;
  saved_id uuid;
  previous_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(payload->'places') is distinct from 'array'
     or jsonb_array_length(payload->'places') > 80 then
    raise exception 'Invalid stops' using errcode = '22023';
  end if;
  draft := jsonb_populate_record(null::public.guides, payload);
  if draft.status = 'PUBLISHED' and exists (
    select 1 from jsonb_array_elements(payload->'places') item
    where not exists (select 1 from public.places p where p.id = (item->>'place_id')::uuid
      and p.is_active and p.status in ('PUBLISHED','ACTIVE'))
  ) then
    raise exception 'Only published places can be included in published guides' using errcode = '22023';
  end if;
  if target_id is null then
    insert into public.guides (slug, status, guide_type, title_ko, title_zh, title_en, title_ja, description_ko, description_zh, description_en, description_ja, cover_image, area, estimated_duration, recommended_for, weather_type, sort_order, is_featured)
    values (draft.slug, draft.status, draft.guide_type, draft.title_ko, draft.title_zh, draft.title_en, draft.title_ja, draft.description_ko, draft.description_zh, draft.description_en, draft.description_ja, draft.cover_image, draft.area, draft.estimated_duration, draft.recommended_for, draft.weather_type, draft.sort_order, draft.is_featured) returning id into saved_id;
  else
    select updated_at into previous_updated_at from public.guides where id = target_id for update;
    if not found then raise exception 'Guide not found' using errcode = 'P0002'; end if;
    if expected_updated_at is null or previous_updated_at <> expected_updated_at then
      raise exception 'Guide changed; reload before saving' using errcode = '40001';
    end if;
    update public.guides set slug = draft.slug, status = draft.status, guide_type = draft.guide_type, title_ko = draft.title_ko, title_zh = draft.title_zh, title_en = draft.title_en, title_ja = draft.title_ja, description_ko = draft.description_ko, description_zh = draft.description_zh, description_en = draft.description_en, description_ja = draft.description_ja, cover_image = draft.cover_image, area = draft.area, estimated_duration = draft.estimated_duration, recommended_for = draft.recommended_for, weather_type = draft.weather_type, sort_order = draft.sort_order, is_featured = draft.is_featured
    where id = target_id;
    saved_id := target_id;
    delete from public.guide_places where guide_id = saved_id;
  end if;
  insert into public.guide_places (
    guide_id, place_id, sequence, custom_title, custom_description, stay_minutes, transportation_note, tip
  )
  select saved_id, (item->>'place_id')::uuid, (ordinality - 1)::integer,
    coalesce(item->'custom_title','{}'), coalesce(item->'custom_description','{}'),
    (item->>'stay_minutes')::integer, coalesce(item->'transportation_note','{}'), coalesce(item->'tip','{}')
  from jsonb_array_elements(payload->'places') with ordinality as stops(item, ordinality);
  return saved_id;
end;
$$;
revoke all on function public.save_official_guide(uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.save_official_guide(uuid,jsonb,timestamptz) to authenticated;
comment on table public.guides is 'Admin-curated official guides; independent from personal trip planning.';
comment on column public.guide_places.transportation_note is 'Localized travel instructions from this stop to the next; never inferred automatically.';
