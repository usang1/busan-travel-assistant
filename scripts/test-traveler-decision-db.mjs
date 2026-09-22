// Run with TRAVELER_PGLITE_MODULE pointing to a separately installed @electric-sql/pglite entry point.
// This is an isolated in-memory PostgreSQL test and never contacts Supabase.
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

if (!process.env.TRAVELER_PGLITE_MODULE) throw new Error("Set TRAVELER_PGLITE_MODULE to the PGlite entry point.");
const { PGlite } = await import(pathToFileURL(process.env.TRAVELER_PGLITE_MODULE).href);
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create type public.app_locale as enum ('zh','en','ja','ko');
  create type public.place_fact_tristate as enum ('yes','no','unknown');
  create type public.china_waiting_level as enum ('unknown','none','short','moderate','long','extreme','varies');
  create type public.place_verification_status as enum ('unverified','pending','verified','needs_review');
  create type public.china_minimum_order_policy as enum ('unknown','none','two_plus','three_plus','other');
  create table public.profiles (id uuid primary key references auth.users, role text not null);
  create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
  create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
  create table public.places (id uuid primary key default gen_random_uuid(), is_active boolean not null default false, status text not null default 'DRAFT');
  alter table public.places enable row level security;
  create policy public_places on public.places for select to anon,authenticated using (is_active and status in ('PUBLISHED','ACTIVE'));
  create policy admin_places on public.places for all to authenticated using (public.is_admin()) with check (public.is_admin());
  grant select on public.places to anon,authenticated; grant all on public.places to authenticated;
  create table public.place_china_info (
    id uuid primary key default gen_random_uuid(), place_id uuid not null unique references places on delete cascade,
    chinese_taste_score smallint, spicy_level smallint, greasy_level smallint, smell_level smallint, portion_level smallint,
    ordering_difficulty smallint, waiting_level china_waiting_level not null default 'unknown', waiting_minutes_min smallint,
    waiting_minutes_max smallint, chinese_menu place_fact_tristate not null default 'unknown', foreign_card place_fact_tristate not null default 'unknown',
    alipay place_fact_tristate not null default 'unknown', wechat_pay place_fact_tristate not null default 'unknown', solo_friendly place_fact_tristate not null default 'unknown',
    luggage_friendly place_fact_tristate not null default 'unknown', toilet_available place_fact_tristate not null default 'unknown',
    reservation_required place_fact_tristate not null default 'unknown', minimum_order_people smallint, xiaohongshu_popular place_fact_tristate not null default 'unknown',
    subway_walk_minutes smallint, manual_summary_override text, manual_warning_override text, verification_status place_verification_status not null default 'unverified',
    verified_at timestamptz, minimum_order_policy china_minimum_order_policy not null default 'unknown', minimum_order_note text,
    photo_recommended place_fact_tristate not null default 'unknown', tourism_recommended place_fact_tristate not null default 'unknown',
    traveler_insights jsonb not null default '{}', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
  alter table place_china_info enable row level security;
  create policy china_public on place_china_info for select to anon,authenticated using (exists(select 1 from places p where p.id=place_id and p.is_active));
  create policy china_admin on place_china_info for all to authenticated using(public.is_admin()) with check(public.is_admin());
  grant select on place_china_info to anon,authenticated; grant all on place_china_info to authenticated;
  create table public.place_menu_items (id uuid primary key default gen_random_uuid(), place_id uuid not null references places on delete cascade, name_ko text not null, name_zh text not null, description_zh text not null default '', price integer, is_recommended boolean not null default false, sort_order integer not null default 0);
  alter table place_menu_items enable row level security;
  create policy menu_public on place_menu_items for select to anon,authenticated using(exists(select 1 from places p where p.id=place_id and p.is_active));
  create policy menu_admin on place_menu_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
  grant select on place_menu_items to anon,authenticated; grant all on place_menu_items to authenticated;
  insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  insert into profiles values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','user');
`);
await db.exec(fs.readFileSync("supabase/migrations/022_official_guides.sql", "utf8"));
await db.exec(fs.readFileSync("supabase/migrations/024_guide_editorial_content.sql", "utf8"));
await db.exec("insert into places(id,is_active,status) values('99999999-9999-4999-8999-999999999999',true,'PUBLISHED'); insert into place_menu_items(place_id,name_ko,name_zh,is_recommended) values('99999999-9999-4999-8999-999999999999','기존 추천','旧推荐',true);");
await db.exec(fs.readFileSync("supabase/migrations/030_traveler_decision_data.sql", "utf8"));
assert.equal((await db.query("select recommendation_status from place_menu_items where name_ko='기존 추천'")).rows[0].recommendation_status, "unknown", "Legacy recommendations without evidence must not become verified recommendations");

const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const place = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
async function actor(role, id = "") { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec(`set role ${role}`); }

await actor("authenticated", admin);
await db.query("insert into places(id,is_active,status) values($1,true,'PUBLISHED'),($2,true,'PUBLISHED')", [place, target]);
await db.query("insert into place_fact_evidence(place_id,field_key,fact_value,source_type,source_label,observed_at,verified_at,verification_status) values($1,'foreign_card','\"yes\"','official_source','Official','2026-09-20','2026-09-22','verified')", [place]);
await db.query("insert into place_decision_profiles(place_id,tourist_fit_score,confidence_score,evidence_count,last_verified_at,verification_status) values($1,80,90,1,'2026-09-22','verified')", [place]);
await assert.rejects(db.query("insert into place_menu_items(place_id,name_ko,name_zh,recommendation_status) values($1,'메뉴','菜单','yes')", [place]), /recommendation_basis/);
await db.query("insert into place_connections(from_place_id,to_place_id,travel_minutes,travel_mode) values($1,$2,10,'walk')", [place,target]);

await actor("anon");
assert.equal((await db.query("select tourist_fit_score from place_decision_profiles")).rows[0].tourist_fit_score, "80.00");
assert.equal((await db.query("select * from place_connections")).rows.length, 1);
await assert.rejects(db.query("select * from place_fact_evidence"));
await assert.rejects(db.query("insert into place_fact_reports(place_id,fact_type,fact_value,observed_at,device_hash,verification_method) values($1,'wifi','\"yes\"',now(),repeat('a',64),'manual')", [place]));

await actor("authenticated", user);
await assert.rejects(db.query("insert into place_decision_profiles(place_id) values($1)", [target]));
await db.query("insert into place_fact_reports(place_id,fact_type,fact_value,observed_at,user_id,verification_method) values($1,'wifi','\"yes\"',now(),$2,'authenticated')", [place,user]);
await assert.rejects(db.query("insert into place_fact_reports(place_id,fact_type,fact_value,observed_at,user_id,verification_method,trust_weight) values($1,'wifi','\"yes\"',now(),$2,'authenticated',99)", [place,user]));
assert.equal((await db.query("select * from place_fact_reports")).rows.length, 1);

await actor("authenticated", admin);
await db.query("delete from place_fact_evidence where place_id=$1", [place]);
const cleared = (await db.query("select tourist_fit_score,evidence_count,verification_status from place_decision_profiles where place_id=$1", [place])).rows[0];
assert.equal(cleared.tourist_fit_score, null);
assert.equal(cleared.evidence_count, 0);
assert.equal(cleared.verification_status, "unverified");

const guidePayload = {
  slug: "decision-course", status: "PUBLISHED", guide_type: "ITINERARY", cover_image: "", area: "Busan",
  estimated_duration: 180, estimated_cost_min: 10000, estimated_cost_max: 30000, recommended_start_time: "10:00",
  recommended_for: {}, weather_type: "ANY", sort_order: 0, is_featured: false, editorial: {},
  trip_themes: ["first_trip", "food_trip"], verification_status: "verified", last_verified_at: "2026-09-22T03:00:00Z",
  ...Object.fromEntries(["ko","zh","en","ja"].flatMap((locale) => [[`title_${locale}`, locale], [`description_${locale}`, `Description ${locale}`]])),
  places: [{ place_id: place, stay_minutes: 60, travel_minutes: 10, travel_mode: "walk" }, { place_id: target, stay_minutes: 40, travel_minutes: null, travel_mode: null }],
};
const guideId = (await db.query("select public.save_official_guide(null,$1::jsonb,null) as id", [JSON.stringify(guidePayload)])).rows[0].id;
const savedGuide = (await db.query("select trip_themes,estimated_cost_min,recommended_start_time::text,verification_status from guides where id=$1", [guideId])).rows[0];
assert.deepEqual(savedGuide.trip_themes, ["first_trip", "food_trip"]);
assert.equal(savedGuide.estimated_cost_min, 10000);
assert.equal(savedGuide.recommended_start_time, "10:00:00");
assert.equal((await db.query("select travel_minutes,travel_mode from guide_places where guide_id=$1 order by sequence", [guideId])).rows[0].travel_mode, "walk");

await db.close();
process.stdout.write("Traveler decision PostgreSQL constraints, evidence invalidation, RLS and ownership tests passed.\n");
