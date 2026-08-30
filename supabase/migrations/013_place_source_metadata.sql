alter table public.place_sources
  add column if not exists raw_metadata jsonb;

comment on column public.place_sources.raw_metadata is
  'Provider-specific factual response and normalized metadata. Generated AI content must not be stored here.';

comment on column public.place_sources.last_synced_at is
  'Timestamp when raw_metadata was last fetched from the provider API.';
