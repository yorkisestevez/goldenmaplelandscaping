# Live public phone listing audit — Golden Maple Landscaping

**Observed:** 2026-09-05 14:07 EDT  
**Requested public contact:** Sophie voice agent, **(705) 300-8015** (`+17053008015`)  
**Allowed replacement targets:** `(705) 500-3581` / `(705) 790-3838` only.  
**Scope:** public listing contact fields only. No recovery/security phone changes, authentication, telephony calls, website deployment, reviews, paid edits, or unrelated business details.

## Ownership identification

The Google profile below is the intended Golden Maple Landscaping listing, not a same-name match: it names **Golden Maple Landscaping**, links to `https://goldenmaplelandscaping.ca`, and is the profile identified by the repository's owner-provided Google review Place ID `ChIJF79Eei2jKogRfcgR8pCR2qc`.

## Results

| Surface | Exact URL | Before observed | Requested after | Status | Verification / blocker |
|---|---|---|---|---|---|
| Google Business Profile / Maps | https://www.google.com/maps/place/?q=place_id:ChIJF79Eei2jKogRfcgR8pCR2qc | `(705) 500-3581` publicly displayed before the owner save. | `(705) 300-8015` | **Verified live** | Owner completed the save in the authenticated Google Business Profile UI. A separate refreshed public Google Maps read immediately afterward showed `(705) 300-8015` and a `Call now` link to the same Sophie number. |
| HomeStars | https://www.homestars.com/companies/2982995-golden-maple-landscaping | Not observable. | `(705) 300-8015` | **Blocked — no change made** | Cloudflare security verification blocked public access before listing content or owner controls could be inspected. No challenge was attempted. |
| Yelp | https://www.yelp.com/biz/golden-maple-landscaping-barrie-4 | Not observable. | `(705) 300-8015` | **Blocked — no change made** | DataDome CAPTCHA blocked public access before listing content or owner controls could be inspected. No challenge was attempted. |
| YellowPages | https://www.yellowpages.ca/bus/Ontario/Barrie/Golden-Maple-Landscaping/102788299.html | Not observable. | `(705) 300-8015` | **Blocked — no change made** | The listing URL returned CloudFront `403 ERROR` before listing content or owner controls could be inspected. |

## Public-site observation (out of deployment scope)

`https://goldenmaplelandscaping.ca/` was publicly reachable and still displayed `(705) 500-3581` during this audit. This was **not changed or deployed**, per the no-website-deployment scope. Existing repository audit data also records the legacy SEO subdomain as showing `(705) 790-3838`; it was not changed.

## Verification state

- **Verified live after a save:** Google Business Profile / Maps — public listing and Call now link show Sophie’s number.
- **Pending review:** none observed in the public Maps read.
- **Blocked:** HomeStars (Cloudflare); Yelp (DataDome CAPTCHA); YellowPages (CloudFront 403).

## Safe continuation requirement

Resume only in an already-authenticated Google owner session that exposes the Golden Maple Landscaping management controls. Change only the public primary phone field to `(705) 300-8015`, save, then refresh the public Maps listing and record whether Google marks the edit pending or shows it live. Do not authenticate on this task's behalf, provide credentials, change recovery/security data, or modify the address, hours, posts, reviews, categories, or any other field.
