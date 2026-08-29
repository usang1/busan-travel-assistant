create table if not exists public.place_ai_generation_drafts (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places(id) on delete set null,
  provider public.place_source_provider not null default 'MANUAL',
  source_url text,
  source_external_id text,
  source_data jsonb not null default '{}'::jsonb,
  generated_content jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint place_ai_generation_drafts_status_check check (status in ('draft', 'applied', 'discarded', 'failed'))
);

create index if not exists place_ai_generation_drafts_place_idx
on public.place_ai_generation_drafts(place_id, created_at desc);

create index if not exists place_ai_generation_drafts_status_idx
on public.place_ai_generation_drafts(status, created_at desc);

drop trigger if exists place_ai_generation_drafts_set_updated_at on public.place_ai_generation_drafts;
create trigger place_ai_generation_drafts_set_updated_at
before update on public.place_ai_generation_drafts
for each row execute function public.set_updated_at();

alter table public.place_ai_generation_drafts enable row level security;

drop policy if exists "Admins can manage place AI generation drafts" on public.place_ai_generation_drafts;
create policy "Admins can manage place AI generation drafts"
on public.place_ai_generation_drafts for all
using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

grant all on public.place_ai_generation_drafts to authenticated;

comment on table public.place_ai_generation_drafts is
  'Admin-only AI generation drafts. Raw source facts and generated content are kept separate until an admin applies the draft to places/place_translations.';
comment on column public.place_ai_generation_drafts.source_data is
  'Structured factual data from admin form or map link. Do not store invented AI content here.';
comment on column public.place_ai_generation_drafts.generated_content is
  'AI-generated copy candidate reviewed by admins before applying to public place fields.';
