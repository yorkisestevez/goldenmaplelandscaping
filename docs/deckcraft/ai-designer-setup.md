# AI Site Designer and edit assistant: cloud AI setup (S4)

DeckCraft's AI Site Designer and the edit assistant ("make the fire pit a gas table") can run on Claude Opus 5.5 on the live site. Both are off until you add an Anthropic API key to Netlify. Until then the site works as it does now: the engine's concepts and the exact measured instructions keep working, and the AI endpoints answer "not configured".

## How it works

1. The engine in the browser composes 2–3 concepts for the measured yard. They are priced and checked, as before.
2. The browser sends the visitor's words, the site brief and short concept summaries to `/.netlify/functions/deck-designer-ai`. Claude picks a concept, the moves to keep and their settings, all inside the bounds in `src/features/deckcraft/siteMoveParams.ts`, and explains why.
3. The engine rebuilds that choice with `conceptFromChoice` (in `siteConcepts.ts`), then prices and checks it. If the engine finds a problem, Claude gets exactly one revision turn with the findings. If the choice still doesn't check out after that, the visitor sees the engine's own concept. The AI never draws geometry and never sets a price.

**Netlify limits (from docs.netlify.com, checked 2026-10-06):**
- Synchronous functions and streamed responses stop at **60 s**, and that limit can't be changed.
- Background functions run up to **15 min**, answer **202** immediately, accept 256 KB and are retried twice if they fail.
- Netlify Blobs supports strong consistency and ETag compare-and-swap writes.

A Claude turn at effort high can take 30–90 s, so each AI turn runs as a job:

1. The POST validates the request, counts the visitor's turn, reserves the worst-case cost and stores a job record in Blobs (store `deck-ai`). It hands the job to `deck-ai-background` and answers 202.
2. The browser polls `GET ?job=` until the job finishes.
3. The background function claims the job with a compare-and-swap, so a Netlify retry never calls the model twice. It calls Claude, records the real cost and stores the validated answer.

**Files:**
- `server/siteDesignerAi.ts`: prompt, schema, validation, the Claude and Ollama providers.
- `server/aiSpendLedger.ts`: rates, ledger, cap, alerts, per-visitor limits, storage.
- `server/aiTurnService.ts`: HTTP endpoints, jobs, provider selection.
- `server/deckAssistantCloud.ts`: the edit assistant on Claude.
- `netlify/functions/deck-designer-ai.ts`, `deck-ai-background.ts`, `deck-assistant.ts`.
- `src/features/deckcraft/designer/siteDesignerAiClient.ts`: `runDesignerTurn` and `designerAiStatus`.

**npm dependencies added:** `@anthropic-ai/sdk` 0.131.0 and `@netlify/blobs` 11.1.3.

## Netlify environment variables (names only)

Add these in Netlify → Site configuration → Environment variables. Scope them to **Functions** and mark the key as a secret. Environment changes take effect on the next deploy.

| Name | Required | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes, to switch the cloud AI on | Turns on Claude for both the designer and the edit assistant. Without it, both answer "not configured". |
| `DECK_AI_HASH_SALT` | recommended | Any long random string. It hashes visitor ids in storage. Changing it resets today's turn counts. |
| `DECK_AI_MONTHLY_CAP_USD` | optional (default `25`) | The hard monthly cap in USD. `0` switches the cloud AI off. |
| `DECK_AI_DAILY_TURNS` | optional (default `10`) | AI turns per visitor per day. |
| `DECK_AI_DAILY_TURNS_PER_IP` | optional (default 3× the daily turns) | AI turns per network address per day. A household or office shares one address. |

Do **not** set these on Netlify. They are for local development only:
- `DECK_ASSISTANT_OLLAMA_URL` (the loopback Ollama)
- `DECK_ASSISTANT_OLLAMA_MODEL` (default `qwen3:14b`)
- `DECK_AI_STORE_FILE` (a JSON file in place of Blobs)

If a site password or Netlify basic auth is ever turned on, the server-to-server hand-off to `deck-ai-background` needs it too. Today it doesn't.

## Anthropic Console backstop

The app's cap is computed from token counts and the price table. Anthropic's own billing is the final word, so put a hard limit there as well:

1. In the Claude Console (platform.claude.com), create a workspace just for the website, for example **DeckCraft website**.
2. Give that workspace a **monthly spend limit**. Use about $30: a little above the app's $25, so visitors hit the app's friendlier cap first. Set it to $25 if you want both limits the same.
3. Check the organization-wide limit under the Console's Limits settings. Menu names move, so look for "Limits".
4. Create the API key **inside that workspace**. Paste it only into Netlify, never into the repo or a chat.
5. Turn on the Console's usage or billing email notifications.

If Anthropic changes prices, update `MODEL_RATES_USD_PER_MTOK` in `server/aiSpendLedger.ts`. The source is noted beside it.

## How the cap and limits behave

**Hard monthly cap ($25 by default)**
- Before each model call, the turn reserves its worst case:
  - design turn: about $0.84
  - revision: about $0.57
  - edit-assistant turn: about $0.65–0.75
- The worst case assumes every output token is used and a refusal fallback also runs. A turn is refused when spent + reserved + its worst case would pass the cap.
- When the turn ends, the real cost from the response's `usage` replaces the reservation. That covers input, cache writes, cache reads and output, with each fallback attempt priced at its own model's rates.
- If the connection drops mid-call, the cost is unknown and the worst case stays counted. If a background run dies, its reservation counts as spent after 20 minutes.
- The month is the UTC calendar month, as Anthropic bills.
- At the cap, the designer shows "The AI has reached this month's budget" and keeps the engine's concepts. The edit assistant falls back to exact measured instructions.

**Alerts at 80 % and 100 %**
- Each fires once per month. It writes a log line `{"event":"deck_ai_spend_alert", ...}` to the Netlify function logs (usually from `deck-ai-background`) and calls any hook registered with `onSpendAlert(...)` in `server/aiSpendLedger.ts`.
- Nothing is sent anywhere today. To get an email or CRM task, register a hook next to the entry points in `server/aiTurnService.ts`, for example `onSpendAlert(async a => { /* post to the CRM bridge */ })`.

**Per-visitor limits**
- Each visitor gets 10 turns a day, tracked by a first-party cookie `dc_ai` (a random id; HttpOnly, SameSite=Strict, path `/.netlify/functions`).
- Each network address gets 30 turns a day, counted by its hash.
- Storage holds only hashes. The address hash includes the date, so it can't be followed from day to day. The day is Barrie local time.
- A design run uses one turn, or two when a revision is needed. Each edit-assistant AI request uses one turn. Exact measured instructions are free.
- A turn counts once it is accepted. A turn the AI later fails on is not given back.

**Storage (Blobs store `deck-ai`)**
- `spend/YYYY-MM`: the month's ledger.
- `turns/<day>/…`: per-visitor turn counters.
- `jobs/<id>`: one job record per turn. The visitor's words and brief are erased when the turn ends.
- Deleting `spend/YYYY-MM` resets the month, so only do that on purpose.

## Model settings

- Model `claude-opus-5-5`. Adaptive thinking is always on. Effort is **high** for a new design and **medium** for the revision and for edits.
- The output is structured through `output_config.format`, with no forced `tool_choice`. The server validates every answer strictly:
  - concept ids, move kinds and setting bounds
  - no extra keys
  - no dollar figure the model wasn't given
  - no contact details
- **Refusal fallback is on:** `fallbacks: "default"` with the beta header `server-side-fallback-2026-07-01`.
  - A turn the safety classifiers decline is re-run on Anthropic's recommended fallback model for that category (Claude Opus 5 or Claude Opus 4.8), billed at that model's rates and counted in the ledger.
  - Declines in the "reasoning extraction" category are not retried.
  - If the whole chain declines, the visitor keeps the engine's concepts.
- **Prompt caching:**
  - The system prompt never changes between requests. It holds the role, the confirmed Barrie rules from `designRules.ts` and the move catalogue with its bounds, and it carries the one cache breakpoint.
  - Everything that varies comes after the breakpoint: the brief, the concepts, the visitor's words and the findings.
  - Design trends (`designTrends.ts`) are left out while `DESIGN_TRENDS_STATUS` is `'draft'`. They join the system prompt automatically once you approve them.
- **Privacy:**
  - Emails, phone numbers and street addresses are removed from the visitor's words before any model sees them.
  - Customer and contractor fields are never part of the requests.
  - Logs record only status, cost and timing.

## Estimated cost per turn

These are estimates from the pricing table, not measurements. Claude Opus 5.5 costs $4 per million input tokens, $20 output, $5 for 5-minute cache writes and $0.20 for cache reads.

| Turn | Tokens (approx.) | Cost |
|---|---|---|
| Design (effort high) | 2.5k cached system + 2.6k brief and concepts + about 5k output including thinking | **~$0.11** ($0.12 on a cold cache) |
| Revision (effort medium) | | **~$0.06** |
| Edit assistant (effort medium) | 6.6k cached system + up to 6k design context + about 3k output | **~$0.08–0.09** |

**$25 a month is roughly:**
- 225 design turns, or 150–200 complete designer runs if a third of them need a revision
- or about 280 edit-assistant turns

The worst-case reservations stop spending at the cap even if every turn ran to its output limit. Run the live eval below to replace these estimates with measured numbers.

## Local development ($0)

- `npm run serve:deck-assistant` (after a build) now serves both the edit assistant and the AI Site Designer on the local Ollama model (`qwen3:14b` on `127.0.0.1:11434`). Nothing goes to the cloud.
- Alternatively, run `netlify dev` with `DECK_ASSISTANT_OLLAMA_URL=http://127.0.0.1:11434` in a local, uncommitted env.
- Tests: `npx tsx scripts/check-designer-ai.ts` uses a fake Anthropic client, with no network calls and no spend. It is part of `npm run check:site`.

## Live eval (only with your OK: it spends money)

From a local shell, with the key set only in that shell:

```
ANTHROPIC_API_KEY=... npx tsx scripts/eval-designer-ai-live.ts --confirm-spend --cap=2 --prompts=4
```

The script refuses to run without the key and `--confirm-spend`. It stops at its own cap (default $2). It sends canned homeowner requests through the real path on the Craighurst fixture, using the engine, Claude, the rebuild and at most one revision. Expect roughly $0.5–1.

For each prompt it prints the outcome, the chosen concept and moves, the engine's findings, the cost, and the prompt-cache tokens read and written. Check that:
- `cacheRead` is above zero from the second model call on
- no price appears in the explanations
- there are no refusals

## Owner actions

1. In the Console, create the website workspace, set its monthly spend limit and create its API key.
2. In Netlify, add `ANTHROPIC_API_KEY` (Functions scope, secret) and `DECK_AI_HASH_SALT`. Optionally set the cap or daily-turn variables.
3. Redeploy through the safe deploy wrapper. Deploys stay owner-gated.
4. Optional: wire `onSpendAlert` to email or the CRM.
5. Optional: run the live eval once to measure real cost per turn and confirm caching.
