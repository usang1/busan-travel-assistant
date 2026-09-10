// Run with GUIDE_PGLITE_MODULE pointing to a separately installed @electric-sql/pglite module.
// This creates an in-memory PostgreSQL test database only. It never contacts Supabase.
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

if (!process.env.GUIDE_PGLITE_MODULE) throw new Error("Set GUIDE_PGLITE_MODULE to the PGlite entry point for this optional database test.");
const { PGlite } = await import(pathToFileURL(process.env.GUIDE_PGLITE_MODULE).href);
const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create table public.profiles (id uuid primary key references auth.users, role text not null);
  create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from profiles where id = auth.uid() and role = 'admin') $$;
  create table public.places (id uuid primary key, is_active boolean not null, status text not null);
  alter table public.places enable row level security;
  create policy public_places on public.places for select using (is_active and status in ('PUBLISHED','ACTIVE'));
  create policy admin_places on public.places for all using (public.is_admin()) with check (public.is_admin());
  grant select on public.places to anon, authenticated;
  insert into auth.users values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), ('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  insert into profiles values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','user'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','user');
  insert into places values ('11111111-1111-4111-8111-111111111111',true,'PUBLISHED'),('22222222-2222-4222-8222-222222222222',true,'PUBLISHED'),('33333333-3333-4333-8333-333333333333',false,'DRAFT');
`);
await db.exec(fs.readFileSync("supabase/migrations/022_official_guides.sql", "utf8"));
await db.exec(fs.readFileSync("supabase/migrations/024_guide_editorial_content.sql", "utf8"));
const admin = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const other = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const p1 = "11111111-1111-4111-8111-111111111111";
const p2 = "22222222-2222-4222-8222-222222222222";
async function actor(role, id = "") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec(`set role ${role}`);
}
const payload = { slug: "test-official", status: "PUBLISHED", guide_type: "ITINERARY", cover_image: "", area: "Busan", estimated_duration: 120, recommended_for: {}, weather_type: "ANY", sort_order: 0, is_featured: true,
  ...Object.fromEntries(["ko","zh","en","ja"].flatMap((l) => [[`title_${l}`,l],[`description_${l}`,`Description ${l}`]])), places: [{ place_id: p1, stay_minutes: 30 }, { place_id: p2, stay_minutes: 60 }] };
async function save(id, value, timestamp = null) {
  return (await db.query("select public.save_official_guide($1,$2::jsonb,$3) as id", [id, JSON.stringify(value), timestamp])).rows[0].id;
}
async function timestamp(id) { return (await db.query("select updated_at::text as t from guides where id=$1", [id])).rows[0].t; }
await actor("authenticated", admin);
const id = await save(null, payload);
const editorial = { ko: { question: "어떻게 여행할까요?", answer: "공개된 두 장소를 순서대로 방문합니다.", faq: [], sources: [], last_checked: "2026-09-09" } };
await save(id, { ...payload, editorial }, await timestamp(id));
await save(id, payload, await timestamp(id));
assert.equal((await db.query("select editorial->'ko'->>'question' as question from guides where id=$1", [id])).rows[0].question, editorial.ko.question, "Older clients must preserve editorial data");
const draftId = await save(null, { ...payload, slug: "private-guide", status: "DRAFT" });
assert.equal((await db.query("select * from guides")).rows.length, 2);
let version = await timestamp(id);
await save(id, { ...payload, places: [...payload.places].reverse() }, version);
assert.equal((await db.query("select place_id from guide_places where guide_id=$1 order by sequence", [id])).rows[0].place_id, p2);
await assert.rejects(save(id, payload, version), /reload/);
version = await timestamp(id);
await assert.rejects(save(id, { ...payload, slug: "must-rollback", places: [payload.places[0],payload.places[0]] }, version));
assert.equal((await db.query("select slug from guides where id=$1", [id])).rows[0].slug, payload.slug);
assert.equal((await db.query("select * from guide_places where guide_id=$1", [id])).rows.length, 2);
await assert.rejects(save(null, { ...payload, slug: "hidden-stop", places: [{ place_id: "33333333-3333-4333-8333-333333333333" }] }));
await actor("anon");
assert.equal((await db.query("select * from guides")).rows.length, 1);
assert.equal((await db.query("select * from guide_places")).rows.length, 2);
await assert.rejects(save(null, { ...payload, slug: "anonymous" }));
await actor("authenticated", user);
await assert.rejects(save(null, { ...payload, slug: "user-created" }), /Administrator/);
await assert.rejects(db.query("insert into guides (slug, guide_type) values ('direct-user','AREA')"));
assert.equal((await db.query("update guides set title_ko='tampered' where id=$1 returning id", [id])).rows.length, 0);
assert.equal((await db.query("delete from guides where id=$1 returning id", [id])).rows.length, 0);
await assert.rejects(db.query("insert into guide_places(guide_id,place_id,sequence) values($1,$2,2)", [id, "33333333-3333-4333-8333-333333333333"]));
assert.equal((await db.query("update guide_places set sequence=9 where guide_id=$1 returning place_id", [id])).rows.length, 0);
assert.equal((await db.query("delete from guide_places where guide_id=$1 returning place_id", [id])).rows.length, 0);
await db.query("insert into guide_saves(user_id,guide_id) values($1,$2)", [user,id]);
assert.equal((await db.query("delete from guide_saves where guide_id=$1 returning guide_id", [id])).rows.length, 1);
await db.query("insert into guide_saves(user_id,guide_id) values($1,$2)", [user,id]);
await assert.rejects(db.query("insert into guide_saves(user_id,guide_id) values($1,$2)", [other,id]));
await assert.rejects(db.query("insert into guide_saves(user_id,guide_id) values($1,$2)", [user,draftId]));
await actor("authenticated", other);
assert.equal((await db.query("select * from guide_saves")).rows.length, 0);
assert.equal((await db.query("delete from guide_saves returning guide_id")).rows.length, 0);
await actor("authenticated", admin);
await save(id, { ...payload, status: "DRAFT" }, await timestamp(id));
await actor("anon");
assert.equal((await db.query("select * from guides")).rows.length, 0);
assert.equal((await db.query("select * from guide_places")).rows.length, 0);
await actor("authenticated", admin);
await save(id, payload, await timestamp(id));
await db.exec("reset role; update places set is_active=false,status='DRAFT' where id='11111111-1111-4111-8111-111111111111'");
await actor("anon");
assert.equal((await db.query("select * from guide_places")).rows.length, 1);
await actor("authenticated", admin);
await db.query("delete from guides where id=$1", [id]);
await db.exec("reset role");
assert.equal((await db.query("select * from guide_saves")).rows.length, 0);
assert.equal((await db.query("select * from guide_places where guide_id=$1", [id])).rows.length, 0);
assert.equal((await db.query("select * from places")).rows.length, 3);
await db.close();
process.stdout.write("PostgreSQL migration, CRUD, RLS, save ownership, ordering, transaction rollback, concurrent editing and unpublishing tests passed.\n");
