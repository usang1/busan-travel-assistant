begin;

alter table public.place_menu_items
  add column if not exists price_is_variable boolean not null default false;

alter table public.place_menu_items
  drop constraint if exists place_menu_items_variable_price_check,
  add constraint place_menu_items_variable_price_check
    check (not price_is_variable or price is null) not valid;

comment on column public.place_menu_items.price_is_variable is
  'True when a menu has no fixed posted price. The numeric price must be null.';

-- These two published whiskey menu rows were explicitly identified as variable priced.
-- Match both the stable row ID and Korean menu name to avoid changing another menu.
update public.place_menu_items
set price = null,
    price_is_variable = true
where (id = '2de37a0c-3e84-414f-b0a1-7fc29f2318b6' and name_ko = '위스키')
   or (id = '9cc10903-6b56-4894-a828-20d58afd15ea' and name_ko = '각종 위스키/칵테일');

commit;

notify pgrst, 'reload schema';
