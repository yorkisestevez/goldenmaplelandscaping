# GBP Daily Mirror Routine

**This file is the playbook for the `gbp-daily-mirror` scheduled task.** It runs in a fresh Claude Code session every day at 2 PM ET. The session has no memory of prior runs — this file is the only source of truth.

## What you're doing

Mirror the newest Golden Maple blog post (from the last 7 days) into a Google Business Profile "What's New" post. The blog-publisher cron creates blog drafts every Monday; this routine pushes them into the GBP panel that lives inside Google Search results.

## Environment

- Working directory: `C:\Users\yorki\Desktop\Goldenmaplelandscaping.ca\golden-maple-landscaping`
- Required env vars (already set in Yorkis's local env via `load-keys.cmd`):
  - `GEMINI_API_KEY` — Gemini 2.5 Pro for compressing blogs into GBP summaries
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — for status pings
- Required MCP servers:
  - `mcp__Claude_in_Chrome__*` — drives Yorkis's actual Chrome browser
- Required Chrome browser deviceId: `58fce9f9-570f-4440-b3e9-ffa56a84af9b` (Yorkis Estevez browser)
  - This is the silent-auto-connect deviceId per `~/.claude/rules/chrome-mcp-auto-connect.md`. Do NOT call `list_connected_browsers` or `switch_browser` — call `select_browser` directly with this id.

## Steps

### 1. Check for a pending blog

```bash
node -e "const g = require('./scripts/gbp-publisher/generator.cjs'); const fs = require('fs'); const state = JSON.parse(fs.readFileSync('./scripts/gbp-publisher/state.json', 'utf8')); const p = g.findPendingBlog(state, {maxAgeDays: 7}); console.log(p ? JSON.stringify({slug: p.blog.slug, title: p.blog.title, heroImage: p.blog.heroImage}) : 'NONE');"
```

- If output is `NONE`: send the idle Telegram ping and exit. You're done.
  ```bash
  node -e "const t = require('./scripts/gbp-publisher/telegram.cjs'); t.sendMessage(t.buildIdleMessage()).then(()=>console.log('idle ping sent'));"
  ```

- If output is a JSON object with a slug: continue to step 2.

### 2. Generate the GBP post body

```bash
node scripts/gbp-publisher/cli.cjs generate-only --slug=<slug-from-step-1>
```

This prints the summary, CTA url, and image url. Capture the values — you need them in step 5. Validation must show `OK`. If it shows `FAIL`, send a failure Telegram with the validation errors and stop.

### 3. Connect to Yorkis's Chrome

```
mcp__Claude_in_Chrome__select_browser({ deviceId: "58fce9f9-570f-4440-b3e9-ffa56a84af9b" })
mcp__Claude_in_Chrome__tabs_context_mcp({ createIfEmpty: true })
```

Note the new tab's `tabId` — you need it for every subsequent call.

### 4. Navigate to the GBP management panel

```
mcp__Claude_in_Chrome__navigate({ tabId, url: "https://www.google.com/search?q=Golden+Maple+Landscaping" })
```

Wait ~3 seconds for the panel to render. Then use `mcp__Claude_in_Chrome__find({ tabId, query: "Posts button in the business management panel" })` to confirm the panel loaded. If find returns nothing, the panel didn't render — screenshot, send failure Telegram, exit.

### 5. Open the post composer

Click the Posts button found in step 4. The Posts modal/page should open with fields for:
- Post text/summary
- Image upload
- (Optional) CTA button with URL

Use `find` to locate each field with natural-language queries:
- `"main text field for post content"` → paste the summary from step 2
- `"add image button"` or `"upload photo"` → click → use Yorkis's image file
- `"add button toggle"` then `"Learn more option"` then `"link URL field"` → fill with the CTA url

For the image, download the hero image first (the heroImage URL from step 2 points at `https://goldenmaplelandscaping.ca/images/projects/...`) to a temp file with `Bash`:
```bash
curl -sL "<image-url>" -o /tmp/gbp-hero.jpg && ls -la /tmp/gbp-hero.jpg
```
Then use `mcp__Claude_in_Chrome__find` + `file_upload` to attach it.

### 6. Publish

Find and click the "Publish" or "Post" button. Wait ~5 seconds. Screenshot the result.

### 7. Update state + Telegram

```bash
node -e "
const fs = require('fs');
const path = './scripts/gbp-publisher/state.json';
const state = JSON.parse(fs.readFileSync(path, 'utf8'));
state.mirrored = [...(state.mirrored||[]), {
  slug: '<slug>',
  title: '<title>',
  ctaUrl: '<ctaUrl>',
  publishedAt: new Date().toISOString(),
  routine: 'gbp-daily-mirror'
}];
state.lastSuccessAt = new Date().toISOString();
state.lastRunAt = new Date().toISOString();
state.consecutiveFailures = 0;
fs.writeFileSync(path, JSON.stringify(state, null, 2));
console.log('state updated');
"
```

Commit + push the state change so the next run doesn't re-mirror the same post:
```bash
git add scripts/gbp-publisher/state.json && \
  git commit -m "gbp: mirror $(date -u +%Y-%m-%d) — <slug>" && \
  git push origin main
```

Send success Telegram with the screenshot from step 6.

### 8. On any failure

- Screenshot whatever is on screen
- Save state with `lastFailureAt`, `consecutiveFailures++`
- Telegram with screenshot + the failing step description
- DO NOT update `mirrored[]` (so the next run retries)
- Exit cleanly

## Hard rules

- Never publish to GBP if validation fails. Quality > consistency.
- Never mirror the same blog twice — `state.mirrored[].slug` is the source of truth.
- Never call `list_connected_browsers` or `switch_browser` (per chrome-mcp-auto-connect rule).
- Never push direct commits unrelated to state.json from this routine.
- If Chrome MCP is not connected (no browsers), send a Telegram alert and exit. Yorkis needs to open Chrome.

## Files this routine touches

- `scripts/gbp-publisher/state.json` (read + write)
- `scripts/gbp-publisher/generator.cjs` (read-only — Gemini call)
- `scripts/gbp-publisher/telegram.cjs` (read-only — Telegram helpers)
- `scripts/blog-publisher/state.json` (read-only — finds pending blogs)
- `scripts/blog-publisher/drafts/*.json` (read-only — blog source content)
