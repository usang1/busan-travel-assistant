-- Enforce the same invariant used by guest storage and application writes.
-- NOT VALID preserves any legacy row for operator review while rejecting new
-- or updated reversed ranges. Validate only after the audit query returns zero.
alter table public.trips
  drop constraint if exists trips_date_range_valid;

alter table public.trips
  add constraint trips_date_range_valid
  check (start_date <= end_date) not valid;

comment on constraint trips_date_range_valid on public.trips is
  'Start date must not be after end date. Before VALIDATE CONSTRAINT, audit with: select id, start_date, end_date from public.trips where start_date > end_date;';

-- Rollback (does not delete schedules):
-- alter table public.trips drop constraint if exists trips_date_range_valid;
