begin;

-- Replaces one place's menu in a single database transaction. Any validation,
-- constraint, or insert failure rolls the delete back, so an existing menu is
-- never left empty after a failed administrator save.
create or replace function public.replace_place_menu_items(
  target_place_id uuid,
  menu_items jsonb
)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  item_count integer;
begin
  if not public.is_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;

  if target_place_id is null or not exists (
    select 1 from public.places where id = target_place_id
  ) then
    raise exception 'place not found' using errcode = 'P0002';
  end if;

  if menu_items is null or jsonb_typeof(menu_items) <> 'array' then
    raise exception 'menu_items must be a JSON array' using errcode = '22023';
  end if;

  item_count := jsonb_array_length(menu_items);
  if item_count > 100 then
    raise exception 'too many menu items' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(menu_items) item
    where nullif(item->>'id', '') is not null
      and not exists (
        select 1
        from public.place_menu_items existing
        where existing.id = (item->>'id')::uuid
          and existing.place_id = target_place_id
      )
  ) then
    raise exception 'menu item does not belong to place' using errcode = '23503';
  end if;

  if exists (
    select nullif(item->>'id', '')
    from jsonb_array_elements(menu_items) item
    where nullif(item->>'id', '') is not null
    group by nullif(item->>'id', '')
    having count(*) > 1
  ) then
    raise exception 'duplicate menu item id' using errcode = '23505';
  end if;

  delete from public.place_menu_items where place_id = target_place_id;

  insert into public.place_menu_items (
    id,
    place_id,
    name_ko,
    name_zh,
    description_zh,
    price,
    price_is_variable,
    is_recommended,
    sort_order,
    localized_name,
    korean_original_name,
    recommendation_status,
    recommendation_basis,
    spicy_level,
    oily_level,
    aroma_level,
    portion_size,
    recommended_party_size,
    contains_seafood,
    contains_cilantro,
    meal_type,
    ordering_note,
    menu_warning,
    availability_time,
    sold_out_risk
  )
  select
    coalesce(nullif(item->>'id', '')::uuid, gen_random_uuid()),
    target_place_id,
    trim(coalesce(item->>'name_ko', '')),
    trim(coalesce(item->>'name_zh', '')),
    coalesce(item->>'description_zh', ''),
    case when coalesce((item->>'price_is_variable')::boolean, false) then null else nullif(item->>'price', '')::integer end,
    coalesce((item->>'price_is_variable')::boolean, false),
    coalesce((item->>'is_recommended')::boolean, false),
    coalesce(nullif(item->>'sort_order', '')::integer, ordinal::integer),
    coalesce(item->'localized_name', '{}'::jsonb),
    coalesce(item->>'korean_original_name', item->>'name_ko', ''),
    coalesce(nullif(item->>'recommendation_status', '')::public.place_fact_tristate, 'unknown'::public.place_fact_tristate),
    nullif(item->>'recommendation_basis', ''),
    nullif(item->>'spicy_level', '')::smallint,
    nullif(item->>'oily_level', '')::smallint,
    nullif(item->>'aroma_level', '')::smallint,
    nullif(item->>'portion_size', '')::smallint,
    nullif(item->>'recommended_party_size', '')::smallint,
    coalesce(nullif(item->>'contains_seafood', '')::public.place_fact_tristate, 'unknown'::public.place_fact_tristate),
    coalesce(nullif(item->>'contains_cilantro', '')::public.place_fact_tristate, 'unknown'::public.place_fact_tristate),
    nullif(item->>'meal_type', ''),
    coalesce(item->'ordering_note', '{}'::jsonb),
    coalesce(item->'menu_warning', '{}'::jsonb),
    coalesce(item->'availability_time', '[]'::jsonb),
    nullif(item->>'sold_out_risk', '')::smallint
  from jsonb_array_elements(menu_items) with ordinality as source(item, ordinal);

  return item_count;
end;
$$;

revoke all on function public.replace_place_menu_items(uuid, jsonb) from public;
grant execute on function public.replace_place_menu_items(uuid, jsonb) to authenticated;

comment on function public.replace_place_menu_items(uuid, jsonb) is
  'Admin-only atomic replacement for a place menu. The prior rows survive any failure.';

commit;

notify pgrst, 'reload schema';
