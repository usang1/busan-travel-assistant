-- Privacy-minimized product funnel analytics. Operational traveler reports stay in
-- their dedicated tables; this table only records coarse product interactions.

alter type public.place_action_event_type add value if not exists 'home_view';
alter type public.place_action_event_type add value if not exists 'city_selected';
alter type public.place_action_event_type add value if not exists 'district_selected';
alter type public.place_action_event_type add value if not exists 'filter_applied';
alter type public.place_action_event_type add value if not exists 'place_impression';
alter type public.place_action_event_type add value if not exists 'place_opened';
alter type public.place_action_event_type add value if not exists 'decision_card_viewed';
alter type public.place_action_event_type add value if not exists 'warning_viewed';
alter type public.place_action_event_type add value if not exists 'place_saved';
alter type public.place_action_event_type add value if not exists 'map_opened';
alter type public.place_action_event_type add value if not exists 'route_saved';
alter type public.place_action_event_type add value if not exists 'itinerary_created';
alter type public.place_action_event_type add value if not exists 'itinerary_place_added';
alter type public.place_action_event_type add value if not exists 'sns_search_started';
alter type public.place_action_event_type add value if not exists 'sns_candidate_confirmed';
alter type public.place_action_event_type add value if not exists 'ai_route_created';
alter type public.place_action_event_type add value if not exists 'ai_route_saved';
alter type public.place_action_event_type add value if not exists 'visit_confirmed';
alter type public.place_action_event_type add value if not exists 'fact_report_submitted';
alter type public.place_action_event_type add value if not exists 'report_accepted';
alter type public.place_action_event_type add value if not exists 'report_conflicted';

alter table public.place_action_events
  drop constraint if exists place_action_events_metadata_object_check,
  add constraint place_action_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 4096)
    not valid;

create index if not exists place_action_events_funnel_idx
  on public.place_action_events(event_type, locale, created_at desc);

comment on column public.place_action_events.metadata is
  'Coarse, sanitized analytics dimensions only. Do not store raw search text, exact coordinates, email, phone, tokens, full URLs, or report evidence.';

