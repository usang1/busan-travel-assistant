begin;

alter type public.profile_role add value if not exists 'tourist';
alter type public.profile_role add value if not exists 'business_owner';

commit;

begin;

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz,
  add column if not exists marketing_opt_in boolean not null default false,
  add column if not exists onboarding_completed boolean not null default true;

update public.profiles set role = 'tourist' where role = 'user';

create type public.business_application_status as enum ('pending', 'reviewing', 'more_info_requested', 'approved', 'rejected');

create table public.business_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  locale public.app_locale not null default 'ko',
  store_name text not null check (length(trim(store_name)) between 1 and 120),
  address text not null check (length(trim(address)) between 1 and 300),
  category text not null check (length(trim(category)) between 1 and 80),
  map_url text,
  map_provider public.place_source_provider not null default 'MANUAL',
  contact_name text not null check (length(trim(contact_name)) between 1 and 120),
  contact_email text,
  contact_phone text,
  applicant_relationship text not null check (length(trim(applicant_relationship)) between 1 and 120),
  request_notes text not null default '' check (length(request_notes) <= 4000),
  privacy_consent_at timestamptz not null,
  status public.business_application_status not null default 'pending',
  linked_place_id uuid references public.places(id) on delete set null,
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  duplicate_key text not null check (duplicate_key ~ '^[0-9a-f]{64}$'),
  notification_status text check (notification_status is null or notification_status in ('sent', 'failed', 'skipped')),
  notification_attempts integer not null default 0,
  notification_last_error text,
  notification_last_attempt_at timestamptz,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (contact_email is not null or contact_phone is not null)
);

create unique index business_applications_active_duplicate_uidx on public.business_applications(duplicate_key)
where status in ('pending', 'reviewing', 'more_info_requested');
create index business_applications_user_created_idx on public.business_applications(user_id, created_at desc);
create index business_applications_status_created_idx on public.business_applications(status, created_at desc);

create trigger business_applications_set_updated_at before update on public.business_applications
for each row execute function public.set_updated_at();

alter table public.business_applications enable row level security;
create policy "Business owners create applications" on public.business_applications for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and role = 'business_owner'));
create policy "Applicants read own applications" on public.business_applications for select to authenticated
using (user_id = auth.uid() or public.is_admin());
create policy "Admins manage business applications" on public.business_applications for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  provider_name text := new.raw_app_meta_data ->> 'provider';
  requested_role text := new.raw_user_meta_data ->> 'account_type';
  safe_role public.profile_role := case when requested_role = 'business_owner' then 'business_owner'::public.profile_role else 'tourist'::public.profile_role end;
  accepted_at timestamptz := case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' and new.raw_user_meta_data ->> 'privacy_accepted' = 'true' then now() else null end;
begin
  insert into public.profiles (id, email, display_name, avatar_url, role, preferred_locale, auth_provider, auth_provider_id, terms_accepted_at, privacy_accepted_at, marketing_opt_in, onboarding_completed)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', new.raw_user_meta_data ->> 'profile_image'),
    safe_role, coalesce(nullif(new.raw_user_meta_data ->> 'preferred_locale', '')::public.app_locale, 'ko'::public.app_locale), provider_name,
    coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub'), accepted_at, accepted_at,
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false), accepted_at is not null
  ) on conflict (id) do update set email = coalesce(public.profiles.email, excluded.email), updated_at = now();
  return new;
end;
$$;

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile" on public.profiles for insert to authenticated
with check (id = auth.uid() and role in ('tourist', 'business_owner'));
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (public.is_admin() or (id = auth.uid() and role in ('tourist', 'business_owner')));

commit;

notify pgrst, 'reload schema';
