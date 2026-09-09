# Official travel guides

## Existing architecture

- Next.js 16.3.2 App Router, React, Tailwind, Supabase JS; existing rounded cards and max-w-3xl mobile/desktop layout.
- Locale URLs remain `/zh`, `/ko`, `/en`, `/ja`. `zh` maps to `zh-CN` in metadata. Admin UI remains Korean.
- `AuthProvider` supplies the Supabase session. Admin endpoints reuse `requireAdmin`, validating the bearer token with `auth.getUser()` and checking `profiles.role = 'admin'`.
- Database policies reuse `public.is_admin()`. No service-role client is introduced.
- Places retain their existing IDs, translations, menu relations and public visibility rules. Guide detail uses `getPublicPlacesByIds`, `getPlaceContent`, `getRepresentativeMenu` and the existing `SaveButton`.
- Existing trips, trip sharing, guest synchronization and personal saved places remain separate.

## Migration and model

Apply `supabase/migrations/022_official_guides.sql` after the repository's existing migrations, using the normal Supabase deployment process. Do not rerun historical migrations against production. This migration contains no seed content.

- `guides`: independent editorial content, unique slug, draft/published state, five guide types, four title/description columns, cover URL, area, estimated minutes, localized recommended audience, weather, feature flag, order and timestamps.
- `guide_places`: place references, unique `(guide_id, place_id)` and `(guide_id, sequence)`, zero-based sequence, optional stay minutes, four-locale JSON objects for custom title/description, onward transportation and tips. Maximum 80 stops, matching the existing bounded place reader. No additional sort_order duplicating sequence.
- `guide_saves`: private user-to-guide bookmarks. Deleting a guide cascades its stops and saves but never deletes place originals. Deleting a place removes its guide links, preserving the existing place deletion flow.
- `save_official_guide`: security-invoker RPC, administrator check, row lock and expected updated_at concurrency check. Guide update and stop replacement share one transaction. On failure, both roll back. API fields are explicitly validated and allowlisted; SQL controls identifiers and timestamps.
- Four title/description translations are required to publish, avoiding default-language SEO on other locales. Drafts may be incomplete. Stop translations remain optional and fall back only to the existing localized place content; missing transport text is never invented.
- Only currently public places can be included when publishing via the RPC. Later-hidden place rows are excluded by RLS and the existing public reader. Onward text is suppressed across gaps in the stored sequence.

## Routes and UI

- `/{locale}/guides`: featured, area, food, theme, itinerary and practical categories, text search, area filter.
- `/{locale}/guides/{slug}`: public detail, cover, localized content, duration/audience/weather, ordered place cards, onward notes, menu/category, existing place saves and official guide saves.
- Existing `/{locale}/admin`: dedicated official guide section with CRUD, publication control, multilingual fields, database place search, duplicate prevention and accessible up/down reordering.
- `/{locale}/saved`: separate saved official guides section alongside existing saved places.
- Admin API: `GET/POST /api/admin/guides`, `GET/PUT/DELETE /api/admin/guides/{id}`. PUT requires the last loaded `updated_at` value. Concurrent edits return 409 instead of overwriting.
- Public pages expose no authoring actions. Anonymous visitors can browse; saving a guide requires sign-in and returns to the same guide after login. Place saving retains existing guest behavior.
- Metadata reuses `buildLocalizedMetadata`: canonical, hreflang, OG/Twitter and locale. Details also emit escaped Article/ItemList JSON-LD. Sitemap dynamically adds published guide URLs only. Drafts return 404; service errors remain server errors rather than fake content or cached draft metadata.

## Verification

Run:

```sh
npm run typecheck
npm run lint
npm test
npm run test:guides
npm run build
```

Optional isolated PostgreSQL verification: install `@electric-sql/pglite` in a separate test tools directory, set `GUIDE_PGLITE_MODULE` to its `dist/index.js`, then run `npm run test:guides:db`. It uses an in-memory PostgreSQL instance, fixture auth users and existing-schema prerequisites. It does not connect to or mutate Supabase. Checks cover migration execution, CRUD, anonymous visibility, normal-user API/database denial, owner-only saves, ordering, duplicate rollback, stale updates, hidden stops and cascading deletes. This does not replace a deployment smoke test with real Supabase accounts.

The original working tree already contained guest saves/trip changes. Two existing TypeScript errors were minimally corrected: a nullable Supabase client guard in `SaveButton` and a PromiseLike-compatible timeout helper in `SavedItemsView`.

## Deployment follow-up

- Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the runtime and build environment.
- Apply migration 022; no production database changes are performed by creating these files.
- Use an existing admin profile to create real curated content, fill translations and publish. No sample guide is seeded.
- Smoke-test with an admin, a normal user and an anonymous browser in the target environment, including save/un-save, mobile detail content, and search crawler metadata.
- Consider image uploads and locale-specific area names later. Covers currently accept HTTPS URLs; arbitrary image domains do not require changing the site's existing Next Image allowlist because guide images use standard image elements.

## Verification results — 2026-09-08

| Check | Result |
| --- | --- |
| Original repository `npm run typecheck` | Passed |
| Original repository `npm run lint` | Passed |
| Original repository `npm test` | Passed, all existing test scripts |
| `npm run test:guides` | Passed: validation, language completeness, normalized order, duplicate/invalid input rejection, 401/403 handler guards |
| `npm run test:guides:db` | Passed on isolated PostgreSQL/PGlite: migration, CRUD, RLS, owner saves and unsaves, hidden content, duplicate rollback and stale-write protection |
| Original repository `npm run build` | Passed in WSL Ubuntu, original Next.js/Turbopack command; 95 static pages generated |
| Windows native build attempt | Environment limitation: unavailable native SWC/Turbopack; Windows Webpack also hit readlink EISDIR. Project dependency versions and build command were preserved; WSL build passed |
| HTTP smoke checks | All 5 admin handlers return 401 without credentials; 4 localized guide indexes and existing places/saved/admin pages return 200; sitemap contains localized guide indexes |
| Browser checks | KO/ZH/EN/JA language/title/canonical/OG locale, mobile 375px viewport and desktop 1280px viewport, no horizontal overflow on checked guide-index states; saved official guides section visible; no browser console errors observed |
| Real populated admin/detail UI and real Supabase account test | Pending runtime configuration and migration; no production/mock guides were inserted |
| Existing unrelated work | Eight untouched modified/untracked files match the starting working-copy snapshot. Existing SaveButton/SavedItemsView changes preserved, with only the noted type corrections |
| Diff whitespace | `git diff --check` passed |

Local browser checks cover the configuration-unavailable guide index and existing saved page. They are not evidence that populated route cards or the authenticated editor have been visually verified. PostgreSQL tests run against isolated prerequisite tables and the actual new migration, not the remote Supabase deployment.

## Files added or modified by this task

- `types/guide.ts`
- `lib/guide-validation.ts`
- `lib/guide-store.ts`
- `lib/guide-admin.ts`
- `lib/guide-copy.ts`
- `components/AdminGuideManager.tsx`
- `components/GuideSaveButton.tsx`
- `components/GuideCard.tsx`
- `components/GuideExplorer.tsx`
- `components/SavedGuides.tsx`
- `app/api/admin/guides/route.ts`
- `app/api/admin/guides/[id]/route.ts`
- `app/[locale]/guides/page.tsx`
- `app/[locale]/guides/[slug]/page.tsx`
- `app/[locale]/guides/error.tsx`
- `supabase/migrations/022_official_guides.sql`
- `scripts/test-official-guides.mjs`
- `scripts/test-official-guides-db.mjs`
- `docs/official-guides.md`
- `components/AdminShell.tsx`
- `components/Header.tsx`
- `components/SaveButton.tsx`
- `components/SavedItemsView.tsx`
- `app/[locale]/saved/page.tsx`
- `app/sitemap.ts`
- `package.json`

No commit or push was performed. Suggested commit message:

`feat: add admin-curated travel guides with RLS and multilingual SEO`
