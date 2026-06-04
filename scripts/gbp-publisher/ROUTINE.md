# GBP Daily Mirror Routine

**This file is the playbook for the `gbp-daily-mirror` scheduled task.** It runs in a fresh Claude Code session multiple times per day. The session has no memory of prior runs — this file is the only source of truth.

## What you're doing

Mirror every recent Golden Maple blog post (last 14 days) that hasn't yet been posted to the Google Business Profile. The blog-publisher cron creates blog drafts every Monday; this routine pushes them into the GBP panel that lives inside Google Search results. It runs multiple times per day so a single closed-Claude-Code window doesn't delay a mirror by more than a few hours.

## Self-healing requirements (READ BEFORE EXECUTING)

1. **Always pull latest main first.** Local clone may be stale — the blog-publisher writes `scripts/blog-publisher/state.json` to remote main, so a stale local read is the most common reason this routine sees "no pending blogs" when there actually are some.
2. **Always update `state.lastRunAt` in `scripts/gbp-publisher/state.json`**, even on the idle path. This is the heartbeat — without it, ops can't tell whether the routine ran at all.
3. **Mirror every pending blog in a single fire**, not just one. Two missed weeks means two blogs to catch up on. `findAllPendingBlogs` returns them oldest-first.
4. **Fail fast with Telegram on environmental issues** — Chrome not running, MCP not connected, no Google session — instead of silently exiting.

## Environment

- Working directory: `C:\Users\yorki\Desktop\Goldenmaplelandscaping.ca\golden-maple-landscaping`
- Required env vars (already set in Yorkis's local env via `load-keys.cmd`):
  - `GEMINI_API_KEY` — Gemini 2.5 Pro
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — for status pings
- Required MCP servers:
  - `mcp__Claude_in_Chrome__*` — drives Yorkis's actual Chrome browser
- Chrome deviceId (silent auto-connect per `~/.claude/rules/chrome-mcp-auto-connect.md`):
  - **`58fce9f9-570f-4440-b3e9-ffa56a84af9b`** ("Yorkis Estevez browser")
  - Do NOT call `list_connected_browsers` or `switch_browser`. Call `select_browser` directly.

## Step 0 — Pull latest main

```bash
cd "C:/Users/yorki/Desktop/Goldenmaplelandscaping.ca/golden-maple-landscaping" && git fetch origin --quiet && git pull --ff-only origin main 2>&1 | tail -3
```

If the pull fails for any reason (merge conflict, divergence) — DO NOT continue. Send a Telegram alert and exit:
```bash
node -e "const t = require('./scripts/gbp-publisher/telegram.cjs'); t.sendMessage('⚠️ *gbp\\-daily\\-mirror* — `git pull` failed on routine start\\. Local repo state is unsafe to use\\. Resolve manually then re\\-trigger\\.').then(()=>console.log('alert sent'));"
```

## Step 1 — Find all pending blogs + heartbeat

```bash
cd "C:/Users/yorki/Desktop/Goldenmaplelandscaping.ca/golden-maple-landscaping" && node -e "
const fs = require('fs');
const g = require('./scripts/gbp-publisher/generator.cjs');
const path = './scripts/gbp-publisher/state.json';
const state = JSON.parse(fs.readFileSync(path, 'utf8'));
// HEARTBEAT — always record the run regardless of outcome
state.lastRunAt = new Date().toISOString();
fs.writeFileSync(path, JSON.stringify(state, null, 2));
const pending = g.findAllPendingBlogs(state);
console.log(JSON.stringify({
  pendingCount: pending.length,
  pending: pending.map(p => ({slug: p.blog.slug, title: p.blog.title, heroImage: p.blog.heroImage}))
}, null, 2));
"
```

**If `pendingCount: 0`**: send idle Telegram, commit the heartbeat update, exit.
```bash
node -e "const t = require('./scripts/gbp-publisher/telegram.cjs'); t.sendMessage(t.buildIdleMessage()).then(()=>console.log('idle ping sent'));" && \
git add scripts/gbp-publisher/state.json && git commit -m "gbp: heartbeat $(date -u +%Y-%m-%dT%H:%M:%SZ)" && git push origin main
```

**If `pendingCount > 0`**: proceed to Step 2 with the list.

## Step 2 — Connect Chrome (once per run)

```
mcp__Claude_in_Chrome__select_browser({ deviceId: "58fce9f9-570f-4440-b3e9-ffa56a84af9b" })
```

If this returns "No connected browser..." — Chrome is closed or the MCP extension isn't running. Telegram + exit:
```bash
node -e "const t = require('./scripts/gbp-publisher/telegram.cjs'); t.sendMessage('⚠️ *gbp\\-daily\\-mirror paused* — Chrome not connected\\. Open Chrome with the Claude\\-in\\-Chrome extension to resume\\.').then(()=>console.log('alert sent'));"
```

Then:
```
mcp__Claude_in_Chrome__tabs_context_mcp({ createIfEmpty: true })
```
Note the `tabId`.

## Step 3 — Loop through each pending blog (oldest first)

For EACH blog in the pending list, execute the per-blog flow below. Do not stop after one — keep going until all are processed OR a hard failure is hit.

### 3a. Generate the GBP post body

```bash
node scripts/gbp-publisher/cli.cjs generate-only --slug=<slug>
```
Capture the summary text, ctaUrl, imageUrl. Validation must show OK.

If validation fails: Telegram with the errors, skip this blog (move to next pending), do NOT mark mirrored.

### 3b. Download hero image to temp

```bash
curl -sL "<imageUrl>" -o "/tmp/gbp-hero-<slug>.jpg" && ls -la "/tmp/gbp-hero-<slug>.jpg"
```

### 3c. Drive Chrome to post

1. `navigate` the tab to `https://www.google.com/search?q=Golden+Maple+Landscaping`. Wait ~3s for the panel.
2. Use `find({ query: "Posts button in the business management panel" })` to locate the Posts entry. Click it (`computer left_click` with the ref's screenshot coords, OR use the ref directly via `scroll_to` + click).
3. Wait for the post composer modal. Use `find` to locate:
   - The text field → click it, then `type` the summary
   - The image upload control → use file_upload with the temp path
   - The "Add button" / CTA toggle → click → select "Learn more" → fill URL field with ctaUrl
4. Click Publish/Post. Wait ~5s.
5. `screenshot` the result with `save_to_disk: true` and remember the saved path.

### 3d. Update state + Telegram

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
state.consecutiveFailures = 0;
fs.writeFileSync(path, JSON.stringify(state, null, 2));
console.log('state updated for', '<slug>');
"
```

Send a Telegram with the screenshot from 3c:
```bash
node -e "
const t = require('./scripts/gbp-publisher/telegram.cjs');
const post = { slug: '<slug>', title: '<title>', summary: '<summary>', ctaUrl: '<ctaUrl>', validation: { charCount: <chars>, ok: true } };
t.sendSuccessWithScreenshot(post, '<screenshot-path>').then(()=>console.log('success ping sent'));
"
```

### 3e. After all blogs processed — commit & push state

```bash
git add scripts/gbp-publisher/state.json && \
  git commit -m "gbp: mirrored $(date -u +%Y-%m-%d) — N blog(s)" && \
  git push origin main
```

## Failure handling

- **Per-blog failure** (validation, UI selector miss, image fetch): screenshot, Telegram with screenshot, increment `consecutiveFailures`, set `lastFailureAt`, skip to next pending blog. Do NOT mark this slug as mirrored.
- **Environmental failure** (git pull fails, Chrome MCP unavailable): Telegram alert, exit clean. The next scheduled fire will retry.
- **Never** mark a blog as mirrored if the actual publish didn't visibly land in the GBP panel.

## Hard rules

- Do NOT call `list_connected_browsers` or `switch_browser`. Call `select_browser` with `58fce9f9-570f-4440-b3e9-ffa56a84af9b` directly.
- Do NOT mirror the same slug twice. `state.mirrored[].slug` is the source of truth.
- Do NOT publish if generator validation returns FAIL.
- Do NOT commit anything except `scripts/gbp-publisher/state.json` from this routine.
- ALWAYS update `state.lastRunAt` in Step 1, even on idle/failure paths.
- ALWAYS pull main in Step 0. Stale local state is the #1 silent-failure mode.

## Why this routine exists (cold-context)

Google killed the GBP Local Posts API in 2024. They also migrated GBP management out of `business.google.com/posts` and into the "Your business on Google" panel that lives inside `google.com/search?q=<your-business>`. Cloud headless Playwright can't authenticate against this UI (bot detection). The only working path is driving Yorkis's already-signed-in local Chrome via the Chrome MCP — which is exactly what this routine does. Don't try to use Playwright, the deleted GitHub Actions workflow, or `business.google.com` directly — they were all abandoned.

Working directory for everything: `C:/Users/yorki/Desktop/Goldenmaplelandscaping.ca/golden-maple-landscaping`
