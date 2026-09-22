begin;

alter table public.place_menu_items
  add column if not exists contains_seafood public.place_fact_tristate not null default 'unknown',
  add column if not exists contains_cilantro public.place_fact_tristate not null default 'unknown',
  add column if not exists meal_type text;

alter table public.place_menu_items drop constraint if exists place_menu_meal_type_check;
alter table public.place_menu_items
  add constraint place_menu_meal_type_check
  check (meal_type is null or meal_type in ('meal', 'snack', 'both'));

alter table public.trip_places
  add column if not exists planned_time time without time zone;

comment on column public.place_menu_items.contains_seafood is 'Explicit administrator-reviewed fact; unknown must not be treated as false.';
comment on column public.place_menu_items.contains_cilantro is 'Explicit administrator-reviewed fact; unknown must not be treated as false.';
comment on column public.place_menu_items.meal_type is 'meal, snack, both, or null when unverified.';
comment on column public.trip_places.planned_time is 'Optional Asia/Seoul local arrival time. Null means no time-based itinerary judgment is allowed.';

drop function if exists public.get_shared_trip(text);
create function public.get_shared_trip(source_share_slug text)
returns table(
  trip_id uuid,
  title text,
  start_date date,
  end_date date,
  visibility public.trip_visibility,
  share_slug text,
  trip_created_at timestamptz,
  trip_updated_at timestamptz,
  trip_place_id uuid,
  place_id uuid,
  day_number integer,
  sort_order integer,
  memo text,
  planned_time time without time zone,
  trip_place_created_at timestamptz,
  trip_place_updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    trips.id,
    trips.title,
    trips.start_date,
    trips.end_date,
    trips.visibility,
    trips.share_slug,
    trips.created_at,
    trips.updated_at,
    trip_places.id,
    trip_places.place_id,
    trip_places.day_number,
    trip_places.sort_order,
    trip_places.memo,
    trip_places.planned_time,
    trip_places.created_at,
    trip_places.updated_at
  from public.trips
  left join public.trip_places on trip_places.trip_id = trips.id
  where trips.share_slug = source_share_slug
    and trips.visibility = 'unlisted'
  order by trip_places.day_number, trip_places.sort_order, trip_places.id;
$$;

create or replace function public.copy_shared_trip(
  source_share_slug text,
  requested_title text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  source_trip public.trips%rowtype;
  copied_trip_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into source_trip
  from public.trips
  where share_slug = source_share_slug and visibility = 'unlisted';

  if not found then
    raise exception 'Shared trip not found';
  end if;

  insert into public.trips(user_id, title, start_date, end_date, visibility)
  values (
    current_user_id,
    left(coalesce(nullif(trim(requested_title), ''), source_trip.title || ' copy'), 120),
    source_trip.start_date,
    source_trip.end_date,
    'private'
  )
  returning id into copied_trip_id;

  insert into public.trip_places(trip_id, place_id, day_number, sort_order, memo, planned_time)
  select copied_trip_id, place_id, day_number, sort_order, memo, planned_time
  from public.trip_places
  where trip_id = source_trip.id
  order by day_number, sort_order, id;

  return copied_trip_id;
end;
$$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

revoke all on function public.copy_shared_trip(text, text) from public;
grant execute on function public.copy_shared_trip(text, text) to authenticated;

commit;
