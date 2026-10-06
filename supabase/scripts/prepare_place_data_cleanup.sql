-- Dry-run cleanup for known price corruption. This script intentionally ends with ROLLBACK.
-- Review the RETURNING rows, replace ROLLBACK with COMMIT, and run in a controlled maintenance window.
begin;

with legacy_tiers as (
  select id,
    greatest(
      case when price_min between 1 and 4 then price_min else 0 end,
      case when price_max between 1 and 4 then price_max else 0 end
    ) as inferred_tier
  from public.places
  where category in ('restaurant', 'cafe', 'bar')
    and (price_min between 1 and 4 or price_max between 1 and 4)
)
update public.places p
set price_level = case when p.price_level is null then nullif(t.inferred_tier, 0) else p.price_level end,
    price_min = case when p.price_min between 1 and 999 then null else p.price_min end,
    price_max = case when p.price_max between 1 and 999 then null else p.price_max end
from legacy_tiers t
where p.id = t.id
returning p.id, p.slug, p.name_ko, p.price_level, p.price_min, p.price_max;

update public.places
set price_min = null,
    price_max = null
where price_min is not null
  and price_max is not null
  and price_min > price_max
returning id, slug, name_ko, price_min, price_max;

update public.place_menu_items
set price = null
where price between 1 and 999
returning id, place_id, name_ko, price;

-- These rows need human translation/address review; this script does not guess replacements.
select id, slug, name_ko, name_zh, address_ko, address_zh, short_description_zh, tips_zh, waiting_info_zh, recommended_order_zh
from public.places
where name_zh = name_ko
   or name_zh ~ '[가-힣]'
   or short_description_zh ~ '[가-힣]'
   or tips_zh ~ '[가-힣]'
   or waiting_info_zh ~ '[가-힣]'
   or recommended_order_zh ~ '[가-힣]'
   or address_zh ~ '[가-힣]'
   or address_zh ~* '(^|[[:space:]])[A-Za-z]+([-[:space:]][A-Za-z0-9]+)*(-ro|-gil|[[:space:]](ro|gil|road|street|avenue))\y'
order by updated_at desc;

select id, place_id, name_ko, name_zh, description_zh
from public.place_menu_items
where name_zh = name_ko
   or name_zh ~ '[가-힣]'
   or description_zh ~ '[가-힣]'
order by place_id, sort_order;

-- Keep this rollback until an operator has reviewed every RETURNING/result row above.
rollback;
