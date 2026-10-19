-- Additive analytics pipeline: validated ingestion dimensions, deduplication,
-- daily aggregates, owner-safe reporting, and retention maintenance.
-- Review and apply separately; this migration is not executed automatically.

alter type public.place_action_event_type add value if not exists 'photo_click';
alter type public.place_action_event_type add value if not exists 'menu_click';
alter type public.place_action_event_type add value if not exists 'map_click';
alter type public.place_action_event_type add value if not exists 'website_click';
alter type public.place_action_event_type add value if not exists 'coupon_view';
alter type public.place_action_event_type add value if not exists 'coupon_claim';
alter type public.place_action_event_type add value if not exists 'coupon_redeem';
alter type public.place_action_event_type add value if not exists 'search';
alter type public.place_action_event_type add value if not exists 'filter_apply';
alter type public.place_action_event_type add value if not exists 'course_save';

alter table public.place_action_events
  add column if not exists client_event_id uuid,
  add column if not exists anonymous_session_id text,
  add column if not exists occurred_at timestamptz,
  add column if not exists source_page text,
  add column if not exists referrer_host text,
  add column if not exists campaign_id text,
  add column if not exists device_type text,
  add column if not exists channel text,
  add column if not exists source text,
  add column if not exists dedupe_key text;

update public.place_action_events set occurred_at = created_at where occurred_at is null;
alter table public.place_action_events alter column occurred_at set default now();
alter table public.place_action_events alter column occurred_at set not null;

alter table public.place_action_events
  add constraint place_action_events_session_format_check
    check (anonymous_session_id is null or anonymous_session_id ~ '^[A-Za-z0-9-]{8,120}$') not valid,
  add constraint place_action_events_source_page_check
    check (source_page is null or (left(source_page, 1) = '/' and length(source_page) <= 240)) not valid,
  add constraint place_action_events_device_check
    check (device_type is null or device_type in ('mobile', 'tablet', 'desktop')) not valid,
  add constraint place_action_events_referrer_host_check
    check (referrer_host is null or length(referrer_host) <= 120) not valid;

create unique index if not exists place_action_events_client_event_uidx
  on public.place_action_events(client_event_id) where client_event_id is not null;
create unique index if not exists place_action_events_dedupe_uidx
  on public.place_action_events(dedupe_key) where dedupe_key is not null;
create index if not exists place_action_events_occurred_idx
  on public.place_action_events(occurred_at desc);
create index if not exists place_action_events_dimensions_idx
  on public.place_action_events(event_type, occurred_at desc, place_id, locale, device_type);
create index if not exists place_action_events_campaign_idx
  on public.place_action_events(campaign_id, occurred_at desc) where campaign_id is not null;

drop policy if exists "Anyone can create place action events" on public.place_action_events;
drop policy if exists "Authenticated users can create own analytics events" on public.place_action_events;
create policy "Authenticated users can create own analytics events"
on public.place_action_events for insert to authenticated
with check (public.is_admin() or user_id = auth.uid());

create table if not exists public.analytics_daily_place_stats (
  stat_date date not null,
  place_id uuid not null references public.places(id) on delete cascade,
  event_name text not null,
  locale text not null default 'unknown',
  device_type text not null default 'unknown',
  channel text not null default 'unknown',
  source text not null default 'unknown',
  campaign_id text not null default '',
  event_count bigint not null default 0 check (event_count >= 0),
  unique_visitors bigint not null default 0 check (unique_visitors >= 0),
  updated_at timestamptz not null default now(),
  primary key (stat_date, place_id, event_name, locale, device_type, channel, source, campaign_id)
);

create table if not exists public.analytics_daily_platform_stats (
  stat_date date not null,
  event_name text not null,
  locale text not null default 'unknown',
  device_type text not null default 'unknown',
  channel text not null default 'unknown',
  source text not null default 'unknown',
  campaign_id text not null default '',
  event_count bigint not null default 0 check (event_count >= 0),
  unique_visitors bigint not null default 0 check (unique_visitors >= 0),
  updated_at timestamptz not null default now(),
  primary key (stat_date, event_name, locale, device_type, channel, source, campaign_id)
);

create index if not exists analytics_daily_place_stats_place_date_idx
  on public.analytics_daily_place_stats(place_id, stat_date desc);
create index if not exists analytics_daily_platform_stats_date_idx
  on public.analytics_daily_platform_stats(stat_date desc);

alter table public.analytics_daily_place_stats enable row level security;
alter table public.analytics_daily_platform_stats enable row level security;

drop policy if exists "Admins read daily place analytics" on public.analytics_daily_place_stats;
create policy "Admins read daily place analytics"
on public.analytics_daily_place_stats for select to authenticated
using (public.is_admin());
drop policy if exists "Owners read own daily place analytics" on public.analytics_daily_place_stats;
create policy "Owners read own daily place analytics"
on public.analytics_daily_place_stats for select to authenticated
using (exists (
  select 1 from public.business_place_memberships membership
  where membership.place_id = analytics_daily_place_stats.place_id
    and membership.user_id = auth.uid()
    and membership.status = 'active'
));
drop policy if exists "Admins read daily platform analytics" on public.analytics_daily_platform_stats;
create policy "Admins read daily platform analytics"
on public.analytics_daily_platform_stats for select to authenticated
using (public.is_admin());

create or replace function public.refresh_analytics_daily_stats(period_start date, period_end date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if period_end < period_start or period_end - period_start > 366 then
    raise exception 'invalid_analytics_period';
  end if;

  delete from public.analytics_daily_place_stats where stat_date between period_start and period_end;
  delete from public.analytics_daily_platform_stats where stat_date between period_start and period_end;

  insert into public.analytics_daily_place_stats (
    stat_date, place_id, event_name, locale, device_type, channel, source, campaign_id,
    event_count, unique_visitors, updated_at
  )
  select
    timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date,
    event.place_id,
    event.event_type::text,
    coalesce(nullif(event.locale::text, ''), 'unknown'),
    coalesce(nullif(event.device_type, ''), 'unknown'),
    coalesce(nullif(event.channel, ''), nullif(event.metadata->>'channel', ''), 'unknown'),
    coalesce(nullif(event.source, ''), nullif(event.metadata->>'initial_source', ''), 'unknown'),
    coalesce(nullif(event.campaign_id, ''), nullif(event.metadata->>'campaign_id', ''), ''),
    count(*)::bigint,
    count(distinct coalesce(event.user_id::text, nullif(event.anonymous_session_id, ''), nullif(event.metadata->>'visit_id', ''), event.id::text))::bigint,
    now()
  from public.place_action_events event
  where event.place_id is not null
    and timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date between period_start and period_end
  group by 1,2,3,4,5,6,7,8;

  insert into public.analytics_daily_place_stats (
    stat_date, place_id, event_name, locale, device_type, channel, source, campaign_id,
    event_count, unique_visitors, updated_at
  )
  select
    timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date,
    event.place_id, '__place_view_unique__', 'all', 'all', 'all', 'all', '',
    count(*)::bigint,
    count(distinct coalesce(event.user_id::text, nullif(event.anonymous_session_id, ''), nullif(event.metadata->>'visit_id', ''), event.id::text))::bigint,
    now()
  from public.place_action_events event
  where event.place_id is not null
    and event.event_type::text in ('place_view', 'place_opened')
    and timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date between period_start and period_end
  group by 1,2;

  insert into public.analytics_daily_platform_stats (
    stat_date, event_name, locale, device_type, channel, source, campaign_id,
    event_count, unique_visitors, updated_at
  )
  select
    timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date,
    event.event_type::text,
    coalesce(nullif(event.locale::text, ''), 'unknown'),
    coalesce(nullif(event.device_type, ''), 'unknown'),
    coalesce(nullif(event.channel, ''), nullif(event.metadata->>'channel', ''), 'unknown'),
    coalesce(nullif(event.source, ''), nullif(event.metadata->>'initial_source', ''), 'unknown'),
    coalesce(nullif(event.campaign_id, ''), nullif(event.metadata->>'campaign_id', ''), ''),
    count(*)::bigint,
    count(distinct coalesce(event.user_id::text, nullif(event.anonymous_session_id, ''), nullif(event.metadata->>'visit_id', ''), event.id::text))::bigint,
    now()
  from public.place_action_events event
  where timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date between period_start and period_end
  group by 1,2,3,4,5,6,7;

  insert into public.analytics_daily_platform_stats (
    stat_date, event_name, locale, device_type, channel, source, campaign_id,
    event_count, unique_visitors, updated_at
  )
  select
    timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date,
    '__all__', 'all', 'all', 'all', 'all', '', count(*)::bigint,
    count(distinct coalesce(event.user_id::text, nullif(event.anonymous_session_id, ''), nullif(event.metadata->>'visit_id', ''), event.id::text))::bigint,
    now()
  from public.place_action_events event
  where timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date between period_start and period_end
  group by 1;

  insert into public.analytics_daily_platform_stats (
    stat_date, event_name, locale, device_type, channel, source, campaign_id,
    event_count, unique_visitors, updated_at
  )
  select
    timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date,
    '__place_view_unique__', 'all', 'all', 'all', 'all', '', count(*)::bigint,
    count(distinct coalesce(event.user_id::text, nullif(event.anonymous_session_id, ''), nullif(event.metadata->>'visit_id', ''), event.id::text))::bigint,
    now()
  from public.place_action_events event
  where event.event_type::text in ('place_view', 'place_opened')
    and timezone('Asia/Seoul', coalesce(event.occurred_at, event.created_at))::date between period_start and period_end
  group by 1;
end;
$$;

create or replace function public.purge_expired_analytics_events(retention_days integer default 180)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare deleted_count bigint;
begin
  if retention_days < 30 or retention_days > 730 then raise exception 'invalid_retention_days'; end if;
  delete from public.place_action_events
  where coalesce(occurred_at, created_at) < now() - make_interval(days => retention_days);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.refresh_analytics_daily_stats(date, date) from public, anon, authenticated;
revoke all on function public.purge_expired_analytics_events(integer) from public, anon, authenticated;
grant execute on function public.refresh_analytics_daily_stats(date, date) to service_role;
grant execute on function public.purge_expired_analytics_events(integer) to service_role;

comment on table public.analytics_daily_place_stats is 'Daily place analytics. Rebuild recent days on a schedule; do not infer physical visits from clicks.';
comment on table public.analytics_daily_platform_stats is 'Daily platform analytics built from validated events. Unique visitors are daily distinct identities and are not additive across dates.';
comment on column public.place_action_events.anonymous_session_id is 'Random session identifier only. Never store raw IP, email, phone, exact coordinates, or full URLs.';
