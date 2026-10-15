-- Membership-scoped aggregate analytics. Raw visitor events remain admin-only.

create or replace function public.get_business_place_analytics(period_start timestamptz, period_end timestamptz)
returns table (
  place_id uuid,
  event_type public.place_action_event_type,
  channel text,
  locale public.app_locale,
  event_count bigint,
  visitor_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event.place_id,
    event.event_type,
    coalesce(nullif(event.metadata->>'channel', ''), 'unknown') as channel,
    event.locale,
    count(*)::bigint as event_count,
    count(distinct coalesce(nullif(event.metadata->>'visit_id', ''), event.user_id::text, event.id::text))::bigint as visitor_count
  from public.place_action_events event
  join public.business_place_memberships membership
    on membership.place_id = event.place_id
   and membership.user_id = auth.uid()
   and membership.status = 'active'
  where auth.uid() is not null
    and event.created_at >= period_start
    and event.created_at < period_end
    and period_end > period_start
    and period_end - period_start <= interval '366 days'
  group by event.place_id, event.event_type, coalesce(nullif(event.metadata->>'channel', ''), 'unknown'), event.locale;
$$;

grant execute on function public.get_business_place_analytics(timestamptz, timestamptz) to authenticated;

comment on function public.get_business_place_analytics(timestamptz, timestamptz) is 'Returns only aggregate events for places connected to the current active business membership. Raw event rows and cross-business data are never exposed.';
