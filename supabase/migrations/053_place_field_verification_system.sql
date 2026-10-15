-- Field-level provenance and three-stage verification.
-- Additive only: existing place data remains unchanged and is never promoted.

begin;

create table if not exists public.place_data_sources (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  source_type text not null check (source_type in ('map_api', 'official_website', 'official_menu', 'owner', 'admin', 'field_visit', 'csv', 'manual')),
  provider text,
  external_id text,
  source_url text,
  raw_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_snapshot) = 'object'),
  collected_at timestamptz not null default now(),
  collected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (source_url is null or source_url ~* '^https?://'),
  check (source_type in ('admin', 'manual', 'field_visit') or provider is not null or source_url is not null)
);

create index if not exists place_data_sources_place_collected_idx
  on public.place_data_sources(place_id, collected_at desc);
create unique index if not exists place_data_sources_external_uidx
  on public.place_data_sources(place_id, source_type, provider, external_id)
  where external_id is not null;

create table if not exists public.place_verification_field_rules (
  field_name text primary key check (field_name ~ '^[a-z][a-z0-9_]{0,63}$'),
  stale_after_days integer not null check (stale_after_days between 1 and 3650),
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.place_verification_field_rules(field_name, stale_after_days) values
  ('opening_hours', 30), ('menu_price', 60), ('phone', 90),
  ('address', 180), ('coordinates', 180), ('website', 180),
  ('category', 180), ('parking', 90), ('reservation', 90),
  ('card_payment', 90), ('solo_friendly', 90), ('foreign_language', 90),
  ('waiting', 30), ('operating_status', 30)
on conflict (field_name) do nothing;

create table if not exists public.place_verification_visits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  visited_on date not null,
  visitor_id uuid not null references auth.users(id) on delete restrict,
  actual_visit boolean not null default false,
  visited_menu text,
  checked_fields text[] not null default '{}',
  advantages text,
  disadvantages text,
  overall_assessment text,
  private_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(checked_fields) <= 64)
);

create index if not exists place_verification_visits_place_date_idx
  on public.place_verification_visits(place_id, visited_on desc);

create or replace function public.reject_future_place_verification_visit()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.actual_visit and new.visited_on > current_date then
    raise exception 'future_field_visit_not_allowed' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists place_verification_visits_reject_future on public.place_verification_visits;
create trigger place_verification_visits_reject_future
before insert or update on public.place_verification_visits
for each row execute function public.reject_future_place_verification_visit();

create table if not exists public.place_verification_photos (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.place_verification_visits(id) on delete cascade,
  storage_url text not null check (storage_url ~* '^https?://'),
  caption text,
  captured_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists place_verification_photos_visit_idx
  on public.place_verification_photos(visit_id, created_at);

create table if not exists public.place_field_verifications (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  field_name text not null check (field_name ~ '^[a-z][a-z0-9_]{0,63}$'),
  current_value jsonb,
  original_value jsonb,
  source_id uuid references public.place_data_sources(id) on delete set null,
  source_type text not null check (source_type in ('map_api', 'official_website', 'official_menu', 'owner', 'admin', 'field_visit', 'csv', 'manual')),
  source_url text,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'auto_imported', 'online_verified', 'owner_confirmed', 'field_verified', 'needs_recheck')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  visit_id uuid references public.place_verification_visits(id) on delete set null,
  private_notes text,
  has_conflict boolean not null default false,
  conflicting_value jsonb,
  conflicting_source_id uuid references public.place_data_sources(id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, field_name),
  check (source_url is null or source_url ~* '^https?://'),
  check (verification_status <> 'field_verified' or visit_id is not null),
  check (verification_status not in ('online_verified', 'owner_confirmed', 'field_verified') or verified_at is not null),
  check (not is_public or approval_status = 'approved'),
  check (source_type <> 'csv' or verification_status in ('unverified', 'auto_imported', 'needs_recheck'))
);

create index if not exists place_field_verifications_place_status_idx
  on public.place_field_verifications(place_id, verification_status, updated_at desc);
create index if not exists place_field_verifications_recheck_idx
  on public.place_field_verifications(approval_status, verified_at)
  where verification_status = 'needs_recheck';

create or replace function public.enforce_place_field_visit_evidence()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verification_status = 'field_verified' and not exists (
    select 1 from public.place_verification_visits visit
    where visit.id = new.visit_id
      and visit.place_id = new.place_id
      and visit.actual_visit = true
  ) then
    raise exception 'actual_field_visit_required' using errcode = '23514';
  end if;
  if new.verification_status = 'field_verified' and new.source_type <> 'field_visit' then
    raise exception 'field_visit_source_required' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists place_field_verifications_enforce_visit on public.place_field_verifications;
create trigger place_field_verifications_enforce_visit
before insert or update on public.place_field_verifications
for each row execute function public.enforce_place_field_visit_evidence();

create table if not exists public.place_change_history (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places(id) on delete cascade,
  field_name text not null,
  previous_value jsonb,
  next_value jsonb,
  source_type text,
  verification_status text,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  changed_by uuid references auth.users(id) on delete set null,
  change_reason text,
  changed_at timestamptz not null default now()
);

create index if not exists place_change_history_place_field_idx
  on public.place_change_history(place_id, field_name, changed_at desc);

create or replace function public.record_place_field_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or
     (new.current_value, new.verification_status, new.approval_status, new.source_id, new.source_url)
     is distinct from
     (old.current_value, old.verification_status, old.approval_status, old.source_id, old.source_url) then
    insert into public.place_change_history(
      place_id, field_name, previous_value, next_value, source_type,
      verification_status, approval_status, changed_by, change_reason
    ) values (
      new.place_id, new.field_name,
      case when tg_op = 'UPDATE' then old.current_value else new.original_value end,
      new.current_value, new.source_type, new.verification_status,
      new.approval_status, auth.uid(),
      case when tg_op = 'INSERT' then 'field_created' else 'field_updated' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists place_field_verifications_record_change on public.place_field_verifications;
create trigger place_field_verifications_record_change
after insert or update on public.place_field_verifications
for each row execute function public.record_place_field_change();

-- When the existing business-review transaction publishes an owner change,
-- record only factual owner-provided fields. Stronger online/field evidence is
-- never overwritten by this compatibility trigger.
create or replace function public.record_approved_owner_place_fields()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_place_id uuid;
  owner_source_id uuid;
  field record;
  owner_fields jsonb;
begin
  if new.status <> 'approved' or old.status = 'approved' then return new; end if;
  target_place_id := coalesce(new.published_place_id, new.place_id);
  if target_place_id is null then return new; end if;

  insert into public.place_data_sources(place_id, source_type, provider, external_id, source_url, raw_snapshot, collected_at, collected_by)
  values (
    target_place_id, 'owner', 'spotzari_business', new.id::text,
    case when new.payload->'source'->>'source_url' ~* '^https?://' then new.payload->'source'->>'source_url' else null end,
    new.payload, now(), new.user_id
  ) returning id into owner_source_id;

  owner_fields := jsonb_strip_nulls(jsonb_build_object(
    'name', nullif(new.payload->>'name_ko', ''),
    'address', nullif(new.payload->>'address_ko', ''),
    'coordinates', case when new.payload ? 'latitude' and new.payload ? 'longitude'
      then jsonb_build_object('latitude', new.payload->'latitude', 'longitude', new.payload->'longitude') end,
    'phone', nullif(new.payload->>'phone', ''),
    'category', nullif(new.payload->>'category', ''),
    'website', nullif(new.payload->>'website', ''),
    'map_link', nullif(new.payload->'source'->>'source_url', ''),
    'opening_hours', nullif(new.payload->>'opening_hours', ''),
    'menu', case when jsonb_typeof(new.payload->'menu_items') = 'array' and jsonb_array_length(new.payload->'menu_items') > 0 then new.payload->'menu_items' end,
    'card_payment', nullif(new.payload->'china_info'->>'foreign_card', 'unknown'),
    'solo_friendly', nullif(new.payload->'china_info'->>'solo_friendly', 'unknown'),
    'waiting', nullif(new.payload->'china_info'->>'waiting_level', 'unknown')
  ));

  for field in select key, value from jsonb_each(owner_fields) loop
    insert into public.place_field_verifications(
      place_id, field_name, current_value, original_value, source_id, source_type,
      verification_status, approval_status, verified_by, verified_at, is_public
    ) values (
      target_place_id, field.key, field.value, field.value, owner_source_id, 'owner',
      'owner_confirmed', 'approved', new.reviewed_by, coalesce(new.reviewed_at, now()), true
    )
    on conflict (place_id, field_name) do update set
      current_value = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.current_value else excluded.current_value end,
      source_id = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.source_id else excluded.source_id end,
      source_type = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.source_type else excluded.source_type end,
      verification_status = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.verification_status else excluded.verification_status end,
      approval_status = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.approval_status else excluded.approval_status end,
      verified_by = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.verified_by else excluded.verified_by end,
      verified_at = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.verified_at else excluded.verified_at end,
      is_public = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') then place_field_verifications.is_public else excluded.is_public end,
      has_conflict = place_field_verifications.verification_status in ('online_verified', 'field_verified') and place_field_verifications.current_value is distinct from excluded.current_value,
      conflicting_value = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') and place_field_verifications.current_value is distinct from excluded.current_value then excluded.current_value else null end,
      conflicting_source_id = case when place_field_verifications.verification_status in ('online_verified', 'field_verified') and place_field_verifications.current_value is distinct from excluded.current_value then excluded.source_id else null end,
      updated_at = now();
  end loop;
  return new;
end;
$$;

drop trigger if exists business_place_changes_record_owner_fields on public.business_place_changes;
create trigger business_place_changes_record_owner_fields
after update of status on public.business_place_changes
for each row execute function public.record_approved_owner_place_fields();

create table if not exists public.place_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  original_filename text not null,
  column_mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(column_mapping) = 'object'),
  status text not null default 'preview' check (status in ('preview', 'importing', 'completed', 'partial', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.place_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.place_import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_data) = 'object'),
  normalized_data jsonb not null default '{}'::jsonb check (jsonb_typeof(normalized_data) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'valid', 'duplicate', 'invalid', 'imported', 'skipped', 'failed')),
  errors text[] not null default '{}',
  duplicate_place_id uuid references public.places(id) on delete set null,
  imported_place_id uuid references public.places(id) on delete set null,
  action text check (action is null or action in ('create', 'skip', 'merge')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

create index if not exists place_import_rows_batch_status_idx
  on public.place_import_rows(batch_id, status, row_number);

alter table public.place_data_sources enable row level security;
alter table public.place_verification_field_rules enable row level security;
alter table public.place_verification_visits enable row level security;
alter table public.place_verification_photos enable row level security;
alter table public.place_field_verifications enable row level security;
alter table public.place_change_history enable row level security;
alter table public.place_import_batches enable row level security;
alter table public.place_import_rows enable row level security;

create policy "Admins manage place data sources" on public.place_data_sources for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage verification rules" on public.place_verification_field_rules for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage verification visits" on public.place_verification_visits for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage verification photos" on public.place_verification_photos for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage field verifications" on public.place_field_verifications for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins read change history" on public.place_change_history for select to authenticated
using (public.is_admin());

create policy "Admins manage import batches" on public.place_import_batches for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage import rows" on public.place_import_rows for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop view if exists public.public_place_field_verifications;
create view public.public_place_field_verifications
with (security_barrier = true) as
select
  verification.place_id,
  verification.field_name,
  verification.source_type,
  case
    when rule.enabled = true
      and coalesce(verification.verified_at, source.collected_at, verification.created_at)
        < now() - make_interval(days => rule.stale_after_days)
    then 'needs_recheck'
    else verification.verification_status
  end as verification_status,
  verification.verified_at,
  source.provider,
  source.collected_at
from public.place_field_verifications verification
left join public.place_data_sources source on source.id = verification.source_id
left join public.place_verification_field_rules rule on rule.field_name = verification.field_name
join public.places place on place.id = verification.place_id
where verification.approval_status = 'approved'
  and verification.is_public = true
  and verification.has_conflict = false
  and place.is_active = true
  and place.status in ('ACTIVE', 'PUBLISHED')
  and verification.verification_status in ('auto_imported', 'online_verified', 'owner_confirmed', 'field_verified', 'needs_recheck');

revoke all on public.place_data_sources, public.place_verification_visits,
  public.place_verification_photos, public.place_field_verifications,
  public.place_change_history, public.place_import_batches, public.place_import_rows from anon;
grant select on public.public_place_field_verifications to anon, authenticated;
revoke all on function public.reject_future_place_verification_visit() from public;
revoke all on function public.enforce_place_field_visit_evidence() from public;
revoke all on function public.record_place_field_change() from public;
revoke all on function public.record_approved_owner_place_fields() from public;

comment on table public.place_field_verifications is 'Current field-level value, provenance, approval, and verification state. Existing places are not auto-promoted.';
comment on table public.place_verification_visits is 'Administrator field visits. actual_visit must be true before any linked field can be marked field_verified.';
comment on view public.public_place_field_verifications is 'Sanitized, approved field verification metadata for public place pages.';

commit;
notify pgrst, 'reload schema';
