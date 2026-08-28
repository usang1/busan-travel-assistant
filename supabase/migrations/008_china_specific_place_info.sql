do $$
begin
  if not exists (select 1 from pg_type where typname = 'place_fact_tristate') then
    create type place_fact_tristate as enum ('yes', 'no', 'unknown');
  end if;

  if not exists (select 1 from pg_type where typname = 'china_waiting_level') then
    create type china_waiting_level as enum ('unknown', 'none', 'short', 'moderate', 'long', 'extreme');
  end if;

  if not exists (select 1 from pg_type where typname = 'place_verification_status') then
    create type place_verification_status as enum ('unverified', 'pending', 'verified', 'needs_review');
  end if;
end $$;

create table if not exists public.place_china_info (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null unique references public.places(id) on delete cascade,
  chinese_taste_score smallint check (chinese_taste_score is null or chinese_taste_score between 1 and 5),
  spicy_level smallint check (spicy_level is null or spicy_level between 1 and 5),
  greasy_level smallint check (greasy_level is null or greasy_level between 1 and 5),
  smell_level smallint check (smell_level is null or smell_level between 1 and 5),
  portion_level smallint check (portion_level is null or portion_level between 1 and 5),
  ordering_difficulty smallint check (ordering_difficulty is null or ordering_difficulty between 1 and 5),
  waiting_level china_waiting_level not null default 'unknown',
  chinese_menu place_fact_tristate not null default 'unknown',
  foreign_card place_fact_tristate not null default 'unknown',
  alipay place_fact_tristate not null default 'unknown',
  wechat_pay place_fact_tristate not null default 'unknown',
  solo_friendly place_fact_tristate not null default 'unknown',
  luggage_friendly place_fact_tristate not null default 'unknown',
  toilet_available place_fact_tristate not null default 'unknown',
  reservation_required place_fact_tristate not null default 'unknown',
  minimum_order_people smallint check (minimum_order_people is null or minimum_order_people between 1 and 10),
  xiaohongshu_popular place_fact_tristate not null default 'unknown',
  subway_walk_minutes smallint check (subway_walk_minutes is null or subway_walk_minutes >= 0),
  manual_summary_override text,
  manual_warning_override text,
  verification_status place_verification_status not null default 'unverified',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_china_info_place_idx on public.place_china_info(place_id);
create index if not exists place_china_info_scores_idx
on public.place_china_info(chinese_taste_score, ordering_difficulty, waiting_level);
create index if not exists place_china_info_verification_idx
on public.place_china_info(verification_status, verified_at desc);

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
  )
);

drop policy if exists "Admins can manage place China info" on public.place_china_info;
create policy "Admins can manage place China info"
on public.place_china_info for all
using (public.is_admin())
with check (public.is_admin());

grant select on public.place_china_info to anon, authenticated;
grant all on public.place_china_info to authenticated;

comment on type place_fact_tristate is
  'Reusable yes/no/unknown fact state. unknown means not verified and must not be treated as false.';

comment on type china_waiting_level is
  'Structured waiting intensity for China-focused place presentation.';

comment on type place_verification_status is
  'Reusable verification workflow state for structured place facts.';

comment on table public.place_china_info is
  'China-focused structured place facts for Chinese independent travelers. Kept separate from places for backward compatibility and future audience-specific expansion.';

comment on column public.place_china_info.chinese_taste_score is
  'How strongly the place is recommended for Chinese travelers, 1 to 5. Null means unreviewed.';

comment on column public.place_china_info.minimum_order_people is
  'Minimum required party size for ordering. Null means unknown, 1 means no multi-person minimum.';

comment on column public.place_china_info.manual_summary_override is
  'Optional admin-written Chinese summary override. Prefer generated copy from structured fields when null.';

comment on column public.place_china_info.manual_warning_override is
  'Optional admin-written Chinese warning override. Prefer generated copy from structured fields when null.';
