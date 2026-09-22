begin;

alter table public.trips
  add column if not exists source_guide_id uuid references public.guides(id) on delete set null,
  add column if not exists source_guide_updated_at timestamptz;

alter table public.trip_places
  add column if not exists stay_minutes smallint,
  add column if not exists travel_minutes smallint,
  add column if not exists travel_mode public.place_travel_mode,
  add column if not exists source_guide_sequence integer;

alter table public.trip_places drop constraint if exists trip_places_stay_minutes_check;
alter table public.trip_places add constraint trip_places_stay_minutes_check
  check (stay_minutes is null or stay_minutes between 0 and 10080);
alter table public.trip_places drop constraint if exists trip_places_travel_minutes_check;
alter table public.trip_places add constraint trip_places_travel_minutes_check
  check (travel_minutes is null or travel_minutes between 0 and 1440);

comment on column public.trips.source_guide_updated_at is
  'Snapshot timestamp of the official guide when copied. Later guide edits never mutate the personal trip.';
comment on column public.trip_places.source_guide_sequence is
  'Original guide stop sequence retained as snapshot provenance.';

create or replace function public.copy_published_guide_to_trip(
  source_guide_id uuid,
  requested_start_date date,
  selected_place_ids uuid[] default null,
  requested_title text default null
) returns uuid
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  source_guide public.guides%rowtype;
  copied_trip_id uuid;
  current_user_id uuid := auth.uid();
  stop record;
  next_time time without time zone;
  previous_sequence integer;
  previous_stay integer;
  previous_travel integer;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if requested_start_date is null then raise exception 'Start date is required' using errcode = '22023'; end if;

  select * into source_guide from public.guides
  where id = source_guide_id and status = 'PUBLISHED'
    and verification_status in ('verified', 'partially_verified');
  if not found then raise exception 'Published reviewed guide not found' using errcode = 'P0002'; end if;

  if selected_place_ids is not null and cardinality(selected_place_ids) = 0 then
    raise exception 'Select at least one stop' using errcode = '22023';
  end if;

  insert into public.trips(user_id, title, start_date, end_date, visibility, source_guide_id, source_guide_updated_at)
  values (current_user_id, left(coalesce(nullif(trim(requested_title), ''), source_guide.title_ko), 120), requested_start_date, requested_start_date, 'private', source_guide.id, source_guide.updated_at)
  returning id into copied_trip_id;

  next_time := source_guide.recommended_start_time;
  for stop in
    select gp.* from public.guide_places gp
    join public.places p on p.id = gp.place_id
    where gp.guide_id = source_guide.id
      and p.is_active and p.status in ('PUBLISHED', 'ACTIVE')
      and (selected_place_ids is null or gp.place_id = any(selected_place_ids))
    order by gp.sequence, gp.id
  loop
    if previous_sequence is null and stop.sequence <> 0 then next_time := null; end if;
    if previous_sequence is not null and stop.sequence <> previous_sequence + 1 then next_time := null; end if;
    if previous_sequence is not null and next_time is not null then
      if previous_stay is null or previous_travel is null then next_time := null;
      else next_time := next_time + make_interval(mins => previous_stay + previous_travel); end if;
    end if;

    insert into public.trip_places(
      trip_id, place_id, day_number, sort_order, memo, planned_time,
      stay_minutes, travel_minutes, travel_mode, source_guide_sequence
    ) values (
      copied_trip_id, stop.place_id, 1,
      (select count(*)::integer from public.trip_places where trip_id = copied_trip_id), '', next_time,
      stop.stay_minutes, stop.travel_minutes, stop.travel_mode, stop.sequence
    );
    previous_sequence := stop.sequence;
    previous_stay := stop.stay_minutes;
    previous_travel := stop.travel_minutes;
  end loop;

  if not exists (select 1 from public.trip_places where trip_id = copied_trip_id) then
    delete from public.trips where id = copied_trip_id;
    raise exception 'No public stops selected' using errcode = '22023';
  end if;
  return copied_trip_id;
end;
$$;

revoke all on function public.copy_published_guide_to_trip(uuid,date,uuid[],text) from public, anon;
grant execute on function public.copy_published_guide_to_trip(uuid,date,uuid[],text) to authenticated;

drop function if exists public.get_shared_trip(text);
create function public.get_shared_trip(source_share_slug text)
returns table(
  trip_id uuid, title text, start_date date, end_date date, visibility public.trip_visibility,
  share_slug text, trip_created_at timestamptz, trip_updated_at timestamptz,
  trip_place_id uuid, place_id uuid, day_number integer, sort_order integer, memo text,
  planned_time time without time zone, stay_minutes smallint, travel_minutes smallint,
  travel_mode public.place_travel_mode, source_guide_sequence integer,
  trip_place_created_at timestamptz, trip_place_updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select t.id, t.title, t.start_date, t.end_date, t.visibility, t.share_slug, t.created_at, t.updated_at,
    tp.id, tp.place_id, tp.day_number, tp.sort_order, tp.memo, tp.planned_time,
    tp.stay_minutes, tp.travel_minutes, tp.travel_mode, tp.source_guide_sequence, tp.created_at, tp.updated_at
  from public.trips t left join public.trip_places tp on tp.trip_id = t.id
  where t.share_slug = source_share_slug and t.visibility = 'unlisted'
  order by tp.day_number, tp.sort_order, tp.id;
$$;

create or replace function public.copy_shared_trip(source_share_slug text, requested_title text default null)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare source_trip public.trips%rowtype; copied_trip_id uuid; current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select * into source_trip from public.trips where share_slug = source_share_slug and visibility = 'unlisted';
  if not found then raise exception 'Shared trip not found'; end if;
  insert into public.trips(user_id, title, start_date, end_date, visibility, source_guide_id, source_guide_updated_at)
  values (current_user_id, left(coalesce(nullif(trim(requested_title), ''), source_trip.title || ' copy'), 120), source_trip.start_date, source_trip.end_date, 'private', source_trip.source_guide_id, source_trip.source_guide_updated_at)
  returning id into copied_trip_id;
  insert into public.trip_places(trip_id, place_id, day_number, sort_order, memo, planned_time, stay_minutes, travel_minutes, travel_mode, source_guide_sequence)
  select copied_trip_id, place_id, day_number, sort_order, memo, planned_time, stay_minutes, travel_minutes, travel_mode, source_guide_sequence
  from public.trip_places where trip_id = source_trip.id order by day_number, sort_order, id;
  return copied_trip_id;
end;
$$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
revoke all on function public.copy_shared_trip(text,text) from public;
grant execute on function public.copy_shared_trip(text,text) to authenticated;

notify pgrst, 'reload schema';
commit;
