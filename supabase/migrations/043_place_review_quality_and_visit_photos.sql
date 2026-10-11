begin;

alter type public.worth_detour_level add value if not exists 'purpose_dependent';
alter type public.worth_detour_level add value if not exists 'not_recommended';

alter table public.place_decision_profiles
  add column if not exists worth_reason jsonb not null default '{}'::jsonb,
  add column if not exists information_status text not null default 'not_checked',
  add column if not exists information_status_note jsonb not null default '{}'::jsonb;

alter table public.place_decision_profiles
  drop constraint if exists place_decision_worth_reason_object_check,
  add constraint place_decision_worth_reason_object_check check (jsonb_typeof(worth_reason) = 'object'),
  drop constraint if exists place_decision_information_status_check,
  add constraint place_decision_information_status_check check (information_status in ('complete', 'partial', 'not_checked', 'not_applicable')),
  drop constraint if exists place_decision_information_status_note_check,
  add constraint place_decision_information_status_note_check check (jsonb_typeof(information_status_note) = 'object');

alter table public.places
  add column if not exists verification_tier smallint not null default 0,
  add column if not exists verification_checked_at timestamptz,
  add column if not exists verification_checked_by uuid references auth.users(id) on delete set null,
  add column if not exists verification_note text,
  add column if not exists verification_source_urls text[] not null default '{}',
  add column if not exists verified_visit_at timestamptz,
  add column if not exists direct_visit_photos jsonb not null default '[]'::jsonb;

alter table public.places
  drop constraint if exists places_verification_tier_check,
  add constraint places_verification_tier_check check (verification_tier between 0 and 3),
  drop constraint if exists places_verification_sources_check,
  add constraint places_verification_sources_check check (
    cardinality(verification_source_urls) = 0
    or array_to_string(verification_source_urls, ',') !~ '(^|,)\s*(javascript|data|file):'
  ),
  drop constraint if exists places_direct_visit_photos_check,
  add constraint places_direct_visit_photos_check check (jsonb_typeof(direct_visit_photos) = 'array');

create table if not exists public.place_verification_history (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places(id) on delete cascade,
  tier smallint not null check (tier between 0 and 3),
  checked_at timestamptz,
  checked_by uuid references auth.users(id) on delete set null,
  note text,
  source_urls text[] not null default '{}',
  visited_at timestamptz,
  direct_photo_count integer not null default 0 check (direct_photo_count >= 0),
  recorded_at timestamptz not null default now()
);

create index if not exists place_verification_history_place_idx
  on public.place_verification_history(place_id, recorded_at desc);

create or replace function public.record_place_verification_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or
     (new.verification_tier, new.verification_checked_at, new.verification_checked_by, new.verification_note,
      new.verification_source_urls, new.verified_visit_at, new.direct_visit_photos)
     is distinct from
     (old.verification_tier, old.verification_checked_at, old.verification_checked_by, old.verification_note,
      old.verification_source_urls, old.verified_visit_at, old.direct_visit_photos) then
    insert into public.place_verification_history (
      place_id, tier, checked_at, checked_by, note, source_urls, visited_at, direct_photo_count
    ) values (
      new.id, new.verification_tier, new.verification_checked_at, new.verification_checked_by,
      new.verification_note, new.verification_source_urls, new.verified_visit_at,
      jsonb_array_length(new.direct_visit_photos)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists places_record_verification_history on public.places;
create trigger places_record_verification_history
after insert or update on public.places
for each row execute function public.record_place_verification_history();

alter table public.place_verification_history enable row level security;
drop policy if exists "Admins read place verification history" on public.place_verification_history;
create policy "Admins read place verification history" on public.place_verification_history
for select to authenticated using (public.is_admin());

commit;

notify pgrst, 'reload schema';
