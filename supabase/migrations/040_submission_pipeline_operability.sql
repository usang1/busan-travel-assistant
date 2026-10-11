begin;

alter table public.place_submissions
  add column if not exists notification_status text,
  add column if not exists notification_attempts integer not null default 0,
  add column if not exists notification_last_attempt_at timestamptz,
  add column if not exists notification_last_error text,
  add column if not exists notification_sent_at timestamptz,
  add column if not exists approval_token uuid,
  add column if not exists approval_started_at timestamptz,
  add column if not exists approval_last_error text;

alter table public.place_submissions
  drop constraint if exists place_submissions_notification_status_check,
  add constraint place_submissions_notification_status_check
    check (notification_status is null or notification_status in ('sent', 'failed', 'skipped')),
  drop constraint if exists place_submissions_notification_attempts_check,
  add constraint place_submissions_notification_attempts_check
    check (notification_attempts >= 0),
  drop constraint if exists place_submissions_approval_lock_check,
  add constraint place_submissions_approval_lock_check
    check ((approval_token is null) = (approval_started_at is null));

-- A submitted row must not arrive with an admin decision or a forged notification result.
drop policy if exists "Anyone can create place submissions" on public.place_submissions;
create policy "Anyone can create place submissions"
on public.place_submissions for insert
with check (
  ((auth.uid() is null and user_id is null) or (auth.uid() is not null and user_id = auth.uid()))
  and status = 'pending'
  and place_id is null
  and reviewed_by is null
  and reviewed_at is null
  and notification_status is null
  and notification_attempts = 0
  and notification_last_attempt_at is null
  and notification_last_error is null
  and notification_sent_at is null
  and approval_token is null
  and approval_started_at is null
  and approval_last_error is null
);

-- Review decisions are made through admin routes. The old policy allowed users to
-- rewrite arbitrary columns on their pending submission.
drop policy if exists "Users can update own draft place submissions" on public.place_submissions;

create table if not exists public.place_submission_audit (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.place_submissions(id) on delete cascade,
  event_type text not null,
  actor_id uuid,
  previous_status text,
  next_status text,
  previous_place_id uuid,
  next_place_id uuid,
  previous_notification_status text,
  next_notification_status text,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists place_submission_audit_submission_created_idx
on public.place_submission_audit(submission_id, created_at desc);

alter table public.place_submission_audit enable row level security;
drop policy if exists "Admins can read submission audit" on public.place_submission_audit;
create policy "Admins can read submission audit"
on public.place_submission_audit for select
using (public.is_admin());
grant select on public.place_submission_audit to authenticated;

create or replace function public.log_place_submission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'submitted';
  elsif old.status is distinct from new.status then
    event_name := 'status_changed';
  elsif old.place_id is distinct from new.place_id then
    event_name := 'place_linked';
  elsif old.notification_last_attempt_at is distinct from new.notification_last_attempt_at then
    event_name := 'notification_attempted';
  elsif old.approval_last_error is distinct from new.approval_last_error and new.approval_last_error is not null then
    event_name := 'approval_failed';
  else
    return new;
  end if;

  insert into public.place_submission_audit (
    submission_id, event_type, actor_id, previous_status, next_status,
    previous_place_id, next_place_id, previous_notification_status,
    next_notification_status, error_code
  ) values (
    new.id, event_name, auth.uid(),
    case when tg_op = 'INSERT' then null else old.status::text end,
    new.status::text,
    case when tg_op = 'INSERT' then null else old.place_id end,
    new.place_id,
    case when tg_op = 'INSERT' then null else old.notification_status end,
    new.notification_status,
    case when new.approval_last_error is not null then left(new.approval_last_error, 80)
         when new.notification_last_error is not null then left(new.notification_last_error, 80)
         else null end
  );
  return new;
end;
$$;

revoke all on function public.log_place_submission_change() from public;
drop trigger if exists place_submission_audit_change on public.place_submissions;
create trigger place_submission_audit_change
after insert or update on public.place_submissions
for each row execute function public.log_place_submission_change();

commit;
notify pgrst, 'reload schema';
