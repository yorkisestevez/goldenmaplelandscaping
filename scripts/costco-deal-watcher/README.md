# Ontario Costco $99 cologne watcher

Daily check of public feeds for Costco ~$99 cologne/fragrance posts that mention Ontario warehouses or cities. Emails Gmail **only when locations or deal posts change**.

Sources: Reddit JSON when Reddit allows it, plus Slickdeals RSS, Google News RSS, and DuckDuckGo HTML snippets (Reddit often returns 403 from cloud IPs). Instagram, Facebook, and TikTok pages are not fetched.

## What the email looks like

```
Ontario Costco $99 cologne watcher
Generated: 2026-05-12T14:00:00.000Z
Change: locations

Locations mentioned:
  • Barrie — Barrie warehouse 1258 (warehouse 1258)
  • Mississauga — Mississauga Heartland (place "heartland")

Source posts:
  • $99 cologne still in stock at Barrie
    r/CostcoCanada · Barrie
    https://www.reddit.com/r/CostcoCanada/...
```

Quiet days (same locations, no new corroborating posts) produce **no email**.

## Run locally

```bash
node --test scripts/costco-deal-watcher/*.test.mjs
node scripts/costco-deal-watcher/watch.mjs
```

`--email` sends via Gmail SMTP when there is a change. `--force-email` sends even if nothing changed. `--no-write` skips updating `state.json`.

## GitHub Action + Gmail (one-time, ~2 min)

Workflow: `.github/workflows/costco-cologne-watch.yml` (daily 14:00 UTC / 10:00 ET, plus manual dispatch).

Gmail will not send from Actions until these repo secrets exist. If they are missing the job still fetches and exits 0.

1. Google Account → Security → 2-Step Verification (on) → App passwords
2. Create an app password for **Mail**
3. Repo → Settings → Secrets and variables → Actions → New repository secret:
   - `GMAIL_USER` — the Gmail address that owns the app password
   - `GMAIL_APP_PASSWORD` — 16-character app password
   - `GMAIL_TO` — destination (defaults to `GMAIL_USER` if you omit it)

State between Action runs is kept in `actions/cache` so the next day can diff without committing noise to `main`.
