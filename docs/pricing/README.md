# Prices on the site: how they are kept honest

Owner decision, 2026-10-17: **no invented prices, at all cost.** Every price a visitor can read comes from one of two places.

1. **The cost-estimator engine.** `src/data/publishedPriceFacts.json` is generated from the engine by `scripts/gen-price-facts.ts`. It holds patio, walkway and retaining-wall planning figures: mid tier, accessible site, before HST. A fact's figure counts as approved only when it is quoted about its own subject and basis:
   - **Where it is checked:** the figure's own sentence. For a table cell, that means the cell's row, the header row and the caption.
   - **That place names the fact's subject** (patio, wall, walkway…).
   - **It also states the fact's basis:** its unit ("per square foot", "per linear foot"), plus the size or wall height it was computed for ("300 sq ft", "2–4 ft").
   - **No other subject nearby.** Neither that place, the sentence before it in the same paragraph, nor the heading or FAQ question above it may name another priced subject (driveway, deck, porcelain, natural stone, concrete, drainage, steps, repairs, lighting, permit…) or another fact's subject (a wall next to a patio figure).
   - **In range, before HST.** A size or height outside the figure's range ("a 100 sq ft patio", "walls over 6 ft") or "after HST" rejects it.
   - **Examples:**
     - "Most interlocking patios come out around $40–$45 per square foot" is approved.
     - "$40–$45" for a driveway, or a paragraph after an "Interlocking Driveway Costs" heading, is not.
     - "$40,000" for a 300 sq ft patio is not.
   - **Pinning:** `check-patio-prices.ts` and `check-wall-prices.ts` pin every engine figure the posts and money pages quote.
2. **The price ledger** (`price-ledger.json`). Every other figure is listed here per file, with a status:
   - `engine-checked`: an engine figure in a file whose numbers the checks above pin.
   - `approved`: you approved it, with a reason.
   - `unverified`: it was on the site before the ledger existed. These are your review list, in [unverified-prices.md](unverified-prices.md).

A "price" is read the way a visitor reads it:
- `$25,000`, `US$25k`, `$25 thousand`, `60-90k`, `90k+`
- `CAD 25,000`, `25,000 dollars`, `25 000 $`
- spelled-out amounts ("twenty grand", "a thousand dollars", "a couple grand")
- HTML entities and look-alike characters
- a "$" split from its number in JSX
- amounts in the price column of a table, including "about 15,000" and "15,500–30,000 (350–450 sq ft)"

`npm run lint` fails, and so do PR CI and the Netlify build (postbuild runs the ledger too), in four cases:
- a scanned file gains a price that is neither an engine fact in context nor in the ledger;
- the facts file drifts from the engine;
- a ledgered figure disappears without the ledger being pruned;
- a scanned folder holds a file type the scan does not read.

**Scanned:**
- every TS, TSX, CJS, MJS and JSON file in `src/pages`, `src/components`, `src/data`, `src/utils` and `netlify/functions`, including the Instagram captions;
- the copy fields of the add-on and paver tables in `carrPrices.ts`;
- the estimator's planning-range copy, as `getEstimatorRangeCopy` renders it.

**Not scanned:**
- The engine's own price math and data (`estimatorDefaults.ts`, `estimateEngine.ts`, `takeoff.ts`, `engine-baseline.json`) and the price sheet itself.
- The deck designer. Decks are priced only there, by its own engine and gates: `src/features/deckcraft`, `deckInEstimate.ts` and `server/`.
- The downloadable PDF cost guide in `public/downloads/`. Review it by hand.

## The blog publisher
- The writer is handed the engine facts and told they are the only prices it may write, each one in a sentence about its own subject.
- `validateDraft` flags any other price. It checks the draft fields and the page exactly as it will be built (FAQ JSON-LD included), which is what the ledger scans.
- `generateDraft` asks for up to two rewrites, listing each bad figure with its reason, then stops: no PR is opened and the topic stays queued.
- The weekly post is written by the claude.ai cloud routine `gm-blog-publisher`, which follows its own prompt rather than `cli.cjs`.
  - Its `npm run build` runs the ledger check, so a post with an unapproved price fails before the routine opens a PR.
  - For the routine to get the facts-only prompt and the retry too, its prompt has to call `buildPrompt` / `validateDraft` from `generate.cjs`.
- No topic in `topics.json` may carry a price in its title, keyword or slug (`price-guard.test.cjs`).

## Sophie
`src/utils/sophieGuard.ts` runs on every AI reply: in the widget for live replies, and in `netlify/functions/chat.ts` for fallback replies. It replaces a whole sentence (so nothing is left half-said) in two cases.

**Prices.** Any price other than the planning ranges shown in this chat, in any of the forms above. That includes trade shorthand such as "40 to 60 per sqft", "75 psf" and "250 per lineal foot".
- **What may be repeated:** every range shown in the chat (up to 5), rounded to the nearest $1,000 or written with cents.
- **Big numbers:** any number of 1,000 or more counts as a price unless a unit follows it ("1,200 or 1,500 square feet", "3,000 pounds", "30.125 in").
- **Not prices:** years, year spans, phone numbers, street addresses and by-law numbers.
- **Result:** the sentence becomes "I won't guess at a price here…" and the widget offers "Get my planning range".

**Claims.** Either of these:
- anything in `scripts/claim-rules.json`;
- a topic only the team may speak to in writing: insurance, licensing, warranty (including "we stand behind our work"), financing, free offers (including "no fee", "on the house"), permits and permit outcomes, approvals, minimums, ratings, reviews, years in business, job counts.

**Not claims:**
- Material words like "weed-free" and "free of topsoil".
- The deck designer's TimberTech PRO Reserve, Legacy and Terrain boards.
- Hedges like "not a guarantee".

## The deck and site designers' AI
The designers' AI (`server/siteDesignerAi.ts`, and the deck assistant in `server/deckAssistantCloud.ts` and `server/deckAssistantBackend.ts`) uses the same detection through `findPricesAndClaims`. It **rejects** a bad answer instead of redacting it; the visitor sees the designer's retry message.
- **Site designer:** may repeat only figures the engine gave it (concept subtotals and deltas, the baseline, the budget) and a budget the homeowner wrote themselves.
- **Deck assistant:** may state no price at all, in its message, assumptions, questions, choices or the names and notes inside its edits. The editor prices every preview.
- **Both:** reject any claim, except the owner's permit guidance and "free" as design prose ("keep the lawn free for play"), which their prompts are written to give. A permit outcome ("needs no permit", "permit-free"), an approval ("meets the Building Code") and a free *offer* are always rejected.
- **Still blocked, by design:** third-party credentials such as "licensed electrician", "CSA-certified" and "manufacturer warranty".

## Common tasks
| You want to… | Run |
|---|---|
| Approve a figure you've confirmed | `npx tsx scripts/check-price-ledger.ts --approve <file> '<figure>' '<why it is right>'` |
| Tidy the ledger after removing figures | `npx tsx scripts/check-price-ledger.ts --prune` |
| Refresh the review list | `npx tsx scripts/check-price-ledger.ts --report` |
| Refresh the engine facts after a price change | `npx tsx scripts/gen-price-facts.ts` |

Figures are written canonically, e.g. `'$40–$45'`, `'$12k'`, `'$3,500+'` or `'twenty grand'`.
