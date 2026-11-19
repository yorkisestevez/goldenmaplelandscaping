# Local resale deal scout

This is an agentic **deal scanner for flipping locally** — Kijiji RSS, Craigslist RSS, a Home Depot **SKU watchlist**, and listings **you paste** from Facebook Marketplace.

It does **not** scrape Facebook Marketplace, log into anyone's account, rotate proxies, or auto-list items. Marketplace has no public API; automated scraping violates their terms and is the fastest way to get banned (and to waste time on a brittle bot). The money is in **speed + comps + pickup**, not in fighting their login wall.

## How you actually make money

1. **Buy under retail from locals** (Kijiji / Craigslist / Marketplace you already browse) when the ask is far below what the same item sells for in your city.
2. **Buy Home Depot (or similar) only when the shelf price is stupid** — clearance / open-box / special-buy on SKUs you already know flip. This tool checks **your** watchlist SKUs; it does not crawl the whole store.
3. **Resell locally** (Marketplace/Kijiji cash) to skip eBay fees and shipping. Price using sold comps, not hope.
4. **Skip anything that does not clear gas + your time.** The scorer subtracts pickup cost and an hourly opportunity cost so "cheap" junk does not look like profit.

Default economics (edit in `config.json`): $15 pickup, 1.5 hours at $25/hr, 35% ROI floor, $40 net floor. If a deal is not **A** or **B**, ignore it.

## What gets scanned

| Source | How | Notes |
| --- | --- | --- |
| Kijiji | Official RSS search | Best public local feed in Canada |
| Craigslist | Official `format=rss` search | Same idea, US/CA cities |
| Home Depot | One GET per watchlist SKU, JSON-LD price | Add SKUs you already flip. Polite 2s delay. If the page has no public price, it is skipped. |
| Facebook Marketplace | **You paste JSON** into `inbox/` | Use the official app; paste title, ask, URL, and your resale estimate |
| eBay comps | Optional Browse API | Off until `EBAY_APP_ID` is set. Without comps, resale is a conservative guess unless you fill `typical_resale_cad` |

## Setup

```bash
cd deal-scout
cp config.example.json config.json
# edit city, kijiji location id, search_queries, homedepot_watchlist
python3 -m pip install -e .   # optional; stdlib is enough to run
PYTHONPATH=src python3 -m deal_scout --config config.json --root .
```

Open `out/latest.html` after a scan.

Run this **on your home network**. Craigslist and Kijiji often return HTTP 403 to datacenter IPs; the scout records that in `errors` and still scores pasted `inbox/` listings plus any Home Depot SKUs that loaded.

Kijiji location id: open a Kijiji search in the browser and copy the `l########` number from the URL into `kijiji_location_id`. City subdomain for Craigslist is `location.city` (e.g. `barrie`).

Home Depot Canada host is `www.homedepot.ca`. Use `www.homedepot.com` for the US. Put the SKU from the product URL in `homedepot_watchlist` with **your** typical local resale, not MSRP.

Paste Marketplace finds:

```json
[
  {
    "title": "Milwaukee M18 impact",
    "price": 80,
    "url": "https://www.facebook.com/marketplace/item/…",
    "typical_resale_cad": 160,
    "notes": "Orillia, 10 minutes ago"
  }
]
```

Save as `inbox/today.json` and re-run the scan.

Optional: set `alert_webhook` to a Slack/Discord incoming webhook. Only **A/B** deals are posted.

## Tests

```bash
cd deal-scout
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

## What this will not do

- Scrape Facebook, OfferUp, or any login-walled marketplace
- Bypass bot checks, CAPTCHAs, or rate limits
- Auto-message sellers or auto-create listings
- Promise profit — comps, condition, and whether the item is actually local are on you

Retail arbitrage and local flipping are legal. Stolen goods, serial-number fraud, and misrepresenting condition are not. If a listing looks fenced, walk away.
