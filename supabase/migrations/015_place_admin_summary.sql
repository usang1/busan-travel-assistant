alter table public.places
  add column if not exists admin_summary text not null default '';

comment on column public.places.admin_summary is
  'Administrator-reviewed Korean summary generated only from normalized provider facts. User submission text remains in place_submissions.';
