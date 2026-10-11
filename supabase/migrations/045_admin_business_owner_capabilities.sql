begin;

create or replace function public.has_business_owner_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('business_owner', 'admin')
  );
$$;

revoke all on function public.has_business_owner_access() from public;
grant execute on function public.has_business_owner_access() to authenticated;

drop policy if exists "Business owners create applications" on public.business_applications;
drop policy if exists "Business owners and admins create applications" on public.business_applications;
create policy "Business owners and admins create applications"
on public.business_applications
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.has_business_owner_access()
);

commit;

notify pgrst, 'reload schema';
