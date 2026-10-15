-- Non-destructive foundations for location/import workflows and product analytics.
-- This migration is intentionally additive. Apply only after reviewing it for the target project.

alter type public.place_action_event_type add value if not exists 'page_view';
alter type public.place_action_event_type add value if not exists 'place_search';
alter type public.place_action_event_type add value if not exists 'place_import_search';
alter type public.place_action_event_type add value if not exists 'place_import_applied';
alter type public.place_action_event_type add value if not exists 'place_import_modified';
alter type public.place_action_event_type add value if not exists 'location_requested';
alter type public.place_action_event_type add value if not exists 'location_succeeded';
alter type public.place_action_event_type add value if not exists 'location_failed';
alter type public.place_action_event_type add value if not exists 'address_search';
alter type public.place_action_event_type add value if not exists 'map_location_selected';
alter type public.place_action_event_type add value if not exists 'coordinate_save_failed';
alter type public.place_action_event_type add value if not exists 'phone_click';
alter type public.place_action_event_type add value if not exists 'menu_view';
alter type public.place_action_event_type add value if not exists 'coupon_issued';
alter type public.place_action_event_type add value if not exists 'coupon_redeemed';
alter type public.place_action_event_type add value if not exists 'stay_qr_landing';
alter type public.place_action_event_type add value if not exists 'business_application_submitted';
alter type public.place_action_event_type add value if not exists 'admin_review_completed';

alter table public.places
  add constraint places_coordinate_pair_check
    check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null)) not valid,
  add constraint places_latitude_range_check
    check (latitude is null or latitude between -90 and 90) not valid,
  add constraint places_longitude_range_check
    check (longitude is null or longitude between -180 and 180) not valid;

create table if not exists public.place_imports (
  id uuid primary key default gen_random_uuid(),
  imported_by uuid not null references auth.users(id) on delete cascade,
  target_place_id uuid references public.places(id) on delete set null,
  provider text not null check (provider in ('google', 'naver', 'kakao', 'manual')),
  source_place_id text,
  source_url text,
  original_data jsonb not null default '{}'::jsonb check (jsonb_typeof(original_data) = 'object'),
  proposed_data jsonb not null default '{}'::jsonb check (jsonb_typeof(proposed_data) = 'object'),
  manually_overridden_fields text[] not null default '{}',
  import_status text not null default 'draft' check (import_status in ('draft', 'applied', 'failed', 'discarded')),
  verification_status text not null default 'owner_review' check (verification_status in ('owner_review', 'admin_review', 'verified', 'rejected')),
  data_confidence numeric(4,3) check (data_confidence is null or data_confidence between 0 and 1),
  source_updated_at timestamptz,
  imported_at timestamptz not null default now(),
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_place_id is not null or source_url is not null or provider = 'manual')
);

create index if not exists place_imports_importer_created_idx on public.place_imports(imported_by, created_at desc);
create index if not exists place_imports_target_status_idx on public.place_imports(target_place_id, verification_status, created_at desc);
create index if not exists place_imports_provider_external_idx on public.place_imports(provider, source_place_id) where source_place_id is not null;

create table if not exists public.place_import_logs (
  id bigint generated always as identity primary key,
  import_id uuid references public.place_imports(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('searched', 'selected', 'applied', 'modified', 'submitted', 'verified', 'rejected', 'failed')),
  field_name text,
  original_value jsonb,
  changed_value jsonb,
  change_reason text,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists place_import_logs_import_created_idx on public.place_import_logs(import_id, created_at desc);

create table if not exists public.place_verification_requests (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  import_id uuid references public.place_imports(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'changes_requested', 'approved', 'rejected')),
  requested_changes jsonb not null default '{}'::jsonb check (jsonb_typeof(requested_changes) = 'object'),
  reviewer_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_verification_requests_place_status_idx on public.place_verification_requests(place_id, status, created_at desc);

create table if not exists public.geocoding_cache (
  cache_key text primary key,
  provider text not null check (provider in ('kakao', 'naver', 'google')),
  direction text not null check (direction in ('forward', 'reverse')),
  request_data jsonb not null check (jsonb_typeof(request_data) = 'object'),
  response_data jsonb check (response_data is null or jsonb_typeof(response_data) = 'object'),
  result_count integer not null default 0 check (result_count >= 0),
  failure_code text,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists geocoding_cache_expiry_idx on public.geocoding_cache(expires_at);

alter table public.place_imports enable row level security;
alter table public.place_import_logs enable row level security;
alter table public.place_verification_requests enable row level security;
alter table public.geocoding_cache enable row level security;

create policy "Importers read own place imports" on public.place_imports for select to authenticated
using (imported_by = auth.uid() or public.is_admin());
create policy "Users create own unverified place imports" on public.place_imports for insert to authenticated
with check (imported_by = auth.uid() and verification_status = 'owner_review' and verified_by is null and verified_at is null);
create policy "Admins manage place imports" on public.place_imports for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Importers read own import logs" on public.place_import_logs for select to authenticated
using (public.is_admin() or exists (select 1 from public.place_imports i where i.id = import_id and i.imported_by = auth.uid()));
create policy "Admins manage import logs" on public.place_import_logs for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Requesters read own verification requests" on public.place_verification_requests for select to authenticated
using (requested_by = auth.uid() or public.is_admin());
create policy "Owners create place verification requests" on public.place_verification_requests for insert to authenticated
with check (
  requested_by = auth.uid()
  and status = 'pending'
  and exists (
    select 1 from public.business_place_memberships membership
    where membership.place_id = place_verification_requests.place_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);
create policy "Admins manage verification requests" on public.place_verification_requests for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage geocoding cache" on public.geocoding_cache for all to authenticated
using (public.is_admin()) with check (public.is_admin());

comment on table public.place_imports is 'Unpublished external place snapshots. Original provider values are retained separately from owner edits and require verification before publication.';
comment on table public.geocoding_cache is 'Server-managed short-lived official geocoding responses. Do not expose provider credentials or retain responses beyond operational need.';
