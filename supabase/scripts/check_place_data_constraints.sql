-- Read-only preflight. Every query must return zero rows before finalizing constraints.
select id, slug, name_ko, category, price_min, price_max
from public.places
where category in ('restaurant', 'cafe', 'bar')
  and price_min is not null
  and price_min between 1 and 999
order by updated_at desc;

select id, slug, name_ko, category, price_min, price_max
from public.places
where category in ('restaurant', 'cafe', 'bar')
  and price_max is not null
  and price_max between 1 and 999
order by updated_at desc;

select id, slug, name_ko, category, price_min, price_max
from public.places
where price_min is not null
  and price_max is not null
  and price_min > price_max
order by updated_at desc;

select id, place_id, name_ko, name_zh, price
from public.place_menu_items
where price between 1 and 999
order by place_id, sort_order;
