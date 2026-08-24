create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'place_category') then
    create type place_category as enum (
      'restaurant',
      'cafe',
      'bar',
      'attraction',
      'shopping',
      'photo_spot',
      'luggage'
    );
  end if;
end $$;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_zh text not null,
  name_ko text not null,
  category place_category not null,
  short_description_zh text not null default '',
  short_description_ko text not null default '',
  address_ko text not null default '',
  address_zh text not null default '',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  nearest_station text not null default '',
  nearest_exit text not null default '',
  walking_minutes integer not null default 0 check (walking_minutes >= 0),
  price_min integer check (price_min is null or price_min >= 0),
  price_max integer check (price_max is null or price_max >= 0),
  opening_hours text not null default '',
  waiting_info_zh text not null default '',
  waiting_info_ko text not null default '',
  solo_friendly boolean not null default false,
  luggage_friendly boolean not null default false,
  chinese_menu boolean not null default false,
  card_payment boolean not null default true,
  recommended_order_zh text not null default '',
  recommended_order_ko text not null default '',
  tips_zh text not null default '',
  tips_ko text not null default '',
  thumbnail_url text not null default '',
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label_zh text not null,
  label_ko text not null
);

create table if not exists public.place_tags (
  place_id uuid not null references public.places(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (place_id, tag_id)
);

create table if not exists public.place_menu_items (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  name_ko text not null,
  name_zh text not null,
  description_zh text not null default '',
  price integer check (price is null or price >= 0),
  is_recommended boolean not null default false,
  sort_order integer not null default 1
);

create index if not exists places_category_idx on public.places(category);
create index if not exists places_active_featured_idx on public.places(is_active, is_featured);
create index if not exists places_search_idx on public.places using gin (
  to_tsvector('simple', coalesce(name_zh, '') || ' ' || coalesce(name_ko, '') || ' ' || coalesce(short_description_zh, '') || ' ' || coalesce(short_description_ko, ''))
);
create index if not exists place_menu_items_place_sort_idx on public.place_menu_items(place_id, sort_order);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
before update on public.places
for each row execute function public.set_updated_at();

alter table public.places enable row level security;
alter table public.tags enable row level security;
alter table public.place_tags enable row level security;
alter table public.place_menu_items enable row level security;

drop policy if exists "Public can read active places" on public.places;
create policy "Public can read active places"
on public.places for select
using (is_active = true);

drop policy if exists "MVP admin can manage places" on public.places;
create policy "MVP admin can manage places"
on public.places for all
using (true)
with check (true);

drop policy if exists "Public can read tags" on public.tags;
create policy "Public can read tags"
on public.tags for select
using (true);

drop policy if exists "MVP admin can manage tags" on public.tags;
create policy "MVP admin can manage tags"
on public.tags for all
using (true)
with check (true);

drop policy if exists "Public can read place tags" on public.place_tags;
create policy "Public can read place tags"
on public.place_tags for select
using (true);

drop policy if exists "MVP admin can manage place tags" on public.place_tags;
create policy "MVP admin can manage place tags"
on public.place_tags for all
using (true)
with check (true);

drop policy if exists "Public can read menu items" on public.place_menu_items;
create policy "Public can read menu items"
on public.place_menu_items for select
using (true);

drop policy if exists "MVP admin can manage menu items" on public.place_menu_items;
create policy "MVP admin can manage menu items"
on public.place_menu_items for all
using (true)
with check (true);

comment on policy "MVP admin can manage places" on public.places is
  'MVP용 임시 정책입니다. Supabase Auth 추가 후 authenticated/admin role 조건으로 교체하세요.';
