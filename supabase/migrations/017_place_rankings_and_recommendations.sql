create index if not exists place_saves_place_created_idx
on public.place_saves(place_id, created_at desc);

create index if not exists places_active_coordinates_idx
on public.places(latitude, longitude)
where is_active = true and status = 'ACTIVE' and latitude is not null and longitude is not null;

create index if not exists places_active_category_idx
on public.places(category)
where is_active = true and status = 'ACTIVE';

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
      and places.status = 'ACTIVE'
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
      where id = target_place_id and is_active = true and status = 'ACTIVE'
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
        and places.status = 'ACTIVE'
    );
end;
$$;

revoke all on function public.get_place_rankings(text, integer, public.place_category, text) from public;
grant execute on function public.get_place_rankings(text, integer, public.place_category, text) to anon, authenticated;

revoke all on function public.set_place_saved(uuid, boolean) from public;
grant execute on function public.set_place_saved(uuid, boolean) to authenticated;

comment on function public.get_place_rankings(text, integer, public.place_category, text) is
  'Returns bounded active-place rankings by cumulative saves or saves created in the last seven days.';

comment on function public.set_place_saved(uuid, boolean) is
  'Atomically applies the authenticated user save state and returns the authoritative active-place save count.';
