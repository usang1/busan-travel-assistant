# Admin place editor workflow

The place editor is organized as a review workflow instead of a full data-entry form.

## Default view

1. **Map link**: accepts Google Maps, Naver Map, and Kakao Map URLs. The provider is detected automatically.
2. **Administrator input**: place name, category, representative image, price level, administrator notes, and publication status.
3. **Collection and AI preview**: shows which factual fields were collected and previews KO, ZH, EN, and JA content in locale tabs.
4. **Actions**: generates AI content, opens advanced editing, and saves or publishes the place.

Provider analysis fills empty fields. Re-analyzing an existing place does not overwrite populated administrator or database values.

## Advanced editing

The initially closed advanced editor contains provider identifiers and metadata, coordinates, phone, website, opening hours, locale-specific names and addresses, descriptions, travel tips, detailed prices, accessibility flags, China-specific metadata, and menu editing.

Empty phone, website, opening-hours, price, and localized preview values are not rendered as literal `null`, `undefined`, or empty strings in the review preview.

## AI behavior

AI generation uses factual provider data and administrator notes. Valid generated content is applied only to empty locale fields. Existing administrator content remains unchanged. Repeating a full generation request without changing its inputs reuses the previous response, while failed locales can be retried independently.

## Mobile layout

At 375px, 390px, and 430px widths, controls use the mobile-first single-column layout. Primary actions are full width with at least 48px height, locale tabs retain four stable columns, long links stay inside the available width, and advanced fields remain collapsed until requested.
