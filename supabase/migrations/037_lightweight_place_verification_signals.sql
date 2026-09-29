-- Completes lightweight place verification without introducing reviews, comments,
-- or public raw reports. Requires migrations 030, 033, and 036.

create or replace function public.submit_traveler_verification(
  target_place_id uuid,
  actor_user_id uuid,
  actor_device_hash text,
  actor_locale public.app_locale,
  actor_verification_method text,
  facts jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  submitted_checkin_id uuid;
  fact jsonb;
  fact_type_value text;
  fact_value_value jsonb;
  recent_count integer;
  rapid_activity boolean := false;
  initial_status public.moderation_status := 'pending';
begin
  if (actor_user_id is null) = (actor_device_hash is null) then
    raise exception 'Exactly one verified actor is required' using errcode = '22023';
  end if;
  if actor_device_hash is not null and actor_device_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid anonymous device hash' using errcode = '22023';
  end if;
  if actor_verification_method not in ('authenticated', 'location', 'receipt', 'photo', 'manual') then
    raise exception 'Unsupported verification method' using errcode = '22023';
  end if;
  if jsonb_typeof(facts) is distinct from 'array'
    or jsonb_array_length(facts) < 1
    or jsonb_array_length(facts) > 8 then
    raise exception 'Submit between one and eight facts' using errcode = '22023';
  end if;
  if (select count(*) from jsonb_array_elements(facts)) is distinct from
     (select count(distinct item->>'fact_type') from jsonb_array_elements(facts) item) then
    raise exception 'Duplicate fact types are not allowed' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.places
    where id = target_place_id and is_active and status in ('PUBLISHED', 'ACTIVE')
  ) then
    raise exception 'Place is not available for verification' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(coalesce(actor_user_id::text, actor_device_hash), 0));

  if actor_user_id is not null then
    if not exists (select 1 from auth.users where id = actor_user_id) then
      raise exception 'Unknown authenticated user' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.place_checkins
      where user_id = actor_user_id and place_id = target_place_id
        and created_at > now() - interval '6 hours'
    ) then
      raise exception 'A recent verification already exists for this place' using errcode = 'P0001';
    end if;
    select count(*) into recent_count from public.place_checkins
      where user_id = actor_user_id and created_at > now() - interval '1 hour';
  else
    if exists (
      select 1 from public.place_checkins
      where device_hash = actor_device_hash and place_id = target_place_id
        and created_at > now() - interval '6 hours'
    ) then
      raise exception 'A recent verification already exists for this place' using errcode = 'P0001';
    end if;
    select count(*) into recent_count from public.place_checkins
      where device_hash = actor_device_hash and created_at > now() - interval '1 hour';
  end if;
  if recent_count >= 3 then
    raise exception 'Hourly verification limit reached' using errcode = 'P0001';
  end if;
  rapid_activity := recent_count >= 1;
  if rapid_activity then initial_status := 'needs_review'; end if;

  if actor_user_id is not null then
    select count(*) into recent_count from public.place_checkins
      where user_id = actor_user_id and created_at > now() - interval '24 hours';
  else
    select count(*) into recent_count from public.place_checkins
      where device_hash = actor_device_hash and created_at > now() - interval '24 hours';
  end if;
  if recent_count >= 10 then
    raise exception 'Daily verification limit reached' using errcode = 'P0001';
  end if;

  for fact in select value from jsonb_array_elements(facts)
  loop
    fact_type_value := fact->>'fact_type';
    fact_value_value := fact->'fact_value';
    if fact_type_value not in (
      'waiting_minutes', 'foreign_card', 'alipay', 'wechat_pay', 'chinese_menu',
      'solo_friendly', 'luggage_friendly', 'restroom', 'restroom_needs_check',
      'sold_out', 'early_closed', 'photo_matches', 'not_recommended_now',
      'information_changed', 'closed', 'ordering_failed', 'minimum_order',
      'cash_only', 'no_foreign_menu', 'restroom_problem', 'transport_difficult',
      'too_spicy', 'too_oily', 'portion_mismatch'
    ) then
      raise exception 'Unsupported fact type' using errcode = '22023';
    end if;
    if fact_type_value = 'waiting_minutes' then
      if jsonb_typeof(fact_value_value) is distinct from 'number'
        or (fact_value_value #>> '{}')::integer not in (0, 10, 20, 40) then
        raise exception 'Invalid waiting time' using errcode = '22023';
      end if;
    elsif jsonb_typeof(fact_value_value) is distinct from 'boolean' then
      raise exception 'Fact value must be boolean' using errcode = '22023';
    end if;
  end loop;

  insert into public.place_checkins (
    place_id, user_id, device_hash, observed_at, locale, verification_method, moderation_status, risk_flags
  ) values (
    target_place_id, actor_user_id, actor_device_hash, now(), actor_locale,
    actor_verification_method, initial_status,
    case when rapid_activity then array['rapid_multi_place_submission']::text[] else '{}'::text[] end
  ) returning id into submitted_checkin_id;

  insert into public.place_fact_reports (
    place_id, checkin_id, fact_type, fact_value, observed_at, locale,
    user_id, device_hash, verification_method, moderation_status, trust_weight
  )
  select target_place_id, submitted_checkin_id, item->>'fact_type', item->'fact_value', now(),
    actor_locale, actor_user_id, actor_device_hash, actor_verification_method, initial_status, null
  from jsonb_array_elements(facts) item;

  return jsonb_build_object(
    'checkin_id', submitted_checkin_id,
    'submitted_fact_count', jsonb_array_length(facts),
    'moderation_status', initial_status
  );
end;
$$;

revoke all on function public.submit_traveler_verification(uuid, uuid, text, public.app_locale, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_traveler_verification(uuid, uuid, text, public.app_locale, text, jsonb) to service_role;

create or replace function public.get_place_trust_summary(target_place_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with allowed_place as (
    select id from public.places
    where id = target_place_id and is_active and status in ('PUBLISHED', 'ACTIVE')
  ),
  approved as (
    select r.*,
      case
        when r.fact_type in ('waiting_minutes', 'sold_out', 'early_closed', 'closed', 'not_recommended_now') then interval '1 day'
        when r.fact_type in ('information_changed', 'restroom_needs_check') then interval '30 days'
        when r.fact_type in ('foreign_card', 'alipay', 'wechat_pay', 'chinese_menu', 'minimum_order', 'cash_only', 'no_foreign_menu', 'restroom', 'restroom_problem', 'luggage_friendly') then interval '90 days'
        else interval '180 days'
      end as freshness_window
    from public.place_fact_reports r
    join allowed_place p on p.id = r.place_id
    where r.moderation_status = 'approved'
  ),
  fact_groups as (
    select fact_type,
      count(*)::integer as report_count,
      sum(coalesce(trust_weight, 0.500)) as evidence_weight,
      count(*) filter (where observed_at >= now() - interval '7 days')::integer as recent_count,
      max(observed_at) as latest_observed_at,
      (array_agg(fact_value order by observed_at desc))[1] as latest_value,
      max(freshness_window) as freshness_window,
      count(distinct fact_value) filter (where observed_at >= now() - freshness_window)::integer as current_value_count
    from approved
    group by fact_type
  ),
  public_facts as (
    select fact_type, report_count, recent_count, latest_observed_at, latest_value,
      case
        when current_value_count > 1 and fact_type in ('foreign_card', 'alipay', 'wechat_pay', 'chinese_menu', 'solo_friendly', 'luggage_friendly', 'restroom', 'photo_matches') then 'conflicting'
        when latest_observed_at < now() - freshness_window then 'stale'
        when evidence_weight >= 3.000 then 'verified'
        else 'reported'
      end as verification_status
    from fact_groups
  ),
  traveler_rollup as (
    select
      count(distinct coalesce(checkin_id::text, id::text)) filter (where observed_at >= now() - interval '7 days')::integer as recent_traveler_count,
      max(observed_at) as latest_traveler_observed_at
    from approved
  ),
  evidence_rollup as (
    select
      max(verified_at) filter (where source_type = 'official_source') as official_last_verified_at,
      max(verified_at) filter (where source_type = 'administrator') as admin_last_verified_at
    from public.place_fact_evidence e
    join allowed_place p on p.id = e.place_id
    where e.verification_status in ('verified', 'partially_verified')
  )
  select case when exists (select 1 from allowed_place) then jsonb_build_object(
    'recent_traveler_count', coalesce((select recent_traveler_count from traveler_rollup), 0),
    'latest_traveler_observed_at', (select latest_traveler_observed_at from traveler_rollup),
    'official_last_verified_at', (select official_last_verified_at from evidence_rollup),
    'admin_last_verified_at', (select admin_last_verified_at from evidence_rollup),
    'conflicting_fact_count', (select count(*)::integer from public_facts where verification_status = 'conflicting'),
    'stale_fact_count', (select count(*)::integer from public_facts where verification_status = 'stale'),
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fact_type', fact_type,
        'report_count', report_count,
        'recent_count', recent_count,
        'latest_observed_at', latest_observed_at,
        'latest_value', latest_value,
        'verification_status', verification_status
      ) order by latest_observed_at desc)
      from public_facts
    ), '[]'::jsonb)
  ) else '{}'::jsonb end;
$$;

revoke all on function public.get_place_trust_summary(uuid) from public;
grant execute on function public.get_place_trust_summary(uuid) to anon, authenticated;

create or replace function public.get_place_trust_summaries(target_place_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_object_agg(ids.place_id::text, public.get_place_trust_summary(ids.place_id)), '{}'::jsonb)
  from (
    select distinct place_id
    from unnest(coalesce(target_place_ids, '{}'::uuid[])) as requested(place_id)
    limit 50
  ) ids;
$$;

revoke all on function public.get_place_trust_summaries(uuid[]) from public;
grant execute on function public.get_place_trust_summaries(uuid[]) to anon, authenticated;

create or replace function public.merge_traveler_reports(
  target_report_id uuid,
  notes text default null
) returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  source_report public.place_fact_reports;
  candidate record;
  merged_count integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  select * into source_report from public.place_fact_reports where id = target_report_id;
  if source_report.id is null then
    raise exception 'Traveler report not found' using errcode = 'P0002';
  end if;

  for candidate in
    select id from public.place_fact_reports
    where place_id = source_report.place_id
      and fact_type = source_report.fact_type
      and fact_value = source_report.fact_value
      and moderation_status in ('pending', 'needs_review')
    order by created_at
    limit 100
  loop
    perform public.moderate_traveler_report(candidate.id, 'approved'::public.moderation_status, notes);
    merged_count := merged_count + 1;
  end loop;
  return merged_count;
end;
$$;

revoke all on function public.merge_traveler_reports(uuid, text) from public, anon;
grant execute on function public.merge_traveler_reports(uuid, text) to authenticated;

comment on function public.get_place_trust_summaries(uuid[]) is
  'Batches approved aggregate trust signals for place cards; raw traveler reports remain private.';
comment on function public.merge_traveler_reports(uuid, text) is
  'Admin-only moderation action approving matching values without collapsing or deleting raw reports.';

-- Rollback: restore the 033 versions of submit_traveler_verification and
-- get_place_trust_summary, then drop get_place_trust_summaries and
-- merge_traveler_reports. Keep raw report rows intact.
