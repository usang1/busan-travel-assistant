do $$
begin
  if not exists (select 1 from pg_type where typname = 'photo_spot_plan') then
    create type photo_spot_plan as enum ('free', 'pro');
  end if;
end $$;

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
  free_or_pro photo_spot_plan not null default 'free',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photo_spots_active_idx on public.photo_spots(is_active);

drop trigger if exists photo_spots_set_updated_at on public.photo_spots;
create trigger photo_spots_set_updated_at
before update on public.photo_spots
for each row execute function public.set_updated_at();

alter table public.photo_spots enable row level security;

drop policy if exists "Public can read active photo spots" on public.photo_spots;
create policy "Public can read active photo spots"
on public.photo_spots for select
using (is_active = true);

drop policy if exists "MVP admin can manage photo spots" on public.photo_spots;
create policy "MVP admin can manage photo spots"
on public.photo_spots for all
using (true)
with check (true);

comment on policy "MVP admin can manage photo spots" on public.photo_spots is
  'MVP용 임시 정책입니다. Supabase Auth 추가 후 authenticated/admin role 조건으로 교체하세요.';
