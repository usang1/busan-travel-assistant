begin;

alter table public.places
  add column if not exists gallery_images jsonb not null default '[]'::jsonb;
alter table public.places drop constraint if exists places_gallery_images_check;
alter table public.places add constraint places_gallery_images_check
  check (jsonb_typeof(gallery_images) = 'array' and jsonb_array_length(gallery_images) <= 30);

alter table public.place_menu_items
  add column if not exists image_url text;

-- Extends the existing atomic menu replacement with menu images. Keeping the
-- same RPC means administrator create/edit and business publication share one
-- relation write path.
create or replace function public.replace_place_menu_items(target_place_id uuid, menu_items jsonb)
returns integer
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare item_count integer;
begin
  if not public.is_admin() then raise exception 'administrator access required' using errcode = '42501'; end if;
  if target_place_id is null or not exists (select 1 from public.places where id = target_place_id) then
    raise exception 'place not found' using errcode = 'P0002';
  end if;
  if menu_items is null or jsonb_typeof(menu_items) <> 'array' then
    raise exception 'menu_items must be a JSON array' using errcode = '22023';
  end if;
  item_count := jsonb_array_length(menu_items);
  if item_count > 100 then raise exception 'too many menu items' using errcode = '22023'; end if;
  if exists (
    select 1 from jsonb_array_elements(menu_items) item
    where nullif(item->>'id', '') is not null and not exists (
      select 1 from public.place_menu_items existing
      where existing.id = (item->>'id')::uuid and existing.place_id = target_place_id
    )
  ) then raise exception 'menu item does not belong to place' using errcode = '23503'; end if;
  if exists (
    select nullif(item->>'id', '') from jsonb_array_elements(menu_items) item
    where nullif(item->>'id', '') is not null group by nullif(item->>'id', '') having count(*) > 1
  ) then raise exception 'duplicate menu item id' using errcode = '23505'; end if;

  delete from public.place_menu_items where place_id = target_place_id;
  insert into public.place_menu_items (
    id, place_id, name_ko, name_zh, description_zh, image_url, price,
    price_is_variable, is_recommended, sort_order, localized_name,
    korean_original_name, recommendation_status, recommendation_basis,
    spicy_level, oily_level, aroma_level, portion_size, recommended_party_size,
    contains_seafood, contains_cilantro, meal_type, ordering_note, menu_warning,
    availability_time, sold_out_risk
  )
  select
    coalesce(nullif(item->>'id', '')::uuid, gen_random_uuid()), target_place_id,
    trim(coalesce(item->>'name_ko', '')), trim(coalesce(item->>'name_zh', '')),
    coalesce(item->>'description_zh', ''), nullif(item->>'image_url', ''),
    case when coalesce((item->>'price_is_variable')::boolean, false) then null else nullif(item->>'price', '')::integer end,
    coalesce((item->>'price_is_variable')::boolean, false), coalesce((item->>'is_recommended')::boolean, false),
    coalesce(nullif(item->>'sort_order', '')::integer, ordinal::integer), coalesce(item->'localized_name', '{}'::jsonb),
    coalesce(item->>'korean_original_name', item->>'name_ko', ''),
    coalesce(nullif(item->>'recommendation_status', '')::public.place_fact_tristate, 'unknown'::public.place_fact_tristate),
    nullif(item->>'recommendation_basis', ''), nullif(item->>'spicy_level', '')::smallint,
    nullif(item->>'oily_level', '')::smallint, nullif(item->>'aroma_level', '')::smallint,
    nullif(item->>'portion_size', '')::smallint, nullif(item->>'recommended_party_size', '')::smallint,
    coalesce(nullif(item->>'contains_seafood', '')::public.place_fact_tristate, 'unknown'::public.place_fact_tristate),
    coalesce(nullif(item->>'contains_cilantro', '')::public.place_fact_tristate, 'unknown'::public.place_fact_tristate),
    nullif(item->>'meal_type', ''), coalesce(item->'ordering_note', '{}'::jsonb),
    coalesce(item->'menu_warning', '{}'::jsonb), coalesce(item->'availability_time', '[]'::jsonb),
    nullif(item->>'sold_out_risk', '')::smallint
  from jsonb_array_elements(menu_items) with ordinality as source(item, ordinal);
  return item_count;
end;
$$;

-- A profile role answers "what kind of account is this?".  It must not be
-- used as proof that the account may edit a particular place.
create table if not exists public.business_place_memberships (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null default 'owner' check (membership_role in ('owner', 'manager')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  source_application_id uuid references public.business_applications(id) on delete set null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create index if not exists business_place_memberships_user_status_idx
  on public.business_place_memberships(user_id, status, updated_at desc);

drop trigger if exists business_place_memberships_set_updated_at on public.business_place_memberships;
create trigger business_place_memberships_set_updated_at before update on public.business_place_memberships
for each row execute function public.set_updated_at();

create table if not exists public.business_place_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.business_applications(id) on delete restrict,
  place_id uuid references public.places(id) on delete set null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_place_id uuid references public.places(id) on delete set null,
  approval_token uuid,
  approval_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((approval_token is null) = (approval_started_at is null))
);

create index if not exists business_place_changes_user_created_idx
  on public.business_place_changes(user_id, created_at desc);
create index if not exists business_place_changes_status_created_idx
  on public.business_place_changes(status, created_at asc);
alter table public.business_place_changes drop constraint if exists business_place_changes_status_check;
update public.business_place_changes set status = 'pending_review' where status in ('pending', 'reviewing');
alter table public.business_place_changes add constraint business_place_changes_status_check
  check (status in ('draft', 'pending_review', 'changes_requested', 'approved', 'rejected'));

drop index if exists public.business_place_changes_open_place_uidx;
create unique index business_place_changes_open_place_uidx
  on public.business_place_changes(user_id, place_id)
  where place_id is not null and status in ('draft', 'pending_review', 'changes_requested');
drop index if exists public.business_place_changes_open_application_uidx;
create unique index business_place_changes_open_application_uidx
  on public.business_place_changes(user_id, application_id)
  where place_id is null and status in ('draft', 'pending_review', 'changes_requested');

create table if not exists public.business_place_change_audit (
  id bigint generated always as identity primary key,
  change_id uuid not null references public.business_place_changes(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_status text,
  next_status text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists business_place_change_audit_change_created_idx
  on public.business_place_change_audit(change_id, created_at desc);

drop trigger if exists business_place_changes_set_updated_at on public.business_place_changes;
create trigger business_place_changes_set_updated_at before update on public.business_place_changes
for each row execute function public.set_updated_at();

create or replace function public.has_place_management_access(target_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.business_place_memberships membership
    where membership.place_id = target_place_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

revoke all on function public.has_place_management_access(uuid) from public;
grant execute on function public.has_place_management_access(uuid) to authenticated;

-- Never accept administrator-controlled trust/publication fields from a
-- business payload, even if the caller bypasses the Next.js form and invokes
-- the RPC directly.
create or replace function public.sanitize_business_place_payload(input_payload jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with top_level as (
    select jsonb_set(
      coalesce(input_payload, '{}'::jsonb)
      - array[
          'id', 'status', 'is_active', 'is_featured', 'admin_summary',
          'verification_tier', 'verification_checked_at', 'verification_checked_by',
          'verification_note', 'verification_source_urls', 'verified_visit_at',
          'direct_visit_photos', 'last_verified_at', 'created_at', 'updated_at', 'decision_profile',
          'operating_profile'
        ],
    '{china_info}',
    coalesce(input_payload->'china_info', '{}'::jsonb)
      - array[
          'verification_status', 'verification_basis', 'traveler_confirmation_count',
          'has_information_conflict', 'verified_at', 'manual_summary_override',
          'manual_warning_override'
        ],
      true
    ) as payload
  )
  select jsonb_set(
    payload,
    '{menu_items}',
    case when jsonb_typeof(payload->'menu_items') = 'array' then coalesce((
      select jsonb_agg(item - 'id' - 'place_id')
      from jsonb_array_elements(payload->'menu_items') item
    ), '[]'::jsonb) else '[]'::jsonb end,
    true
  ) from top_level;
$$;

revoke all on function public.sanitize_business_place_payload(jsonb) from public;

create or replace function public.review_business_application(
  application_id uuid,
  next_status text,
  review_notes text default null,
  target_place_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  application_row public.business_applications%rowtype;
  applicant_role public.profile_role;
  effective_place_id uuid;
  was_approved boolean;
begin
  if actor_id is null then
    return jsonb_build_object('ok', false, 'code', 'login_required');
  end if;
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'admin_required');
  end if;
  if next_status not in ('pending', 'reviewing', 'more_info_requested', 'approved', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status');
  end if;

  select * into application_row
  from public.business_applications
  where id = application_id
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'application_not_found');
  end if;

  was_approved := application_row.status = 'approved';
  effective_place_id := coalesce(target_place_id, application_row.linked_place_id);

  if was_approved and next_status <> 'approved' then
    return jsonb_build_object('ok', false, 'code', 'approved_application_immutable');
  end if;
  if was_approved and target_place_id is not null
     and application_row.linked_place_id is distinct from target_place_id then
    return jsonb_build_object('ok', false, 'code', 'approved_place_mismatch');
  end if;

  select role into applicant_role from public.profiles where id = application_row.user_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'applicant_profile_missing');
  end if;

  if next_status = 'approved' then
    if effective_place_id is not null and not exists (
      select 1 from public.places where id = effective_place_id
    ) then
      return jsonb_build_object('ok', false, 'code', 'place_not_found');
    end if;

    if applicant_role <> 'admin' then
      update public.profiles
      set role = 'business_owner', updated_at = now()
      where id = application_row.user_id;
    end if;

    if effective_place_id is not null then
      insert into public.business_place_memberships (
        place_id, user_id, membership_role, status, source_application_id,
        granted_by, granted_at, revoked_at
      ) values (
        effective_place_id, application_row.user_id, 'owner', 'active', application_row.id,
        actor_id, now(), null
      )
      on conflict (place_id, user_id) do update set
        membership_role = 'owner', status = 'active',
        source_application_id = excluded.source_application_id,
        granted_by = excluded.granted_by, granted_at = now(), revoked_at = null,
        updated_at = now();
    end if;
  end if;

  update public.business_applications
  set status = next_status::public.business_application_status,
      admin_notes = nullif(trim(review_notes), ''),
      linked_place_id = effective_place_id,
      reviewed_by = actor_id,
      reviewed_at = now(),
      updated_at = now()
  where id = application_row.id;

  return jsonb_build_object(
    'ok', true,
    'code', case when was_approved then 'already_approved' else 'updated' end,
    'application_id', application_row.id,
    'user_id', application_row.user_id,
    'place_id', effective_place_id,
    'status', next_status
  );
exception
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'code', 'ownership_link_failed');
  when insufficient_privilege then
    return jsonb_build_object('ok', false, 'code', 'database_permission_denied');
end;
$$;

revoke all on function public.review_business_application(uuid, text, text, uuid) from public;
grant execute on function public.review_business_application(uuid, text, text, uuid) to authenticated;

create or replace function public.save_business_place_change(
  change_id uuid,
  target_application_id uuid,
  target_place_id uuid,
  change_payload jsonb,
  submit_for_review boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  saved_row public.business_place_changes%rowtype;
  desired_status text := case when submit_for_review then 'pending_review' else 'draft' end;
  application_place_id uuid;
begin
  if actor_id is null then
    raise exception 'login_required' using errcode = '42501';
  end if;
  if jsonb_typeof(change_payload) is distinct from 'object' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  select application.linked_place_id into application_place_id
    from public.business_applications application
    where application.id = target_application_id
      and application.user_id = actor_id
      and application.status = 'approved';
  if not found then
    raise exception 'approved_application_required' using errcode = '42501';
  end if;
  if target_place_id is null and application_place_id is not null then
    raise exception 'application_already_linked' using errcode = '42501';
  end if;
  if target_place_id is not null and not exists (
    select 1 from public.business_place_memberships membership
    where membership.place_id = target_place_id
      and membership.user_id = actor_id
      and membership.status = 'active'
  ) then
    raise exception 'place_ownership_required' using errcode = '42501';
  end if;

  if change_id is null then
    insert into public.business_place_changes (
      user_id, application_id, place_id, payload, status
    ) values (
      actor_id, target_application_id, target_place_id,
      public.sanitize_business_place_payload(change_payload), desired_status
    ) returning * into saved_row;
  else
    update public.business_place_changes
    set application_id = target_application_id,
        place_id = target_place_id,
        payload = public.sanitize_business_place_payload(change_payload),
        status = desired_status,
        rejection_reason = null,
        reviewed_by = null,
        reviewed_at = null
    where id = change_id
      and user_id = actor_id
      and status in ('draft', 'changes_requested', 'rejected')
    returning * into saved_row;
    if not found then
      raise exception 'change_not_editable' using errcode = '55000';
    end if;
  end if;

  return to_jsonb(saved_row);
end;
$$;

revoke all on function public.save_business_place_change(uuid, uuid, uuid, jsonb, boolean) from public;
grant execute on function public.save_business_place_change(uuid, uuid, uuid, jsonb, boolean) to authenticated;

create or replace function public.audit_business_place_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare event_name text;
begin
  event_name := case
    when tg_op = 'INSERT' then 'created'
    when old.status is distinct from new.status then new.status
    else 'updated'
  end;
  insert into public.business_place_change_audit (
    change_id, actor_id, event_type, previous_status, next_status, reason
  ) values (
    new.id, auth.uid(), event_name,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status, new.rejection_reason
  );
  return new;
end;
$$;

drop trigger if exists business_place_changes_audit on public.business_place_changes;
create trigger business_place_changes_audit
after insert or update on public.business_place_changes
for each row execute function public.audit_business_place_change();

-- Apply the reviewed snapshot and all dependent records in one transaction.
-- Any constraint/RLS error rolls the entire approval back.
create or replace function public.approve_business_place_change(
  change_id uuid,
  requested_place_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  change_row public.business_place_changes%rowtype;
  application_row public.business_applications%rowtype;
  effective_place_id uuid;
  safe_payload jsonb;
  merged_payload jsonb;
  editable_columns text;
  tag_item jsonb;
  resolved_tag_id uuid;
  translation_item jsonb;
  source_item jsonb;
  china_payload jsonb;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;

  select * into change_row from public.business_place_changes where id = change_id for update;
  if not found then raise exception 'change_not_found' using errcode = 'P0002'; end if;
  if change_row.status = 'approved' then
    return jsonb_build_object('ok', true, 'code', 'already_approved', 'change_id', change_row.id, 'place_id', change_row.published_place_id);
  end if;
  if change_row.status <> 'pending_review' then
    raise exception 'change_not_approvable' using errcode = '55000';
  end if;

  select * into application_row
  from public.business_applications
  where id = change_row.application_id and user_id = change_row.user_id
  for update;
  if not found or application_row.status <> 'approved' then
    raise exception 'approved_application_required' using errcode = '42501';
  end if;
  if change_row.place_id is not null and requested_place_id is not null
     and change_row.place_id <> requested_place_id then
    raise exception 'existing_place_target_mismatch' using errcode = '22023';
  end if;

  effective_place_id := coalesce(requested_place_id, change_row.place_id, application_row.linked_place_id);
  if application_row.linked_place_id is not null
     and effective_place_id is distinct from application_row.linked_place_id then
    raise exception 'application_place_mismatch' using errcode = '22023';
  end if;
  if effective_place_id is not null and not exists (select 1 from public.places where id = effective_place_id) then
    raise exception 'place_not_found' using errcode = 'P0002';
  end if;

  safe_payload := public.sanitize_business_place_payload(change_row.payload);
  if nullif(trim(coalesce(safe_payload->>'slug', '')), '') is null
     or nullif(trim(coalesce(safe_payload->>'name_ko', '')), '') is null
     or nullif(trim(coalesce(safe_payload->>'name_zh', '')), '') is null
     or nullif(trim(coalesce(safe_payload->>'category', '')), '') is null
     or nullif(trim(coalesce(safe_payload->>'address_ko', safe_payload->>'address', '')), '') is null
     or safe_payload->>'latitude' is null
     or safe_payload->>'longitude' is null then
    raise exception 'required_place_information_missing' using errcode = '22023';
  end if;

  if effective_place_id is null then
    insert into public.places (slug, name_zh, name_ko, category, status, is_active, last_verified_at)
    values (
      safe_payload->>'slug', safe_payload->>'name_zh', safe_payload->>'name_ko',
      (safe_payload->>'category')::public.place_category, 'DRAFT', false, null
    ) returning id into effective_place_id;
  end if;

  select to_jsonb(place_row) || safe_payload into merged_payload
  from public.places place_row where place_row.id = effective_place_id for update;
  select string_agg(quote_ident(attribute.attname), ', ' order by attribute.attnum)
  into editable_columns
  from pg_attribute attribute
  where attribute.attrelid = 'public.places'::regclass
    and attribute.attnum > 0 and not attribute.attisdropped
    and attribute.attname not in (
      'id', 'created_at', 'updated_at', 'status', 'is_active', 'is_featured',
      'admin_summary', 'verification_tier', 'verification_checked_at',
      'verification_checked_by', 'verification_note', 'verification_source_urls',
      'verified_visit_at', 'direct_visit_photos', 'last_verified_at'
    );
  execute format(
    'update public.places set (%1$s) = (select %1$s from jsonb_populate_record(null::public.places, $1)) where id = $2',
    editable_columns
  ) using merged_payload, effective_place_id;
  update public.places
  set status = 'PUBLISHED', is_active = true, last_verified_at = now(), updated_at = now()
  where id = effective_place_id;

  delete from public.place_translations where place_id = effective_place_id;
  if jsonb_typeof(safe_payload->'translations') = 'array' then
    for translation_item in select value from jsonb_array_elements(safe_payload->'translations') loop
      if nullif(trim(coalesce(translation_item->>'name', '')), '') is not null then
        insert into public.place_translations (place_id, locale, name, description, travel_tip, address)
        values (
          effective_place_id, (translation_item->>'locale')::public.app_locale,
          translation_item->>'name', coalesce(translation_item->>'description', ''),
          coalesce(translation_item->>'travel_tip', ''), coalesce(translation_item->>'address', '')
        ) on conflict (place_id, locale) do update set
          name = excluded.name, description = excluded.description,
          travel_tip = excluded.travel_tip, address = excluded.address, updated_at = now();
      end if;
    end loop;
  end if;
  if not exists (select 1 from public.place_translations where place_id = effective_place_id) then
    insert into public.place_translations (place_id, locale, name, description, travel_tip, address)
    values
      (effective_place_id, 'ko', safe_payload->>'name_ko', coalesce(safe_payload->>'short_description_ko', ''), coalesce(safe_payload->>'tips_ko', ''), coalesce(safe_payload->>'address_ko', '')),
      (effective_place_id, 'zh', safe_payload->>'name_zh', coalesce(safe_payload->>'short_description_zh', ''), coalesce(safe_payload->>'tips_zh', ''), coalesce(safe_payload->>'address_zh', ''));
  end if;

  delete from public.place_tags where place_id = effective_place_id;
  if jsonb_typeof(safe_payload->'tags') = 'array' then
    for tag_item in select value from jsonb_array_elements(safe_payload->'tags') loop
      if nullif(trim(coalesce(tag_item->>'slug', '')), '') is not null then
        insert into public.tags (slug, label_zh, label_ko)
        values (tag_item->>'slug', coalesce(tag_item->>'label_zh', ''), coalesce(tag_item->>'label_ko', ''))
        on conflict (slug) do update set label_zh = excluded.label_zh, label_ko = excluded.label_ko
        returning id into resolved_tag_id;
        insert into public.place_tags (place_id, tag_id)
        values (effective_place_id, resolved_tag_id) on conflict do nothing;
      end if;
    end loop;
  end if;

  perform public.replace_place_menu_items(
    effective_place_id,
    case when jsonb_typeof(safe_payload->'menu_items') = 'array' then safe_payload->'menu_items' else '[]'::jsonb end
  );

  source_item := safe_payload->'source';
  if jsonb_typeof(source_item) = 'object' and nullif(trim(coalesce(source_item->>'source_url', '')), '') is not null then
    if nullif(source_item->>'external_id', '') is not null then
      insert into public.place_sources (place_id, provider, external_id, source_url)
      values (
        effective_place_id, coalesce(source_item->>'provider', 'MANUAL')::public.place_source_provider,
        source_item->>'external_id', source_item->>'source_url'
      ) on conflict (provider, external_id) where external_id is not null
      do update set place_id = excluded.place_id, source_url = excluded.source_url, updated_at = now();
    else
      insert into public.place_sources (place_id, provider, external_id, source_url)
      values (
        effective_place_id, coalesce(source_item->>'provider', 'MANUAL')::public.place_source_provider,
        null, source_item->>'source_url'
      ) on conflict (place_id, provider, source_url) where external_id is null and source_url is not null
      do update set source_url = excluded.source_url, updated_at = now();
    end if;
  end if;

  china_payload := safe_payload->'china_info';
  if jsonb_typeof(china_payload) = 'object' then
    insert into public.place_china_info (place_id) values (effective_place_id)
    on conflict (place_id) do nothing;
    select to_jsonb(china_row) || china_payload into merged_payload
    from public.place_china_info china_row where china_row.place_id = effective_place_id for update;
    select string_agg(quote_ident(attribute.attname), ', ' order by attribute.attnum)
    into editable_columns
    from pg_attribute attribute
    where attribute.attrelid = 'public.place_china_info'::regclass
      and attribute.attnum > 0 and not attribute.attisdropped
      and attribute.attname not in (
        'id', 'place_id', 'created_at', 'updated_at', 'verification_status',
        'verification_basis', 'traveler_confirmation_count', 'has_information_conflict',
        'verified_at', 'manual_summary_override', 'manual_warning_override'
      );
    execute format(
      'update public.place_china_info set (%1$s) = (select %1$s from jsonb_populate_record(null::public.place_china_info, $1)) where place_id = $2',
      editable_columns
    ) using merged_payload, effective_place_id;
  end if;

  insert into public.business_place_memberships (
    place_id, user_id, membership_role, status, source_application_id, granted_by, granted_at
  ) values (
    effective_place_id, change_row.user_id, 'owner', 'active', change_row.application_id, actor_id, now()
  ) on conflict (place_id, user_id) do update set
    status = 'active', source_application_id = excluded.source_application_id,
    granted_by = actor_id, granted_at = now(), revoked_at = null, updated_at = now();

  update public.business_applications
  set linked_place_id = coalesce(linked_place_id, effective_place_id), updated_at = now()
  where id = change_row.application_id and user_id = change_row.user_id and status = 'approved';

  update public.business_place_changes
  set status = 'approved', published_place_id = effective_place_id,
      reviewed_by = actor_id, reviewed_at = now(), rejection_reason = null,
      approval_token = null, approval_started_at = null
  where id = change_row.id;

  return jsonb_build_object('ok', true, 'code', 'approved', 'change_id', change_row.id, 'place_id', effective_place_id);
end;
$$;

create or replace function public.review_business_place_change(change_id uuid, decision text, reason text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare actor_id uuid := auth.uid(); reviewed public.business_place_changes%rowtype; next_state text;
begin
  if not public.is_admin() then raise exception 'admin_required' using errcode = '42501'; end if;
  if nullif(trim(reason), '') is null then raise exception 'rejection_reason_required' using errcode = '22023'; end if;
  if decision not in ('changes_requested', 'rejected') then raise exception 'invalid_decision' using errcode = '22023'; end if;
  next_state := decision;
  update public.business_place_changes
  set status = next_state, rejection_reason = trim(reason), reviewed_by = actor_id,
      reviewed_at = now(), approval_token = null, approval_started_at = null
  where id = change_id and status = 'pending_review'
  returning * into reviewed;
  if not found then raise exception 'change_not_rejectable' using errcode = '55000'; end if;
  return to_jsonb(reviewed);
end;
$$;

drop function if exists public.claim_business_place_change(uuid, uuid);
drop function if exists public.finalize_business_place_change(uuid, uuid, uuid);
drop function if exists public.reject_business_place_change(uuid, text);
revoke all on function public.approve_business_place_change(uuid, uuid) from public;
revoke all on function public.review_business_place_change(uuid, text, text) from public;
grant execute on function public.approve_business_place_change(uuid, uuid) to authenticated;
grant execute on function public.review_business_place_change(uuid, text, text) to authenticated;

alter table public.business_place_memberships enable row level security;
alter table public.business_place_changes enable row level security;
alter table public.business_place_change_audit enable row level security;

drop policy if exists "Owners read own memberships" on public.business_place_memberships;
create policy "Owners read own memberships" on public.business_place_memberships for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Admins manage memberships" on public.business_place_memberships;
create policy "Admins manage memberships" on public.business_place_memberships for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Owners read own place changes" on public.business_place_changes;
create policy "Owners read own place changes" on public.business_place_changes for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists "Admins manage place changes" on public.business_place_changes;
create policy "Admins manage place changes" on public.business_place_changes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Owners read own place change audit" on public.business_place_change_audit;
create policy "Owners read own place change audit" on public.business_place_change_audit for select to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.business_place_changes change
    where change.id = business_place_change_audit.change_id
      and change.user_id = auth.uid()
  )
);

-- Existing public policies still apply.  This additional read policy lets an
-- owner load an archived/review place only when an active membership exists.
drop policy if exists "Owners read managed places" on public.places;
create policy "Owners read managed places" on public.places for select to authenticated
using (public.has_place_management_access(id));

drop policy if exists "Owners read managed place translations" on public.place_translations;
create policy "Owners read managed place translations" on public.place_translations for select to authenticated
using (public.has_place_management_access(place_id));
drop policy if exists "Owners read managed place sources" on public.place_sources;
create policy "Owners read managed place sources" on public.place_sources for select to authenticated
using (public.has_place_management_access(place_id));
drop policy if exists "Owners read managed place tags" on public.place_tags;
create policy "Owners read managed place tags" on public.place_tags for select to authenticated
using (public.has_place_management_access(place_id));
drop policy if exists "Owners read managed place menus" on public.place_menu_items;
create policy "Owners read managed place menus" on public.place_menu_items for select to authenticated
using (public.has_place_management_access(place_id));
drop policy if exists "Owners read managed place China info" on public.place_china_info;
create policy "Owners read managed place China info" on public.place_china_info for select to authenticated
using (public.has_place_management_access(place_id));

-- Any signed-in account may apply.  business_owner is granted only after an
-- administrator approval, so requiring that role here made the workflow
-- impossible for ordinary users.
drop policy if exists "Business owners and admins create applications" on public.business_applications;
drop policy if exists "Business owners create applications" on public.business_applications;
create policy "Authenticated users create own business applications"
on public.business_applications for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
  and linked_place_id is null
  and reviewed_by is null
  and reviewed_at is null
);

-- Signup metadata expresses an application intent, not an approved role.
create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  provider_name text := new.raw_app_meta_data ->> 'provider';
  accepted_at timestamptz := case when new.raw_user_meta_data ->> 'terms_accepted' = 'true' and new.raw_user_meta_data ->> 'privacy_accepted' = 'true' then now() else null end;
begin
  insert into public.profiles (
    id, email, display_name, avatar_url, role, preferred_locale, auth_provider,
    auth_provider_id, terms_accepted_at, privacy_accepted_at, marketing_opt_in,
    onboarding_completed
  ) values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', new.raw_user_meta_data ->> 'profile_image'),
    'tourist'::public.profile_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'preferred_locale', '')::public.app_locale, 'ko'::public.app_locale),
    provider_name, coalesce(new.raw_user_meta_data ->> 'provider_id', new.raw_user_meta_data ->> 'sub'),
    accepted_at, accepted_at, coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    accepted_at is not null
  ) on conflict (id) do update set email = coalesce(public.profiles.email, excluded.email), updated_at = now();
  return new;
end;
$$;

-- Prevent the old profile update policy from being used to self-promote a
-- tourist to business_owner/admin.  Users retain edits to ordinary profile
-- fields; only an admin-controlled transaction can change role.
create or replace function public.prevent_unprivileged_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role is distinct from new.role and not public.is_admin() and auth.role() is distinct from 'service_role' then
    raise exception 'profile role is administrator managed' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_unprivileged_profile_role_change() from public;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
for each row execute function public.prevent_unprivileged_profile_role_change();

-- Owners upload only into their own top-level folder.  The server still checks
-- application/ownership before issuing the upload request.
drop policy if exists "Business owners upload own place images" on storage.objects;
create policy "Business owners upload own place images" on storage.objects for insert to authenticated
with check (
  bucket_id = 'place-images'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.business_applications application
    where application.user_id = auth.uid() and application.status = 'approved'
  )
);
drop policy if exists "Business owners update own place images" on storage.objects;
create policy "Business owners update own place images" on storage.objects for update to authenticated
using (bucket_id = 'place-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'place-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Business owners delete own place images" on storage.objects;
create policy "Business owners delete own place images" on storage.objects for delete to authenticated
using (bucket_id = 'place-images' and (storage.foldername(name))[1] = auth.uid()::text);

commit;

notify pgrst, 'reload schema';
