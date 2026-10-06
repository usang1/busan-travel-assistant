-- Run only after reviewing and committing prepare_place_data_cleanup.sql.
-- PostgreSQL validates every existing row and aborts this transaction if dirty data remains.
begin;

alter table public.places validate constraint places_price_range_order_check;
alter table public.places validate constraint places_food_price_min_sanity_check;
alter table public.places validate constraint places_food_price_max_sanity_check;
alter table public.place_menu_items validate constraint place_menu_items_price_check;

commit;
