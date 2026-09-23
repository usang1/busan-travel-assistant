begin;

alter table public.sns_place_mappings
  add column if not exists input_kind text not null default 'text',
  add column if not exists extracted_station_terms text[] not null default '{}',
  add column if not exists extracted_menu_terms text[] not null default '{}',
  add column if not exists extracted_landmark_terms text[] not null default '{}',
  add column if not exists extracted_hashtags text[] not null default '{}',
  add column if not exists match_notes jsonb not null default '{}'::jsonb,
  add column if not exists processing_status text not null default 'completed',
  add column if not exists confirmed_by_user_at timestamptz,
  add column if not exists created_by_device_hash text;

alter table public.sns_place_mappings
  drop constraint if exists sns_place_mappings_input_kind_check,
  add constraint sns_place_mappings_input_kind_check
    check (input_kind in ('link', 'text', 'image', 'direct')),
  drop constraint if exists sns_place_mappings_processing_status_check,
  add constraint sns_place_mappings_processing_status_check
    check (processing_status in ('completed', 'no_match', 'ocr_unavailable', 'ocr_failed')),
  drop constraint if exists sns_place_mappings_device_hash_check,
  add constraint sns_place_mappings_device_hash_check
    check (created_by_device_hash is null or created_by_device_hash ~ '^[a-f0-9]{64}$'),
  drop constraint if exists sns_place_mappings_match_notes_check,
  add constraint sns_place_mappings_match_notes_check
    check (jsonb_typeof(match_notes) = 'object');

-- The original unique key made unrelated anonymous users share one moderation row.
-- Keep the hash searchable without treating a URL as a user identity.
alter table public.sns_place_mappings
  drop constraint if exists sns_place_mappings_source_platform_source_url_hash_key;

create index if not exists sns_place_mappings_source_hash_idx
  on public.sns_place_mappings(source_platform, source_url_hash);
create index if not exists sns_place_mappings_device_created_idx
  on public.sns_place_mappings(created_by_device_hash, created_at desc)
  where created_by_device_hash is not null;

alter table public.sns_place_candidates
  add column if not exists match_reasons text[] not null default '{}',
  add column if not exists match_source text not null default 'rules',
  add column if not exists confirmed_by_user boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.sns_place_candidates
  drop constraint if exists sns_place_candidates_match_source_check,
  add constraint sns_place_candidates_match_source_check
    check (match_source in ('rules', 'approved_alias'));

create table if not exists public.social_discovery_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_hash text,
  input_kind text not null check (input_kind in ('link', 'text', 'image', 'direct')),
  source_platform text not null check (source_platform in ('xiaohongshu', 'instagram', 'tiktok', 'youtube', 'other')),
  result_status text not null default 'processing'
    check (result_status in ('processing', 'matched', 'no_match', 'ocr_unavailable', 'ocr_failed', 'failed')),
  mapping_id uuid references public.sns_place_mappings(id) on delete set null,
  candidate_count integer not null default 0 check (candidate_count between 0 and 20),
  used_ocr boolean not null default false,
  created_at timestamptz not null default now(),
  check (device_hash is null or device_hash ~ '^[a-f0-9]{64}$'),
  check (user_id is not null or device_hash is not null)
);

create index if not exists social_discovery_requests_user_created_idx
  on public.social_discovery_requests(user_id, created_at desc)
  where user_id is not null;
create index if not exists social_discovery_requests_device_created_idx
  on public.social_discovery_requests(device_hash, created_at desc)
  where device_hash is not null;
create index if not exists social_discovery_requests_status_created_idx
  on public.social_discovery_requests(result_status, created_at desc);

alter table public.social_discovery_requests enable row level security;

drop policy if exists "Admins read social discovery requests" on public.social_discovery_requests;
create policy "Admins read social discovery requests"
on public.social_discovery_requests for select to authenticated
using (public.is_admin());

drop policy if exists "Admins manage social discovery requests" on public.social_discovery_requests;
create policy "Admins manage social discovery requests"
on public.social_discovery_requests for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.register_social_discovery_request(
  actor_user_id uuid,
  actor_device_hash text,
  request_input_kind text,
  request_source_platform text,
  request_uses_ocr boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_key text;
  request_id uuid;
begin
  if actor_user_id is null and (actor_device_hash is null or actor_device_hash !~ '^[a-f0-9]{64}$') then
    raise exception 'Invalid social discovery actor' using errcode = '22023';
  end if;
  if request_input_kind not in ('link', 'text', 'image', 'direct') then
    raise exception 'Invalid social discovery input kind' using errcode = '22023';
  end if;
  if request_source_platform not in ('xiaohongshu', 'instagram', 'tiktok', 'youtube', 'other') then
    raise exception 'Invalid social discovery platform' using errcode = '22023';
  end if;

  actor_key := coalesce(actor_user_id::text, actor_device_hash);
  perform pg_advisory_xact_lock(hashtext('social-discovery:' || actor_key));

  if (
    select count(*) from public.social_discovery_requests
    where created_at > now() - interval '1 hour'
      and ((actor_user_id is not null and user_id = actor_user_id)
        or (actor_user_id is null and device_hash = actor_device_hash))
  ) >= 12 then
    raise exception 'Social discovery rate limit exceeded' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.social_discovery_requests
    where created_at > now() - interval '24 hours'
      and ((actor_user_id is not null and user_id = actor_user_id)
        or (actor_user_id is null and device_hash = actor_device_hash))
  ) >= 40 then
    raise exception 'Social discovery daily limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.social_discovery_requests (
    user_id, device_hash, input_kind, source_platform, used_ocr
  ) values (
    actor_user_id,
    case when actor_user_id is null then actor_device_hash else null end,
    request_input_kind,
    request_source_platform,
    request_uses_ocr
  ) returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.register_social_discovery_request(uuid, text, text, text, boolean) from public;
revoke all on function public.register_social_discovery_request(uuid, text, text, text, boolean) from anon, authenticated;
grant execute on function public.register_social_discovery_request(uuid, text, text, text, boolean) to service_role;

revoke all on public.social_discovery_requests from anon;
grant select, update, delete on public.social_discovery_requests to authenticated;
grant all on public.social_discovery_requests to service_role;
grant all on public.sns_place_mappings, public.sns_place_candidates to service_role;

comment on table public.social_discovery_requests is
  'Rate-limit and operational metadata only. Raw social text, URLs, screenshots, IP addresses, and OCR images are not stored.';
comment on column public.sns_place_mappings.source_url_hash is
  'SHA-256 of a normalized public URL path or normalized text fingerprint. Raw input is intentionally not stored.';
comment on column public.sns_place_mappings.created_by_device_hash is
  'HMAC-SHA256 pseudonymous device key for ownership checks; never a raw cookie or hardware identifier.';

commit;
