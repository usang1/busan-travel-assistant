alter table public.trips
  add column if not exists client_merge_key text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'trips_user_client_merge_key_unique'
      and conrelid = 'public.trips'::regclass
  ) then
    alter table public.trips
      add constraint trips_user_client_merge_key_unique unique (user_id, client_merge_key);
  end if;
end $$;

comment on column public.trips.client_merge_key is
  'Optional client-generated key used to idempotently merge guest localStorage trips into an authenticated account.';
