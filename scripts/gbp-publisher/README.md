# GBP Publisher — Local Claude Code Routine

Mirrors every weekly Golden Maple blog post into a Google Business Profile "What's New" post. Runs as a **scheduled Claude Code routine** that fires **4x/day** (9:11 AM, 1:11 PM, 5:11 PM, 9:11 PM ET) on Yorkis's local machine. Three-tier publish stack: **Business Profile API** (preferred — attaches image), **Chrome MCP composer** (fallback — text+CTA, manual-attach nudge), **markdown paste queue** (last resort). Self-heals on stale local repo, catches up backlogs across missed fires.

## Three-tier publish stack

### Tier 1 — Business Profile API (preferred)

When `~/Hermes Agent/credentials/gbp-token.json` has a fresh OAuth token, the routine calls `scripts/gbp-publisher/api-bridge.cjs publish --slug=<slug>` which goes through the Hermes GBP publisher at `~/Hermes Agent/skills/gbp-publisher/publisher.js`. That POSTs to `mybusiness.googleapis.com/v4/.../localPosts` with the post summary, Learn more CTA, AND the hero image URL — Google fetches the image from `goldenmaplelandscaping.ca/images/projects/...` and embeds it natively. **One HTTP call, image attached, zero browser fragility.**

### Tier 2 — Chrome MCP composer (fallback)

If the API path returns non-api mode (no token, expired refresh, account/location missing, API error), the routine falls back to driving Yorkis's already-signed-in Chrome via `mcp__Claude_in_Chrome__*` tools. This posts text + Learn more CTA but cannot attach an image — Chrome MCP can't drive Google's composer file upload (two adversarial workflow verdicts on 2026-06-04 confirmed: Wiz framework gates on `event.isTrusted`, no `input[type=file]` in DOM, Playwright `filechooser` event doesn't fire for `window.showOpenFilePicker()`). After the text post lands, a Telegram nudge sends Yorkis the hero image so he can drag it into the live post manually (~30s of human attention).

### Tier 3 — Markdown paste queue (last resort)

If both Tier 1 AND Tier 2 fail (e.g. Chrome not open, all browser automation blocked), the Hermes publisher's existing markdown fallback writes a paste-ready `.md` file to `~/Hermes Agent/queue/gbp-paste/` for Yorkis to copy-paste manually.

## Why this routine exists (cold-context)

The original GitHub Actions + headless Playwright plan died:
1. The Local Posts API was deprecated then partially restored in 2024 — `localPosts.create` still works for `sourceUrl` media references, hence the Tier 1 path being viable
2. Google migrated GBP management out of `business.google.com/posts` into `google.com/search?q=<your-business>`, breaking cloud automation
3. Headless Chromium from GitHub IPs gets bot-detected on `google.com/search`
4. Session cookies don't transfer between browsers

So the architecture is:
- **Scheduled task** (`~/.claude/scheduled-tasks/gbp-daily-mirror/`) runs 4x/day in Claude Code
- The task reads `ROUTINE.md` (this directory) as its playbook
- Tries API first, falls back through Chrome MCP, then markdown paste
- Telegrams success/failure with whatever proof we have (post_id for API path, screenshot for Chrome MCP path)

Trade-off accepted: this only fires while Claude Code is open. If Claude Code is closed when the task is due, it runs on next launch. For a once-a-week mirror, that's fine.

## Flow

1. **4x/day (9/13/17/21:11 ET)** — scheduled task fires
2. **`git pull origin main`** — always pulls fresh blog-publisher state (fixes the 2026-05-31 silent-no-op incident — a stale local clone showed no pending blogs even though origin had a fresh one merged)
3. Writes `state.lastRunAt` heartbeat regardless of outcome
4. Reads `scripts/blog-publisher/state.json`, finds **all** un-mirrored blogs from the last **14 days**
5. Calls `node scripts/gbp-publisher/api-bridge.cjs status` — caches the result so the per-blog loop knows whether Tier 1 is available
6. If nothing pending → idle Telegram ping → commit heartbeat → exit
7. If pending → for each blog (oldest first):
   1. The local `claude` CLI generates an 800-1400 char summary + Learn more CTA (`generator.cjs`, via `claude-provider.cjs` — same swap `blog-publisher` made 2026-07-28, not Gemini)
   2. **Tier 1 attempt**: `api-bridge.cjs publish --slug=<slug>` — if mode=api, post is live WITH IMAGE
   3. **Tier 2 fallback** (only if Tier 1 returned non-api): Chrome MCP composer flow — text+CTA only, screenshot
   4. Updates `state.mirrored[]` with the slug + which tier was used + whether image attached
   5. Telegrams success (API: post_id + image; Chrome MCP: screenshot + manual-attach nudge with the hero image)
8. Commits the updated `state.json` back to `main` so the same blog never posts twice
8. On environmental failure (Chrome closed, MCP disconnected) → Telegram alert → exit clean — next fire (≤4h away) retries

## Setup

Already done if you're reading this — the scheduled task is created via `mcp__scheduled-tasks__create_scheduled_task` and lives in `~/.claude/scheduled-tasks/gbp-daily-mirror/`.

### Required env vars / prerequisites

| Var | Used for |
|---|---|
| `claude` binary on PATH | Generation — compresses blog drafts into GBP summaries via `claude-provider.cjs`. Override with `CLAUDE_BIN` / `BLOG_CLAUDE_MODEL` if needed. |
| `TELEGRAM_BOT_TOKEN` | Status pings to Yorkis (set via `~/Hermes Agent/credentials/load-keys.cmd`) |
| `TELEGRAM_CHAT_ID` | Same |

`GEMINI_API_KEY` is **vestigial** — `generator.cjs` only checks it's non-empty as a presence-gate before routing through the local Claude CLI (see the comment at `generator.cjs:146`, matching `cli.cjs`'s `"not set (fine — claude CLI path)"` message). It is not a real Gemini API key and nothing here calls Google's API. If a failure message says `"Gemini error: ..."`, that's this same compat-naming leftover — check the `claude` CLI, not a Gemini quota/outage.

### Required Chrome state (Tier 2 fallback only — skip if Tier 1 is wired)

Yorkis's Chrome must be:
- Open (the MCP needs a running Chrome to connect to)
- Signed into the Google account that manages Golden Maple Business Profile

The deviceId `58fce9f9-570f-4440-b3e9-ffa56a84af9b` (Yorkis Estevez browser) is the silent-auto-connect default per `~/.claude/rules/chrome-mcp-auto-connect.md`.

### Setting up Tier 1 (Business Profile API — gets you image-attached posts)

One-time setup, ~30–60 min Yorkis time. See `~/Hermes Agent/skills/gbp-publisher/SKILL.md` for the full ritual. Short version:

1. **Google Cloud Console** — create/select a project, enable these APIs:
   - My Business Account Management API
   - My Business Business Information API
   - Business Profile Performance API
2. **OAuth consent screen** — External, add Yorkis's email as a test user
3. **Credentials** → OAuth client → Desktop app → download JSON → save to `~/Hermes Agent/credentials/gbp-oauth-client.json`
4. **Run the consent flow**:
   ```bash
   node "/c/Users/yorki/Hermes Agent/skills/gbp-publisher/oauth-flow.cjs"
   ```
   Browser opens → approve with the GBP-managing Google account → tokens written to `~/Hermes Agent/credentials/gbp-token.json`
5. **Discover account_id + location_id**:
   ```bash
   node "/c/Users/yorki/Hermes Agent/skills/gbp-publisher/discover-location.cjs"
   ```
   Pick the Golden Maple location → patched into the token file
6. **Smoke test**:
   ```bash
   node "/c/Users/yorki/Hermes Agent/skills/gbp-publisher/publisher.js" test
   # expect: "mode": "api", account_id + location_id populated
   ```

After that, the next routine fire uses Tier 1 automatically. If anything in the chain breaks (token revoked, API quota, etc.), the routine cleanly falls back to Tier 2 (Chrome MCP) with no manual intervention.

## Manual run

If you want to mirror a specific blog right now without waiting for the cron, paste this into Claude Code:

> Run the GBP daily-mirror routine for blog slug `<slug>`. Playbook at `scripts/gbp-publisher/ROUTINE.md`.

## CLI reference (helpers — Claude calls these during the routine)

```bash
# Check which blogs (if any) are pending — matches the routine's own 14-day
# window (findAllPendingBlogs, not the legacy 7-day findPendingBlog singular)
node -e "const g = require('./scripts/gbp-publisher/generator.cjs'); const fs = require('fs'); const state = JSON.parse(fs.readFileSync('./scripts/gbp-publisher/state.json', 'utf8')); console.log(g.findAllPendingBlogs(state).map(p => p.blog.slug));"

# Generate the GBP post body for a specific blog (validation included)
node scripts/gbp-publisher/cli.cjs generate-only --slug=<slug>

# Sanity check env + state files
node scripts/gbp-publisher/cli.cjs doctor

# Direct Telegram send (used by the routine)
node -e "const t = require('./scripts/gbp-publisher/telegram.cjs'); t.sendMessage('test').then(console.log);"
```

## What happens on failure

The routine sends a Telegram with a screenshot showing exactly where things broke. Common failures:

| Failure | Likely cause | Fix |
|---|---|---|
| `Chrome not connected` | Yorkis closed Chrome | Open Chrome and re-trigger |
| `Posts button not found` | Wrong Google account active, or panel didn't render | Open `google.com/search?q=Golden+Maple+Landscaping` in your Chrome, switch to the right account, re-trigger |
| `Generated post failed validation` | The Claude CLI generation exceeded 1500 chars or used a banned phrase | Re-run (generation is non-deterministic) |
| `Image fetch failed: 404` | Blog hero image not deployed | Wait for Netlify deploy, re-trigger |
| (silence — no Telegram) | Claude Code was closed when the task fired | Will run on next Claude Code launch |

`state.json` tracks `lastFailureAt` and `consecutiveFailures` so you can see drift over time.

## File layout

```
scripts/gbp-publisher/
├── README.md           you are here
├── ROUTINE.md          step-by-step playbook the scheduled task reads
├── cli.cjs             helper CLI — generate-only | doctor | post-now | capture-state
├── generator.cjs       local Claude CLI blog→GBP summary + validation (claude-provider.cjs)
├── api-bridge.cjs      Tier 1 wrapper — calls Hermes GBP publisher (Business Profile API)
├── telegram.cjs        Telegram helpers (idle / success-with-photo / manual-attach nudge)
├── publisher.cjs       LEGACY — Playwright-based publisher (kept for reference, not used by the routine)
├── state.json          { mirrored: [...slugs already posted], lastSuccessAt, consecutiveFailures }
└── debug-shots/        (gitignored) screenshots from failed attempts
```

## What this does NOT do

- **No GBP photos-only posts.** Only "What's New" posts mirroring blog content.
- **No GBP Offers or Events.** Different fields.
- **No reply-to-reviews.** Separate skill.
- **No QnA management.** Separate skill.
- **No human approval gate.** The blog PR already had one (you merged it). GBP post goes live without another checkpoint.
