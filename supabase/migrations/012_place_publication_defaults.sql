alter table public.places
  alter column is_active set default true,
  alter column status set default 'ACTIVE';

update public.places
set is_active = true
where is_active is null;

update public.places
set status = case
  when is_active then 'ACTIVE'
  else 'DRAFT'
end
where status is null;

alter table public.places
  alter column is_active set not null,
  alter column status set not null;

alter table public.places
  drop constraint if exists places_status_check,
  add constraint places_status_check check (status in ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED'));
