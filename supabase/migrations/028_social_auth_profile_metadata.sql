alter table public.profiles
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists avatar_url text,
  add column if not exists role public.profile_role not null default 'user',
  add column if not exists preferred_locale public.app_locale not null default 'zh',
  add column if not exists auth_provider text,
  add column if not exists auth_provider_id text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists profiles_email_idx
on public.profiles(email)
where email is not null;

create unique index if not exists profiles_auth_provider_id_uidx
on public.profiles(auth_provider, auth_provider_id)
where auth_provider is not null
  and auth_provider_id is not null;

update public.profiles as profile
set
  email = coalesce(profile.email, auth_user.email),
  auth_provider = coalesce(profile.auth_provider, auth_user.raw_app_meta_data ->> 'provider'),
  auth_provider_id = coalesce(
    profile.auth_provider_id,
    auth_user.raw_user_meta_data ->> 'provider_id',
    auth_user.raw_user_meta_data ->> 'sub'
  ),
  avatar_url = coalesce(
    profile.avatar_url,
    auth_user.raw_user_meta_data ->> 'avatar_url',
    auth_user.raw_user_meta_data ->> 'picture',
    auth_user.raw_user_meta_data ->> 'profile_image'
  )
from auth.users as auth_user
where profile.id = auth_user.id;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_name text := new.raw_app_meta_data ->> 'provider';
  provider_subject text := coalesce(
    new.raw_user_meta_data ->> 'provider_id',
    new.raw_user_meta_data ->> 'sub'
  );
  profile_name text := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'nickname',
    split_part(new.email, '@', 1)
  );
  profile_avatar text := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    new.raw_user_meta_data ->> 'profile_image'
  );
begin
  insert into public.profiles (
    id,
    email,
    display_name,
    avatar_url,
    preferred_locale,
    auth_provider,
    auth_provider_id
  )
  values (
    new.id,
    new.email,
    profile_name,
    profile_avatar,
    'zh',
    provider_name,
    provider_subject
  )
  on conflict (id) do update set
    email = coalesce(public.profiles.email, excluded.email),
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    auth_provider = coalesce(public.profiles.auth_provider, excluded.auth_provider),
    auth_provider_id = coalesce(public.profiles.auth_provider_id, excluded.auth_provider_id),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();
