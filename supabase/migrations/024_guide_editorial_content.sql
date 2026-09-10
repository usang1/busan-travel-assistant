begin;

alter table public.guides add column if not exists editorial jsonb not null default '{}'::jsonb
  check (jsonb_typeof(editorial) = 'object' and octet_length(editorial::text) <= 524288);

-- Existing guides and older admin clients retain their editorial data.
create or replace function public.save_official_guide(
  target_id uuid, payload jsonb, expected_updated_at timestamptz default null
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  draft public.guides;
  saved_id uuid;
  previous_updated_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if jsonb_typeof(payload->'places') is distinct from 'array'
     or jsonb_array_length(payload->'places') > 80 then
    raise exception 'Invalid stops' using errcode = '22023';
  end if;
  draft := jsonb_populate_record(null::public.guides, payload);
  if draft.status = 'PUBLISHED' and exists (
    select 1 from jsonb_array_elements(payload->'places') item
    where not exists (select 1 from public.places p where p.id = (item->>'place_id')::uuid
      and p.is_active and p.status in ('PUBLISHED','ACTIVE'))
  ) then
    raise exception 'Only published places can be included in published guides' using errcode = '22023';
  end if;
  if target_id is null then
    insert into public.guides (slug, status, guide_type, title_ko, title_zh, title_en, title_ja, description_ko, description_zh, description_en, description_ja, cover_image, area, estimated_duration, recommended_for, weather_type, sort_order, is_featured, editorial)
    values (draft.slug, draft.status, draft.guide_type, draft.title_ko, draft.title_zh, draft.title_en, draft.title_ja, draft.description_ko, draft.description_zh, draft.description_en, draft.description_ja, draft.cover_image, draft.area, draft.estimated_duration, draft.recommended_for, draft.weather_type, draft.sort_order, draft.is_featured, coalesce(draft.editorial, '{}'::jsonb)) returning id into saved_id;
  else
    select updated_at into previous_updated_at from public.guides where id = target_id for update;
    if not found then raise exception 'Guide not found' using errcode = 'P0002'; end if;
    if expected_updated_at is null or previous_updated_at <> expected_updated_at then
      raise exception 'Guide changed; reload before saving' using errcode = '40001';
    end if;
    update public.guides set slug = draft.slug, status = draft.status, guide_type = draft.guide_type, title_ko = draft.title_ko, title_zh = draft.title_zh, title_en = draft.title_en, title_ja = draft.title_ja, description_ko = draft.description_ko, description_zh = draft.description_zh, description_en = draft.description_en, description_ja = draft.description_ja, cover_image = draft.cover_image, area = draft.area, estimated_duration = draft.estimated_duration, recommended_for = draft.recommended_for, weather_type = draft.weather_type, sort_order = draft.sort_order, is_featured = draft.is_featured, editorial = coalesce(draft.editorial, guides.editorial)
    where id = target_id;
    saved_id := target_id;
    delete from public.guide_places where guide_id = saved_id;
  end if;
  insert into public.guide_places (
    guide_id, place_id, sequence, custom_title, custom_description, stay_minutes, transportation_note, tip
  )
  select saved_id, (item->>'place_id')::uuid, (ordinality - 1)::integer,
    coalesce(item->'custom_title','{}'), coalesce(item->'custom_description','{}'),
    (item->>'stay_minutes')::integer, coalesce(item->'transportation_note','{}'), coalesce(item->'tip','{}')
  from jsonb_array_elements(payload->'places') with ordinality as stops(item, ordinality);
  return saved_id;
end;
$$;
revoke all on function public.save_official_guide(uuid,jsonb,timestamptz) from public, anon;
grant execute on function public.save_official_guide(uuid,jsonb,timestamptz) to authenticated;

commit;
