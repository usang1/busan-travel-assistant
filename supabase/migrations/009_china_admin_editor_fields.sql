do $$
begin
  alter type china_waiting_level add value if not exists 'varies';
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'china_minimum_order_policy') then
    create type china_minimum_order_policy as enum ('unknown', 'none', 'two_plus', 'three_plus', 'other');
  end if;
end $$;

alter table public.place_china_info
  add column if not exists waiting_minutes_min smallint,
  add column if not exists waiting_minutes_max smallint,
  add column if not exists minimum_order_policy china_minimum_order_policy not null default 'unknown',
  add column if not exists minimum_order_note text,
  add column if not exists photo_recommended place_fact_tristate not null default 'unknown',
  add column if not exists tourism_recommended place_fact_tristate not null default 'unknown';

alter table public.place_china_info
  drop constraint if exists place_china_info_waiting_minutes_min_check,
  add constraint place_china_info_waiting_minutes_min_check check (waiting_minutes_min is null or waiting_minutes_min >= 0),
  drop constraint if exists place_china_info_waiting_minutes_max_check,
  add constraint place_china_info_waiting_minutes_max_check check (waiting_minutes_max is null or waiting_minutes_max >= 0),
  drop constraint if exists place_china_info_waiting_minutes_range_check,
  add constraint place_china_info_waiting_minutes_range_check check (
    waiting_minutes_min is null
    or waiting_minutes_max is null
    or waiting_minutes_max >= waiting_minutes_min
  );

comment on type china_minimum_order_policy is
  'Structured minimum order policy for China-focused admin input.';

comment on column public.place_china_info.waiting_minutes_min is
  'Lower bound of expected waiting minutes. Null means unknown or not applicable.';

comment on column public.place_china_info.waiting_minutes_max is
  'Upper bound of expected waiting minutes. Null means unknown, variable, or open-ended.';

comment on column public.place_china_info.minimum_order_policy is
  'Structured minimum order policy for display. unknown must not be treated as no limit.';

comment on column public.place_china_info.minimum_order_note is
  'Optional admin note for other minimum order policies.';

comment on column public.place_china_info.photo_recommended is
  'Whether the place is recommended specifically for taking photos.';

comment on column public.place_china_info.tourism_recommended is
  'Whether the place is recommended for general sightseeing.';
