begin;

alter table public.place_decision_profiles
  drop constraint if exists place_decision_recommendation_has_evidence;

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
  set evidence_count = counted
  where place_id = affected_place_id;
  return coalesce(new, old);
end;
$$;

comment on column public.place_decision_profiles.evidence_count is
  'Legacy informational count. Recommendation fields no longer require or depend on field-level evidence.';

commit;
