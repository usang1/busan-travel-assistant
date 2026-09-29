begin;

create table if not exists public.grounded_trip_plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  device_hash text,
  request_kind text not null check (request_kind in ('plan', 'recover')),
  condition_hash text not null check (condition_hash ~ '^[a-f0-9]{64}$'),
  locale text not null check (locale in ('ko', 'zh', 'en', 'ja')),
  result_status text not null default 'processing'
    check (result_status in ('processing', 'completed', 'no_result', 'failed')),
  planner_source text check (planner_source in ('rules', 'ai_ordered')),
  ai_status text not null default 'disabled'
    check (ai_status in ('disabled', 'completed', 'fallback', 'cache')),
  model_name text,
  candidate_count integer not null default 0 check (candidate_count between 0 and 100),
  result_place_count integer not null default 0 check (result_place_count between 0 and 10),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  created_at timestamptz not null default now(),
  check (device_hash is null or device_hash ~ '^[a-f0-9]{64}$'),
  check (user_id is not null or device_hash is not null)
);

create index if not exists grounded_trip_plan_requests_user_created_idx
  on public.grounded_trip_plan_requests(user_id, created_at desc)
  where user_id is not null;
create index if not exists grounded_trip_plan_requests_device_created_idx
  on public.grounded_trip_plan_requests(device_hash, created_at desc)
  where device_hash is not null;
create index if not exists grounded_trip_plan_requests_status_created_idx
  on public.grounded_trip_plan_requests(result_status, created_at desc);

alter table public.grounded_trip_plan_requests enable row level security;

drop policy if exists "Admins read grounded trip plan metrics" on public.grounded_trip_plan_requests;
create policy "Admins read grounded trip plan metrics"
on public.grounded_trip_plan_requests for select to authenticated
using (public.is_admin());

drop policy if exists "Admins delete grounded trip plan metrics" on public.grounded_trip_plan_requests;
create policy "Admins delete grounded trip plan metrics"
on public.grounded_trip_plan_requests for delete to authenticated
using (public.is_admin());

create or replace function public.register_grounded_trip_plan_request(
  actor_user_id uuid,
  actor_device_hash text,
  request_kind text,
  request_condition_hash text,
  request_locale text
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
    raise exception 'Invalid trip planner actor' using errcode = '22023';
  end if;
  if request_kind not in ('plan', 'recover') then
    raise exception 'Invalid trip planner request kind' using errcode = '22023';
  end if;
  if request_condition_hash !~ '^[a-f0-9]{64}$' or request_locale not in ('ko', 'zh', 'en', 'ja') then
    raise exception 'Invalid trip planner metadata' using errcode = '22023';
  end if;

  actor_key := coalesce(actor_user_id::text, actor_device_hash);
  perform pg_advisory_xact_lock(hashtext('grounded-trip-plan:' || actor_key));

  if (
    select count(*) from public.grounded_trip_plan_requests
    where created_at > now() - interval '1 hour'
      and ((actor_user_id is not null and user_id = actor_user_id)
        or (actor_user_id is null and device_hash = actor_device_hash))
  ) >= 10 then
    raise exception 'Trip planner hourly rate limit exceeded' using errcode = 'P0001';
  end if;

  if (
    select count(*) from public.grounded_trip_plan_requests
    where created_at > now() - interval '24 hours'
      and ((actor_user_id is not null and user_id = actor_user_id)
        or (actor_user_id is null and device_hash = actor_device_hash))
  ) >= 30 then
    raise exception 'Trip planner daily rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.grounded_trip_plan_requests (
    user_id, device_hash, request_kind, condition_hash, locale
  ) values (
    actor_user_id,
    case when actor_user_id is null then actor_device_hash else null end,
    request_kind,
    request_condition_hash,
    request_locale
  ) returning id into request_id;

  return request_id;
end;
$$;

revoke all on function public.register_grounded_trip_plan_request(uuid, text, text, text, text) from public;
revoke all on function public.register_grounded_trip_plan_request(uuid, text, text, text, text) from anon, authenticated;
grant execute on function public.register_grounded_trip_plan_request(uuid, text, text, text, text) to service_role;
revoke all on public.grounded_trip_plan_requests from anon;
grant select, delete on public.grounded_trip_plan_requests to authenticated;
grant all on public.grounded_trip_plan_requests to service_role;

comment on table public.grounded_trip_plan_requests is
  'Operational metrics and rate limits for grounded planning. Raw prompts, exact coordinates, itineraries, and profile data are intentionally not stored.';
comment on column public.grounded_trip_plan_requests.condition_hash is
  'SHA-256 request fingerprint used for duplicate and failure monitoring; the original conditions are not retained.';

commit;

-- Rollback consideration: drop register_grounded_trip_plan_request first, then
-- grounded_trip_plan_requests. The planner keeps its in-process limiter and
-- rule-based fallback when this optional operational table is unavailable.

