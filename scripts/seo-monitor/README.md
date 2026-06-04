# SEO Weekly Digest

Pulls Search Console data for `goldenmaplelandscaping.ca` and Telegrams a weekly
performance report. Closes the "we publish into a void" blindspot — until this
ran, we measured publish success but nothing about whether posts actually got
traffic.

## What the digest reports

Every Saturday 14:00 UTC, you get a Telegram like:

```
📊 SEO Digest — 2026-06-04 → 2026-06-11

Site totals: 47 clicks · 1,832 impressions · 2.57% CTR

Top /resources/ posts by clicks:
  • 18 clicks · 412 imp · 4.4% · pos 8.3 — /resources/paver-walkway-cost-barrie
  • 12 clicks · 287 imp · 4.2% · pos 11.1 — /resources/why-patios-sink-barrie
  • 8 clicks · 198 imp · 4.0% · pos 9.7 — /resources/landscaping-cost-guide-barrie
  ...

Posts with impressions but 0 clicks (title/description need work):
  • 41 imp · pos 18.2 — /resources/clear-stone-vs-granular-a-base
  • 28 imp · pos 14.9 — /resources/timbertech-vs-wood-decking-ontario
```

The "impressions but 0 clicks" section is the actionable signal — those posts
are ranking but their title + meta description aren't compelling enough to win
the click. They're prime candidates for a refresh.

## One-time setup (~20 min)

This script is **inert until you finish setup.** It checks for the
`GSC_SERVICE_ACCOUNT_JSON` repo secret and exits cleanly if not set.

### 1. Create a Google Cloud project (or use existing)

- https://console.cloud.google.com → new project → name it whatever
- Note the project ID

### 2. Enable Search Console API

- In the project → APIs & Services → Library → search "Search Console API" → Enable

### 3. Create a service account

- IAM & Admin → Service Accounts → Create
- Name: `gm-seo-digest`
- Role: leave blank (it gets per-property access in step 5)
- Done → click into the service account → Keys → Add Key → Create new key → JSON
- Download the JSON file — keep it safe, it's a credential

### 4. Add the service account as a property user in Search Console

- https://search.google.com/search-console
- Select `goldenmaplelandscaping.ca` property
- Settings (gear icon) → Users and permissions → Add user
- Paste the service account email (looks like `gm-seo-digest@<project>.iam.gserviceaccount.com`)
- Permission: **Restricted** (read-only is enough)
- Add

### 5. Add the service account JSON as a repo secret

- Open the downloaded JSON file in a text editor
- Copy the entire contents (it should start with `{` and end with `}`)
- GitHub repo → Settings → Secrets and variables → Actions → New repository secret
- Name: `GSC_SERVICE_ACCOUNT_JSON`
- Secret: paste the entire JSON blob (it's multi-line, that's fine)
- Save

### 6. Test it

GitHub → Actions → "Weekly SEO Digest" → Run workflow → leave inputs blank → Run

Within ~30 seconds you should get a Telegram with the digest. If you get
"No /resources/ traffic yet this period" it just means GSC doesn't have
data yet for those URLs — give it 2-3 days after the post first appears in
the index.

## Files

```
scripts/seo-monitor/
├── README.md           you are here
└── gsc-digest.cjs      the worker (JWT signs, queries GSC, Telegrams digest)

.github/workflows/seo-digest.yml   weekly cron (Sat 14:00 UTC)
```

## How the auth works (no npm deps)

The script does JWT-signed OAuth2 manually:
1. Reads `GSC_SERVICE_ACCOUNT_JSON` from env
2. Signs a JWT with the SA's private key (Node's `crypto` module — no external dep)
3. Exchanges the JWT for an OAuth access token at `oauth2.googleapis.com/token`
4. Uses the access token to query `searchconsole.googleapis.com/webmasters/v3/...`

No googleapis npm package required. Keeps the deploy bundle slim.

## Why service account (not OAuth refresh token)

OAuth refresh tokens for personal Google accounts expire silently after 6 months
of inactivity, and Google rotates them on every refresh — see
`~/.claude/rules/single-use-refresh-tokens.md`. Service accounts have
non-expiring keys (you control rotation explicitly) and are designed exactly for
this use case.

## When this skill is NOT the right tool

- For real-time SEO monitoring → use Search Console UI directly
- For keyword research / opportunity finding → outside scope (consider seo-article-writer skill in OpenClaw)
- For Google Analytics 4 (page views, sessions, conversions) → would need a separate GA4 Data API integration. Not built. Search Console covers the most actionable signal (organic search clicks/impressions/CTR/position) without that extra plumbing.
