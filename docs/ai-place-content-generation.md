# AI-assisted place content generation foundation

## Current structure

- Admin entry points: `app/admin/page.tsx`, `components/AdminShell.tsx`, `components/AdminSubmissionWorkflow.tsx`, `components/AdminPlaceManager.tsx`
- Admin auth: API routes call `requireAdmin()` from `lib/admin-auth.ts`, which verifies Supabase Auth and `profiles.role = 'admin'`.
- Place writes: `lib/place-store.ts` owns `createPlace()` and `updatePlace()`. It writes `places`, then syncs tags, menu items, locale translations, source references, and China-specific structured info.
- Map links: `place_sources` stores provider, source URL, and external ID. `lib/map-url.ts` detects NAVER/KAKAO/GOOGLE/MANUAL links. `lib/map-link-analysis.ts` extracts facts available from URLs.
- Multilingual content: legacy `places.name_zh/name_ko`, `short_description_zh/ko`, and `tips_zh/ko` remain for compatibility. `place_translations` stores locale-specific name, description, and travel tip for `zh/en/ja/ko`.

## Data separation

Factual/source data stays in existing place tables:

- `places`: name, category, address, coordinates, station, hours, prices, compatibility fields.
- `place_menu_items`: menu facts and prices.
- `place_sources`: map provider, map URL, external ID.
- `place_china_info`: structured China-focused facts such as payment, waiting, toilet, taste scores.

Generated candidates are represented by `PlaceAiGeneratedContent` in `types/place-ai.ts`:

- `description_ko`, `description_zh`, `description_en`, `description_ja`
- `travel_tip_ko`, `travel_tip_zh`, `travel_tip_en`, `travel_tip_ja`
- `short_summary_ko`, `short_summary_zh`, `short_summary_en`, `short_summary_ja`
- `highlights`
- `traveler_tips`
- `recommended_for`
- `cautions`

The new `place_ai_generation_drafts` migration stores admin-only draft snapshots with:

- `source_data`: structured facts used as input.
- `generated_content`: generated candidate copy.
- `status`: `draft`, `applied`, `discarded`, or `failed`.

Public place fields are updated only after an admin applies draft content to the form and saves the place.

## Admin workflow

1. Admin enters or loads factual place data.
2. Admin keeps map URL/provider/source ID in the source section.
3. Admin clicks `AI 여행정보 생성`.
4. The server route normalizes source facts and calls the OpenAI Responses API.
5. The route returns schema-validated `PlaceAiGeneratedContent`.
6. Admin reviews the generated fields in `AdminAiDraftPanel`.
7. Admin clicks `적용` to copy draft content into the editable form.
8. Admin clicks `저장` to persist final reviewed content through existing place write logic.

## AI connection

Use `app/api/admin/place-ai-generation/route.ts` or the alias `app/api/admin/places/generate-ai/route.ts` as the integration point. The route is already admin-protected and receives `PlaceAiGenerationRequest`.

The OpenAI integration uses Structured Outputs with `description.{ko,zh,en,ja}` and `travel_tip.{ko,zh,en,ja}` objects. Each locale is validated independently, so one missing or wrong-language value does not discard successful locales. Admin notes are editorial context rather than factual authority; superlatives and promotional wording must be neutralized. Keep source facts and generated copy separate, and do not invent facts that are not present in `source_data`.

Localized addresses are stored in `place_translations.address`. Korean provider addresses remain in `places.address_ko`; translated addresses must preserve road/building numbers and are rejected when the Korean source is copied unchanged into another locale.

## Migration

Run the additive migration only when the database is ready for persisted AI draft snapshots:

```bash
supabase/migrations/010_place_ai_generation_drafts.sql
supabase/migrations/014_place_translation_addresses.sql
```

This migration does not modify existing place records and is restricted to admins by RLS.
