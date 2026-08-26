create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_locale') then
    create type app_locale as enum ('zh', 'en', 'ja', 'ko');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_source_provider') then
    create type place_source_provider as enum ('NAVER', 'KAKAO', 'GOOGLE', 'MANUAL');
  end if;

  if not exists (select 1 from pg_type where typname = 'profile_role') then
    create type profile_role as enum ('user', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type submission_status as enum ('pending', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_event_status') then
    create type place_event_status as enum ('draft', 'published', 'cancelled', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'correction_status') then
    create type correction_status as enum ('pending', 'accepted', 'rejected');
  end if;
end $$;

alter table public.places
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists price_level smallint,
  add column if not exists status text not null default 'ACTIVE';

alter table public.places
  drop constraint if exists places_price_level_check,
  add constraint places_price_level_check check (price_level is null or price_level between 0 and 4);

alter table public.places
  drop constraint if exists places_status_check,
  add constraint places_status_check check (status in ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'));

update public.places
set address = coalesce(nullif(address_ko, ''), nullif(address_zh, ''), '')
where address is null;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  role profile_role not null default 'user',
  preferred_locale app_locale not null default 'zh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_translations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  locale app_locale not null,
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
  provider place_source_provider not null,
  external_id text,
  source_url text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists place_sources_provider_external_id_uidx
on public.place_sources(provider, external_id)
where external_id is not null;

create unique index if not exists place_sources_place_manual_url_uidx
on public.place_sources(place_id, provider, source_url)
where external_id is null and source_url is not null;

create table if not exists public.place_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

create table if not exists public.place_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  locale app_locale not null default 'zh',
  name text not null,
  category place_category,
  provider place_source_provider not null default 'MANUAL',
  external_id text,
  source_url text,
  address_text text,
  notes text not null default '',
  status submission_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.place_events (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  source_url text,
  status place_event_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.place_corrections (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  locale app_locale not null default 'zh',
  field_name text not null,
  current_value text,
  suggested_value text not null,
  source_url text,
  notes text not null default '',
  status correction_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.place_translations (place_id, locale, name, description, travel_tip)
select id, 'zh'::app_locale, name_zh, short_description_zh, tips_zh
from public.places
on conflict (place_id, locale) do update set
  name = excluded.name,
  description = excluded.description,
  travel_tip = excluded.travel_tip,
  updated_at = now();

insert into public.place_translations (place_id, locale, name, description, travel_tip)
select id, 'ko'::app_locale, name_ko, short_description_ko, tips_ko
from public.places
on conflict (place_id, locale) do update set
  name = excluded.name,
  description = excluded.description,
  travel_tip = excluded.travel_tip,
  updated_at = now();

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists place_translations_locale_idx on public.place_translations(locale);
create index if not exists place_translations_search_idx on public.place_translations using gin (
  to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(travel_tip, ''))
);
create index if not exists place_sources_place_provider_idx on public.place_sources(place_id, provider);
create index if not exists place_saves_user_created_idx on public.place_saves(user_id, created_at desc);
create index if not exists place_saves_place_idx on public.place_saves(place_id);
create index if not exists place_submissions_status_created_idx on public.place_submissions(status, created_at desc);
create index if not exists place_submissions_user_idx on public.place_submissions(user_id);
create index if not exists place_events_place_starts_idx on public.place_events(place_id, starts_at);
create index if not exists place_events_status_starts_idx on public.place_events(status, starts_at);
create index if not exists place_corrections_place_status_idx on public.place_corrections(place_id, status);
create index if not exists place_corrections_user_idx on public.place_corrections(user_id);

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

alter table public.profiles enable row level security;
alter table public.place_translations enable row level security;
alter table public.place_sources enable row level security;
alter table public.place_saves enable row level security;
alter table public.place_submissions enable row level security;
alter table public.place_events enable row level security;
alter table public.place_corrections enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "Public can read active place translations" on public.place_translations;
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

drop policy if exists "Admins can manage place translations" on public.place_translations;
create policy "Admins can manage place translations"
on public.place_translations for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read active place sources" on public.place_sources;
create policy "Public can read active place sources"
on public.place_sources for select
using (
  exists (
    select 1
    from public.places
    where places.id = place_sources.place_id
      and places.is_active = true
  )
);

drop policy if exists "Admins can manage place sources" on public.place_sources;
create policy "Admins can manage place sources"
on public.place_sources for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can manage own place saves" on public.place_saves;
create policy "Users can manage own place saves"
on public.place_saves for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Public can create place submissions" on public.place_submissions;
create policy "Public can create place submissions"
on public.place_submissions for insert
with check (true);

drop policy if exists "Users can read own place submissions" on public.place_submissions;
create policy "Users can read own place submissions"
on public.place_submissions for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage place submissions" on public.place_submissions;
create policy "Admins can manage place submissions"
on public.place_submissions for all
using (public.is_admin())
with check (public.is_admin());

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
  )
);

drop policy if exists "Admins can manage place events" on public.place_events;
create policy "Admins can manage place events"
on public.place_events for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can create place corrections" on public.place_corrections;
create policy "Public can create place corrections"
on public.place_corrections for insert
with check (true);

drop policy if exists "Users can read own place corrections" on public.place_corrections;
create policy "Users can read own place corrections"
on public.place_corrections for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can manage place corrections" on public.place_corrections;
create policy "Admins can manage place corrections"
on public.place_corrections for all
using (public.is_admin())
with check (public.is_admin());

comment on table public.place_translations is
  'Locale-specific place content. Legacy name_zh/name_ko columns remain for compatibility until all readers migrate.';

comment on table public.place_sources is
  'Official API/SDK source references for NAVER, KAKAO, GOOGLE, or MANUAL entries. This table does not imply unofficial crawling.';
