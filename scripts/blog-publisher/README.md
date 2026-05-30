# Blog Publisher — Cloud Cron

Automated weekly SEO blog posts for goldenmaplelandscaping.ca. Runs in GitHub Actions every Monday at 9 AM ET. **No local machine needed.**

## Flow

1. **Mondays 9 AM ET** — `.github/workflows/blog-publisher.yml` fires on GitHub's runners.
2. Picks the next unused topic from `topics.json`.
3. Calls Gemini 2.5 Pro → structured 1500-2200 word post (title, sections, FAQs, internal links, FAQPage schema).
4. Validates word count / banned phrases / hero allowlist / internal link count.
5. Writes the new `.tsx`, updates `App.tsx`, `Resources.tsx`, `sitemap.xml`, updates `state.json`, archives the draft.
6. Creates branch `auto/blog-YYYY-MM-DD-<slug>`, commits the changes, pushes.
7. Opens a PR via `gh`.
8. Telegrams the operator with the PR link.

**Approve:** tap the PR link on your phone → tap **Merge** on GitHub. Netlify auto-deploys from `main` in ~90s.

**Reject:** close the PR without merging. The topic is still marked used (no-loop guarantee). Next Monday picks fresh.

## Required GitHub repo secrets

The workflow needs these 3 secrets set on the repo (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `GEMINI_API_KEY` | Gemini 2.5 Pro API key |
| `TELEGRAM_BOT_TOKEN` | Same bot token used by @YorkisAi_bot |
| `TELEGRAM_CHAT_ID` | `7866654612` |

(`GITHUB_TOKEN` is auto-provided by Actions — no setup needed.)

The deploy workflow (`netlify-deploy.yml`) additionally needs `NETLIFY_AUTH_TOKEN`.

## Required GitHub repo settings (defaults will break this — don't skip)

**Settings → Actions → General → Workflow permissions:**
- ✅ "Read and write permissions" (radio button)
- ✅ "Allow GitHub Actions to create and approve pull requests" (checkbox)

The 2026-05-25 Monday cron failed because this checkbox is **off by default**. The workflow generated the draft, pushed the branch — but `gh pr create` returned `GraphQL: GitHub Actions is not permitted to create or approve pull requests`. After flipping the toggle, the 2026-05-30 manual re-run completed in 1m14s end-to-end. If this ever gets toggled off again (e.g. by an organization-level policy), expect the same silent breakage.

## Failure alerts

Both `blog-publisher.yml` and `netlify-deploy.yml` ship with a workflow-level `if: failure()` Telegram step that fires on **any** job failure — including ones where the Node script crashes before reaching its own error handlers. The alert includes a direct link to the failing run's logs. Use this to debug.

## Manual trigger

GitHub UI → Actions → "Weekly Blog Publisher" → Run workflow.
Optionally enter a `topic_id` (like `auto-005`) to force a specific topic.

## Topic backlog

45 hyperlocal Barrie/Simcoe topics seeded. At 1/week that's ~10 months of content.

Inspect what's left:
```bash
node -e "const t=require('./topics.json').topics; const s=require('./state.json'); const used=new Set(s.usedTopicIds||[]); console.log(t.filter(x=>!used.has(x.id)).length + ' unused / ' + t.length + ' total');"
```

To refill: append new entries with `auto-XXX` ids to `topics.json`.

## File layout

```
scripts/blog-publisher/
├── README.md           you are here
├── cli.cjs             entry — workflow-run / generate-only
├── generate.cjs        Gemini call + validation
├── inject.cjs          writes the 4 user-facing files
├── telegram.cjs        env-driven Telegram sender
├── topics.json         the topic backlog (45 entries)
├── state.json          used topic ids + history
└── drafts/             archived JSON of every generated post
```

## Brand voice constraints (baked into the prompt)

- Operator-honest, Simcoe-County-specific. Real Lake Simcoe / Barrie clay / freeze-thaw references.
- Banned: "industry-leading", "passionate team", "state-of-the-art", "in today's world", "look no further", "elevate your", "transform your".
- Canadian English (metre, colour, neighbour).
- No fake stats — ranges only.
- Products allowed: Permacon, Unilock, Techo-Bloc pavers; TimberTech composite decking.
- Base spec: 12-16" compacted clear stone (not granular A).
- Founder: Yorkis Estevez. Service area: Barrie, Innisfil, Oro-Medonte, Springwater, Orillia, Wasaga Beach, Midland, Collingwood.

## Pause / resume

GitHub UI → Actions → "Weekly Blog Publisher" → ⋯ → Disable / Enable.
