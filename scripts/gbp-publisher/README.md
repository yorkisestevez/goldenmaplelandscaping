# GBP Publisher — Cloud Cron

Mirrors each weekly Golden Maple blog post into a Google Business Profile "What's New" post. Runs in GitHub Actions daily at 2 PM ET, no local machine needed (except during the monthly cookie-refresh ritual).

## Flow

1. **Daily 2 PM ET** — `.github/workflows/gbp-publisher.yml` fires on GitHub's runners.
2. Reads `scripts/blog-publisher/state.json` to find the newest blog from the last 7 days that hasn't been mirrored yet (`state.mirrored[]` is the truth).
3. If nothing is pending → sends a quiet "idle" Telegram ping, exits clean.
4. If something is pending → loads `scripts/blog-publisher/drafts/<slug>.json`, asks Gemini 2.5 Pro for an 800-1400 char summary + CTA.
5. Launches headless Chromium with stored Google session cookies, navigates to `business.google.com/posts`, fills the form, attaches the hero image, sets the **Learn more** button to the blog URL, hits Publish.
6. Telegrams a success message with a screenshot of the published post.
7. Commits the updated `state.json` back to `main` so the same blog doesn't get mirrored twice.

## Why this design (and why it's fragile)

**Google killed the Local Posts API in 2024.** There is no longer any way to publish a GBP post via an official API. The only options are:

- Manual posting (current state — no scale)
- Browser automation (this skill)
- Third-party SaaS like Buffer or Publer (~$5-15/mo, would also work)

Browser automation is **fragile**:

- **Google's UI changes.** Every few months they tweak the GBP dashboard. Selectors break. The script logs the failing step and posts a screenshot to Telegram so you can see what broke.
- **Google's bot detection.** Headless Chrome on a GitHub runner IP is suspicious. If you have a fresh-login flow, Google will challenge with 2FA. We work around this by capturing a logged-in `storageState` locally on your trusted machine and uploading it as an encrypted GitHub secret — Google sees a "known session" and skips the challenge.
- **Cookies expire.** Trusted-device cookies for Google last ~14-30 days. When they die, posting fails with `GBP storage state expired` and you get a Telegram alert pointing at the refresh ritual below.

When something breaks the recovery is usually 2 minutes (cookie refresh) or 15 minutes (selector tweak). Failure modes are alerted, not silent.

## One-time setup

### 1. Install Playwright locally (for `capture-state`)

From the repo root:

```bash
npm install --no-save playwright@1.49.0
npx playwright install chromium
```

### 2. Capture a logged-in Google session

```bash
node scripts/gbp-publisher/cli.cjs capture-state
```

This opens a real Chromium window. **Sign into Google with the account that manages your Golden Maple Business Profile.** Navigate until you can see the Posts page for the Barrie location, then come back to the terminal and press Enter.

A file `scripts/gbp-publisher/storage-state.json` is written to disk. It's in `.gitignore` — never commit it. Treat it like a password: it grants full access to your Business Profile.

### 3. Upload the session as a GitHub secret

```bash
gh secret set GBP_STORAGE_STATE < scripts/gbp-publisher/storage-state.json
rm scripts/gbp-publisher/storage-state.json
```

### 4. (Optional) Pin a specific location

If your Google account manages more than one GBP location, set the location id to avoid the script posting to the wrong one:

```bash
gh secret set GBP_LOCATION_ID --body "1234567890123456789"
```

Find your location id from `business.google.com/n/<this-is-the-id>/posts` in the URL when you're on the Posts page.

### 5. Confirm the other 3 secrets exist

These are reused from the blog-publisher workflow — they should already be set, but check:

```bash
gh secret list | grep -E '(GEMINI_API_KEY|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)'
```

If any are missing, set them the same way (`gh secret set NAME --body "..."`).

### 6. Test it

Trigger the workflow manually:

GitHub UI → Actions → "Daily GBP Publisher" → Run workflow.

Optionally enter a slug to force-mirror a specific blog (otherwise it'll pick the next-pending or send an idle ping).

Watch the run in Actions. On failure, debug shots are uploaded as an artifact for 14 days.

## Monthly cookie refresh ritual

When you get this Telegram alert:

> ❌ gm-gbp-publisher failed
> Stage: navigate-to-business
> Error: GBP storage state expired — Google bounced us to sign-in.

Run these 3 commands (~2 minutes):

```bash
node scripts/gbp-publisher/cli.cjs capture-state
gh secret set GBP_STORAGE_STATE < scripts/gbp-publisher/storage-state.json
rm scripts/gbp-publisher/storage-state.json
```

Next scheduled run (or manual trigger) will work again. Nothing in the repo changes.

## CLI reference

```bash
# What the GitHub workflow runs
node scripts/gbp-publisher/cli.cjs workflow-run

# Force-mirror a specific blog slug (must exist in blog-publisher/drafts/)
node scripts/gbp-publisher/cli.cjs post-now --slug=spring-cleanup-barrie

# Generate the GBP post body without publishing (preview / debug)
node scripts/gbp-publisher/cli.cjs generate-only --slug=spring-cleanup-barrie

# Open a Chrome window to sign in to Google (refresh ritual)
node scripts/gbp-publisher/cli.cjs capture-state
node scripts/gbp-publisher/cli.cjs capture-state --out=/tmp/my-state.json

# Sanity check env vars + state files
node scripts/gbp-publisher/cli.cjs doctor
```

## Local debugging tips

```bash
# Run against a local storage-state.json instead of the env secret
GBP_STORAGE_STATE_FILE=./scripts/gbp-publisher/storage-state.json \
  node scripts/gbp-publisher/cli.cjs post-now --slug=spring-cleanup-barrie

# Watch it in a real browser window (Linux/Mac only — needs a display)
GBP_HEADLESS=false node scripts/gbp-publisher/cli.cjs post-now --slug=spring-cleanup-barrie

# Verbose error stacks
GBP_DEBUG=1 node scripts/gbp-publisher/cli.cjs workflow-run
```

When a selector fails, the debug shot + an HTML dump land in `scripts/gbp-publisher/debug-shots/` (gitignored).

## File layout

```
scripts/gbp-publisher/
├── README.md           you are here
├── cli.cjs             entry — workflow-run | post-now | generate-only | capture-state | doctor
├── generator.cjs       Gemini call: blog draft → GBP post body + CTA + validation
├── publisher.cjs       Playwright Chromium → business.google.com → publish
├── telegram.cjs        success / failure / idle pings (reuses TELEGRAM_BOT_TOKEN)
├── state.json          { mirrored: [...slugs already posted to GBP] }
├── storage-state.json  (gitignored) local Google session bundle
└── debug-shots/        (gitignored) screenshots + HTML dumps from failed runs
```

## What goes in the GBP post

The generator produces a plain-text summary (no HTML, no markdown) between 800 and 1400 characters. Hard constraints baked into the prompt:

- Operator-honest brand voice — same banned phrases as blog-publisher.
- One paragraph hook → tease the article → one-sentence nudge.
- Canadian English.
- No links inside the body (the **Learn more** button handles that).
- No emoji except one optional 🍁 or 🌿.

The CTA is always `Learn more` pointing to `https://goldenmaplelandscaping.ca/resources/<slug>`. The hero image is the same one used by the blog post.

## Pause / resume

GitHub UI → Actions → "Daily GBP Publisher" → ⋯ → Disable / Enable.

Disabling stops the cron. The blog-publisher workflow keeps running independently.

## Failure modes you might see

| Telegram says | Cause | Fix |
|---|---|---|
| `GBP storage state expired` | Google session cookies died (~monthly) | Run capture-state ritual above |
| `Could not find Add update button` | Google changed the GBP UI | Check `debug-shots/` artifact — update selectors in `publisher.cjs` |
| `Generated post failed validation` | Gemini returned >1500 chars or used a banned phrase | Re-run; check generator.cjs prompt if recurring |
| `Image fetch failed: ... HTTP 404` | Blog hero image not deployed yet | Check Netlify deploy status; image must be live |
| (no message at all) | Workflow itself broke before sending Telegram | Check the Actions run log directly |

## What this does NOT do

- **No GBP photos-only posts.** Only "What's New" posts mirroring blog content.
- **No GBP Offers or Events.** Those have different fields and bot-detection profiles.
- **No reply-to-reviews.** Separate skill.
- **No QnA management.** Separate skill.
- **No approval gate.** The blog PR already had one (you merged it). GBP post goes live without another human checkpoint.
