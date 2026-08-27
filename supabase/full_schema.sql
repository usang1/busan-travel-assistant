-- ==========================================
-- 1. EXTENSIONS / FUNCTIONS
-- ==========================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_locale') then
    create type public.app_locale as enum ('zh', 'en', 'ja', 'ko');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_category') then
    create type public.place_category as enum (
      'restaurant',
      'cafe',
      'bar',
      'attraction',
      'shopping',
      'photo_spot',
      'luggage'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'photo_spot_plan') then
    create type public.photo_spot_plan as enum ('free', 'pro');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_source_provider') then
    create type public.place_source_provider as enum ('NAVER', 'KAKAO', 'GOOGLE', 'MANUAL');
  end if;

  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type public.profile_role as enum ('user', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type public.submission_status as enum ('pending', 'reviewing', 'approved', 'rejected', 'duplicate');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_event_status') then
    create type public.place_event_status as enum ('draft', 'published', 'cancelled', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'correction_status') then
    create type public.correction_status as enum ('pending', 'accepted', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_action_event_type') then
    create type public.place_action_event_type as enum (
      'place_view',
      'place_save',
      'place_unsave',
      'marker_click',
      'directions_click',
      'share',
      'submission_created',
      'correction_submitted'
    );
  end if;
end $$;

do $$
begin
  alter type public.submission_status add value if not exists 'reviewing';
  alter type public.submission_status add value if not exists 'duplicate';
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

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
  group by place_saves.place_id;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'zh'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ==========================================
-- 2. TABLES
-- ==========================================

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_zh text not null,
  name_ko text not null,
  category public.place_category not null,
  short_description_zh text not null default '',
  short_description_ko text not null default '',
  address text,
  address_ko text not null default '',
  address_zh text not null default '',
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  phone text,
  website text,
  price_level smallint,
  status text not null default 'ACTIVE',
  nearest_station text not null default '',
  nearest_exit text not null default '',
  walking_minutes integer not null default 0,
  price_min integer,
  price_max integer,
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
  updated_at timestamptz not null default now(),
  constraint places_walking_minutes_check check (walking_minutes >= 0),
  constraint places_price_min_check check (price_min is null or price_min >= 0),
  constraint places_price_max_check check (price_max is null or price_max >= 0),
  constraint places_price_range_check check (price_min is null or price_max is null or price_max >= price_min),
  constraint places_price_level_check check (price_level is null or price_level between 0 and 4),
  constraint places_status_check check (status in ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'))
);

alter table public.places
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists price_level smallint,
  add column if not exists status text not null default 'ACTIVE';

alter table public.places
  drop constraint if exists places_walking_minutes_check,
  add constraint places_walking_minutes_check check (walking_minutes >= 0),
  drop constraint if exists places_price_min_check,
  add constraint places_price_min_check check (price_min is null or price_min >= 0),
  drop constraint if exists places_price_max_check,
  add constraint places_price_max_check check (price_max is null or price_max >= 0),
  drop constraint if exists places_price_range_check,
  add constraint places_price_range_check check (price_min is null or price_max is null or price_max >= price_min),
  drop constraint if exists places_price_level_check,
  add constraint places_price_level_check check (price_level is null or price_level between 0 and 4),
  drop constraint if exists places_status_check,
  add constraint places_status_check check (status in ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'));

update public.places
set address = coalesce(nullif(address, ''), nullif(address_ko, ''), nullif(address_zh, ''))
where address is null;

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
  price integer,
  is_recommended boolean not null default false,
  sort_order integer not null default 1,
  constraint place_menu_items_price_check check (price is null or price >= 0)
);

alter table public.place_menu_items
  drop constraint if exists place_menu_items_price_check,
  add constraint place_menu_items_price_check check (price is null or price >= 0);

create table if not exists public.photo_spots (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_zh text not null,
  name_ko text not null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  best_time text not null default '',
  camera_position text not null default '',
  subject_position text not null default '',
  recommended_zoom text not null default '',
  portrait_tip_zh text not null default '',
  lighting_tip_zh text not null default '',
  thumbnail_url text not null default '',
  sample_image_url text not null default '',
  free_or_pro public.photo_spot_plan not null default 'free',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role public.profile_role not null default 'user',
  preferred_locale public.app_locale not null default 'zh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_translations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  locale public.app_locale not null,
  name text not null,
  description text not null default '',
  travel_tip text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, locale)
);

create table if not exists public.place_sources (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  provider public.place_source_provider not null,
  external_id text,
  source_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint place_saves_user_place_unique unique (user_id, place_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'place_saves_user_place_unique'
      and conrelid = 'public.place_saves'::regclass
  ) then
    alter table public.place_saves
      add constraint place_saves_user_place_unique unique (user_id, place_id);
  end if;
end $$;

create table if not exists public.place_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  place_id uuid references public.places(id) on delete set null,
  locale public.app_locale not null default 'zh',
  name text,
  category public.place_category,
  provider public.place_source_provider not null default 'MANUAL',
  external_id text,
  source_url text,
  address_text text,
  location_text text,
  recommendation_reason text not null default '',
  notes text not null default '',
  status public.submission_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.place_submissions
  alter column name drop not null,
  add column if not exists place_id uuid references public.places(id) on delete set null,
  add column if not exists location_text text,
  add column if not exists recommendation_reason text not null default '';

update public.place_submissions
set recommendation_reason = notes
where recommendation_reason = ''
  and notes <> '';

create table if not exists public.place_events (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  source_url text,
  status public.place_event_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_events_time_check check (ends_at is null or ends_at >= starts_at)
);

alter table public.place_events
  drop constraint if exists place_events_time_check,
  add constraint place_events_time_check check (ends_at is null or ends_at >= starts_at);

create table if not exists public.place_corrections (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  locale public.app_locale not null default 'zh',
  field_name text not null,
  current_value text,
  suggested_value text not null,
  source_url text,
  notes text not null default '',
  status public.correction_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  place_id uuid references public.places(id) on delete cascade,
  locale public.app_locale not null default 'zh',
  event_type public.place_action_event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.place_translations (place_id, locale, name, description, travel_tip)
select id, 'zh'::public.app_locale, name_zh, short_description_zh, tips_zh
from public.places
on conflict (place_id, locale) do update set
  name = excluded.name,
  description = excluded.description,
  travel_tip = excluded.travel_tip,
  updated_at = now();

insert into public.place_translations (place_id, locale, name, description, travel_tip)
select id, 'ko'::public.app_locale, name_ko, short_description_ko, tips_ko
from public.places
on conflict (place_id, locale) do update set
  name = excluded.name,
  description = excluded.description,
  travel_tip = excluded.travel_tip,
  updated_at = now();

-- ==========================================
-- 3. INDEXES
-- ==========================================

create index if not exists places_category_idx on public.places(category);
create index if not exists places_active_featured_idx on public.places(is_active, is_featured);
create index if not exists places_status_idx on public.places(status);
create index if not exists places_updated_at_idx on public.places(updated_at desc);
create index if not exists places_search_idx on public.places using gin (
  to_tsvector('simple', coalesce(name_zh, '') || ' ' || coalesce(name_ko, '') || ' ' || coalesce(short_description_zh, '') || ' ' || coalesce(short_description_ko, ''))
);

create index if not exists place_tags_tag_idx on public.place_tags(tag_id);
create index if not exists place_menu_items_place_sort_idx on public.place_menu_items(place_id, sort_order);
create index if not exists photo_spots_active_idx on public.photo_spots(is_active);
create index if not exists photo_spots_updated_at_idx on public.photo_spots(updated_at desc);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists place_translations_locale_idx on public.place_translations(locale);
create index if not exists place_translations_search_idx on public.place_translations using gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(travel_tip, ''))
);
create index if not exists place_sources_place_provider_idx on public.place_sources(place_id, provider);
create unique index if not exists place_sources_provider_external_id_uidx
on public.place_sources(provider, external_id)
where external_id is not null;
create unique index if not exists place_sources_place_manual_url_uidx
on public.place_sources(place_id, provider, source_url)
where external_id is null and source_url is not null;
create index if not exists place_saves_user_created_idx on public.place_saves(user_id, created_at desc);
create index if not exists place_saves_place_idx on public.place_saves(place_id);
create index if not exists place_submissions_status_created_idx on public.place_submissions(status, created_at desc);
create index if not exists place_submissions_user_idx on public.place_submissions(user_id);
create index if not exists place_submissions_place_idx on public.place_submissions(place_id);
create index if not exists place_submissions_source_url_idx on public.place_submissions(source_url);
create index if not exists place_events_place_starts_idx on public.place_events(place_id, starts_at);
create index if not exists place_events_status_starts_idx on public.place_events(status, starts_at);
create index if not exists place_corrections_place_status_idx on public.place_corrections(place_id, status);
create index if not exists place_corrections_user_idx on public.place_corrections(user_id);
create index if not exists place_corrections_status_created_idx on public.place_corrections(status, created_at desc);
create index if not exists place_action_events_place_created_idx on public.place_action_events(place_id, created_at desc);
create index if not exists place_action_events_user_created_idx on public.place_action_events(user_id, created_at desc)
where user_id is not null;
create index if not exists place_action_events_type_created_idx on public.place_action_events(event_type, created_at desc);

-- ==========================================
-- 4. RLS
-- ==========================================

alter table public.places enable row level security;
alter table public.tags enable row level security;
alter table public.place_tags enable row level security;
alter table public.place_menu_items enable row level security;
alter table public.photo_spots enable row level security;
alter table public.profiles enable row level security;
alter table public.place_translations enable row level security;
alter table public.place_sources enable row level security;
alter table public.place_saves enable row level security;
alter table public.place_submissions enable row level security;
alter table public.place_events enable row level security;
alter table public.place_corrections enable row level security;
alter table public.place_action_events enable row level security;

-- ==========================================
-- 5. POLICIES
-- ==========================================

drop policy if exists "Public can read active places" on public.places;
drop policy if exists "MVP admin can manage places" on public.places;
drop policy if exists "Admins can manage places" on public.places;
create policy "Public can read active places"
on public.places for select
using (is_active = true);
create policy "Admins can manage places"
on public.places for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read tags" on public.tags;
drop policy if exists "MVP admin can manage tags" on public.tags;
drop policy if exists "Admins can manage tags" on public.tags;
create policy "Public can read tags"
on public.tags for select
using (true);
create policy "Admins can manage tags"
on public.tags for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read place tags" on public.place_tags;
drop policy if exists "Public can read active place tags" on public.place_tags;
drop policy if exists "MVP admin can manage place tags" on public.place_tags;
drop policy if exists "Admins can manage place tags" on public.place_tags;
create policy "Public can read active place tags"
on public.place_tags for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_tags.place_id
      and places.is_active = true
  )
);
create policy "Admins can manage place tags"
on public.place_tags for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read menu items" on public.place_menu_items;
drop policy if exists "Public can read active place menu items" on public.place_menu_items;
drop policy if exists "MVP admin can manage menu items" on public.place_menu_items;
drop policy if exists "Admins can manage menu items" on public.place_menu_items;
create policy "Public can read active place menu items"
on public.place_menu_items for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_menu_items.place_id
      and places.is_active = true
  )
);
create policy "Admins can manage menu items"
on public.place_menu_items for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active photo spots" on public.photo_spots;
drop policy if exists "MVP admin can manage photo spots" on public.photo_spots;
drop policy if exists "Admins can manage photo spots" on public.photo_spots;
create policy "Public can read active photo spots"
on public.photo_spots for select
using (is_active = true);
create policy "Admins can manage photo spots"
on public.photo_spots for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can create own profile" on public.profiles;
drop policy if exists "Users can create own user profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own non-role profile fields" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());
create policy "Users can create own user profile"
on public.profiles for insert
with check (id = auth.uid() and role = 'user');
create policy "Users can update own non-role profile fields"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid() and role = 'user');
create policy "Admins can manage profiles"
on public.profiles for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active place translations" on public.place_translations;
drop policy if exists "Admins can manage place translations" on public.place_translations;
create policy "Public can read active place translations"
on public.place_translations for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_translations.place_id
      and places.is_active = true
  )
);
create policy "Admins can manage place translations"
on public.place_translations for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active place sources" on public.place_sources;
drop policy if exists "Admins can read place sources" on public.place_sources;
drop policy if exists "Admins can manage place sources" on public.place_sources;
create policy "Admins can read place sources"
on public.place_sources for select
using (public.is_admin());
create policy "Admins can manage place sources"
on public.place_sources for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can manage own place saves" on public.place_saves;
drop policy if exists "Users can read own place saves" on public.place_saves;
drop policy if exists "Users can create own place saves" on public.place_saves;
drop policy if exists "Users can delete own place saves" on public.place_saves;
create policy "Users can read own place saves"
on public.place_saves for select
using (user_id = auth.uid() or public.is_admin());
create policy "Users can create own place saves"
on public.place_saves for insert
with check (auth.uid() is not null and user_id = auth.uid());
create policy "Users can delete own place saves"
on public.place_saves for delete
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Public can create place submissions" on public.place_submissions;
drop policy if exists "Authenticated users can create own place submissions" on public.place_submissions;
drop policy if exists "Users can read own place submissions" on public.place_submissions;
drop policy if exists "Users can update own draft place submissions" on public.place_submissions;
drop policy if exists "Admins can manage place submissions" on public.place_submissions;
create policy "Authenticated users can create own place submissions"
on public.place_submissions for insert
with check (auth.uid() is not null and user_id = auth.uid());
create policy "Users can read own place submissions"
on public.place_submissions for select
using (user_id = auth.uid() or public.is_admin());
create policy "Users can update own draft place submissions"
on public.place_submissions for update
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');
create policy "Admins can manage place submissions"
on public.place_submissions for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published place events" on public.place_events;
drop policy if exists "Admins can manage place events" on public.place_events;
create policy "Public can read published place events"
on public.place_events for select
using (
  status = 'published'
  and exists (
    select 1
    from public.places
    where places.id = place_events.place_id
      and places.is_active = true
  )
);
create policy "Admins can manage place events"
on public.place_events for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can create place corrections" on public.place_corrections;
drop policy if exists "Authenticated users can create own place corrections" on public.place_corrections;
drop policy if exists "Users can read own place corrections" on public.place_corrections;
drop policy if exists "Admins can manage place corrections" on public.place_corrections;
create policy "Authenticated users can create own place corrections"
on public.place_corrections for insert
with check (auth.uid() is not null and user_id = auth.uid());
create policy "Users can read own place corrections"
on public.place_corrections for select
using (user_id = auth.uid() or public.is_admin());
create policy "Admins can manage place corrections"
on public.place_corrections for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Anyone can create place action events" on public.place_action_events;
drop policy if exists "Admins can read place action events" on public.place_action_events;
create policy "Anyone can create place action events"
on public.place_action_events for insert
with check (user_id is null or user_id = auth.uid());
create policy "Admins can read place action events"
on public.place_action_events for select
using (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.places to anon, authenticated;
grant select on public.tags to anon, authenticated;
grant select on public.place_tags to anon, authenticated;
grant select on public.place_menu_items to anon, authenticated;
grant select on public.photo_spots to anon, authenticated;
grant select on public.place_translations to anon, authenticated;
grant insert on public.place_action_events to anon, authenticated;

grant all on public.places to authenticated;
grant all on public.tags to authenticated;
grant all on public.place_tags to authenticated;
grant all on public.place_menu_items to authenticated;
grant all on public.photo_spots to authenticated;
grant all on public.profiles to authenticated;
grant all on public.place_translations to authenticated;
grant all on public.place_sources to authenticated;
grant all on public.place_saves to authenticated;
grant all on public.place_submissions to authenticated;
grant all on public.place_events to authenticated;
grant all on public.place_corrections to authenticated;
grant select, insert on public.place_action_events to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.get_place_save_counts(uuid[]) to anon, authenticated;

-- ==========================================
-- 6. TRIGGERS
-- ==========================================

drop trigger if exists places_set_updated_at on public.places;
create trigger places_set_updated_at
before update on public.places
for each row execute function public.set_updated_at();

drop trigger if exists photo_spots_set_updated_at on public.photo_spots;
create trigger photo_spots_set_updated_at
before update on public.photo_spots
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists place_translations_set_updated_at on public.place_translations;
create trigger place_translations_set_updated_at
before update on public.place_translations
for each row execute function public.set_updated_at();

drop trigger if exists place_sources_set_updated_at on public.place_sources;
create trigger place_sources_set_updated_at
before update on public.place_sources
for each row execute function public.set_updated_at();

drop trigger if exists place_submissions_set_updated_at on public.place_submissions;
create trigger place_submissions_set_updated_at
before update on public.place_submissions
for each row execute function public.set_updated_at();

drop trigger if exists place_events_set_updated_at on public.place_events;
create trigger place_events_set_updated_at
before update on public.place_events
for each row execute function public.set_updated_at();

drop trigger if exists place_corrections_set_updated_at on public.place_corrections;
create trigger place_corrections_set_updated_at
before update on public.place_corrections
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

comment on table public.place_translations is
  'Locale-specific place content. Legacy name_zh/name_ko columns remain for compatibility until all readers migrate.';
comment on table public.place_sources is
  'Admin-only source references for NAVER, KAKAO, GOOGLE, or MANUAL entries. This table does not imply unofficial crawling.';
comment on table public.place_action_events is
  'Append-only behavior log for place interactions. Core product actions must not fail if logging fails.';
comment on column public.place_submissions.source_url is
  'Original Naver/Kakao/Google map URL supplied by the user. Do not scrape unsupported data from it.';
comment on column public.place_submissions.recommendation_reason is
  'User-written recommendation reason for admin review.';
