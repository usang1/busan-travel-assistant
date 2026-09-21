alter table public.places
  add column if not exists city_code text,
  add column if not exists district_code text;

update public.places
set city_code = case
  when coalesce(address_ko, address, '') like '%부산%' then 'busan'
  when coalesce(address_ko, address, '') like '%서울%' then 'seoul'
  when coalesce(address_ko, address, '') ~ '(제주|서귀포)' then 'jeju'
  else city_code
end
where city_code is null;

update public.places as places
set city_code = replace(tags.slug, 'place-city-', '')
from public.place_tags
join public.tags on tags.id = place_tags.tag_id
where place_tags.place_id = places.id
  and places.city_code is null
  and tags.slug in ('place-city-busan', 'place-city-seoul', 'place-city-jeju');

update public.places
set district_code = case
  when coalesce(address_ko, address, '') like '%부산진구%' then 'busanjin-gu'
  when coalesce(address_ko, address, '') like '%해운대구%' then 'haeundae-gu'
  when coalesce(address_ko, address, '') like '%금정구%' then 'geumjeong-gu'
  when coalesce(address_ko, address, '') like '%강서구%' then 'gangseo-gu'
  when coalesce(address_ko, address, '') like '%수영구%' then 'suyeong-gu'
  when coalesce(address_ko, address, '') like '%영도구%' then 'yeongdo-gu'
  when coalesce(address_ko, address, '') like '%동래구%' then 'dongnae-gu'
  when coalesce(address_ko, address, '') like '%연제구%' then 'yeonje-gu'
  when coalesce(address_ko, address, '') like '%사상구%' then 'sasang-gu'
  when coalesce(address_ko, address, '') like '%기장군%' then 'gijang-gun'
  when coalesce(address_ko, address, '') like '%사하구%' then 'saha-gu'
  when coalesce(address_ko, address, '') like '%동구%' then 'dong-gu'
  when coalesce(address_ko, address, '') like '%서구%' then 'seo-gu'
  when coalesce(address_ko, address, '') like '%남구%' then 'nam-gu'
  when coalesce(address_ko, address, '') like '%북구%' then 'buk-gu'
  when coalesce(address_ko, address, '') like '%중구%' then 'jung-gu'
  else district_code
end
where city_code = 'busan'
  and district_code is null;

update public.places as places
set district_code = replace(tags.slug, 'busan-district-', '')
from public.place_tags
join public.tags on tags.id = place_tags.tag_id
where place_tags.place_id = places.id
  and places.city_code = 'busan'
  and places.district_code is null
  and tags.slug like 'busan-district-%';

alter table public.places drop constraint if exists places_city_code_check;
alter table public.places
  add constraint places_city_code_check
  check (city_code is null or city_code in ('busan', 'seoul', 'jeju'));

create index if not exists places_public_city_district_idx
on public.places(city_code, district_code, updated_at desc)
where is_active = true and status in ('PUBLISHED', 'ACTIVE');

alter table public.place_china_info
  add column if not exists verification_basis text not null default 'unverified',
  add column if not exists traveler_confirmation_count integer not null default 0,
  add column if not exists has_information_conflict boolean not null default false;

update public.place_china_info
set verification_basis = 'admin'
where verification_status = 'verified'
  and verification_basis = 'unverified';

alter table public.place_china_info drop constraint if exists place_china_info_verification_basis_check;
alter table public.place_china_info
  add constraint place_china_info_verification_basis_check
  check (verification_basis in ('official_source', 'admin', 'traveler', 'unverified'));

alter table public.place_china_info drop constraint if exists place_china_info_traveler_confirmation_count_check;
alter table public.place_china_info
  add constraint place_china_info_traveler_confirmation_count_check
  check (traveler_confirmation_count >= 0);

alter table public.place_china_info drop constraint if exists place_china_info_traveler_basis_count_check;
alter table public.place_china_info
  add constraint place_china_info_traveler_basis_count_check
  check (verification_basis <> 'traveler' or traveler_confirmation_count > 0);

alter table public.place_china_info drop constraint if exists place_china_info_conflict_verification_check;
alter table public.place_china_info
  add constraint place_china_info_conflict_verification_check
  check (not has_information_conflict or verification_status <> 'verified');

create or replace function public.get_place_rankings(
  ranking_period text default 'all',
  result_limit integer default 8,
  category_filter public.place_category default null,
  region_filter text default null
)
returns table(
  place_id uuid,
  save_count bigint,
  recent_save_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      places.id as place_id,
      count(place_saves.id)::bigint as save_count,
      count(place_saves.id) filter (
        where place_saves.created_at >= now() - interval '7 days'
      )::bigint as recent_save_count
    from public.places
    left join public.place_saves on place_saves.place_id = places.id
    where places.is_active = true
      and places.status in ('PUBLISHED', 'ACTIVE')
      and places.city_code = 'busan'
      and places.district_code is not null
      and places.latitude between 34.95 and 35.45
      and places.longitude between 128.65 and 129.4
      and (category_filter is null or places.category = category_filter)
      and (
        nullif(trim(region_filter), '') is null
        or coalesce(places.address_ko, '') ilike '%' || trim(region_filter) || '%'
        or coalesce(places.address_zh, '') ilike '%' || trim(region_filter) || '%'
        or coalesce(places.address, '') ilike '%' || trim(region_filter) || '%'
      )
    group by places.id
  )
  select ranked.place_id, ranked.save_count, ranked.recent_save_count
  from ranked
  where case
    when ranking_period = 'week' then ranked.recent_save_count >= 3
    else ranked.save_count >= 3
  end
  order by
    case when ranking_period = 'week' then ranked.recent_save_count else ranked.save_count end desc,
    ranked.save_count desc,
    ranked.place_id
  limit greatest(1, least(coalesce(result_limit, 8), 24));
$$;

revoke all on function public.get_place_rankings(text, integer, public.place_category, text) from public;
grant execute on function public.get_place_rankings(text, integer, public.place_category, text) to anon, authenticated;

comment on column public.places.city_code is
  'Admin-verified city scope used with district and coordinate checks; null means review required.';
comment on column public.places.district_code is
  'Normalized district key. Public Busan views require a valid Busan district.';
comment on column public.place_china_info.verification_basis is
  'Evidence basis. Defaults to unverified and must not be inferred from save counts.';
comment on function public.get_place_rankings(text, integer, public.place_category, text) is
  'Returns Busan-only rankings after at least three cumulative or recent saves.';

notify pgrst, 'reload schema';
