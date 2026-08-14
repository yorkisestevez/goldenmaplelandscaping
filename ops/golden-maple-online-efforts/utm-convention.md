# UTM convention — Golden Maple external links

**Scope: EXTERNAL surfaces only** — GBP posts, social posts, email, ads, printed QR codes.

**NEVER put utm_* on internal site links** (blog → estimator, page → page). UTMs on
internal navigation restart the GA4 session and overwrite the visitor's true
acquisition source, corrupting attribution for the whole visit. Internal links use
prefill params only (`?type=`, `?city=`, `?sqft=`) — `page_referrer` +
`landing_page` capture already attribute them.

The estimator captures every utm_* + gclid/fbclid on landing
(`src/utils/utmCapture.ts`) and ships them with each lead to the CRM, so a
correctly-tagged external link is attributable end-to-end.

## Canonical values

| Surface | utm_source | utm_medium | utm_campaign |
|---|---|---|---|
| Google Business Profile post | `gbp` | `organic` | per-push, e.g. `calculator-launch`, `blog-mirror` |
| Facebook / Instagram organic | `facebook` / `instagram` | `social` | per-push, e.g. `calculator-launch` |
| LinkedIn organic | `linkedin` | `social` | per-push |
| Email (CRM sequences, one-offs) | `crm` | `email` | sequence name, e.g. `lead-followup` |
| Printed QR (truck, estimate sheets, yard signs) | `qr` | `offline` | placement, e.g. `truck`, `yard-sign` |
| Google Ads | auto-tagged (gclid) | — | don't hand-set utm on Ads links |

Rules:
- lowercase, kebab-case, no spaces
- `utm_campaign` names a PUSH, not a channel — the channel is already source/medium
- always target a **prefilled** estimator URL when the content has a project type

## Ready-to-use estimator links

```
https://goldenmaplelandscaping.ca/cost-estimator?type=patio&utm_source=gbp&utm_medium=organic&utm_campaign=calculator-launch
https://goldenmaplelandscaping.ca/cost-estimator?type=wall&utm_source=gbp&utm_medium=organic&utm_campaign=calculator-launch
https://goldenmaplelandscaping.ca/cost-estimator?type=deck&utm_source=facebook&utm_medium=social&utm_campaign=calculator-launch
https://goldenmaplelandscaping.ca/cost-estimator?utm_source=qr&utm_medium=offline&utm_campaign=truck
```

Valid `type` values: patio, stone, wall, steps, deck, kitchen, firepit, pergola,
turf, lighting, full. Valid `city`: barrie, innisfil, oro-medonte, springwater,
orillia, wasaga-beach, midland, collingwood, other.

Share card: `/cost-estimator` (and any `?build=` permalink) previews with
`public/images/og/cost-estimator-v1.jpg` — regenerate via
`node scripts/build-estimator-images.mjs` (bump `-v1` → `-v2`; the /images/*
cache header is immutable for a year, never overwrite in place).
