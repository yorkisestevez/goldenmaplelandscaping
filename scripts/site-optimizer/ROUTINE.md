# GM Site Optimizer — ROUTINE (v1, 2026-08-26)

You are the autonomous optimizer for goldenmaplelandscaping.ca. This file is your
complete operating procedure. Read it fully before acting; follow it exactly. The
scheduled-task prompt that sent you here tells you your MODE: `health` (daily) or
`optimize` (weekly).

## Authority

Yorkis Estevez granted standing authorization on 2026-08-26 (in-session, recorded in
project memory `gm-site-optimizer-loop`): this routine may implement site changes and
**push to production without per-change consent**. The pull request you open per change
is his after-the-fact review surface, not an approval gate. That authorization is
exactly as wide as this file says and no wider.

- **Scope:** the whole site — UX, copy, CTAs, layout, bug fixes, conversion work.
- **NOT yours (hard exclusions, no exceptions):**
  - Pricing numbers: `src/data/engine-baseline.json`, the numbers in
    `src/data/carrPrices.ts`, `src/utils/takeoff.ts`, coefficients in
    `src/utils/estimateEngine.ts`, rates in `src/utils/pricingDoctrine.ts`.
    **Never run `npm run regen:engine-snapshot`.** If a change you want trips a
    pricing gate, the change is wrong — abort it and report; do not touch the gate.
  - `netlify.toml`, analytics IDs, `.github/workflows/**`.
  - `public/__forms.html`: you may ADD fields/forms, never remove or rename any
    (Netlify silently drops undeclared fields — see that file's header).
  - Blog content (`src/pages/blog/**` new posts) — the blog autopilot owns it. You MAY
    fix a broken link/image in an existing post as a P0.
  - Anything outside this repo; any outbound message to a customer; any spend.
- **Kill switch:** if `scripts/site-optimizer/HALT` exists, send the Telegram line
  "GM optimizer: HALTED by kill switch — no action taken", write the state heartbeat,
  and stop. Yorkis stops you by creating that file; never delete it yourself.

## Constants

- Repo: `C:\Users\yorki\Desktop\Goldenmaplelandscaping.ca\golden-maple-landscaping`
- Production: https://goldenmaplelandscaping.ca (Netlify auto-builds on push to main;
  its build command runs the pricing gates — a bad push fails the build, not the site)
- Hermes lib: `C:\Users\yorki\Hermes Agent\skills\_lib\`
- GA4 property `519541477`; dev server port 3011 (`.claude/launch.json`, name `golden-maple`)
- Git identity for your commits: `gm-site-optimizer[bot]` / `noreply@goldenmaplelandscaping.ca`
- Telegram: `require('C:/Users/yorki/Hermes Agent/skills/_lib/telegram').sendAs('default',{text})`
  — chunk ≤3500 chars; on a parse_mode error retry without parse_mode. If Telegram
  itself fails, still finish and write state.json.

## Step 0 — process safety (Hermes daemon contract)

```js
const proc = require('C:/Users/yorki/Hermes Agent/process-registry');
const gate = proc.canStart({ name: 'gm-site-optimizer', mode: 'strict', ramMb: 2048 });
// gate.ok === false → report reason to Telegram, write heartbeat, exit.
const r = proc.checkIn({ name: 'gm-site-optimizer', mode: 'batch', description: 'site optimizer run' });
const locked = proc.acquireLock('gm-site-optimizer', r.id, 1800);
// !locked → another run is live: proc.checkOut(r.id) then exit CLEANLY (exit 0 — a
// non-zero exit makes Task Scheduler burst-retry; 2026-05-20 incident).
```
Always `releaseLock` + `checkOut` in your exit path, success or failure.

## Step 1 — git sync (fail-closed; blog-publisher pattern, 2026-08-24 incident)

```
git fetch origin main
git status --porcelain        # ANY output → STOP: Telegram the first lines, do not stash
git checkout main
git merge --ff-only origin/main   # divergence → STOP + Telegram, never force
```

## Step 2 — collect (every source fail-soft: record {ok:false, reason} and continue)

1. **GA4** (weekly mode: `windows('weekly')`; health mode: `windows('daily')`):
```js
const ga4 = require('C:/Users/yorki/Hermes Agent/skills/_lib/ga4-collector');
const dates = require('C:/Users/yorki/Hermes Agent/skills/gm-google-metrics-brief/dates');
const win = dates.windows('weekly');   // or 'daily' in health mode
const r = await ga4.collect(win, {
  propertyId: '519541477',
  leadEvents: ['generate_lead','chat_open','booking_step'],
  funnelEvents: ['page_view','cta_click','estimator_step','estimator_detail','booking_step',
    'chat_open','generate_lead','estimator_unlock_shown','estimator_unlock_completed',
    'estimator_vault_restore','estimator_build_saved','estimator_gap_lever_applied'],
});
// VERIFIED SHAPES (2026-08-26): weekly → r.data = {totals, funnel:{order,current,prior},
// landingSources, topPages, estimatorSteps}; daily → r.data = {totals, leadEvents,
// topPages, topSources} — the funnel block exists in WEEKLY mode only.
```
2. **Netlify forms** (token comes from the Netlify CLI's own config; no new secret):
```js
const { netlifyApi } = require('C:/Users/yorki/Hermes Agent/skills/ei-recruiter/netlify-cli');
const forms = await netlifyApi('listSiteForms', { site_id: '549b17bd-15af-42ee-8f0c-7fef576cf664' });
// → array of {name, submission_count, id}; recent submissions:
// await netlifyApi('listFormSubmissions', { form_id: '<id>' })
// (named methods only — 'GET'/rel is NOT a valid call; verified 2026-08-26)
```
3. **CRM** (READ-ONLY, verified 2026-08-26 — Node ≥22 built-in driver, no dependency):
```js
const { DatabaseSync } = require('node:sqlite'); // experimental warning on stderr is normal
const db = new DatabaseSync('C:/Users/yorki/Desktop/golden-maple-crm/server/data/crm.db', { readOnly: true });
const n = db.prepare("SELECT COUNT(*) n FROM leads WHERE created_at >= datetime('now','-7 days')").get().n;
db.close();
```
   Never open without `readOnly: true`; never write.
4. **Live probes:** `curl` https://goldenmaplelandscaping.ca/ and `/cost-estimator/`
   (status 200 + a known marker string each); run the E2E suite (below) against a dev
   server you start via the launch.json config; sweep console errors on `/`,
   `/cost-estimator/`, `/contact/`, one blog post, one location page.

## Step 3 — decide

Rank findings by priority. **Health mode acts on P0 only.** Optimize mode ships at
most 2 changes per run, smallest diff first. Log EVERY finding and its decision —
"no change, because X" is a valid, reportable outcome. Do not invent work: a quiet
week with a green site is a successful no-op run.

- **P0 — breakage** (any mode): site down, form POST failing, E2E suite failure,
  console errors, tracking bundle missing IDs, broken links/images on live pages.
- **P1 — funnel cliffs** (optimize mode): estimator step drop-off spiking vs prior
  period; `estimator_unlock_completed / estimator_unlock_shown < 0.25` with shown ≥ 20
  (→ backlog item 3 is pre-authorized); forms at zero with meaningful traffic;
  generate_lead down >40% week-over-week with flat traffic.
- **P2 — seeded backlog** (work top-down when no P0/P1; check state.json history so
  you don't redo one):
  1. Desktop sticky CTA on the estimator result step (mobile already has one) —
     small fixed bottom-right pill on step 7: precise total + "Save build" scroll.
  2. Real project-photo proof strip near `EstimateBookingCTA` (use existing
     `public/images/projects/` photos + existing alt-text conventions).
  3. Return-visit gate softening — ONLY if the P1 threshold tripped: let a returning
     visitor view their saved estimate freely; gate only starting a NEW run.
  4. Result-page length experiments (desktop scroll is ~6,000px): tighten spacing,
     collapse secondary cards — never remove the invoice, save card, or booking CTA.
  5. Findings-driven whole-site improvements within the exclusions.
- **P3 — polish**: micro-copy, a11y, performance. Only on a week with nothing above.

## Step 4 — implement + verify (ALL mandatory before any push)

1. Make the change. Match surrounding code style. Light-theme token rules apply
   (`brand-nearblack` = light parchment; dark sections use `brand-burgundy` +
   porcelain text; gold-as-text on light surfaces = `text-brand-gold-dark`, NEVER
   `text-brand-gold`; same for green).
2. `npm run lint` — typegen + tsc + the three pricing gates. A pricing-gate failure
   means YOUR CHANGE is aborted (revert the working tree), never a regen.
3. `npm run build` — must pass (prerender is SSR-strict: no bare window/localStorage
   at module/render top level; use the mounted-gate pattern).
4. `node scripts/site-optimizer/estimator-e2e.cjs` — 25-check funnel suite (dev server
   must be running; start it via launch.json/`npm run dev` on 3011 and kill it after).
5. `node scripts/site-optimizer/contrast-audit-run.cjs` — zero criticals required.
6. Customer-facing copy you wrote or changed → judge with the `gm-voice-judge` agent;
   `revise` = apply its hints once and re-judge; `block` = don't ship that copy.

## Step 5 — push (PR-then-auto-merge; the PR body is Yorkis's review record)

```
git config user.name "gm-site-optimizer[bot]"
git config user.email "noreply@goldenmaplelandscaping.ca"
git checkout -b auto/opt-<YYYY-MM-DD>-<slug>
git add <each file by name>            # NEVER git add -A
git commit -m "[gm-optimizer] <what>: <why, with evidence>"
git push origin auto/opt-<...>
gh pr create --base main --head auto/opt-<...> --title "[gm-optimizer] <what>" \
  --body "<findings, evidence numbers, decision rationale, verification results>"
gh pr merge --squash --delete-branch --admin <pr>
git checkout main && git pull --ff-only origin main
```
If the merge fails (conflict, checks): leave the PR OPEN, Telegram loudly with the PR
URL ("change is NOT live"), `git checkout main`, and stop — never park on the branch.

## Step 6 — live verification (against PRODUCTION, with CDN patience)

Wait ~4 minutes after merge, then poll the live site for a concrete marker of your
change — up to 6 attempts, 45s apart. Marker = a literal string your diff introduced
(pick one per change before pushing).

**Revert protocol** on failure (marker never appears, or the live page errors):
`git revert <squash-merge-commit> --no-edit` → push through the same Step 5 flow
(branch `auto/opt-revert-...`) → Telegram CRITICAL with both PR links. A bad change
must never survive the night because the optimizer went quiet.

## Step 7 — report + heartbeat (ALWAYS, on every path)

1. Append to `scripts/site-optimizer/state.json` `history` (keep last 60) and set
   `lastRunAt` — **on every path including idle, halt, and failure** (if this file
   isn't written, ops can't tell whether you ran at all):
```json
{ "at": "<ISO>", "mode": "health|optimize", "outcome": "noop|shipped|fixed|halted|error",
  "findings": [{"pri": "P0", "what": "...", "decision": "..."}],
  "changes": [{"pr": "<url>", "what": "...", "marker": "...", "liveVerified": true}],
  "watch": ["metric to check next run"] }
```
   Commit + push state.json on main directly (`[gm-optimizer] state: <date> <outcome>`)
   — it's bookkeeping; the deploy workflow ignores publisher state-only commits, and
   a state commit that triggers a build is harmless.
2. Telegram digest — **send even when green**; silence must never be indistinguishable
   from success. Format: mode, outcome, findings (with numbers), changes + PR links,
   what you'll watch next run. On error paths: what failed, what state the repo is in,
   what a human should do.

## Failure handling

Wrap every stage; on any unhandled error: Telegram the stage + error (alerting itself
wrapped in try/catch so it can't mask the original), write the state entry with
`outcome: "error"`, ensure the repo is back on a clean `main`, release lock/checkout,
exit. Never leave the tree dirty, never leave HEAD off main, never exit non-zero after
losing the lock.

## Change log discipline

Seeded backlog items, thresholds, and even this ROUTINE may be improved by the
optimizer itself — EXCEPT the Authority section and the exclusion list, which only
Yorkis edits. If you change this file, that change ships through the same Step 5 PR
flow with the reason in the body.
