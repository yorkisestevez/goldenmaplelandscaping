# Jev design-rule check

An internal check that reads a DeckCraft design and reports, rule by rule, whether it follows the Golden Maple design rules. It is off until two environment variables are set, has no public UI, and never opens a proposal, a share link, the send form or the DeckCraft AI assistant.

## What Jev is

Jev (`jev-1.13.0`) is TypeSafe AI's "System One" decision model. It does not write text and cannot read a repo. You send it a `state` (text or JSON) and typed questions, and it answers each one with a number:

- **noul**: the probability that a yes/no statement is true.
- **choice**: one option from a set, with a probability for each.
- **score**: a rating along ordered levels.

This check uses nouls only.

## How the check works

1. **Measure in code.** `server/jevDesignSummary.ts` turns the design JSON into a short summary. Jev is weak at arithmetic, counting and coordinates, so every measurement is taken here and written in words: which surface each light stands on, where each stair lands, whether each seat faces its focal point, which seating areas are joined by paving.
   - Deck, railing, stair and automatic light positions come from the deck engine, on a design the app's own validator accepted.
   - Landscape objects and pinned light positions are read tolerantly, so a design saved by a newer build still checks.
2. **Ask Jev.** `server/jevDesignCheck.ts` sends the summary once, with one yes/no question per rule.
3. **Report.** Each rule comes back with pass or fail, a confidence, and the evidence from the summary.

| Rule | What the summary gives Jev | Measured in code too |
|---|---|---|
| No standing or bollard lights on paving | Each light group: fixture, type, surface | Yes |
| No railing on the house side of the deck | Railing on each deck edge | Yes |
| Stairs land on paving | The surface just past each bottom riser | Yes |
| All sitting areas are connected | Each seating area and its paved route | Yes |
| Every seat faces its focal point | Each seat, its focal point, within 30° or not | Yes |
| Lawn edges are deliberate | Lawn panels, what frames them, leftover strips | No (a judgment) |
| Plants are Ontario natives | One question per species | No (Jev's knowledge) |
| Every structure makes sense | Each wall, paved area, pool, fire feature, pergola and what it joins | Yes |

Two things differ from the original brief, following TypeSafe's guidance of one judgment per question:

- Lawn and planting are two rules, so the report has eight rules.
- Planting asks Jev about each species separately, and the code counts the share of native plants. The rule passes at 60% native by plant count (`CHECK_POLICY.nativeShareMin`). That number is an owner decision.

For the first five rules and the last, the code has already measured the answer and Jev is reading it back. The report shows both (`measured` beside Jev's answer) and flags any disagreement. Jev adds real judgment on the lawn and the plants.

## Setup

Set these in Netlify (Site configuration, Environment variables), scoped to Functions. Do not put them in a `VITE_` variable or in the repo.

| Variable | Needed | What it does |
|---|---|---|
| `JEV_API_KEY` | Yes | TypeSafe API key. Sent only in the `Authorization` header to `api.typesafe.ai`. Never logged. |
| `JEV_ROUTE_TOKEN` | Yes | The internal token callers must send. At least 24 characters; a shorter one counts as unset. |
| `JEV_DAILY_CHECKS` | No | Jev calls allowed per day across all callers. Default 300. `0` stops every check (429). |
| `JEV_CHECKS_PER_MINUTE` | No | Requests per minute from one address. Default 20. Wrong tokens count. |
| `JEV_STORE_FILE` | No | Local use only: keep the rate-limit counters in a JSON file instead of Netlify Blobs. |

Until both `JEV_API_KEY` and `JEV_ROUTE_TOKEN` are set, the route answers `503 not_configured` and touches nothing.

Make a token with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

## Calling the route

`POST /.netlify/functions/jev-design-check` with the design JSON as the body (the saved design file, or its bare `configuration`).

```bash
curl -X POST https://goldenmaplelandscaping.ca/.netlify/functions/jev-design-check -H "Authorization: Bearer $JEV_ROUTE_TOKEN" -H "Content-Type: application/json" --data-binary @design.json
```

The token can also go in an `x-jev-route-token` header. The body limit is 1 MB.

The answer:

```json
{
  "ok": true,
  "pass": false,
  "needsReview": false,
  "failed": ["standing_lights_off_paving"],
  "rules": [
    {
      "id": "standing_lights_off_paving",
      "label": "No standing or bollard lights on paving",
      "applies": true,
      "pass": false,
      "confidence": 0.94,
      "probability": 0.03,
      "unsure": false,
      "measured": "fail",
      "evidence": ["1 × LIV Bollard on Dining terrace"]
    }
  ],
  "warnings": [],
  "model": "jev-1.13.0",
  "usage": {"inputTokens": 0, "outputTokens": 0},
  "costUsd": 0,
  "summary": "Deck:\n  30 ft wide and 16 ft deep ..."
}
```

- `probability` is Jev's probability that the rule is **met**. A rule passes at 0.5 or above.
- `confidence` is how far the answer is from a coin toss: `|2p − 1|`, the measure TypeSafe documents for nouls.
- `unsure` is true when confidence is under 0.6, or when Jev and the measurement disagree. `needsReview` is true when any rule is unsure.
- `applies: false` means the design has nothing for that rule to judge (no stairs, no seats, no plants). The rule is not sent to Jev and passes.
- `summary` is exactly what Jev was shown.

Errors use `{"ok": false, "error": {"code", "message"}}`: 401 without the token, 413 over 1 MB, 400 for JSON that is not a design, 429 when rate limited, 502–504 when Jev fails.

## Other ways to run it

**In the designer (staff only).** Open the designer with `?jevcheck=1`. A "Check design rules" button appears bottom left. It asks for the internal token once, keeps it in `sessionStorage` for that tab, and lists the rules that fail or need a look. It works on the deployed site and under `netlify dev`; plain `npm run dev` does not serve functions.

**From the command line.**

```bash
npx tsx scripts/jev-check-design.ts path/to/design.json --summary
```

prints the summary with no call and no cost. Without `--summary` it makes one Jev call and needs `JEV_API_KEY` in the environment.

**Tests.**

```bash
npm run check:jev
```

Jev is never called in tests: a stand-in answers from the summary. The check also runs as part of `npm run check:deck`, so it is in the deploy gate. The fixture `scripts/fixtures/jev-estate-01.json` is the estate showcase design with the customer name, address, scope notes and plant source notes removed.

## Cost

- `jev-1.13.0` costs **$0.042 per million input tokens**. Output tokens are free. (docs.typesafe.ai/models, checked 2026-10-13.)
- The estate design's summary is about 6,600 characters, and the request carries 26 questions (7 rules and 19 species). That should be a few thousand tokens, so roughly **$0.0002 per check**. This is an estimate: no live call has been made yet. Every report returns the real `usage.inputTokens` and `costUsd`, so the first live call settles it.
- The daily cap of 300 calls keeps a full day under $1 even if every request hit Jev's 64k-token limit.
- The summary is capped at 90,000 characters and the request at 120 questions before anything is sent.

## Limits and safety

- **Thresholds are not tuned.** The 0.5 pass line, the 0.6 "unsure" line and the 60% native share are starting points. Run the command-line check on designs you know are good and bad, then adjust `CHECK_POLICY`.
- **The lawn rule is the weakest.** One big lawn that wraps everything reads the same in the data as a deliberate panel. The summary can only report what frames each panel and how much open ground lies in narrow strips.
- **No fence in the data.** This design format has no fence object, so the summary says so. It reports hedge shrubs and deck privacy screens instead.
- **Seat rotation.** A seat with `rotationDeg` 0 is taken to face away from the house, the convention the estate branch's `furnitureFacing.ts` uses. When that branch merges, this check should import that module instead of carrying its own copy of the rule.
- **House-wall guard.** A design can switch the house-wall guard off under the edge name `rect-back`. This build only gives that name to decks with angled corners, so the app itself would still draw that guard. The check follows the design and says so in `warnings`.
- **What is sent to TypeSafe.** Only the summary: sizes, surfaces, fixture names, plant names and object names. Customer name, address, scope text and contact details are never included, and object names are reduced to plain words first. TypeSafe states it does not train on requests.
- **What this code can reach.** Its only outbound call is to `api.typesafe.ai`. A test walks the import graph and fails if a proposal, share-link, lead-form or paid-AI module becomes reachable from it.
- **Model version is pinned** to `jev-1.13.0`. An alias such as `jev-latest` moves when TypeSafe ships a release, which would shift tuned thresholds.

## Not verified against TypeSafe

The endpoint, auth header, request fields and response fields were checked against docs.typesafe.ai on 2026-10-13. These were not, or could not be:

- No live request has been made, so the response shape is confirmed from the docs only. The client validates every response with Zod and refuses anything unexpected.
- TypeSafe gives limits in tokens but publishes no tokenizer, so the size guard counts characters.
- The docs do not say whether the state is billed once per request or once per question. The cost figure above assumes once.
- The docs do not describe the JSON body of an error response, so the client reads only the status code.
- The docs mention a `retry-after` header only in passing. The client honours it when present, capped at 5 seconds, and otherwise waits about half a second before its one retry.
- No latency figure is published. The client's timeout is 10 seconds per attempt.
- Published rate limits (80 requests per second) are marked as changing without notice.
