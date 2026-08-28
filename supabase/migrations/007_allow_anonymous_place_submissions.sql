alter table public.place_submissions enable row level security;

drop policy if exists "Public can create place submissions" on public.place_submissions;
drop policy if exists "Anyone can create place submissions" on public.place_submissions;
drop policy if exists "Authenticated users can create own place submissions" on public.place_submissions;

create policy "Anyone can create place submissions"
on public.place_submissions for insert
with check (
  (auth.uid() is null and user_id is null)
  or (auth.uid() is not null and user_id = auth.uid())
);

grant usage on schema public to anon, authenticated;
grant insert on public.place_submissions to anon;
grant all on public.place_submissions to authenticated;
