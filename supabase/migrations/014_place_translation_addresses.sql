alter table public.place_translations
  add column if not exists address text not null default '';

update public.place_translations translations
set address = case translations.locale
  when 'ko' then places.address_ko
  when 'zh' then case
    when places.address_zh <> places.address_ko and places.address_zh !~ '[가-힣]' then places.address_zh
    else ''
  end
  else translations.address
end
from public.places
where places.id = translations.place_id
  and translations.address = ''
  and translations.locale in ('ko', 'zh');

comment on column public.place_translations.address is
  'Locale-specific display address. Road and building numbers must be preserved from the Korean provider address.';
