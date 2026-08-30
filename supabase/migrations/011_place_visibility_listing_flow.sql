do $$
begin
  if not exists (select 1 from pg_type where typname = 'place_fact_tristate') then
    create type public.place_fact_tristate as enum ('yes', 'no', 'unknown');
  end if;

  if not exists (select 1 from pg_type where typname = 'china_waiting_level') then
    create type public.china_waiting_level as enum ('unknown', 'none', 'short', 'moderate', 'long', 'extreme');
  end if;

  alter type public.china_waiting_level add value if not exists 'varies';

  if not exists (select 1 from pg_type where typname = 'china_minimum_order_policy') then
    create type public.china_minimum_order_policy as enum ('unknown', 'none', 'two_plus', 'three_plus', 'other');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_verification_status') then
    create type public.place_verification_status as enum ('unverified', 'pending', 'verified', 'needs_review');
  end if;
end $$;

alter table public.places
  add column if not exists status text not null default 'ACTIVE';

alter table public.places
  drop constraint if exists places_status_check,
  add constraint places_status_check check (status in ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'));

update public.places
set status = case
  when is_active then 'ACTIVE'
  when status = 'ACTIVE' then 'DRAFT'
  else status
end;

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
    and places.status = 'ACTIVE'
  group by place_saves.place_id;
$$;

create table if not exists public.place_china_info (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references public.places(id) on delete cascade,
  chinese_taste_score smallint check (chinese_taste_score is null or chinese_taste_score between 1 and 5),
  spicy_level smallint check (spicy_level is null or spicy_level between 1 and 5),
  greasy_level smallint check (greasy_level is null or greasy_level between 1 and 5),
  smell_level smallint check (smell_level is null or smell_level between 1 and 5),
  portion_level smallint check (portion_level is null or portion_level between 1 and 5),
  ordering_difficulty smallint check (ordering_difficulty is null or ordering_difficulty between 1 and 5),
  waiting_level public.china_waiting_level not null default 'unknown',
  waiting_minutes_min smallint,
  waiting_minutes_max smallint,
  chinese_menu public.place_fact_tristate not null default 'unknown',
  foreign_card public.place_fact_tristate not null default 'unknown',
  alipay public.place_fact_tristate not null default 'unknown',
  wechat_pay public.place_fact_tristate not null default 'unknown',
  solo_friendly public.place_fact_tristate not null default 'unknown',
  luggage_friendly public.place_fact_tristate not null default 'unknown',
  toilet_available public.place_fact_tristate not null default 'unknown',
  reservation_required public.place_fact_tristate not null default 'unknown',
  minimum_order_people smallint check (minimum_order_people is null or minimum_order_people between 1 and 10),
  minimum_order_policy public.china_minimum_order_policy not null default 'unknown',
  minimum_order_note text,
  xiaohongshu_popular public.place_fact_tristate not null default 'unknown',
  photo_recommended public.place_fact_tristate not null default 'unknown',
  tourism_recommended public.place_fact_tristate not null default 'unknown',
  subway_walk_minutes smallint check (subway_walk_minutes is null or subway_walk_minutes >= 0),
  manual_summary_override text,
  manual_warning_override text,
  verification_status public.place_verification_status not null default 'unverified',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_china_info_waiting_minutes_min_check check (waiting_minutes_min is null or waiting_minutes_min >= 0),
  constraint place_china_info_waiting_minutes_max_check check (waiting_minutes_max is null or waiting_minutes_max >= 0),
  constraint place_china_info_waiting_minutes_range_check check (
    waiting_minutes_min is null
    or waiting_minutes_max is null
    or waiting_minutes_max >= waiting_minutes_min
  )
);

alter table public.place_china_info
  add column if not exists waiting_minutes_min smallint,
  add column if not exists waiting_minutes_max smallint,
  add column if not exists minimum_order_policy public.china_minimum_order_policy not null default 'unknown',
  add column if not exists minimum_order_note text,
  add column if not exists photo_recommended public.place_fact_tristate not null default 'unknown',
  add column if not exists tourism_recommended public.place_fact_tristate not null default 'unknown';

create index if not exists place_china_info_place_idx on public.place_china_info(place_id);

drop trigger if exists place_china_info_set_updated_at on public.place_china_info;
create trigger place_china_info_set_updated_at
before update on public.place_china_info
for each row execute function public.set_updated_at();

alter table public.place_china_info enable row level security;

drop policy if exists "Public can read active place China info" on public.place_china_info;
create policy "Public can read active place China info"
on public.place_china_info for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_china_info.place_id
      and places.is_active = true
      and places.status = 'ACTIVE'
  )
);

drop policy if exists "Admins can manage place China info" on public.place_china_info;
create policy "Admins can manage place China info"
on public.place_china_info for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active places" on public.places;
create policy "Public can read active places"
on public.places for select
using (is_active = true and status = 'ACTIVE');

drop policy if exists "Public can read place tags" on public.place_tags;
drop policy if exists "Public can read active place tags" on public.place_tags;
create policy "Public can read active place tags"
on public.place_tags for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_tags.place_id
      and places.is_active = true
      and places.status = 'ACTIVE'
  )
);

drop policy if exists "Public can read menu items" on public.place_menu_items;
drop policy if exists "Public can read active place menu items" on public.place_menu_items;
create policy "Public can read active place menu items"
on public.place_menu_items for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_menu_items.place_id
      and places.is_active = true
      and places.status = 'ACTIVE'
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
      and places.status = 'ACTIVE'
  )
);

drop policy if exists "Public can read active place sources" on public.place_sources;
drop policy if exists "Admins can read place sources" on public.place_sources;
create policy "Admins can read place sources"
on public.place_sources for select
using (public.is_admin());

drop policy if exists "Public can read published place events" on public.place_events;
create policy "Public can read published place events"
on public.place_events for select
using (
  status = 'published'
  and exists (
    select 1
    from public.places
    where places.id = place_events.place_id
      and places.is_active = true
      and places.status = 'ACTIVE'
  )
);

grant select on public.place_china_info to anon, authenticated;
grant all on public.place_china_info to authenticated;
grant execute on function public.get_place_save_counts(uuid[]) to anon, authenticated;
