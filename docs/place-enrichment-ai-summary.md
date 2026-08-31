# Place enrichment and AI administrator summary

## Data flow

```text
map URL
  -> provider detection and redirect resolution
  -> official provider lookup
  -> NormalizedPlace factual fields
  -> empty administrator form fields and source metadata
  -> Korean AI administrator summary
  -> administrator review
  -> places and place_sources
```

## Missing-field causes before this change

| Field | Cause |
| --- | --- |
| Photo | Google `photos` was requested but discarded by normalization. No Photo Media request or separate preview state existed. |
| Price | Google enum/range mapping existed, but absent provider values correctly stayed empty. Naver/Kakao Local APIs do not return price data. |
| Opening hours | Google regular hours were mapped; current hours were not requested or used as a fallback. Naver/Kakao Local APIs do not return hours. |
| Website | Google `websiteUri` was mapped. Naver/Kakao return their own detail page, not the business website, so it must not populate `website`. |
| Rating/review count | Google values were normalized and stored only in source metadata/read-only form fields. Naver/Kakao Local APIs do not return them. |
| Category | Provider category was mapped, but Google `types` were discarded and therefore could not assist canonical category mapping. |

## Photo policy

Google Photo Media results are preview-only. The API key stays server-side, attribution is shown in the administrator UI, and photo names/temporary URLs are excluded from persisted source metadata. Administrator-selected images and existing database thumbnails always win.

## Summary separation

`places.admin_summary` stores the administrator-reviewed Korean AI summary. `place_submissions.recommendation_reason` and `place_submissions.notes` remain immutable source input for the review workflow and are never copied into `admin_summary`.

The summary model receives only whitelisted facts. Validation rejects unsupported marketing claims, claims about unavailable price/hours/rating/review data, non-Korean output, summaries outside 2-4 sentences, and numeric tokens absent from provider facts.
