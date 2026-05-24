# GBP Publisher — Local Claude Code Routine

Mirrors each weekly Golden Maple blog post into a Google Business Profile "What's New" post. Runs as a **scheduled Claude Code routine** (daily 2 PM ET) on Yorkis's local machine, driving his already-signed-in Chrome via the `mcp__Claude_in_Chrome__*` tools.

## Why local + Chrome MCP (and not GitHub Actions)

**Originally** this was designed as a GitHub Actions cron + headless Playwright + stored Google session cookies. That plan died on contact with reality:

1. **Google killed the Local Posts API in 2024.** No direct-API path exists.
2. **Google migrated GBP management into Google Search results.** The legacy `business.google.com/posts` dashboard now redirects into the "Your business on Google" panel that only renders inside `google.com/search?q=<your-business>`.
3. **The new UI is heavily bot-detected.** `google.com/search` has the most aggressive bot detection on the internet — a headless Chromium from a GitHub Azure IP, signing in fresh, would fail every time.
4. **Google session cookies don't transfer between browsers.** Even captured locally, uploading to GitHub as a secret and replaying in a different browser fingerprint triggers re-auth challenges.

So the architecture is:
- **Scheduled task** (`~/.claude/scheduled-tasks/gbp-daily-mirror/`) runs daily 2 PM ET in this Claude Code app
- The task reads `ROUTINE.md` (this directory) as its playbook
- Drives Yorkis's already-signed-in Chrome via `mcp__Claude_in_Chrome__*`
- Telegrams success-with-screenshot, failure-with-screenshot, or idle

Trade-off accepted: this only fires while Claude Code is open. If Claude Code is closed when the task is due, it runs on next launch. For a once-a-week mirror, that's fine.

## Flow

1. **Daily 2 PM ET** — scheduled task fires
2. Reads `scripts/blog-publisher/state.json` to find the newest blog from the last 7 days that hasn't been mirrored (per `scripts/gbp-publisher/state.json`)
3. If nothing pending → idle Telegram ping → exit
4. If pending → Gemini generates an 800-1400 char summary + Learn more CTA
5. Connects to Yorkis's Chrome silently, navigates to `google.com/search?q=Golden+Maple+Landscaping`
6. Clicks Posts in the business panel, fills the form, uploads the hero image, sets CTA URL
7. Publishes, screenshots, Telegrams the result
8. Commits the updated `state.json` back to `main` so the same blog never posts twice

## Setup

Already done if you're reading this — the scheduled task is created via `mcp__scheduled-tasks__create_scheduled_task` and lives in `~/.claude/scheduled-tasks/gbp-daily-mirror/`.

### Required env vars (all already set via `~/Hermes Agent/credentials/load-keys.cmd`)

| Var | Used for |
|---|---|
| `GEMINI_API_KEY` | Gemini 2.5 Pro — compresses blog drafts into GBP summaries |
| `TELEGRAM_BOT_TOKEN` | Status pings to Yorkis |
| `TELEGRAM_CHAT_ID` | Same |

### Required Chrome state

Yorkis's Chrome must be:
- Open (the MCP needs a running Chrome to connect to)
- Signed into the Google account that manages Golden Maple Business Profile

The deviceId `58fce9f9-570f-4440-b3e9-ffa56a84af9b` (Yorkis Estevez browser) is the silent-auto-connect default per `~/.claude/rules/chrome-mcp-auto-connect.md`.

## Manual run

If you want to mirror a specific blog right now without waiting for the cron, paste this into Claude Code:

> Run the GBP daily-mirror routine for blog slug `<slug>`. Playbook at `scripts/gbp-publisher/ROUTINE.md`.

## CLI reference (helpers — Claude calls these during the routine)

```bash
# Check what blog (if any) is pending
node -e "const g = require('./scripts/gbp-publisher/generator.cjs'); const fs = require('fs'); const state = JSON.parse(fs.readFileSync('./scripts/gbp-publisher/state.json', 'utf8')); console.log(JSON.stringify(g.findPendingBlog(state, {maxAgeDays: 7})));"

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
| `Generated post failed validation` | Gemini exceeded 1500 chars or used a banned phrase | Re-run (Gemini is non-deterministic) |
| `Image fetch failed: 404` | Blog hero image not deployed | Wait for Netlify deploy, re-trigger |
| (silence — no Telegram) | Claude Code was closed when the task fired | Will run on next Claude Code launch |

`state.json` tracks `lastFailureAt` and `consecutiveFailures` so you can see drift over time.

## File layout

```
scripts/gbp-publisher/
├── README.md           you are here
├── ROUTINE.md          step-by-step playbook the scheduled task reads
├── cli.cjs             helper CLI — generate-only | doctor | post-now | capture-state
├── generator.cjs       Gemini blog→GBP summary + validation
├── telegram.cjs        Telegram helpers (idle / success-with-photo / failure-with-photo)
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
