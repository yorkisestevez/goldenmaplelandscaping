# Prices on the site: how they are kept honest

Owner decision, 2026-10-17: **no invented prices, at all cost.** Every price a visitor can read comes from one of two places.

1. **The cost-estimator engine.** `src/data/publishedPriceFacts.json` is generated from the engine by `scripts/gen-price-facts.ts`. It holds patio, walkway and retaining-wall planning figures: mid tier, accessible site, before HST.
   - A fact's figure counts as approved only when its subject (patio, wall, walkway…) is named in the same sentence or the one either side.
   - The figure's own sentence must name no other priced subject: driveway, deck, porcelain, natural stone, pergola, kitchen, lighting, permit and so on.
   - So "$40–$45" next to "interlocking patio" is approved, but "$40–$45 for an interlocking driveway" is not.
   - `check-patio-prices.ts` and `check-wall-prices.ts` pin every engine figure the posts and money pages quote.
2. **The price ledger** (`price-ledger.json`). Every other figure is listed here per file, with a status:
   - `engine-checked`: computed by the engine and pinned by the checks above.
   - `approved`: you approved it, with a reason.
   - `unverified`: it was on the site before the ledger existed. These are your review list, in [unverified-prices.md](unverified-prices.md).

A "price" is read the way a visitor reads it:
- `$25,000`, `US$25k`, `$25 thousand`
- `CAD 25,000`, `25,000 dollars`, `25 000 $`
- spelled-out amounts ("twenty grand")
- HTML entities and look-alike characters
- a "$" split from its number in JSX
- bare numbers in the price column of a table

`npm run lint` fails, and so do PR CI and the Netlify build (postbuild runs the ledger too), when any scanned file gains a price that is neither an engine fact in context nor in the ledger. It also fails when the facts file drifts from the engine, or when a ledgered figure disappears without the ledger being pruned.

**Scanned:** `src/pages`, `src/components`, `src/data`, `src/utils` and `netlify/functions`.

**Not scanned:**
- The engine's own price tables and math (`carrPrices.ts`, `estimatorDefaults.ts`, `estimateEngine.ts`, `takeoff.ts`).
- The deck designer. Decks are priced only there, by its own engine and gates: `src/features/deckcraft`, `deckInEstimate.ts` and `server/`.
- The downloadable PDF cost guide in `public/downloads/`. Review it by hand.

## The blog publisher
- The writer is handed the engine facts and told they are the only prices it may write, each one in a sentence about its own subject.
- `validateDraft` flags any other price. `generateDraft` asks for up to two rewrites with the bad figures listed, then stops: no PR is opened and the topic stays queued.
- The weekly post is written by the claude.ai cloud routine `gm-blog-publisher`, which follows its own prompt rather than `cli.cjs`. Its `npm run build` now runs the ledger check, so a post with an unapproved price fails before the routine opens a PR. For the routine to get the facts-only prompt and the retry too, its prompt has to call `buildPrompt` / `validateDraft` from `generate.cjs`.
- No topic in `topics.json` may carry a price in its title, keyword or slug (`price-guard.test.cjs`).

## Sophie
`src/utils/sophieGuard.ts` runs on every AI reply: in the widget for live replies, and in `netlify/functions/chat.ts` for fallback replies. It replaces a whole sentence (so nothing is left half-said) in two cases.

**Prices.** Any price other than the planning range she was given, in any of the forms above, plus "40 to 45 per square foot", "25K" and "25 thousand". Any number of 1,000 or more counts as a price unless a unit follows it ("1,200 or 1,500 square feet", "3,000 pounds"); years and phone numbers don't count. The sentence becomes "I won't guess at a price here…" and the widget offers "Get my planning range".

**Claims.** Either of these:
- anything in `scripts/claim-rules.json`;
- a topic only the team may speak to in writing: insurance, licensing, warranty, financing, "free", permits, minimums, ratings, reviews, years in business, job counts.

## Common tasks
| You want to… | Run |
|---|---|
| Approve a figure you've confirmed | `npx tsx scripts/check-price-ledger.ts --approve <file> '<figure>' '<why it is right>'` |
| Tidy the ledger after removing figures | `npx tsx scripts/check-price-ledger.ts --prune` |
| Refresh the review list | `npx tsx scripts/check-price-ledger.ts --report` |
| Refresh the engine facts after a price change | `npx tsx scripts/gen-price-facts.ts` |

Figures are written canonically, e.g. `'$40–$45'`, `'$12k'`, `'$3,500+'` or `'twenty grand'`.
