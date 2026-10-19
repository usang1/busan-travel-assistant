-- Additive diagnostics for administrator place autofill runs.
-- Apply only after review; no existing place data is changed.

begin;

create table if not exists public.place_autofill_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  source_provider text not null check (source_provider in ('google', 'naver', 'kakao', 'unknown')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0 and duration_ms <= 300000),
  status text not null check (status in ('success', 'partial', 'failed')),
  error_code text check (error_code is null or length(error_code) <= 80),
  retry_of uuid references public.place_autofill_runs(id) on delete set null,
  field_results jsonb not null default '[]'::jsonb check (jsonb_typeof(field_results) = 'array'),
  created_at timestamptz not null default now()
);

create index if not exists place_autofill_runs_requested_idx
  on public.place_autofill_runs(requested_at desc);
create index if not exists place_autofill_runs_provider_status_idx
  on public.place_autofill_runs(source_provider, status, requested_at desc);

alter table public.place_autofill_runs enable row level security;

create policy "Admins manage place autofill diagnostics"
  on public.place_autofill_runs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.place_autofill_runs from anon;

comment on table public.place_autofill_runs is
  'Redacted execution diagnostics for administrator place autofill. API credentials and raw provider responses are never stored.';
comment on column public.place_autofill_runs.field_results is
  'Per-field status, source label, retryability, and stable failure code. Contains no raw provider response.';

commit;
notify pgrst, 'reload schema';
