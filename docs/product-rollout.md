# Product rollout and data operations

## Product identity

Korea Travel Assistant is a travel decision and failure-prevention layer, not a general map app. The first and deepest operating area is Busan. The schema and city switcher also support reviewed places in Seoul and Jeju; each request remains city-scoped and never mixes nearby candidates across cities.

The primary users are first-time international independent travelers, especially Chinese travelers who discover places through Xiaohongshu. The product helps them decide whether to go now, what to order, what may fail, and where to go next.

We do not compete on map accuracy, routing, public transit, traffic, nationwide POI volume, or general star reviews. Naver Map, KakaoMap, and Google Maps remain the routing layer.

## Data flywheel

1. A public, active, reviewed place is shown with a decision card and failure warning.
2. The traveler saves it, opens an external map, or adds it to an itinerary.
3. On return, the detail and saved-place views offer a 10-second field check.
4. Raw facts stay private until moderation. Conflicting facts are not overwritten.
5. Approved, recent evidence feeds the trust summary and deterministic recommendation filters.
6. Better decisions create more saves, visits, and fresh field checks.

Analytics events and operational evidence are deliberately separate. `place_action_events` contains coarse funnel dimensions. `place_checkins`, `place_fact_reports`, and `place_report_evidence` retain the auditable operational record.

## Funnel events

Migration `036_product_rollout_analytics.sql` adds:

`home_view`, `city_selected`, `district_selected`, `filter_applied`, `place_impression`, `place_opened`, `decision_card_viewed`, `warning_viewed`, `place_saved`, `map_opened`, `route_saved`, `itinerary_created`, `itinerary_place_added`, `sns_search_started`, `sns_candidate_confirmed`, `ai_route_created`, `ai_route_saved`, `visit_confirmed`, `fact_report_submitted`, `report_accepted`, and `report_conflicted`.

Do not send free-form search or AI prompts, exact coordinates, addresses, email, phone, tokens, full URLs, or evidence through analytics. Client metadata is allow-shaped, length-limited, and analytics failures never block the user action. UTM attribution stores path only, without the query string.

## Recommendation and trust rules

- Candidate selection is deterministic before any AI call: public and active status, city scope, coordinate validity, arrival-time opening status, temporary closure, budget, travel type, walking burden, and known practical facts.
- Unknown values remain unknown. Missing evidence does not become `false`, a score, or a recommendation.
- AI may order only server-approved candidate IDs. The server rejects unknown IDs and recalculates times and facts.
- Official, owner, administrator, and traveler evidence remain distinguishable. Recency decay varies by fact type.
- A conflicting report becomes a moderation task; it does not immediately overwrite the public place record.

## Feature flags

All flags default to `false`. Public flags are frozen at `next build` time and must be set for the Vercel build environment.

| Phase | Feature | Server flag | Public flag |
| --- | --- | --- | --- |
| 1 | Decision cards, warnings, practical facts, time state, routes, courses, field check, trust | always available when migrations/data exist | none |
| 2 | SNS text/link discovery | `SOCIAL_DISCOVERY_ENABLED` | `NEXT_PUBLIC_SOCIAL_DISCOVERY_ENABLED` |
| 2 | SNS screenshot OCR | `SOCIAL_DISCOVERY_IMAGE_ENABLED` | inherited from server-rendered page |
| 2 | Grounded trip planner | `GROUNDED_TRIP_PLANNER_ENABLED` | `NEXT_PUBLIC_GROUNDED_TRIP_PLANNER_ENABLED` |
| 2 | Itinerary recovery | `ITINERARY_RECOVERY_ENABLED` | `NEXT_PUBLIC_ITINERARY_RECOVERY_ENABLED` |
| 2 | AI candidate ordering | `AI_TRIP_PLANNER_ENABLED` | none |
| 2 | Near-place visit confirmation | none | `NEXT_PUBLIC_VISIT_PROXIMITY_VERIFICATION_ENABLED` |
| 2 | Traveler evidence uploads | storage and policy setup | `NEXT_PUBLIC_TRAVELER_EVIDENCE_UPLOAD_ENABLED` |

Keep a paired server/public feature off if either side is not ready. The API independently rejects disabled SNS and grounded-planner requests.

Phase 3 personalization, real movement graphs, reviewer community tooling, and merchant insights are backlog only. They must not infer nationality from locale or expose individual behavior.

## Data relationships

```text
places
  -> place_decision_profiles / place_practical_info / place_operating_profiles
  -> place_menu_items / place_fact_evidence / place_connections
  -> place_saves / trip_places / guide_places
  -> place_checkins -> place_fact_reports -> place_report_evidence
  -> sns_place_candidates -> sns_place_mappings

profiles -> place_saves / trips / place_checkins / user_trust_profiles
guides -> guide_places -> places
trips -> trip_places -> places
place_action_events -> optional place_id and authenticated user_id
```

## Administrator operations

1. Publish only active places that pass publication quality checks and have valid city/district/coordinates.
2. Enter unknown for unverified tri-state facts; never choose `no` merely because evidence is missing.
3. Record source and verified date for decision, time, menu, and practical facts.
4. Open the traveler-report section in `/[locale]/admin` and review flagged and conflicting reports first. Approval changes trust aggregates; it does not blindly overwrite place fields.
5. Review SNS aliases and candidate confirmations before approving a mapping.
6. Unpublish a place when core identity or location is invalid. Saved and itinerary snapshots remain, but public fetches exclude it.

## Migration order and rollback

Apply every migration from `001` through `037` in filename order. In particular, `030_traveler_decision_data.sql` creates the base traveler-report and SNS relations, `033_traveler_verification_and_trust_signals.sql` adds private moderation and public aggregates, `034_social_discovery_matching.sql` adds the operational matching flow, `035_grounded_trip_planning.sql` adds planner request controls, `036_product_rollout_analytics.sql` adds the funnel enum values, and `037_lightweight_place_verification_signals.sql` adds batched card summaries, explicit recheck facts, and non-destructive report merging.

PostgreSQL enum values are not safely removed during normal rollback. To roll back application behavior, turn off Phase 2 flags and deploy the previous application. The added analytics values and indexes can remain dormant. Do not drop operational or analytics rows during a rollback.

## Deployment checklist

- Apply migrations through `037` before deploying the lightweight verification UI.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS custom domain.
- Set both server and public halves of any enabled Phase 2 feature in Production and rebuild.
- Restrict map/API keys by production domain; keep service-role and OpenAI keys server-only.
- Verify Supabase RLS, admin role, Auth redirect URLs, and Vercel production environment.
- Check `/ko`, `/zh`, `/en`, `/ja`, `/places`, `/nearby`, `/saved`, `/itinerary`, one place detail, `/sitemap.xml`, and `/robots.txt`.
- Test external map return, anonymous report throttling, authenticated merge, report moderation, and disabled-feature `404` behavior.

The detailed automated/manual matrix is in [final-qa-matrix.md](./final-qa-matrix.md).
