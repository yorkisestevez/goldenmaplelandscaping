# Instagram feed refresh — routine (v1, 2026-09-13)

Playbook-as-file for the weekly refresh of the Home "Latest from the job site" section.
The scheduled task `gm-weekly-instagram-refresh` (`~/.claude/scheduled-tasks/`) is a thin
pointer to this document. Same pattern as `scripts/site-optimizer/ROUTINE.md`.

## Authority (only Yorkis edits this section)

- **Scope:** the two register-backed paths only — `public/images/instagram/**` and
  `src/data/instagramFeed.json`. Nothing else may change in an `auto/ig-*` branch.
- **Curation (owner decision 2026-09-13):** job photos only. Top `topN` posts by likes
  in the last `windowDays`, IMAGE + CAROUSEL only, minus `excludeIds` in
  `scripts/instagram/config.json`. New non-project posts (AI graphics, supplier promos,
  reposts) must be added to `excludeIds`; the run never guesses.
- **Ship gate: PR only. Do NOT merge.** Auto-merge for IG refreshes has not been
  authorized. If it ever is, the only acceptable guard is: every path in
  `git diff --name-only origin/main...HEAD` matches
  `^(public/images/instagram/.+\.webp|src/data/instagramFeed\.json)$`, else leave the PR open.
- **Token:** the Meta SYSTEM_USER token in the Hermes registry slot `golden-maple`. It is
  resolved in memory by the fetch script and never written, printed or copied to Netlify.
- **Kill switch:** create `scripts/instagram/HALT` in the repo → the run stops before
  step 2 and sends a Telegram notice.

## Constants

- Repo: `C:\Users\yorki\Desktop\Goldenmaplelandscaping.ca\golden-maple-landscaping`
- Branch prefix: `auto/ig-YYYY-MM-DD`
- Git identity for the commit: `gm-ig-refresh[bot] <noreply@goldenmaplelandscaping.ca>`
- Telegram: `Hermes Agent/skills/_lib/telegram.sendAs('default', {text})`
- Process registry lock name: `gm-ig-refresh` (TTL 20 min)

## Step 0 — process safety

1. `node -e "require('C:/Users/yorki/Hermes Agent/process-registry').getStatus()"` — abort if
   RAM free < 4 GB or a `gm-*` site task is already running.
2. `acquireLock('gm-ig-refresh', <holderId>, 1200)`. No lock → stop, report, no Telegram.
3. If `scripts/instagram/HALT` exists → Telegram "IG refresh halted by kill switch", release lock, stop.

## Step 1 — fail-closed git sync

```bash
git status --porcelain            # must be EMPTY; otherwise stop (never stash, never -A)
git checkout main
git fetch origin main
git merge --ff-only origin/main   # must fast-forward; otherwise stop and report
```

## Step 2 — fetch

```bash
npm run instagram:dry-run         # prints "IG username confirmed: goldenmaplelandscaping.ca" + ranking
npm run instagram:refresh         # writes JSON + webp; exit ≠ 0 → stop, tree must still be clean
```

Exit codes: 2 = Graph rate limit (retry next week, no Telegram alarm); 3 = token missing
(Telegram P1 — check `MetaTokenGuard-Daily` log); 4 = username mismatch (Telegram P1,
never commit).

If the dry-run ranking shows a post that is clearly not a job photo, STOP and report it
with its id so Yorkis can add it to `excludeIds`. Do not commit a feed containing it.

## Step 3 — gates

```bash
npm run check:instagram && npm run check:image-refs && npm run lint
```

All must pass. `check:instagram` also refuses any token-shaped string in the JSON.

## Step 4 — branch, commit by path, PR

```bash
git checkout -b auto/ig-YYYY-MM-DD
git add public/images/instagram src/data/instagramFeed.json     # BY PATH — never `git add -A`
git commit -m "[gm-ig] weekly refresh: +A −R posts (top N by likes, window YYYY-MM-DD..YYYY-MM-DD)"
git push -u origin auto/ig-YYYY-MM-DD
gh pr create --base main --title "[gm-ig] weekly Instagram refresh YYYY-MM-DD" --body "<ranking table from the dry-run + add/remove list + 'PR only — awaiting Yorkis'>"
```

If `git diff --cached --name-only` contains anything outside the two allowed paths → abort
before committing.

## Step 5 — STOP

Do not merge. Do not deploy. Yorkis reviews and merges the PR; Netlify deploys on merge.

## Step 6 — report + heartbeat

- Telegram digest every run, including the quiet "no change" case:
  `IG refresh YYYY-MM-DD: N posts, +A −R, PR <url> | or: no change`.
- Append one line to `scripts/instagram/state.jsonl`: `{ts, result, added, removed, pr}`.
- `git checkout main`, release the lock.

## Failure handling

- Any failure leaves `src/data/instagramFeed.json` byte-identical (the script writes
  atomically and only after every download succeeded).
- A dirty working tree at any point → stop, do not `git stash`, report the file list.
- Never print the token. Every error path in the script runs through `redact()`.
