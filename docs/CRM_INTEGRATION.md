# CRM Integration — Website ↔ Golden Maple CRM

Two integration paths, both fully built. This doc is the runbook for going live.

1. **Forms** — form submission → CRM creates a `lead` (two transports, see below — **do not enable both against the same CRM instance, or every submission hits the CRM twice**)
2. **Bookings** — Browser → CRM directly via `/public/bookings/*` → CRM creates `booking` + `lead`

---

## Architecture — Booking flow (the schedule loop)

```
  Visitor lands on /book (or hits "Book Discovery Call" anywhere on the site)
      ↓  Browser fetches GET https://crm.yorkis.net/public/bookings/availability?from=...&days=14
  CRM returns next 14 days' available slots (reads booking_slots, subtracts existing bookings)
      ↓
  Visitor picks a date + time, fills name/phone/email/notes
      ↓  Browser POSTs to https://crm.yorkis.net/public/bookings (rate-limited, attribution attached)
  CRM:
    - Validates the slot is still open
    - INSERT INTO bookings (...)
    - INSERT INTO leads (..., source='booking' or inferred from utm_source)
    - emit('booking.created', ...)
      ↓
  Automation engine fires the booking.created sequence (whatever you've configured)
      ↓
  Visitor sees confirmation: "You're booked for Tue Apr 28 at 2:00 PM"
```

**Yorkis controls the available slots** from the CRM admin UI (`/bookings/slots`). Add/remove/edit availability templates by day-of-week + time. Default Mon-Fri 9am, 10am, 1pm, 2pm, 3pm seeded on first run.

---

## Architecture — Forms flow (the lead loop)

**Primary transport — the Netlify Function bridge.** This is the live path today: it fires automatically on every Netlify Forms submission, with no per-form dashboard config.

```
  Visitor lands on goldenmaplelandscaping.ca
      ↓  (URL has ?utm_source=google-ads&gclid=... — we stash it in sessionStorage)
  Visitor browses, fills out a form (Contact / HeroContactForm / QuickQuote / CostEstimator / CostGuide / BuyersGuide)
      ↓  (form posts to Netlify with UTMs, gclid, fbclid, landing_page, referrer, event_id attached)
  Netlify Forms receives the submission, stores it, fires the "submission-created" event
      ↓  netlify/functions/submission-created.ts runs automatically (no dashboard config)
            - flattens payload.data (every declared field, including event_id)
            - HMAC-SHA256-signs the JSON body with GM_CRM_BRIDGE_SECRET
            - POST <GM_CRM_BRIDGE_URL>  header: X-Bridge-Signature: <hex hmac>
  CRM receiver:
    - Verifies the signature
    - Coalesces fields, infers source from UTMs
    - INSERT INTO leads (...)
    - emit('lead.created', ...)
      ↓
  Automation engine fires "🤖 New Lead → Start Follow-up Sequence"
      → SMS / email / task creation, whatever you've configured
```

**Legacy transport — Netlify dashboard outgoing webhook.** The CRM receiver at `POST /integrations/netlify/lead` still supports this and the troubleshooting rows below are accurate if you use it, but it requires manual per-form configuration in the Netlify dashboard (Step 3 below) and is **not currently configured**. Decide which transport you want live — running both against the same CRM double-inserts every lead.

---

## What's already done

### Website side ([this repo](../))

✅ Six forms wired to Netlify Forms with stable form names:

| Form name | Page(s) | Funnel tier | Sends |
|---|---|---|---|
| `contact` | `/contact` (`Contact.tsx`) **and** the Home hero (`HeroContactForm.tsx` — both post `form-name: contact`) | high-intent | `name`, `phone`, `email`, `service`, `budget`, `details` (auto-enriched: service + budget concatenated in), `lead_score`/`lead_tier`/`lead_score_reasons` (from `scoreGoldenMapleLead()`, both forms use the same budget-bucket enum so scoring is consistent), `event_id`, all attribution |
| `quick-quote` | Every `/services/:slug` and `/locations/:slug` page (**not** the Home hero — that posts to `contact`, see above) | high-intent | `name`, `phone`, `details`, `source=hero`, `event_id`, all attribution |
| `cost-estimator` | `/cost-estimator` | high-intent | `name`, `email`, `phone`, `source`, `event_id`, `project_type`, `project_elements`, `project_details`, `lead_score`/`lead_tier`/`lead_score_reasons`, `estimate_low`/`estimate_high` (raw engine basis) + `displayed_low`/`displayed_high` (confidence-widened, what the visitor actually saw), `target_budget`, `build_permalink`, `scope_sizes`, `brand_chosen`, `city`, `sqft`, `add_ons`, `has_photos`, `site_conditions`, all attribution |
| `cost-guide` | `/cost-guide` | top-of-funnel | `name`, `email`, `address` (the self-reported town — appended as `(location: <town>)` when filled), `details=Downloaded the 2026 Simcoe County Cost Guide`, `source=cost-guide-page`, `event_id`, all attribution |
| `guide-download` | `/contact` (`BuyersGuide.tsx`, Tier 1 free-PDF form) | top-of-funnel | `name`, `email`, `source=buyers_guide_download`, `event_id`, all attribution |
| `estimate-request` | `/contact` (`BuyersGuide.tsx`, Tier 2 form) | high-intent | `name`, `phone`, `email`, `service`, `budget`, `details`, `source=estimate_request`, `event_id`, all attribution |

✅ Hidden static forms in [`public/__forms.html`](../public/__forms.html) for Netlify build-time schema detection. **Read that file's own header comment before touching any form** — it documents a real regression class (self-registering via `data-netlify` on the runtime JSX silently drops every attribution field, because the prerendered HTML's static markup lacks the JS-populated inputs) that has bitten this repo twice.

✅ Attribution capture in [`src/utils/utmCapture.ts`](../src/utils/utmCapture.ts) — reads `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid` from URL on first visit, persists to `sessionStorage`, attaches to every form submission.

✅ Field mapping aligned with the CRM receiver's coalesce logic for the legacy webhook path — every field the CRM looks for is sent (see the per-form table above for what each form actually submits).

✅ GA4 + Meta Pixel + Google Ads conversion fires on each form success via [`src/utils/analytics.ts`](../src/utils/analytics.ts) — `trackLead(formName, ...)` reports the same string the form submits under (`form_name` in GA4, `content_name` in Meta), so analytics and CRM `form_name` stay comparable.

✅ Primary-path bridge: [`netlify/functions/submission-created.ts`](../netlify/functions/submission-created.ts) — fires automatically on every submission, HMAC-signs with `GM_CRM_BRIDGE_SECRET`, no dashboard config needed.

### CRM side (golden-maple-crm — separate repo, `C:\Users\yorki\Desktop\golden-maple-crm\`)

✅ Legacy webhook endpoint: `POST /integrations/netlify/lead` (`server/routes/integrations-netlify.ts`)

✅ Legacy webhook auth: `X-Netlify-Webhook-Secret` header. The secret lives in the CRM's own `.env` — **do not paste it into this doc**; copy it directly between the CRM `.env` and the Netlify dashboard webhook config when you configure Step 3.

✅ Primary-path bridge endpoint: wherever `GM_CRM_BRIDGE_URL` points, auth'd via `X-Bridge-Signature` (HMAC-SHA256 of the raw JSON body, keyed by `GM_CRM_BRIDGE_SECRET` — **this must be the same value on both sides**, i.e. the website's Netlify env var and the CRM's own secret for verifying the signature).

✅ Field-coalesce logic handles every variant either transport sends (`name`/`fullname`/`your_name`, `email`/`your_email`, `phone`/`phone_number`/`your_phone`, `details`/`project_details`/`tell_us_more`).

✅ UTM-driven source classification via `inferSource()` — auto-buckets into google / facebook / instagram / referral / website / etc.

✅ Legacy webhook mounted pre-auth in `server/routes/index.ts`, public Netlify can reach it without JWT.

✅ Automation: `lead.created` event auto-fires the **🤖 New Lead → Start Follow-up Sequence** automation seeded in `automation-engine.ts`.

---

## Deployment — what you need to do

### Step 1 — Cloudflare tunnel

Only relevant if you're running the CRM behind `crm.yorkis.net` via Cloudflare Tunnel. If that's already live and healthy, skip to Step 2. If you're setting it up fresh, see `golden-maple-crm/docs/cloudflare-tunnel.md` in the CRM repo for the current tunnel config — this doc doesn't duplicate tunnel/DNS setup instructions since they live with the CRM, not the website.

### Step 2 — Make sure CRM is running

```bash
cd C:\Users\yorki\Desktop\golden-maple-crm
npm run dev:all
```

Confirm it's reachable through the tunnel:
```bash
curl -I https://crm.yorkis.net/api/v1/health
```
Should return 200.

### Step 3 — Configure Netlify outgoing webhooks (legacy transport only — skip if using the bridge)

**Only needed if you're intentionally running the legacy webhook path instead of (or alongside — see the double-insert warning above) the `submission-created.ts` bridge.** The bridge needs no per-form dashboard config at all; it fires on every submission automatically.

In the Netlify dashboard for `goldenmaplelandscaping.ca`:

1. **Site → Forms → Notifications**
2. Click **Add notification → Outgoing webhook** — repeat for each form you want mirrored this way.

| Field | Value |
|---|---|
| Event to listen for | New form submission |
| Form | (choose one of `contact`, `quick-quote`, `cost-estimator`, `cost-guide`, `guide-download`, `estimate-request`, repeat per form) |
| URL to notify | `https://crm.yorkis.net/integrations/netlify/lead` |
| Custom HTTP headers | `X-Netlify-Webhook-Secret: <value from CRM .env>` |

### Step 4 — Set environment variables on Netlify

In Netlify dashboard → **Site settings → Environment variables**, add:

```
VITE_CRM_BASE_URL = https://crm.yorkis.net
GM_CRM_BRIDGE_URL = <the CRM's bridge-receiving endpoint>
GM_CRM_BRIDGE_SECRET = <must equal the CRM's own value for verifying X-Bridge-Signature>
```

`VITE_CRM_BASE_URL` powers the booking widget (calls the CRM directly from the browser). `GM_CRM_BRIDGE_URL`/`GM_CRM_BRIDGE_SECRET` power `submission-created.ts` — without both set, that function returns `500 "bridge not configured"` on every submission (see Troubleshooting).

Trigger a redeploy after adding these.

### Step 5 — Test end-to-end

1. On the live site, fill out the QuickQuote form on any `/services/*` or `/locations/*` page (or Contact/HeroContactForm — both post to `contact`).
2. **Netlify dashboard → Forms** — submission appears within a few seconds.
3. If using the bridge: **Netlify dashboard → Functions → submission-created → logs** — confirm it ran without a `500`/`502`. If using the legacy webhook: **Netlify dashboard → Forms → (form name) → Notifications log** — confirm the webhook fired (200 OK).
4. **CRM `leads` table** — new row should be there:
   ```bash
   sqlite3 server/data/crm.db "SELECT id, name, phone, source, utm_source, utm_campaign FROM leads ORDER BY id DESC LIMIT 5;"
   ```
5. **CRM `automation_log` table** — confirm the follow-up automation fired:
   ```bash
   sqlite3 server/data/crm.db "SELECT * FROM automation_log ORDER BY id DESC LIMIT 5;"
   ```

### Step 6 — Test the attribution path (the big one)

Visit the site with a fake UTM:
```
https://goldenmaplelandscaping.ca/?utm_source=google&utm_medium=cpc&utm_campaign=spring-2026&gclid=test123
```

Click around, then submit the QuickQuote form. The CRM lead should now have:
- `source = 'google'`  (auto-inferred from utm_source)
- `utm_source = 'google'`
- `utm_medium = 'cpc'`
- `utm_campaign = 'spring-2026'`
- `gclid = 'test123'`
- `landing_page = '/'`

If those columns are populated, the loop is closed end-to-end.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `submission-created.ts` returns 500 "bridge not configured" | `GM_CRM_BRIDGE_URL` or `GM_CRM_BRIDGE_SECRET` not set in Netlify env | Set both per Step 4, redeploy |
| `submission-created.ts` returns 502 "bridge error" / "bridge unreachable" | CRM isn't running, or its bridge endpoint rejected the signature | Confirm CRM is up (Step 2); confirm `GM_CRM_BRIDGE_SECRET` matches on both sides |
| Legacy webhook log shows 401 | `X-Netlify-Webhook-Secret` header doesn't match CRM `.env` | Copy the exact secret from CRM `.env` into Netlify webhook header config |
| Legacy webhook log shows 503 | `NETLIFY_WEBHOOK_SECRET` not set in CRM env at runtime | Verify `.env` is loaded on the running CRM process |
| Submission succeeds but no row in `leads` | Required fields missing, or the field wasn't declared in `public/__forms.html` (Netlify silently drops undeclared fields) | Check Netlify submission → Data tab → confirm `name` is present + (`email` OR `phone`); cross-check the field is declared in `public/__forms.html` |
| Lead row exists but `source = 'website'` instead of `google` | UTM params didn't reach the form | Open browser DevTools → Application → Session Storage → `gm_attribution` — should have `utm_source`. If empty, attribution capture didn't run (check console for errors) |
| Both a lead AND a duplicate lead land in the CRM per submission | Both the bridge and a legacy dashboard webhook are configured for the same form against the same CRM | Pick one transport; disable the other |

---

## Reference

- **Legacy webhook receiver:** `golden-maple-crm/server/routes/integrations-netlify.ts` (separate repo, `C:\Users\yorki\Desktop\golden-maple-crm\`)
- **Bridge function (primary path):** [`netlify/functions/submission-created.ts`](../netlify/functions/submission-created.ts)
- **Tunnel doc:** `golden-maple-crm/docs/cloudflare-tunnel.md` (separate repo)
- **Automation engine:** `golden-maple-crm/server/automation-engine.ts` (separate repo)
- **Website attribution capture:** [`src/utils/utmCapture.ts`](../src/utils/utmCapture.ts)
- **Website analytics layer:** [`src/utils/analytics.ts`](../src/utils/analytics.ts)
- **Hidden static forms (schema source of truth):** [`public/__forms.html`](../public/__forms.html)
