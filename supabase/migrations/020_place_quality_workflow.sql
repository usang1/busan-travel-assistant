alter table public.places
  add column if not exists closed_days text not null default '',
  add column if not exists last_verified_at timestamptz;

alter table public.place_china_info
  add column if not exists chinese_service public.place_fact_tristate not null default 'unknown';

update public.places
set status = case
  when status = 'ACTIVE' and is_active = true then 'PUBLISHED'
  when status = 'ACTIVE' and is_active = false then 'DRAFT'
  when status = 'INACTIVE' then 'DRAFT'
  else status
end
where status in ('ACTIVE', 'INACTIVE');

update public.places p
set last_verified_at = c.verified_at
from public.place_china_info c
where p.id = c.place_id
  and p.last_verified_at is null
  and c.verified_at is not null;

alter table public.places
  alter column status set default 'DRAFT',
  alter column is_active set default false;

alter table public.places
  drop constraint if exists places_status_check,
  add constraint places_status_check check (status in ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED', 'ACTIVE', 'INACTIVE'));

create index if not exists places_public_quality_idx
on public.places(status, is_active, last_verified_at desc);

drop index if exists public.places_active_coordinates_idx;
create index places_active_coordinates_idx
on public.places(latitude, longitude)
where is_active = true and status in ('PUBLISHED', 'ACTIVE') and latitude is not null and longitude is not null;

drop index if exists public.places_active_category_idx;
create index places_active_category_idx
on public.places(category)
where is_active = true and status in ('PUBLISHED', 'ACTIVE');

drop policy if exists "Public can read active places" on public.places;
create policy "Public can read active places"
on public.places for select
using (is_active = true and status in ('PUBLISHED', 'ACTIVE'));

drop policy if exists "Public can read active place tags" on public.place_tags;
create policy "Public can read active place tags"
on public.place_tags for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_tags.place_id
      and places.is_active = true
      and places.status in ('PUBLISHED', 'ACTIVE')
  )
);

drop policy if exists "Public can read active place menu items" on public.place_menu_items;
create policy "Public can read active place menu items"
on public.place_menu_items for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_menu_items.place_id
      and places.is_active = true
      and places.status in ('PUBLISHED', 'ACTIVE')
  )
);

drop policy if exists "Public can read active place translations" on public.place_translations;
create policy "Public can read active place translations"
on public.place_translations for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_translations.place_id
      and places.is_active = true
      and places.status in ('PUBLISHED', 'ACTIVE')
  )
);

drop policy if exists "Public can read active place China info" on public.place_china_info;
create policy "Public can read active place China info"
on public.place_china_info for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_china_info.place_id
      and places.is_active = true
      and places.status in ('PUBLISHED', 'ACTIVE')
  )
);

create or replace function public.get_place_save_counts(place_ids uuid[])
returns table(place_id uuid, save_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select place_saves.place_id, count(*)::bigint as save_count
  from public.place_saves
  join public.places on places.id = place_saves.place_id
  where place_saves.place_id = any(place_ids)
    and places.is_active = true
    and places.status in ('PUBLISHED', 'ACTIVE')
  group by place_saves.place_id;
$$;

create or replace function public.get_place_rankings(
  ranking_period text default 'all',
  result_limit integer default 8,
  category_filter public.place_category default null,
  region_filter text default null
)
returns table(
  place_id uuid,
  save_count bigint,
  recent_save_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      places.id as place_id,
      count(place_saves.id)::bigint as save_count,
      count(place_saves.id) filter (
        where place_saves.created_at >= now() - interval '7 days'
      )::bigint as recent_save_count
    from public.places
    left join public.place_saves on place_saves.place_id = places.id
    where places.is_active = true
      and places.status in ('PUBLISHED', 'ACTIVE')
      and (category_filter is null or places.category = category_filter)
      and (
        nullif(trim(region_filter), '') is null
        or coalesce(places.address_ko, '') ilike '%' || trim(region_filter) || '%'
        or coalesce(places.address_zh, '') ilike '%' || trim(region_filter) || '%'
        or coalesce(places.address, '') ilike '%' || trim(region_filter) || '%'
      )
    group by places.id
  )
  select ranked.place_id, ranked.save_count, ranked.recent_save_count
  from ranked
  where case
    when ranking_period = 'week' then ranked.recent_save_count > 0
    else ranked.save_count > 0
  end
  order by
    case when ranking_period = 'week' then ranked.recent_save_count else ranked.save_count end desc,
    ranked.save_count desc,
    ranked.place_id
  limit greatest(1, least(coalesce(result_limit, 8), 24));
$$;

create or replace function public.set_place_saved(
  target_place_id uuid,
  should_save boolean
)
returns table(saved boolean, save_count bigint)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if should_save then
    if not exists (
      select 1 from public.places
      where id = target_place_id
        and is_active = true
        and status in ('PUBLISHED', 'ACTIVE')
    ) then
      raise exception 'Place is not available';
    end if;

    insert into public.place_saves(user_id, place_id)
    values (current_user_id, target_place_id)
    on conflict (user_id, place_id) do nothing;
  else
    delete from public.place_saves
    where user_id = current_user_id and place_id = target_place_id;
  end if;

  return query
  select
    exists (
      select 1 from public.place_saves
      where user_id = current_user_id and place_id = target_place_id
    ),
    (
      select count(*)::bigint
      from public.place_saves
      join public.places on places.id = place_saves.place_id
      where place_saves.place_id = target_place_id
        and places.is_active = true
        and places.status in ('PUBLISHED', 'ACTIVE')
    );
end;
$$;

revoke all on function public.get_place_rankings(text, integer, public.place_category, text) from public;
grant execute on function public.get_place_rankings(text, integer, public.place_category, text) to anon, authenticated;

revoke all on function public.set_place_saved(uuid, boolean) from public;
grant execute on function public.set_place_saved(uuid, boolean) to authenticated;

comment on column public.places.status is
  'Publishing workflow state. New writes use DRAFT, REVIEW, PUBLISHED, ARCHIVED; ACTIVE and INACTIVE are accepted only for legacy compatibility.';

comment on column public.places.closed_days is
  'Human-readable closed days or holiday note. Empty means not confirmed.';

comment on column public.places.last_verified_at is
  'Last date/time an admin verified the public place facts. Null means not confirmed.';

comment on column public.place_china_info.chinese_service is
  'Whether Chinese-language assistance is available from staff or service channels. unknown means not confirmed.';

comment on function public.get_place_rankings(text, integer, public.place_category, text) is
  'Returns bounded published-place rankings by cumulative saves or saves created in the last seven days.';

comment on function public.set_place_saved(uuid, boolean) is
  'Atomically applies the authenticated user save state and returns the authoritative public-place save count.';

notify pgrst, 'reload schema';
