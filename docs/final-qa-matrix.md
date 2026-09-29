# Final QA matrix

## Automated coverage

| Area | Covered by |
| --- | --- |
| City scope, invalid coordinates, public status | `test-location-scope-integrity`, `test-city-regions`, `test-grounded-trip-planner` |
| Midnight hours, temporary closure, last order, unknown values | `test-time-aware-menu-guidance`, `test-trip-planning` |
| Locale content and untranslated states | `test-locale-content-consistency`, `test-locale-indexability-states` |
| Guest saves, guest itinerary, authenticated merge contracts | `test-guest-trip-add-flow`, `test-trip-planning` |
| Course snapshots and hidden places | `test-practical-routes-and-courses`, `test-official-guides` |
| Field report validation, rate limits, conflicts, RLS contracts | `test-traveler-verification`, `test-traveler-insights` |
| SNS SSRF/input/privacy/candidate matching | `test-social-discovery` |
| Grounded planner closed-place and unknown-ID rejection | `test-grounded-trip-planner` |
| Funnel privacy, flags, dialog focus, thin SEO pages | `test-product-rollout` |
| Map selection and mobile overlay behavior | `test-map-focus-behavior`, `test-map-discovery-filters` |

## Manual release scenarios

Run each scenario in `ko`, `zh`, `en`, and `ja` when content exists.

- A: choose Busan, Suyeong-gu, solo and low-wait; open detail, save, and open each map provider.
- B: save while signed out, create a local itinerary, add the place, sign in, and verify merge without local deletion on failure.
- C: on Chinese detail verify taste, Korean-only order phrase, Korean-only taxi phrase, and map handoff.
- D: deny location and verify the city default label; allow it and verify current-location mode and pin/card synchronization.
- E: with Phase 2 enabled, search Xiaohongshu text or an approved screenshot, confirm a candidate, save, and open a map.
- F: with planner flags enabled, create a three-hour route, save it, add it to an itinerary, then test a closure recovery proposal without automatic replacement.
- G: submit a partial field check, confirm pending trust state, approve/conflict it in admin, then verify aggregate wording.

## Viewports

Check `360x800`, `390x844`, `430x932`, `768x1024`, and `1366x768` for bottom safe area, 44px targets, map/list switch, horizontal filters, long Chinese text, CTA overlap, modal keyboard viewport, scroll lock, and selected pin/card sync.

## Accessibility

- Heading levels remain ordered per page.
- Every control has a wrapping label, explicit label, or accessible name.
- Dialogs trap Tab/Shift+Tab, close on Escape, and restore trigger focus.
- Status and error messages use live regions where an async action changes state.
- Color is accompanied by text/icon status.
- Map views retain a list/card alternative.

Automated source and build checks do not replace VoiceOver/TalkBack, mobile Safari, real map SDK, Supabase production data, or OAuth-provider testing. Record those results after deployment rather than marking them complete from local code inspection.

## Local production verification (2026-09-29)

- Lighthouse at `/ko`: Performance 98, Accessibility 100, Best Practices 100, SEO 100.
- FCP 0.9s, LCP 2.3s, TBT 50ms, CLS 0 in the final local synthetic run.
- Home was exercised at all five target viewports with no horizontal overflow, sub-40px interactive targets, browser console errors, or page errors.
- Place list, nearby map/list, and itinerary pages were exercised in `ko`, `zh`, `en`, and `ja` without horizontal overflow.
- The local Naver Maps SDK returned 401 because `127.0.0.1:3011` is not registered as an authorized origin. Production-domain rendering remains a deployment check.
- Phase 2 social discovery returned 404 as intended while its feature flag was disabled.
