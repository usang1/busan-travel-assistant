alter table public.place_china_info
  add column if not exists traveler_insights jsonb not null default '{}'::jsonb;

alter table public.place_china_info
  drop constraint if exists place_china_info_traveler_insights_object_check,
  add constraint place_china_info_traveler_insights_object_check
  check (jsonb_typeof(traveler_insights) = 'object');

create index if not exists place_china_info_traveler_insights_idx
on public.place_china_info using gin (traveler_insights);

update public.place_china_info
set traveler_insights = jsonb_strip_nulls(jsonb_build_object(
  'solo_dining', nullif(solo_friendly::text, 'unknown'),
  'card_payment', nullif(foreign_card::text, 'unknown'),
  'chinese_menu', nullif(chinese_menu::text, 'unknown'),
  'luggage_storage', nullif(luggage_friendly::text, 'unknown'),
  'toilet', case toilet_available when 'yes' then 'available' when 'no' then 'none' else null end,
  'reservation', case reservation_required when 'yes' then 'required' when 'no' then 'not_needed' else null end,
  'waiting', case
    when waiting_level = 'none' then 'none'
    when waiting_level in ('short', 'moderate', 'varies') then 'some'
    when waiting_level in ('long', 'extreme') then 'high'
    else null
  end,
  'spicy', case when spicy_level is null then null when spicy_level >= 4 then 'strong' else 'normal' end,
  'greasiness', case when greasy_level is null then null when greasy_level >= 4 then 'possible' else 'no' end,
  'portion', case when portion_level is null then null when portion_level >= 4 then 'large' else 'regular' end,
  'tourist_friendly', nullif(tourism_recommended::text, 'unknown')
)) || traveler_insights;

comment on column public.place_china_info.traveler_insights is
  'Extensible structured practical facts for travelers. Unknown values are omitted or stored as unknown; prose and AI output must not overwrite this object.';

-- Existing RLS policies on place_china_info cover this column:
-- active-place facts are public-read, and only admins can insert/update/delete.
