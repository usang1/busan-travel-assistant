begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'traveler_verification_status') then
    create type public.traveler_verification_status as enum (
      'verified', 'partially_verified', 'unverified', 'stale', 'conflicting', 'rejected'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'place_fact_source_type') then
    create type public.place_fact_source_type as enum (
      'official_source', 'owner_merchant', 'administrator', 'traveler_report', 'inferred', 'unverified'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'worth_detour_level') then
    create type public.worth_detour_level as enum (
      'nearby_only', 'worth_short_detour', 'worth_long_detour', 'destination'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'place_travel_mode') then
    create type public.place_travel_mode as enum ('walk', 'transit', 'taxi', 'car', 'mixed');
  end if;
  if not exists (select 1 from pg_type where typname = 'moderation_status') then
    create type public.moderation_status as enum ('pending', 'approved', 'rejected', 'needs_review');
  end if;
end $$;

create table public.place_decision_profiles (
  place_id uuid primary key references public.places(id) on delete cascade,
  tourist_fit_score numeric(5,2) check (tourist_fit_score is null or tourist_fit_score between 0 and 100),
  recommended_for text[] not null default '{}',
  not_recommended_for text[] not null default '{}',
  primary_warning jsonb not null default '{}'::jsonb check (jsonb_typeof(primary_warning) = 'object'),
  visit_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(visit_summary) = 'object'),
  worth_detour_level public.worth_detour_level,
  solo_difficulty smallint check (solo_difficulty is null or solo_difficulty between 1 and 5),
  foreigner_difficulty smallint check (foreigner_difficulty is null or foreigner_difficulty between 1 and 5),
  confidence_score numeric(5,2) check (confidence_score is null or confidence_score between 0 and 100),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  last_verified_at timestamptz,
  verification_status public.traveler_verification_status not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_decision_recommendation_has_evidence check (
    (tourist_fit_score is null and cardinality(recommended_for) = 0 and worth_detour_level is null)
    or evidence_count > 0
  ),
  constraint place_decision_score_has_confidence check (
    tourist_fit_score is null or confidence_score is not null
  ),
  constraint place_decision_verified_has_date check (
    verification_status not in ('verified', 'partially_verified') or last_verified_at is not null
  )
);

alter table public.place_china_info
  add column if not exists sweetness_level smallint,
  add column if not exists taste_notes_zh text,
  add column if not exists taste_notes_ko text,
  add column if not exists taste_notes_en text,
  add column if not exists taste_notes_ja text,
  add column if not exists kiosk_language_support jsonb not null default '{"status":"unknown","languages":[]}'::jsonb,
  add column if not exists restroom_location_note text,
  add column if not exists minimum_order_amount integer,
  add column if not exists wheelchair_access public.place_fact_tristate not null default 'unknown',
  add column if not exists elevator public.place_fact_tristate not null default 'unknown',
  add column if not exists stroller_friendly public.place_fact_tristate not null default 'unknown',
  add column if not exists power_outlet public.place_fact_tristate not null default 'unknown',
  add column if not exists wifi public.place_fact_tristate not null default 'unknown',
  add column if not exists smoking_policy text,
  add column if not exists queue_available public.place_fact_tristate not null default 'unknown',
  add column if not exists queue_method text;

alter table public.place_china_info
  add constraint place_china_info_sweetness_level_check check (sweetness_level is null or sweetness_level between 1 and 5),
  add constraint place_china_info_minimum_order_amount_check check (minimum_order_amount is null or minimum_order_amount >= 0),
  add constraint place_china_info_kiosk_language_support_check check (
    jsonb_typeof(kiosk_language_support) = 'object'
    and kiosk_language_support->>'status' in ('yes', 'no', 'unknown')
    and jsonb_typeof(kiosk_language_support->'languages') = 'array'
  ),
  add constraint place_china_info_smoking_policy_check check (
    smoking_policy is null or smoking_policy in ('non_smoking', 'smoking_area', 'smoking_allowed')
  );

create table public.place_operating_profiles (
  place_id uuid primary key references public.places(id) on delete cascade,
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  structured_operating_hours jsonb not null default '[]'::jsonb check (jsonb_typeof(structured_operating_hours) = 'array'),
  last_order_time time,
  temporary_closures jsonb not null default '[]'::jsonb check (jsonb_typeof(temporary_closures) = 'array'),
  recommended_time_ranges jsonb not null default '[]'::jsonb check (jsonb_typeof(recommended_time_ranges) = 'array'),
  avoid_time_ranges jsonb not null default '[]'::jsonb check (jsonb_typeof(avoid_time_ranges) = 'array'),
  wait_time_by_weekday_hour jsonb not null default '{}'::jsonb check (jsonb_typeof(wait_time_by_weekday_hour) = 'object'),
  sellout_risk_by_hour jsonb not null default '{}'::jsonb check (jsonb_typeof(sellout_risk_by_hour) = 'object'),
  photo_time_ranges jsonb not null default '[]'::jsonb check (jsonb_typeof(photo_time_ranges) = 'array'),
  seasonal_availability jsonb not null default '[]'::jsonb check (jsonb_typeof(seasonal_availability) = 'array'),
  holiday_notes jsonb not null default '{}'::jsonb check (jsonb_typeof(holiday_notes) = 'object'),
  verification_status public.traveler_verification_status not null default 'unverified',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (verification_status not in ('verified', 'partially_verified') or last_verified_at is not null)
);

alter table public.place_menu_items
  add column if not exists localized_name jsonb not null default '{}'::jsonb,
  add column if not exists korean_original_name text not null default '',
  add column if not exists recommendation_status public.place_fact_tristate not null default 'unknown',
  add column if not exists recommendation_basis text,
  add column if not exists spicy_level smallint,
  add column if not exists oily_level smallint,
  add column if not exists aroma_level smallint,
  add column if not exists portion_size smallint,
  add column if not exists recommended_party_size smallint,
  add column if not exists ordering_note jsonb not null default '{}'::jsonb,
  add column if not exists menu_warning jsonb not null default '{}'::jsonb,
  add column if not exists availability_time jsonb not null default '[]'::jsonb,
  add column if not exists sold_out_risk smallint,
  add column if not exists updated_at timestamptz not null default now();

update public.place_menu_items
set localized_name = jsonb_strip_nulls(jsonb_build_object('ko', nullif(name_ko, ''), 'zh', nullif(name_zh, ''))),
    korean_original_name = name_ko,
    recommendation_status = 'unknown'::public.place_fact_tristate
where localized_name = '{}'::jsonb;

alter table public.place_menu_items
  add constraint place_menu_localized_name_check check (jsonb_typeof(localized_name) = 'object'),
  add constraint place_menu_spicy_level_check check (spicy_level is null or spicy_level between 1 and 5),
  add constraint place_menu_oily_level_check check (oily_level is null or oily_level between 1 and 5),
  add constraint place_menu_aroma_level_check check (aroma_level is null or aroma_level between 1 and 5),
  add constraint place_menu_portion_size_check check (portion_size is null or portion_size between 1 and 5),
  add constraint place_menu_party_size_check check (recommended_party_size is null or recommended_party_size between 1 and 20),
  add constraint place_menu_ordering_note_check check (jsonb_typeof(ordering_note) = 'object'),
  add constraint place_menu_warning_check check (jsonb_typeof(menu_warning) = 'object'),
  add constraint place_menu_availability_check check (jsonb_typeof(availability_time) = 'array'),
  add constraint place_menu_sold_out_risk_check check (sold_out_risk is null or sold_out_risk between 1 and 5),
  add constraint place_menu_recommendation_basis_check check (
    recommendation_status <> 'yes' or length(trim(coalesce(recommendation_basis, ''))) > 0
  );

create table public.place_fact_evidence (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z][a-z0-9_.]{1,99}$'),
  fact_value jsonb,
  source_type public.place_fact_source_type not null default 'unverified',
  source_label text not null default '' check (length(source_label) <= 200),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  observed_at timestamptz,
  verified_at timestamptz,
  verification_status public.traveler_verification_status not null default 'unverified',
  notes text check (length(notes) <= 4000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_fact_evidence_verified_source check (
    verification_status not in ('verified', 'partially_verified')
    or (source_type <> 'unverified' and observed_at is not null)
  )
);

create table public.place_connections (
  id uuid primary key default gen_random_uuid(),
  from_place_id uuid not null references public.places(id) on delete cascade,
  to_place_id uuid not null references public.places(id) on delete cascade,
  travel_minutes smallint check (travel_minutes is null or travel_minutes between 0 and 1440),
  travel_distance integer check (travel_distance is null or travel_distance >= 0),
  travel_mode public.place_travel_mode,
  sequence_reason jsonb not null default '{}'::jsonb check (jsonb_typeof(sequence_reason) = 'object'),
  valid_time_ranges jsonb not null default '[]'::jsonb check (jsonb_typeof(valid_time_ranges) = 'array'),
  weather_conditions text[] not null default '{}',
  trip_theme text[] not null default '{}',
  active boolean not null default true,
  priority smallint not null default 0 check (priority between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_place_id, to_place_id),
  check (from_place_id <> to_place_id)
);

alter table public.guides
  add column if not exists trip_themes text[] not null default '{}',
  add column if not exists estimated_cost_min integer,
  add column if not exists estimated_cost_max integer,
  add column if not exists recommended_start_time time,
  add column if not exists verification_status public.traveler_verification_status not null default 'unverified',
  add column if not exists last_verified_at timestamptz;

alter table public.guides
  add constraint guides_estimated_cost_check check (
    (estimated_cost_min is null or estimated_cost_min >= 0)
    and (estimated_cost_max is null or estimated_cost_max >= 0)
    and (estimated_cost_min is null or estimated_cost_max is null or estimated_cost_max >= estimated_cost_min)
  );

alter table public.guide_places
  add column if not exists travel_minutes smallint,
  add column if not exists travel_mode public.place_travel_mode;

alter table public.guide_places
  add constraint guide_places_travel_minutes_check check (travel_minutes is null or travel_minutes between 0 and 1440);

create table public.user_trust_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trust_score numeric(6,3) not null default 1 check (trust_score between 0 and 100),
  approved_report_count integer not null default 0 check (approved_report_count >= 0),
  rejected_report_count integer not null default 0 check (rejected_report_count >= 0),
  updated_at timestamptz not null default now()
);

create table public.place_checkins (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  device_hash text,
  observed_at timestamptz not null,
  locale public.app_locale not null default 'ko',
  verification_method text not null check (verification_method in ('authenticated', 'location', 'receipt', 'photo', 'manual')),
  moderation_status public.moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  check ((user_id is not null)::integer + (device_hash is not null)::integer = 1),
  check (device_hash is null or device_hash ~ '^[a-f0-9]{64}$')
);

create table public.place_fact_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  fact_type text not null check (fact_type ~ '^[a-z][a-z0-9_.]{1,99}$'),
  fact_value jsonb not null,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  locale public.app_locale not null default 'ko',
  user_id uuid references auth.users(id) on delete cascade,
  device_hash text,
  verification_method text not null check (verification_method in ('authenticated', 'location', 'receipt', 'photo', 'manual')),
  moderation_status public.moderation_status not null default 'pending',
  trust_weight numeric(6,3) check (trust_weight is null or trust_weight between 0 and 100),
  moderator_id uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  check ((user_id is not null)::integer + (device_hash is not null)::integer = 1),
  check (device_hash is null or device_hash ~ '^[a-f0-9]{64}$')
);

create table public.place_fact_votes (
  report_id uuid not null references public.place_fact_reports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);

create table public.place_report_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.place_fact_reports(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('photo', 'receipt', 'official_link', 'note')),
  storage_path text,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  file_sha256 text check (file_sha256 is null or file_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  check (storage_path is not null or source_url is not null or file_sha256 is not null)
);

create table public.sns_place_mappings (
  id uuid primary key default gen_random_uuid(),
  source_platform text not null check (source_platform in ('xiaohongshu', 'instagram', 'tiktok', 'youtube', 'other')),
  source_url_hash text not null check (source_url_hash ~ '^[a-f0-9]{64}$'),
  extracted_place_terms text[] not null default '{}',
  extracted_region_terms text[] not null default '{}',
  place_alias text not null default '' check (length(place_alias) <= 300),
  alias_locale public.app_locale,
  match_confidence numeric(5,2) check (match_confidence is null or match_confidence between 0 and 100),
  confirmed_place_id uuid references public.places(id) on delete set null,
  moderation_status public.moderation_status not null default 'pending',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_platform, source_url_hash)
);

create table public.sns_place_candidates (
  mapping_id uuid not null references public.sns_place_mappings(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  confidence numeric(5,2) check (confidence is null or confidence between 0 and 100),
  primary key (mapping_id, place_id)
);

create index place_decision_verification_idx on public.place_decision_profiles(verification_status, last_verified_at desc);
create index place_fact_evidence_place_field_idx on public.place_fact_evidence(place_id, field_key, verified_at desc);
create index place_connections_from_active_idx on public.place_connections(from_place_id, active, priority desc);
create index place_connections_to_idx on public.place_connections(to_place_id);
create index place_checkins_place_observed_idx on public.place_checkins(place_id, observed_at desc);
create index place_fact_reports_moderation_idx on public.place_fact_reports(place_id, moderation_status, observed_at desc);
create index sns_place_mappings_moderation_idx on public.sns_place_mappings(moderation_status, created_at desc);

create trigger place_decision_profiles_set_updated_at before update on public.place_decision_profiles
for each row execute function public.set_updated_at();
create trigger place_operating_profiles_set_updated_at before update on public.place_operating_profiles
for each row execute function public.set_updated_at();
create trigger place_menu_items_decision_set_updated_at before update on public.place_menu_items
for each row execute function public.set_updated_at();
create trigger place_fact_evidence_set_updated_at before update on public.place_fact_evidence
for each row execute function public.set_updated_at();
create trigger place_connections_set_updated_at before update on public.place_connections
for each row execute function public.set_updated_at();
create trigger user_trust_profiles_set_updated_at before update on public.user_trust_profiles
for each row execute function public.set_updated_at();
create trigger sns_place_mappings_set_updated_at before update on public.sns_place_mappings
for each row execute function public.set_updated_at();

create or replace function public.refresh_place_decision_evidence_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  affected_place_id uuid := coalesce(new.place_id, old.place_id);
  counted integer;
begin
  select count(*)::integer into counted
  from public.place_fact_evidence
  where place_id = affected_place_id
    and verification_status in ('verified', 'partially_verified');

  update public.place_decision_profiles
  set evidence_count = counted,
      tourist_fit_score = case when counted = 0 then null else tourist_fit_score end,
      confidence_score = case when counted = 0 then null else confidence_score end,
      recommended_for = case when counted = 0 then '{}'::text[] else recommended_for end,
      worth_detour_level = case when counted = 0 then null else worth_detour_level end,
      verification_status = case when counted = 0 then 'unverified'::public.traveler_verification_status else verification_status end
  where place_id = affected_place_id;
  return coalesce(new, old);
end;
$$;

create trigger refresh_place_decision_evidence_count
after insert or update or delete on public.place_fact_evidence
for each row execute function public.refresh_place_decision_evidence_count();

alter table public.place_decision_profiles enable row level security;
alter table public.place_operating_profiles enable row level security;
alter table public.place_fact_evidence enable row level security;
alter table public.place_connections enable row level security;
alter table public.user_trust_profiles enable row level security;
alter table public.place_checkins enable row level security;
alter table public.place_fact_reports enable row level security;
alter table public.place_fact_votes enable row level security;
alter table public.place_report_evidence enable row level security;
alter table public.sns_place_mappings enable row level security;
alter table public.sns_place_candidates enable row level security;

create policy "Public reads published place decisions" on public.place_decision_profiles for select to anon, authenticated
using (verification_status in ('verified', 'partially_verified', 'stale', 'conflicting') and exists (
  select 1 from public.places p where p.id = place_id and p.is_active and p.status in ('PUBLISHED', 'ACTIVE')
));
create policy "Admins manage place decisions" on public.place_decision_profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Public reads published operating profiles" on public.place_operating_profiles for select to anon, authenticated
using (verification_status in ('verified', 'partially_verified', 'stale', 'conflicting')
  and exists (select 1 from public.places p where p.id = place_id and p.is_active and p.status in ('PUBLISHED', 'ACTIVE')));
create policy "Admins manage operating profiles" on public.place_operating_profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage fact evidence" on public.place_fact_evidence for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Public reads active place connections" on public.place_connections for select to anon, authenticated
using (active and exists (select 1 from public.places p where p.id = from_place_id and p.is_active and p.status in ('PUBLISHED','ACTIVE'))
  and exists (select 1 from public.places p where p.id = to_place_id and p.is_active and p.status in ('PUBLISHED','ACTIVE')));
create policy "Admins manage place connections" on public.place_connections for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Users read own trust profile" on public.user_trust_profiles for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage trust profiles" on public.user_trust_profiles for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Users manage own checkins" on public.place_checkins for all to authenticated
using (user_id = auth.uid() or public.is_admin())
with check ((user_id = auth.uid() and device_hash is null and moderation_status = 'pending') or public.is_admin());
create policy "Users read own reports" on public.place_fact_reports for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy "Users create pending reports" on public.place_fact_reports for insert to authenticated
with check (user_id = auth.uid() and device_hash is null and moderation_status = 'pending' and trust_weight is null);
create policy "Admins manage reports" on public.place_fact_reports for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Users read own votes" on public.place_fact_votes for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy "Users create own votes" on public.place_fact_votes for insert to authenticated
with check (user_id = auth.uid());
create policy "Users change own votes" on public.place_fact_votes for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users remove own votes" on public.place_fact_votes for delete to authenticated
using (user_id = auth.uid());
create policy "Users read own report evidence" on public.place_report_evidence for select to authenticated
using (public.is_admin() or exists (select 1 from public.place_fact_reports r where r.id = report_id and r.user_id = auth.uid()));
create policy "Users add own report evidence" on public.place_report_evidence for insert to authenticated
with check (exists (select 1 from public.place_fact_reports r where r.id = report_id and r.user_id = auth.uid() and r.moderation_status = 'pending'));
create policy "Admins manage report evidence" on public.place_report_evidence for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage SNS mappings" on public.sns_place_mappings for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage SNS candidates" on public.sns_place_candidates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select on public.place_decision_profiles, public.place_operating_profiles, public.place_connections to anon;
grant select, insert, update, delete on public.place_decision_profiles, public.place_operating_profiles,
  public.place_fact_evidence, public.place_connections, public.user_trust_profiles, public.place_checkins,
  public.place_fact_reports, public.place_fact_votes, public.place_report_evidence, public.sns_place_mappings,
  public.sns_place_candidates to authenticated;

comment on table public.place_decision_profiles is 'Admin-reviewed 30-second visit decisions. Scores stay null without verified evidence.';
comment on column public.place_decision_profiles.evidence_count is 'Maintained from verified or partially verified place_fact_evidence rows.';
comment on column public.place_china_info.greasy_level is 'Canonical storage for oily_level (1-5); null means unknown.';
comment on column public.place_china_info.smell_level is 'Canonical storage for aroma_level (1-5); null means unknown.';
comment on column public.place_china_info.ordering_difficulty is 'Canonical storage for order_difficulty (1-5); null means unknown.';
comment on table public.place_fact_evidence is 'Field-level provenance; raw traveler submissions remain private in place_fact_reports.';
comment on column public.sns_place_mappings.source_url_hash is 'SHA-256 of the normalized source URL. Raw social URLs are intentionally not stored.';
comment on table public.place_operating_profiles is 'Structured operating data interpreted only in Asia/Seoul.';

-- Replace the existing invoker RPC so course fields and stop travel data are saved in the same transaction.
-- Older clients preserve the newly added fields when they omit them.
create or replace function public.save_official_guide(
  target_id uuid, payload jsonb, expected_updated_at timestamptz default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  draft public.guides;
  saved_id uuid;
  previous_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(payload->'places') is distinct from 'array' or jsonb_array_length(payload->'places') > 80 then
    raise exception 'Invalid stops' using errcode = '22023';
  end if;
  draft := jsonb_populate_record(null::public.guides, payload);
  if draft.status = 'PUBLISHED' and coalesce(draft.verification_status, 'unverified') not in ('verified', 'partially_verified') then
    raise exception 'Only reviewed guides can be published' using errcode = '22023';
  end if;
  if draft.status = 'PUBLISHED' and exists (
    select 1 from jsonb_array_elements(payload->'places') item
    where not exists (select 1 from public.places p where p.id = (item->>'place_id')::uuid
      and p.is_active and p.status in ('PUBLISHED','ACTIVE'))
  ) then
    raise exception 'Only published places can be included in published guides' using errcode = '22023';
  end if;
  if target_id is null then
    insert into public.guides (
      slug, status, guide_type, title_ko, title_zh, title_en, title_ja,
      description_ko, description_zh, description_en, description_ja, cover_image, area,
      estimated_duration, recommended_for, weather_type, sort_order, is_featured, editorial,
      trip_themes, estimated_cost_min, estimated_cost_max, recommended_start_time,
      verification_status, last_verified_at
    ) values (
      draft.slug, draft.status, draft.guide_type, draft.title_ko, draft.title_zh, draft.title_en, draft.title_ja,
      draft.description_ko, draft.description_zh, draft.description_en, draft.description_ja, draft.cover_image, draft.area,
      draft.estimated_duration, draft.recommended_for, draft.weather_type, draft.sort_order, draft.is_featured,
      coalesce(draft.editorial, '{}'::jsonb), coalesce(draft.trip_themes, '{}'::text[]),
      draft.estimated_cost_min, draft.estimated_cost_max, draft.recommended_start_time,
      coalesce(draft.verification_status, 'unverified'), draft.last_verified_at
    ) returning id into saved_id;
  else
    select updated_at into previous_updated_at from public.guides where id = target_id for update;
    if not found then raise exception 'Guide not found' using errcode = 'P0002'; end if;
    if expected_updated_at is null or previous_updated_at <> expected_updated_at then
      raise exception 'Guide changed; reload before saving' using errcode = '40001';
    end if;
    update public.guides set
      slug = draft.slug, status = draft.status, guide_type = draft.guide_type,
      title_ko = draft.title_ko, title_zh = draft.title_zh, title_en = draft.title_en, title_ja = draft.title_ja,
      description_ko = draft.description_ko, description_zh = draft.description_zh,
      description_en = draft.description_en, description_ja = draft.description_ja,
      cover_image = draft.cover_image, area = draft.area, estimated_duration = draft.estimated_duration,
      recommended_for = draft.recommended_for, weather_type = draft.weather_type,
      sort_order = draft.sort_order, is_featured = draft.is_featured,
      editorial = coalesce(draft.editorial, guides.editorial),
      trip_themes = coalesce(draft.trip_themes, guides.trip_themes),
      estimated_cost_min = case when payload ? 'estimated_cost_min' then draft.estimated_cost_min else guides.estimated_cost_min end,
      estimated_cost_max = case when payload ? 'estimated_cost_max' then draft.estimated_cost_max else guides.estimated_cost_max end,
      recommended_start_time = case when payload ? 'recommended_start_time' then draft.recommended_start_time else guides.recommended_start_time end,
      verification_status = coalesce(draft.verification_status, guides.verification_status),
      last_verified_at = case when payload ? 'last_verified_at' then draft.last_verified_at else guides.last_verified_at end
    where id = target_id;
    saved_id := target_id;
    delete from public.guide_places where guide_id = saved_id;
  end if;
  insert into public.guide_places (
    guide_id, place_id, sequence, custom_title, custom_description, stay_minutes,
    transportation_note, tip, travel_minutes, travel_mode
  )
  select saved_id, (item->>'place_id')::uuid, (ordinality - 1)::integer,
    coalesce(item->'custom_title','{}'), coalesce(item->'custom_description','{}'),
    nullif(item->>'stay_minutes','')::integer, coalesce(item->'transportation_note','{}'),
    coalesce(item->'tip','{}'), nullif(item->>'travel_minutes','')::integer,
    nullif(item->>'travel_mode','')::public.place_travel_mode
  from jsonb_array_elements(payload->'places') with ordinality as stops(item, ordinality);
  return saved_id;
end;
$$;
revoke all on function public.save_official_guide(uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.save_official_guide(uuid,jsonb,timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
