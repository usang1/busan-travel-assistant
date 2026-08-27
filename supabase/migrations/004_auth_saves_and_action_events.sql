create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'place_action_event_type') then
    create type place_action_event_type as enum (
      'place_view',
      'place_save',
      'place_unsave',
      'marker_click',
      'directions_click',
      'share',
      'submission_created',
      'correction_submitted'
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'place_saves_user_place_unique'
      and conrelid = 'public.place_saves'::regclass
  ) then
    alter table public.place_saves
      add constraint place_saves_user_place_unique unique (user_id, place_id);
  end if;
end $$;

create table if not exists public.place_action_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  place_id uuid references public.places(id) on delete cascade,
  locale app_locale not null default 'zh',
  event_type place_action_event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists place_action_events_place_created_idx
on public.place_action_events(place_id, created_at desc);

create index if not exists place_action_events_user_created_idx
on public.place_action_events(user_id, created_at desc)
where user_id is not null;

create index if not exists place_action_events_type_created_idx
on public.place_action_events(event_type, created_at desc);

create or replace function public.get_place_save_counts(place_ids uuid[])
returns table(place_id uuid, save_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select place_saves.place_id, count(*)::bigint as save_count
  from public.place_saves
  join public.places on places.id = place_saves.place_id
  where place_saves.place_id = any(place_ids)
    and places.is_active = true
  group by place_saves.place_id;
$$;

grant execute on function public.get_place_save_counts(uuid[]) to anon, authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, preferred_locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'zh'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

alter table public.place_action_events enable row level security;

drop policy if exists "Users can manage own place saves" on public.place_saves;
drop policy if exists "Users can read own place saves" on public.place_saves;
create policy "Users can read own place saves"
on public.place_saves for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can create own place saves" on public.place_saves;
create policy "Users can create own place saves"
on public.place_saves for insert
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Users can delete own place saves" on public.place_saves;
create policy "Users can delete own place saves"
on public.place_saves for delete
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Public can create place submissions" on public.place_submissions;
drop policy if exists "Authenticated users can create own place submissions" on public.place_submissions;
create policy "Authenticated users can create own place submissions"
on public.place_submissions for insert
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Public can create place corrections" on public.place_corrections;
drop policy if exists "Authenticated users can create own place corrections" on public.place_corrections;
create policy "Authenticated users can create own place corrections"
on public.place_corrections for insert
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Anyone can create place action events" on public.place_action_events;
create policy "Anyone can create place action events"
on public.place_action_events for insert
with check (user_id is null or user_id = auth.uid());

drop policy if exists "Admins can read place action events" on public.place_action_events;
create policy "Admins can read place action events"
on public.place_action_events for select
using (public.is_admin());

drop policy if exists "MVP admin can manage places" on public.places;
drop policy if exists "Admins can manage places" on public.places;
create policy "Admins can manage places"
on public.places for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "MVP admin can manage tags" on public.tags;
drop policy if exists "Admins can manage tags" on public.tags;
create policy "Admins can manage tags"
on public.tags for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "MVP admin can manage place tags" on public.place_tags;
drop policy if exists "Admins can manage place tags" on public.place_tags;
create policy "Admins can manage place tags"
on public.place_tags for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "MVP admin can manage menu items" on public.place_menu_items;
drop policy if exists "Admins can manage menu items" on public.place_menu_items;
create policy "Admins can manage menu items"
on public.place_menu_items for all
using (public.is_admin())
with check (public.is_admin());

comment on table public.place_action_events is
  'Append-only behavior log for place interactions. Core product actions must not fail if logging fails.';
