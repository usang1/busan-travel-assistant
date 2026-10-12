begin;

alter table public.business_applications
  add column if not exists applicant_role text,
  add column if not exists consent_version text;

alter table public.business_applications
  drop constraint if exists business_applications_applicant_role_check,
  add constraint business_applications_applicant_role_check
    check (applicant_role is null or applicant_role in ('owner', 'staff', 'agency')),
  drop constraint if exists business_applications_consent_version_check,
  add constraint business_applications_consent_version_check
    check (consent_version is null or length(consent_version) between 1 and 80);

comment on column public.business_applications.applicant_role is
  'Normalized applicant relationship: owner, staff, or agency. Legacy rows may be null.';
comment on column public.business_applications.consent_version is
  'Version of the business-application privacy notice accepted at privacy_consent_at.';

create or replace function public.submit_business_application(
  request_locale text,
  place_url text,
  place_external_id text,
  applicant_name text,
  requested_applicant_role text,
  contact_phone text,
  accepted_consent_version text,
  store_name_hint text default null,
  address_hint text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  application_id uuid;
  duplicate_value text;
begin
  if actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'login_required');
  end if;
  if not exists (select 1 from public.profiles where id = actor_id) then
    return jsonb_build_object('ok', false, 'code', 'profile_required');
  end if;
  if request_locale not in ('ko', 'zh', 'en', 'ja') then
    return jsonb_build_object('ok', false, 'code', 'invalid_locale');
  end if;
  if requested_applicant_role not in ('owner', 'staff', 'agency') then
    return jsonb_build_object('ok', false, 'code', 'invalid_applicant_role');
  end if;
  if nullif(trim(applicant_name), '') is null or length(trim(applicant_name)) > 60 then
    return jsonb_build_object('ok', false, 'code', 'invalid_applicant_name');
  end if;
  if contact_phone !~ '^010-[0-9]{4}-[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_contact_phone');
  end if;
  if accepted_consent_version <> 'business-application-privacy-v1' then
    return jsonb_build_object('ok', false, 'code', 'consent_version_mismatch');
  end if;
  if place_url !~ '^https://(naver[.]me|(www[.]|m[.])?map[.]naver[.]com|(www[.]|m[.])?place[.]naver[.]com)/' then
    return jsonb_build_object('ok', false, 'code', 'invalid_place_url');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('business-application:' || actor_id::text, 0));
  if (select count(*) from public.business_applications where user_id = actor_id and created_at >= now() - interval '24 hours') >= 5 then
    return jsonb_build_object('ok', false, 'code', 'rate_limited');
  end if;

  duplicate_value := md5('NAVER|' || coalesce(nullif(trim(place_external_id), ''), trim(place_url)))
    || md5('spotzari|NAVER|' || coalesce(nullif(trim(place_external_id), ''), trim(place_url)));

  if exists (
    select 1 from public.business_applications
    where duplicate_key = duplicate_value and status <> 'rejected'
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate_application');
  end if;

  insert into public.business_applications (
    user_id, locale, store_name, address, category, map_url, map_provider,
    contact_name, contact_email, contact_phone, applicant_relationship,
    applicant_role, request_notes, privacy_consent_at, consent_version,
    status, duplicate_key
  ) values (
    actor_id, request_locale::public.app_locale,
    left(coalesce(nullif(trim(store_name_hint), ''), '네이버 플레이스 업체'), 120),
    left(coalesce(nullif(trim(address_hint), ''), '네이버 플레이스 URL 확인 필요'), 300),
    '미확인', trim(place_url), 'NAVER', trim(applicant_name), null,
    contact_phone, requested_applicant_role, requested_applicant_role, '',
    now(), accepted_consent_version, 'pending', duplicate_value
  ) returning id into application_id;

  return jsonb_build_object('ok', true, 'code', 'created', 'application_id', application_id);
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'duplicate_application');
end;
$$;

revoke all on function public.submit_business_application(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_business_application(text, text, text, text, text, text, text, text, text) to authenticated;

-- Intake must go through the validated RPC. Reading remains protected by the
-- existing applicant/admin RLS policy and reviews remain admin-only.
revoke insert on public.business_applications from authenticated;
drop policy if exists "Authenticated users create own business applications" on public.business_applications;
drop policy if exists "Business owners and admins create applications" on public.business_applications;
drop policy if exists "Business owners create applications" on public.business_applications;

commit;

notify pgrst, 'reload schema';
