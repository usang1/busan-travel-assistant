-- Additive business reporting, feature entitlement, and coupon operations.
-- Existing coupons, issues, redemptions, subscriptions, and place data are preserved.

alter table public.coupons
  add column if not exists discount_type text not null default 'other',
  add column if not exists discount_value numeric(12,2),
  add column if not exists minimum_order_amount numeric(12,2),
  add column if not exists terms_text text not null default '',
  add column if not exists image_url text,
  add column if not exists per_user_redemption_limit integer not null default 1,
  add column if not exists rejection_reason text,
  add column if not exists paused_at timestamptz,
  add column if not exists ended_at timestamptz;

do $$ begin
  alter table public.coupons add constraint coupons_discount_type_check
    check (discount_type in ('amount', 'percentage', 'free_item', 'other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.coupons add constraint coupons_discount_value_check
    check (discount_value is null or discount_value > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.coupons add constraint coupons_minimum_order_check
    check (minimum_order_amount is null or minimum_order_amount >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.coupons add constraint coupons_redemption_limit_check
    check (per_user_redemption_limit between 1 and 20);
exception when duplicate_object then null; end $$;

create table if not exists public.coupon_redemption_events (
  id bigint generated always as identity primary key,
  issue_id uuid not null references public.coupon_issues(id) on delete restrict,
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  place_id uuid not null references public.places(id) on delete restrict,
  event_type text not null check (event_type in ('redeemed', 'cancelled')),
  actor_id uuid not null references auth.users(id) on delete restrict,
  reason text,
  occurred_at timestamptz not null default now()
);
create index if not exists coupon_redemption_events_place_idx on public.coupon_redemption_events(place_id, occurred_at desc);
create index if not exists coupon_redemption_events_issue_idx on public.coupon_redemption_events(issue_id, occurred_at desc);

create table if not exists public.business_performance_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  comparison_start timestamptz not null,
  comparison_end timestamptz not null,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  recommendations jsonb not null default '[]'::jsonb check (jsonb_typeof(recommendations) = 'array'),
  data_version text not null default 'business-performance-v1',
  generated_by uuid not null references auth.users(id) on delete restrict,
  generated_at timestamptz not null default now(),
  check (period_end > period_start),
  check (comparison_end > comparison_start)
);
create index if not exists business_reports_place_period_idx on public.business_performance_reports(place_id, period_end desc);
create index if not exists place_action_events_business_period_idx on public.place_action_events(place_id, occurred_at desc, event_type);
create index if not exists place_action_events_coupon_idx on public.place_action_events((metadata->>'coupon_id'), occurred_at desc)
  where metadata ? 'coupon_id';

insert into public.subscription_plans(code, name, description, features, active, sort_order)
values
  ('free', 'Free', '기본 조회수와 저장수', '{"basic_analytics":true,"detailed_analytics":false,"period_comparison":false,"report_download":false,"coupon_analytics":false,"automatic_reports":false}'::jsonb, true, 10),
  ('pro', 'Pro', '상세 성과 분석, 기간 비교, 리포트 다운로드', '{"basic_analytics":true,"detailed_analytics":true,"period_comparison":true,"report_download":true,"coupon_analytics":false,"automatic_reports":false}'::jsonb, true, 20),
  ('business', 'Business', '고급 분석, 쿠폰 성과, 자동 리포트', '{"basic_analytics":true,"detailed_analytics":true,"period_comparison":true,"report_download":true,"coupon_analytics":true,"automatic_reports":true}'::jsonb, true, 30)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  features = excluded.features,
  active = excluded.active,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace function public.get_business_place_performance(
  target_place_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  row_kind text,
  event_name text,
  dimension text,
  dimension_value text,
  stat_date date,
  event_count bigint,
  unique_visitors bigint
)
language sql stable security definer set search_path = public
as $$
  with authorized as (
    select target_place_id as place_id,
      public.is_admin() or exists (
        select 1 from public.business_subscriptions s join public.subscription_plans p on p.id = s.plan_id
        where s.business_user_id = auth.uid() and (s.place_id is null or s.place_id = target_place_id)
          and s.status in ('trial', 'active') and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
          and coalesce((p.features->>'detailed_analytics')::boolean, false)
      ) as detailed,
      public.is_admin() or exists (
        select 1 from public.business_subscriptions s join public.subscription_plans p on p.id = s.plan_id
        where s.business_user_id = auth.uid() and (s.place_id is null or s.place_id = target_place_id)
          and s.status in ('trial', 'active') and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
          and coalesce((p.features->>'coupon_analytics')::boolean, false)
      ) as coupon_analytics
    where auth.uid() is not null
      and period_end > period_start
      and period_end - period_start <= interval '366 days'
      and (public.is_admin() or exists (
        select 1 from public.business_place_memberships m
        where m.place_id = target_place_id and m.user_id = auth.uid() and m.status = 'active'
      ))
  ), normalized as (
    select
      case event.event_type::text
        when 'place_opened' then 'place_view'
        when 'place_saved' then 'place_save'
        when 'map_opened' then 'directions_click'
        when 'coupon_issued' then 'coupon_claim'
        when 'coupon_redeemed' then 'coupon_redeem'
        else event.event_type::text
      end as event_name,
      coalesce(nullif(event.channel, ''), nullif(event.metadata->>'channel', ''), 'direct') as channel,
      event.locale::text as locale,
      (event.occurred_at at time zone 'Asia/Seoul')::date as stat_date,
      coalesce(event.user_id::text, nullif(event.anonymous_session_id, ''), nullif(event.metadata->>'visit_id', ''), event.id::text) as visitor_key,
      nullif(event.metadata->>'coupon_id', '') as coupon_id,
      coalesce(nullif(event.metadata->>'stage', ''), 'detail') as coupon_stage,
      authorized.detailed,
      authorized.coupon_analytics
    from public.place_action_events event join authorized on authorized.place_id = event.place_id
    where event.occurred_at >= period_start and event.occurred_at < period_end
  ), relevant as (
    select * from normalized where event_name in ('place_view', 'place_save', 'place_unsave')
      or (detailed and event_name in ('directions_click', 'phone_click'))
      or (coupon_analytics and event_name in ('coupon_view', 'coupon_claim', 'coupon_redeem'))
  )
  select 'metric', event_name, 'all', 'all', null::date, count(*)::bigint, count(distinct visitor_key)::bigint
    from relevant group by event_name
  union all
  select 'channel', 'place_view', 'channel', channel, null::date, count(*)::bigint, count(distinct visitor_key)::bigint
    from relevant where event_name = 'place_view' group by channel
  union all
  select 'locale', 'place_view', 'locale', locale, null::date, count(*)::bigint, count(distinct visitor_key)::bigint
    from relevant where event_name = 'place_view' group by locale
  union all
  select 'daily', event_name, 'date', stat_date::text, stat_date, count(*)::bigint, count(distinct visitor_key)::bigint
    from relevant group by event_name, stat_date
  union all
  select 'coupon', event_name, 'coupon_id', coalesce(coupon_id, 'unknown'), null::date, count(*)::bigint, count(distinct visitor_key)::bigint
    from relevant where event_name in ('coupon_view', 'coupon_claim', 'coupon_redeem')
    group by event_name, coalesce(coupon_id, 'unknown')
  union all
  select 'coupon_stage', 'coupon_view', 'stage', coupon_stage, null::date, count(*)::bigint, count(distinct visitor_key)::bigint
    from relevant where event_name = 'coupon_view' group by coupon_stage;
$$;
grant execute on function public.get_business_place_performance(uuid, timestamptz, timestamptz) to authenticated;
revoke execute on function public.get_business_place_performance(uuid, timestamptz, timestamptz) from public, anon;

comment on function public.get_business_place_performance(uuid, timestamptz, timestamptz) is
  'Membership-scoped exact period metrics. Directions represent intent, not a verified visit.';

create or replace function public.issue_coupon(target_coupon_id uuid, visit_id text default null)
returns public.coupon_issues language plpgsql security definer set search_path = public
as $$
declare
  target public.coupons;
  issued public.coupon_issues;
  current_count integer;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  select * into target from public.coupons where id = target_coupon_id for update;
  if target.id is null or target.status <> 'approved' or not target.active then raise exception 'coupon_unavailable'; end if;
  if now() < target.valid_from or now() >= target.valid_until then raise exception 'coupon_expired'; end if;
  if target.daily_start is not null and target.daily_end is not null then
    if target.daily_start <= target.daily_end and (now() at time zone 'Asia/Seoul')::time not between target.daily_start and target.daily_end then raise exception 'coupon_outside_hours'; end if;
    if target.daily_start > target.daily_end and (now() at time zone 'Asia/Seoul')::time < target.daily_start and (now() at time zone 'Asia/Seoul')::time > target.daily_end then raise exception 'coupon_outside_hours'; end if;
  end if;
  select count(*) into current_count from public.coupon_issues
    where coupon_id = target.id and user_id = auth.uid() and status <> 'cancelled';
  if current_count >= target.per_user_limit then raise exception 'coupon_limit_reached'; end if;
  if target.issue_limit is not null then
    select count(*) into current_count from public.coupon_issues where coupon_id = target.id and status <> 'cancelled';
    if current_count >= target.issue_limit then raise exception 'coupon_sold_out'; end if;
  end if;
  insert into public.coupon_issues(coupon_id, user_id, anonymous_visit_id, expires_at)
  values (target.id, auth.uid(), null, target.valid_until) returning * into issued;
  return issued;
end;
$$;

revoke execute on function public.issue_coupon(uuid, text) from public, anon;
grant execute on function public.issue_coupon(uuid, text) to authenticated;

create or replace function public.redeem_coupon(issue_token uuid)
returns public.coupon_redemptions language plpgsql security definer set search_path = public
as $$
declare
  target_issue public.coupon_issues;
  target_coupon public.coupons;
  redemption public.coupon_redemptions;
  redemption_count integer;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  select * into target_issue from public.coupon_issues where public_token = issue_token for update;
  if target_issue.id is null then raise exception 'coupon_issue_not_found'; end if;
  if target_issue.status <> 'issued' or target_issue.redeemed_at is not null then raise exception 'coupon_already_used'; end if;
  if now() >= target_issue.expires_at then
    update public.coupon_issues set status = 'expired' where id = target_issue.id;
    raise exception 'coupon_expired';
  end if;
  select * into target_coupon from public.coupons where id = target_issue.coupon_id for share;
  if target_coupon.id is null or target_coupon.status <> 'approved' or not target_coupon.active then raise exception 'coupon_unavailable'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.business_place_memberships m
    where m.place_id = target_coupon.place_id and m.user_id = auth.uid() and m.status = 'active'
  ) then raise exception 'place_ownership_required'; end if;
  select count(*) into redemption_count
  from public.coupon_redemptions r join public.coupon_issues i on i.id = r.issue_id
  where r.coupon_id = target_coupon.id and i.user_id = target_issue.user_id;
  if redemption_count >= target_coupon.per_user_redemption_limit then raise exception 'coupon_redemption_limit_reached'; end if;
  update public.coupon_issues set status = 'redeemed', redeemed_at = now() where id = target_issue.id;
  insert into public.coupon_redemptions(issue_id, coupon_id, place_id, redeemed_by)
  values (target_issue.id, target_coupon.id, target_coupon.place_id, auth.uid()) returning * into redemption;
  insert into public.coupon_redemption_events(issue_id, coupon_id, place_id, event_type, actor_id)
  values (target_issue.id, target_coupon.id, target_coupon.place_id, 'redeemed', auth.uid());
  return redemption;
end;
$$;

create or replace function public.cancel_coupon_redemption(target_issue_id uuid, cancellation_reason text)
returns public.coupon_issues language plpgsql security definer set search_path = public
as $$
declare
  target_issue public.coupon_issues;
  target_coupon public.coupons;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  select * into target_issue from public.coupon_issues where id = target_issue_id for update;
  if target_issue.id is null then raise exception 'coupon_issue_not_found'; end if;
  select * into target_coupon from public.coupons where id = target_issue.coupon_id;
  if not public.is_admin() and not exists (
    select 1 from public.business_place_memberships m where m.place_id = target_coupon.place_id and m.user_id = auth.uid() and m.status = 'active'
  ) then raise exception 'place_ownership_required'; end if;
  if target_issue.status <> 'redeemed' then raise exception 'coupon_not_redeemed'; end if;
  delete from public.coupon_redemptions where issue_id = target_issue.id;
  update public.coupon_issues
    set status = case when now() >= expires_at then 'expired' else 'issued' end, redeemed_at = null
    where id = target_issue.id returning * into target_issue;
  insert into public.coupon_redemption_events(issue_id, coupon_id, place_id, event_type, actor_id, reason)
  values (target_issue.id, target_coupon.id, target_coupon.place_id, 'cancelled', auth.uid(), left(nullif(trim(cancellation_reason), ''), 500));
  return target_issue;
end;
$$;
grant execute on function public.cancel_coupon_redemption(uuid, text) to authenticated;
revoke execute on function public.cancel_coupon_redemption(uuid, text) from public, anon;

alter table public.coupon_redemption_events enable row level security;
alter table public.business_performance_reports enable row level security;

create policy "Owners control published coupon availability" on public.coupons for update to authenticated
using (created_by = auth.uid() and status in ('approved', 'paused') and exists (
  select 1 from public.business_place_memberships m where m.place_id = coupons.place_id and m.user_id = auth.uid() and m.status = 'active'
))
with check (created_by = auth.uid() and status in ('approved', 'paused', 'ended') and exists (
  select 1 from public.business_place_memberships m where m.place_id = coupons.place_id and m.user_id = auth.uid() and m.status = 'active'
));

create policy "Owners read coupon redemption events" on public.coupon_redemption_events for select to authenticated
using (public.is_admin() or exists (
  select 1 from public.business_place_memberships m
  where m.place_id = coupon_redemption_events.place_id and m.user_id = auth.uid() and m.status = 'active'
));
create policy "Admins manage coupon redemption events" on public.coupon_redemption_events for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage business reports" on public.business_performance_reports for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "Entitled owners read place reports" on public.business_performance_reports for select to authenticated
using (exists (
  select 1 from public.business_place_memberships m
  where m.place_id = business_performance_reports.place_id and m.user_id = auth.uid() and m.status = 'active'
) and exists (
  select 1 from public.business_subscriptions s join public.subscription_plans p on p.id = s.plan_id
  where s.business_user_id = auth.uid()
    and (s.place_id is null or s.place_id = business_performance_reports.place_id)
    and s.status in ('trial', 'active') and s.starts_at <= now() and (s.ends_at is null or s.ends_at > now())
    and coalesce((p.features->>'report_download')::boolean, false)
));

comment on table public.business_performance_reports is 'Immutable analytics snapshots. Metrics and limitations are preserved as generated.';
comment on table public.coupon_redemption_events is 'Append-only redemption and cancellation audit trail.';
