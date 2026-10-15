-- Additive stay partnership, recommendation, and QR campaign model.

create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 160),
  stay_type text not null check (stay_type in ('hotel', 'hostel', 'guesthouse', 'residence', 'pension', 'other')),
  address text not null,
  road_address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  image_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  supported_locales app_locale[] not null default array['ko'::app_locale, 'zh'::app_locale, 'en'::app_locale, 'ja'::app_locale],
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'active', 'suspended', 'rejected')),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists stays_status_created_idx on public.stays(status, created_at desc);
create index if not exists stays_coordinates_idx on public.stays(latitude, longitude);

create table if not exists public.stay_members (
  stay_id uuid not null references public.stays(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'manager' check (role in ('owner', 'manager', 'viewer')),
  status text not null default 'active' check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (stay_id, user_id)
);

create index if not exists stay_members_user_status_idx on public.stay_members(user_id, status);

create table if not exists public.stay_recommendations (
  stay_id uuid not null references public.stays(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0),
  note_ko text,
  note_zh text,
  note_en text,
  note_ja text,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (stay_id, place_id)
);

create index if not exists stay_recommendations_stay_order_idx on public.stay_recommendations(stay_id, is_active, sort_order);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  name text not null,
  channel text not null check (channel in ('xiaohongshu', 'instagram', 'naver_blog', 'google_search', 'stay_qr', 'place_qr', 'direct', 'other')),
  place_id uuid references public.places(id) on delete cascade,
  stay_id uuid references public.stays(id) on delete cascade,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  is_sponsored boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists marketing_campaigns_owner_idx on public.marketing_campaigns(created_by, status, created_at desc);
create index if not exists marketing_campaigns_place_idx on public.marketing_campaigns(place_id, status) where place_id is not null;
create index if not exists marketing_campaigns_stay_idx on public.marketing_campaigns(stay_id, status) where stay_id is not null;

create table if not exists public.qr_campaigns (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{5,79}$'),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  stay_id uuid references public.stays(id) on delete cascade,
  place_id uuid references public.places(id) on delete cascade,
  destination_path text not null check (destination_path like '/%'),
  label text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'expired')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (stay_id is not null or place_id is not null)
);

create index if not exists qr_campaigns_stay_status_idx on public.qr_campaigns(stay_id, status) where stay_id is not null;
create index if not exists qr_campaigns_place_status_idx on public.qr_campaigns(place_id, status) where place_id is not null;

create or replace function public.can_manage_stay(target_stay_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.stay_members
    where stay_id = target_stay_id and user_id = auth.uid() and status = 'active' and role in ('owner', 'manager')
  );
$$;
grant execute on function public.can_manage_stay(uuid) to authenticated;

alter table public.stays enable row level security;
alter table public.stay_members enable row level security;
alter table public.stay_recommendations enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.qr_campaigns enable row level security;

create policy "Public reads active stays" on public.stays for select using (status = 'active' or public.can_manage_stay(id));
create policy "Admins manage stays" on public.stays for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Members read their stay memberships" on public.stay_members for select to authenticated using (user_id = auth.uid() or public.can_manage_stay(stay_id));
create policy "Admins manage stay memberships" on public.stay_members for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Public reads active stay recommendations" on public.stay_recommendations for select
using (is_active and exists (select 1 from public.stays where stays.id = stay_id and stays.status = 'active'));
create policy "Stay managers manage recommendations" on public.stay_recommendations for all to authenticated
using (public.can_manage_stay(stay_id)) with check (public.can_manage_stay(stay_id));

create policy "Campaign owners read campaigns" on public.marketing_campaigns for select to authenticated
using (public.is_admin() or created_by = auth.uid() or (stay_id is not null and public.can_manage_stay(stay_id)));
create policy "Admins manage campaigns" on public.marketing_campaigns for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Public reads active QR campaigns" on public.qr_campaigns for select using (status = 'active');
create policy "Stay managers manage QR campaigns" on public.qr_campaigns for all to authenticated
using (public.is_admin() or (stay_id is not null and public.can_manage_stay(stay_id)))
with check (public.is_admin() or (stay_id is not null and public.can_manage_stay(stay_id)));

comment on table public.stays is 'Approved accommodation partners. Contact fields are never selected by public landing queries.';
comment on table public.qr_campaigns is 'QR creation records. Actual scans are measured by landing events, never by QR creation counts.';
