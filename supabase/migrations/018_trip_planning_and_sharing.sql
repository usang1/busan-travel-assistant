do $$
begin
  if not exists (select 1 from pg_type where typname = 'trip_visibility') then
    create type public.trip_visibility as enum ('private', 'unlisted');
  end if;
end $$;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  start_date date not null,
  end_date date not null,
  visibility public.trip_visibility not null default 'private',
  share_slug text not null default replace(gen_random_uuid()::text, '-', '') unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (end_date - start_date <= 30)
);

create table if not exists public.trip_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  day_number integer not null default 1 check (day_number between 1 and 31),
  sort_order integer not null default 0 check (sort_order >= 0),
  memo text not null default '' check (char_length(memo) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, place_id)
);

create index if not exists trips_user_updated_idx
on public.trips(user_id, updated_at desc);

create index if not exists trips_unlisted_share_idx
on public.trips(share_slug)
where visibility = 'unlisted';

create index if not exists trip_places_trip_day_order_idx
on public.trip_places(trip_id, day_number, sort_order);

drop trigger if exists trips_set_updated_at on public.trips;
create trigger trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

drop trigger if exists trip_places_set_updated_at on public.trip_places;
create trigger trip_places_set_updated_at
before update on public.trip_places
for each row execute function public.set_updated_at();

create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.trips
    where trips.id = target_trip_id and trips.user_id = auth.uid()
  );
$$;

create or replace function public.get_shared_trip(source_share_slug text)
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

  insert into public.trip_places(trip_id, place_id, day_number, sort_order, memo)
  select copied_trip_id, place_id, day_number, sort_order, memo
  from public.trip_places
  where trip_id = source_trip.id
  order by day_number, sort_order, id;

  return copied_trip_id;
end;
$$;

alter table public.trips enable row level security;
alter table public.trip_places enable row level security;

drop policy if exists "Trip owners and shared viewers can read trips" on public.trips;
drop policy if exists "Trip owners can read trips" on public.trips;
create policy "Trip owners can read trips"
on public.trips for select
using (user_id = auth.uid());

drop policy if exists "Users can create own trips" on public.trips;
create policy "Users can create own trips"
on public.trips for insert
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips"
on public.trips for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own trips" on public.trips;
create policy "Users can delete own trips"
on public.trips for delete
using (user_id = auth.uid());

drop policy if exists "Trip owners and shared viewers can read trip places" on public.trip_places;
drop policy if exists "Trip owners can read trip places" on public.trip_places;
drop function if exists public.can_read_trip(uuid);
create policy "Trip owners can read trip places"
on public.trip_places for select
using (public.is_trip_owner(trip_id));

drop policy if exists "Trip owners can create trip places" on public.trip_places;
create policy "Trip owners can create trip places"
on public.trip_places for insert
with check (public.is_trip_owner(trip_id));

drop policy if exists "Trip owners can update trip places" on public.trip_places;
create policy "Trip owners can update trip places"
on public.trip_places for update
using (public.is_trip_owner(trip_id))
with check (public.is_trip_owner(trip_id));

drop policy if exists "Trip owners can delete trip places" on public.trip_places;
create policy "Trip owners can delete trip places"
on public.trip_places for delete
using (public.is_trip_owner(trip_id));

revoke select on public.trips, public.trip_places from anon;
grant select on public.trips, public.trip_places to authenticated;
grant insert, update, delete on public.trips, public.trip_places to authenticated;

revoke all on function public.is_trip_owner(uuid) from public;
grant execute on function public.is_trip_owner(uuid) to anon, authenticated;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;

revoke all on function public.copy_shared_trip(text, text) from public;
grant execute on function public.copy_shared_trip(text, text) to authenticated;

comment on table public.trips is
  'User-owned trip plans. Unlisted trips are readable only through their random share slug and are not publicly indexed.';

comment on table public.trip_places is
  'Ordered places assigned to a trip day. User memos are copied only when an unlisted trip is explicitly copied.';
