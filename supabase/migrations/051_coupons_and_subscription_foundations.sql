-- Additive coupon redemption and manually activated subscription foundations.

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  benefit_text text not null check (char_length(trim(benefit_text)) between 1 and 500),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  daily_start time,
  daily_end time,
  issue_limit integer check (issue_limit is null or issue_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit between 1 and 20),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'approved', 'rejected', 'paused', 'ended')),
  active boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until > valid_from)
);

create index if not exists coupons_place_status_idx on public.coupons(place_id, status, valid_until desc);

create table if not exists public.coupon_issues (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_visit_id text,
  status text not null default 'issued' check (status in ('issued', 'redeemed', 'expired', 'cancelled')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  check (user_id is not null or anonymous_visit_id is not null)
);

create index if not exists coupon_issues_user_limit_idx on public.coupon_issues(coupon_id, user_id) where user_id is not null;
create index if not exists coupon_issues_visit_limit_idx on public.coupon_issues(coupon_id, anonymous_visit_id) where anonymous_visit_id is not null;
create index if not exists coupon_issues_coupon_status_idx on public.coupon_issues(coupon_id, status, issued_at desc);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null unique references public.coupon_issues(id) on delete restrict,
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  place_id uuid not null references public.places(id) on delete restrict,
  redeemed_by uuid not null references auth.users(id) on delete restrict,
  redeemed_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_place_created_idx on public.coupon_redemptions(place_id, redeemed_at desc);

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,79}$'),
  name text not null,
  description text not null default '',
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  place_id uuid references public.places(id) on delete cascade,
  status text not null default 'trial' check (status in ('trial', 'active', 'paused', 'cancelled', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  activation_source text not null default 'admin_manual' check (activation_source in ('admin_manual', 'migration', 'payment_provider')),
  external_subscription_id text,
  activated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists business_subscriptions_user_status_idx on public.business_subscriptions(business_user_id, status, ends_at);
create unique index if not exists business_subscriptions_external_uidx on public.business_subscriptions(external_subscription_id) where external_subscription_id is not null;

create or replace function public.issue_coupon(target_coupon_id uuid, visit_id text default null)
returns public.coupon_issues language plpgsql security definer set search_path = public
as $$
declare
  target public.coupons;
  issued public.coupon_issues;
  current_count integer;
begin
  select * into target from public.coupons where id = target_coupon_id for update;
  if target.id is null or target.status <> 'approved' or not target.active then raise exception 'coupon_unavailable'; end if;
  if now() < target.valid_from or now() >= target.valid_until then raise exception 'coupon_expired'; end if;
  if target.daily_start is not null and target.daily_end is not null then
    if target.daily_start <= target.daily_end and (now() at time zone 'Asia/Seoul')::time not between target.daily_start and target.daily_end then raise exception 'coupon_outside_hours'; end if;
    if target.daily_start > target.daily_end and (now() at time zone 'Asia/Seoul')::time < target.daily_start and (now() at time zone 'Asia/Seoul')::time > target.daily_end then raise exception 'coupon_outside_hours'; end if;
  end if;
  if auth.uid() is null and nullif(trim(visit_id), '') is null then raise exception 'visitor_required'; end if;
  select count(*) into current_count from public.coupon_issues
  where coupon_id = target.id and status <> 'cancelled'
    and ((auth.uid() is not null and user_id = auth.uid()) or (auth.uid() is null and anonymous_visit_id = left(trim(visit_id), 120)));
  if current_count >= target.per_user_limit then raise exception 'coupon_limit_reached'; end if;
  if target.issue_limit is not null then
    select count(*) into current_count from public.coupon_issues where coupon_id = target.id and status <> 'cancelled';
    if current_count >= target.issue_limit then raise exception 'coupon_sold_out'; end if;
  end if;
  insert into public.coupon_issues(coupon_id, user_id, anonymous_visit_id, expires_at)
  values (target.id, auth.uid(), case when auth.uid() is null then left(trim(visit_id), 120) else null end, target.valid_until)
  returning * into issued;
  return issued;
end;
$$;

create or replace function public.redeem_coupon(issue_token uuid)
returns public.coupon_redemptions language plpgsql security definer set search_path = public
as $$
declare
  target_issue public.coupon_issues;
  target_coupon public.coupons;
  redemption public.coupon_redemptions;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  select * into target_issue from public.coupon_issues where public_token = issue_token for update;
  if target_issue.id is null then raise exception 'coupon_issue_not_found'; end if;
  if target_issue.status <> 'issued' or target_issue.redeemed_at is not null then raise exception 'coupon_already_used'; end if;
  if now() >= target_issue.expires_at then
    update public.coupon_issues set status = 'expired' where id = target_issue.id;
    raise exception 'coupon_expired';
  end if;
  select * into target_coupon from public.coupons where id = target_issue.coupon_id;
  if target_coupon.id is null or target_coupon.status <> 'approved' or not target_coupon.active then raise exception 'coupon_unavailable'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.business_place_memberships m
    where m.place_id = target_coupon.place_id and m.user_id = auth.uid() and m.status = 'active'
  ) then raise exception 'place_ownership_required'; end if;
  update public.coupon_issues set status = 'redeemed', redeemed_at = now() where id = target_issue.id;
  insert into public.coupon_redemptions(issue_id, coupon_id, place_id, redeemed_by)
  values (target_issue.id, target_coupon.id, target_coupon.place_id, auth.uid()) returning * into redemption;
  return redemption;
end;
$$;

grant execute on function public.issue_coupon(uuid, text) to anon, authenticated;
grant execute on function public.redeem_coupon(uuid) to authenticated;

alter table public.coupons enable row level security;
alter table public.coupon_issues enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.business_subscriptions enable row level security;

create policy "Public reads approved active coupons" on public.coupons for select using (status = 'approved' and active and now() between valid_from and valid_until);
create policy "Owners read managed coupons" on public.coupons for select to authenticated using (public.is_admin() or exists (select 1 from public.business_place_memberships m where m.place_id = coupons.place_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "Owners create coupon drafts" on public.coupons for insert to authenticated with check (created_by = auth.uid() and status in ('draft', 'pending_review') and not active and exists (select 1 from public.business_place_memberships m where m.place_id = coupons.place_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "Owners update coupon drafts" on public.coupons for update to authenticated
using (created_by = auth.uid() and status = 'draft' and exists (select 1 from public.business_place_memberships m where m.place_id = coupons.place_id and m.user_id = auth.uid() and m.status = 'active'))
with check (created_by = auth.uid() and status in ('draft', 'pending_review') and not active);
create policy "Admins manage coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read own coupon issues" on public.coupon_issues for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "Place owners read coupon issues" on public.coupon_issues for select to authenticated using (exists (select 1 from public.coupons c join public.business_place_memberships m on m.place_id = c.place_id where c.id = coupon_issues.coupon_id and m.user_id = auth.uid() and m.status = 'active'));
create policy "Place owners read redemptions" on public.coupon_redemptions for select to authenticated using (public.is_admin() or exists (select 1 from public.business_place_memberships m where m.place_id = coupon_redemptions.place_id and m.user_id = auth.uid() and m.status = 'active'));

create policy "Public reads active subscription plans" on public.subscription_plans for select using (active or public.is_admin());
create policy "Admins manage subscription plans" on public.subscription_plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Businesses read own subscriptions" on public.business_subscriptions for select to authenticated using (business_user_id = auth.uid() or public.is_admin());
create policy "Admins manage business subscriptions" on public.business_subscriptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

comment on function public.redeem_coupon(uuid) is 'Atomically locks and redeems one issue after expiry, ownership, store, and duplicate-use checks.';
comment on table public.business_subscriptions is 'Payment-neutral subscription entitlement state. Until a payment integration is approved, activation_source must remain admin_manual.';
