# Traveler decision data

Migration: `supabase/migrations/030_traveler_decision_data.sql`

## Relationships

```text
places 1---0..1 place_decision_profiles
places 1---0..1 place_china_info (extended taste and practical facts)
places 1---0..1 place_operating_profiles
places 1---0..* place_menu_items (extended localized decision fields)
places 1---0..* place_fact_evidence
places 1---0..* place_connections *---1 places
guides 1---0..* guide_places *---1 places
places 1---0..* place_checkins
places 1---0..* place_fact_reports 1---0..* place_fact_votes
place_fact_reports 1---0..* place_report_evidence
auth.users 1---0..1 user_trust_profiles
sns_place_mappings 1---0..* sns_place_candidates *---1 places
```

`place_china_info.greasy_level`, `smell_level`, and `ordering_difficulty` remain the canonical storage for the requested oily, aroma, and order-difficulty concepts. Existing `traveler_insights.english_menu` and `traveler_insights.luggage_storage` keys are also reused and merged without overwriting sibling keys. This avoids duplicate facts. `null` scores and `unknown` tristates are deliberately different from zero and `no`.

## Admin workflow

1. Open `/ko/admin` and choose **여행자 데이터**.
2. Select a place. Each disclosure panel saves independently.
3. Add field-level evidence before entering a fit score, recommended audience, or detour value.
4. Use `unknown` unless a source supports `yes` or `no`. Scores stay blank when there is no evidence.
5. Review the translation preview and unknown-field list. Korean source names stay separate from localized copy.
6. In **여행 가이드 / 여행 코스 관리**, set themes, cost, start time, verification state, and stop travel data. Only verified or partially verified courses can be newly published.

The admin API revalidates the bearer token and `profiles.role` on the server. It uses the caller's Supabase JWT, so table RLS remains in force; no service-role secret is exposed.

## Data rules

- `tourist_fit_score` and `confidence_score`: `0..100`, nullable.
- Difficulty, taste, portion, and sellout-risk levels: `1..5`, nullable.
- Practical facts: `yes | no | unknown`; new rows default to `unknown`.
- Times: `Asia/Seoul`, 24-hour `HH:MM`. End must be later than start; last order cannot be later than a configured closing time.
- Menu recommendation `yes` requires a written basis.
- Verified evidence requires a non-unverified source and observation time.
- Raw SNS URLs are not stored. Only a SHA-256 normalized URL hash is retained.
- Anonymous device identifiers are supported in schema only as a 64-character hash. Public insert policies are intentionally absent until an abuse-controlled server endpoint exists.

## RLS summary

Public users can read reviewed decision/operating profiles and active connections only for published places. `unverified` and `rejected` profiles stay administrator-only; stale or conflicting rows retain their explicit warning state. Field evidence, raw traveler reports, trust profiles, report attachments, and SNS mapping candidates are not public. Authenticated users can create and read their own pending reports/check-ins/votes; moderation and trust weights are administrator-controlled.

## Apply and rollback

Apply `030` only after migrations `001` through `029`. The application shows a migration-required error instead of silently dropping advanced data when the new tables are unavailable.

Rollback is intentionally manual because the migration expands live tables. Before rollback, export the new tables and extended columns. Then drop new policies/triggers/tables in reverse dependency order, restore `save_official_guide` from migration `024`, and drop only the columns/enums introduced by `030`. Do not roll back by editing or re-running an older migration. Dropping the extended menu or guide columns destroys entered decision data, so a backup and maintenance window are required.
