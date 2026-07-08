# Golden Maple CRM Lead Scoring Doctrine

This matches `src/utils/leadScoring.ts` and the Netlify form fields now posted from `/contact` and `/cost-estimator`.

## Score Targets

| Score | Tier | Action |
|---:|---|---|
| 75-100 | A | Yorkis personal reply / fast call |
| 50-74 | B | Qualify budget + scope before site visit |
| 25-49 | C | Send estimator/resources; defer unless scope improves |
| 0-24 | D | Decline, defer, or route to educational content |

## Positive Signals

- Budget/estimate **$50K+**: +25
- Budget/estimate **$35K+**: +15
- Patio / outdoor living / hardscape / retaining / slope / drainage: +20
- Slope, drainage, difficult access, or multiple levels: +20
- Premium service area: +15
- 500+ sqft: +10
- Photos supplied: +10

## Negative Signals

- Under $25K or estimate under $25K: -30
- Cheap / small repair / lawn / maintenance / garden bed / sod-only language: -25

## Fields Posted

Contact form posts:
- `lead_score`
- `lead_tier`
- `lead_score_reasons`
- `service`
- `budget`
- enriched `details`

Estimator form posts:
- `lead_score`
- `lead_tier`
- `lead_score_reasons`
- `project_type`
- `project_elements`
- `estimate_low`
- `estimate_high`
- `city`
- `sqft`
- `site_conditions`
- `project_details`

## Operating Rule

Yorkis should only spend immediate sales energy on A/B leads unless the calendar needs filler. C/D leads get education and estimator links, not a site visit by default.
