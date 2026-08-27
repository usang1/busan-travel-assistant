do $$
begin
  alter type submission_status add value if not exists 'reviewing';
  alter type submission_status add value if not exists 'duplicate';
exception
  when duplicate_object then null;
end $$;

alter table public.place_submissions
  alter column name drop not null,
  add column if not exists place_id uuid references public.places(id) on delete set null,
  add column if not exists location_text text,
  add column if not exists recommendation_reason text not null default '';

update public.place_submissions
set recommendation_reason = notes
where recommendation_reason = ''
  and notes <> '';

create index if not exists place_submissions_place_idx on public.place_submissions(place_id);
create index if not exists place_submissions_source_url_idx on public.place_submissions(source_url);

drop policy if exists "Public can create place submissions" on public.place_submissions;
drop policy if exists "Authenticated users can create own place submissions" on public.place_submissions;
create policy "Authenticated users can create own place submissions"
on public.place_submissions for insert
with check (auth.uid() is not null and user_id = auth.uid());

drop policy if exists "Users can read own place submissions" on public.place_submissions;
create policy "Users can read own place submissions"
on public.place_submissions for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own draft place submissions" on public.place_submissions;
create policy "Users can update own draft place submissions"
on public.place_submissions for update
using (user_id = auth.uid() and status = 'pending')
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can manage place submissions" on public.place_submissions;
create policy "Admins can manage place submissions"
on public.place_submissions for all
using (public.is_admin())
with check (public.is_admin());

comment on column public.place_submissions.source_url is
  'Original Naver/Kakao/Google map URL supplied by the user. Do not scrape unsupported data from it.';

comment on column public.place_submissions.recommendation_reason is
  'User-written recommendation reason for admin review.';
