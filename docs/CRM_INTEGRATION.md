# CRM Integration — Website ↔ Golden Maple CRM

Two integration paths, both fully built. This doc is the runbook for going live.

1. **Forms** — Netlify Forms outgoing webhook → CRM creates a `lead`
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

```
  Visitor lands on goldenmaplelandscaping.ca
      ↓  (URL has ?utm_source=google-ads&gclid=... — we stash it in sessionStorage)
  Visitor browses, fills out a form (QuickQuote / Contact / Cost Guide)
      ↓  (form posts to Netlify with UTMs, gclid, fbclid, landing_page, referrer attached)
  Netlify Forms receives submission, stores it, fires "outgoing webhook"
      ↓  POST https://<tunnel-hostname>/integrations/netlify/lead
            header: X-Netlify-Webhook-Secret: <secret>
  CRM receiver:
    - Auth-checks the header
    - Coalesces fields, infers source from UTMs
    - INSERT INTO leads (...)
    - emit('lead.created', ...)
      ↓
  Automation engine fires "🤖 New Lead → Start Follow-up Sequence"
      → SMS / email / task creation, whatever you've configured
```

---

## What's already done

### Website side ([this repo](file:///C:/Users/yorki/OneDrive/Desktop/Goldenmaplelandscaping.ca/golden-maple-landscaping/))

✅ Three forms wired to Netlify Forms with stable form names:

| Form name | Page(s) | Funnel tier |
|---|---|---|
| `contact` | `/contact` | high-intent |
| `quick-quote` | Home hero + every `/services/*` page | high-intent |
| `cost-guide` | `/cost-guide` | top-of-funnel |

✅ Hidden static forms in [`index.html`](../index.html) for Netlify build-time detection — schemas include all attribution fields.

✅ Attribution capture in [`src/utils/utmCapture.ts`](../src/utils/utmCapture.ts) — reads `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `gclid`, `fbclid` from URL on first visit, persists to `sessionStorage`, attaches to every form submission.

✅ Field mapping aligned with the CRM receiver's coalesce logic — every field the CRM looks for is now sent:

| Form | Sends |
|---|---|
| `quick-quote` | `name`, `phone`, **`details`** (was `project`, renamed), `source=hero`, all attribution |
| `contact` | `name`, `phone`, `email`, `service`, `budget`, **`details`** (auto-enriched: service + budget concatenated in), all attribution |
| `cost-guide` | `name`, `email`, **`address`** (the self-reported town), `details=Downloaded the 2026 Cost Guide`, `source=cost-guide-page`, all attribution |

✅ GA4 + Meta Pixel + Google Ads conversion fires on each form success via [`src/utils/analytics.ts`](../src/utils/analytics.ts).

### CRM side ([golden-maple-crm](file:///C:/Users/yorki/OneDrive/Desktop/golden-maple-crm/))

✅ Endpoint: `POST /integrations/netlify/lead` ([`server/routes/integrations-netlify.ts`](file:///C:/Users/yorki/OneDrive/Desktop/golden-maple-crm/server/routes/integrations-netlify.ts))

✅ Auth: `X-Netlify-Webhook-Secret` header, secret already in CRM `.env`:
```
NETLIFY_WEBHOOK_SECRET=faa3e61364d96bda901b9c236aa31a54875a5d89bea4f365
```

✅ Field-coalesce logic handles every variant we send (name/full_name/your_name, email/email_address, phone/tel, message/details/notes/comments).

✅ UTM-driven source classification via `inferSource()` — auto-buckets into google / facebook / instagram / referral / website / etc.

✅ Mounted pre-auth in [`server/routes/index.ts`](file:///C:/Users/yorki/OneDrive/Desktop/golden-maple-crm/server/routes/index.ts) line 142, public Netlify can reach it without JWT.

✅ Automation: `lead.created` event auto-fires the **🤖 New Lead → Start Follow-up Sequence** automation seeded in `automation-engine.ts`.

---

## Deployment — what you need to do (~15 min)

### Step 1 — Cloudflare tunnel (already done)

✅ Ingress rule added to `%USERPROFILE%\.cloudflared\config.yml` for `crm.yorkis.net → http://127.0.0.1:3001`
✅ DNS CNAME `crm.yorkis.net` registered against tunnel `openclaw-mcp` (UUID `5b64774d-cf9e-451a-8fde-f3c13c95e25f`)
✅ Config validated — `cloudflared tunnel ingress validate` returned OK
✅ Backup of previous config: `config.yml.bak.20260426-194543`

**One thing left for you to do** — kick `cloudflared` so the new ingress activates. It's running as PID 42180 (not as a Windows service, so it won't auto-pick-up config changes). Easiest:

```powershell
# Kill the running cloudflared (drops MCP + chat for ~5s)
Stop-Process -Id 42180 -Force

# Re-launch however you normally start it (likely from a startup script
# or terminal session). If you don't have a startup script, this will
# also work and runs in the foreground:
cloudflared tunnel run openclaw-mcp

# Or, even better — install as a Windows service so future config changes
# auto-apply without manual restarts:
cloudflared service install
```

Verify it picked up the new rule:
```bash
curl -I https://crm.yorkis.net/
# Expect: 502 Bad Gateway (CRM not running yet) — confirms tunnel routing works
```

### Step 2 — Make sure CRM is running

```bash
cd C:\Users\yorki\OneDrive\Desktop\golden-maple-crm
npm run dev:all
```

Confirm it's reachable through the tunnel:
```bash
curl -I https://crm.yorkis.net/api/v1/health
```
Should return 200.

### Step 3 — Configure Netlify outgoing webhooks

In the Netlify dashboard for `goldenmaplelandscaping.ca`:

1. **Site → Forms → Notifications**
2. Click **Add notification → Outgoing webhook** — repeat the following for each of the 3 forms:

| Field | Value |
|---|---|
| Event to listen for | New form submission |
| Form | (choose `contact`, then again for `quick-quote`, then again for `cost-guide`) |
| URL to notify | `https://crm.yorkis.net/integrations/netlify/lead` |
| Custom HTTP headers | `X-Netlify-Webhook-Secret: faa3e61364d96bda901b9c236aa31a54875a5d89bea4f365` |

Save each. You'll end up with 3 outgoing webhooks total (one per form).

### Step 4 — Set the website's CRM base URL on Netlify

In Netlify dashboard → **Site settings → Environment variables**, add:

```
VITE_CRM_BASE_URL = https://crm.yorkis.net
```

Trigger a redeploy. The booking widget on `/book` will start calling the CRM directly.

### Step 5 — Test end-to-end

1. On the live site, fill out the QuickQuote form on the Home page (or any service page).
2. **Netlify dashboard → Forms** — submission appears within a few seconds.
3. **Netlify dashboard → Forms → quick-quote → Notifications log** — confirm the webhook fired (200 OK).
4. **CRM `leads` table** — new row should be there:
   ```bash
   sqlite3 server/data/crm.db "SELECT id, name, phone, source, utm_source, utm_campaign FROM leads ORDER BY id DESC LIMIT 5;"
   ```
5. **CRM `automation_log` table** — confirm the follow-up automation fired:
   ```bash
   sqlite3 server/data/crm.db "SELECT * FROM automation_log ORDER BY id DESC LIMIT 5;"
   ```

### Step 5 — Test the attribution path (the big one)

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
| Netlify webhook log shows 401 | `X-Netlify-Webhook-Secret` header doesn't match CRM `.env` | Copy the exact secret from CRM `.env` into Netlify webhook header config |
| Netlify webhook log shows 503 | `NETLIFY_WEBHOOK_SECRET` not set in CRM env at runtime | Verify `.env` is loaded on the running CRM process |
| Webhook log shows 200 but no row in `leads` | Required fields missing from submission | Check Netlify submission → Data tab → confirm `name` is present + (`email` OR `phone`) |
| Lead row exists but `source = 'website'` instead of `google` | UTM params didn't reach the form | Open browser DevTools → Application → Session Storage → `gm_attribution` — should have `utm_source`. If empty, attribution capture didn't run (check console for errors) |
| Webhook never fires | Netlify outgoing webhook not configured for that specific form | Re-check Netlify → Forms → Notifications, ensure all 3 forms have an outgoing webhook |

---

## Reference

- **Receiver:** [`golden-maple-crm/server/routes/integrations-netlify.ts`](file:///C:/Users/yorki/OneDrive/Desktop/golden-maple-crm/server/routes/integrations-netlify.ts)
- **Tunnel doc:** [`golden-maple-crm/docs/cloudflare-tunnel.md`](file:///C:/Users/yorki/OneDrive/Desktop/golden-maple-crm/docs/cloudflare-tunnel.md)
- **Automation engine:** [`golden-maple-crm/server/automation-engine.ts`](file:///C:/Users/yorki/OneDrive/Desktop/golden-maple-crm/server/automation-engine.ts)
- **Website attribution capture:** [`src/utils/utmCapture.ts`](../src/utils/utmCapture.ts)
- **Website analytics layer:** [`src/utils/analytics.ts`](../src/utils/analytics.ts)
- **Hidden static forms:** [`index.html`](../index.html)
