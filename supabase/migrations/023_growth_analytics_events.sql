do $$
begin
  alter type public.place_action_event_type add value if not exists 'guide_view';
  alter type public.place_action_event_type add value if not exists 'guide_save';
  alter type public.place_action_event_type add value if not exists 'guide_unsave';
  alter type public.place_action_event_type add value if not exists 'guide_place_click';
  alter type public.place_action_event_type add value if not exists 'saved_list_view';
  alter type public.place_action_event_type add value if not exists 'saved_map_view';
  alter type public.place_action_event_type add value if not exists 'share_click';
exception
  when duplicate_object then null;
end $$;

comment on column public.place_action_events.metadata is
  'Non-PII analytics payload. Guide ids, guide type, area, source, referrer, and UTM attribution may be stored here.';
