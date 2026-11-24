# DeckCraft continuation prompt (2026-10-03)

Paste everything below the line into the GPT coding agent.

---

You are continuing work on **DeckCraft**, the 3D deck and backyard designer for Golden Maple Landscaping (Barrie, Ontario).

- It is live at goldenmaplelandscaping.ca/deck-designer.
- PR 114 also builds it into /cost-estimator.
- The owner is Yorkis Estevez.
- You are picking up where a Claude Code session stopped. Read this whole prompt before touching anything.

## 1. Where the code is

- **Checkout:** `C:\Users\yorki\Desktop\Goldenmaplelandscaping.ca\golden-maple-landscaping\.claude\worktrees\estimator-deckcraft`. This is a git worktree; work only here.
- **Branch:** `wip/deckcraft-2026-10-03`, head `9b2ee11`, pushed to `origin`.
- **GitHub:** `yorkisestevez/goldenmaplelandscaping`. The repo is **PUBLIC**:
  - Never commit secrets, `.env` files, private supplier prices or business-strategy documents.
  - The private supplier ratebook and pool budget presets live in the browser's IndexedDB (`privateRates`), never in code.
- **Production:** every push to `main` deploys the live site through GitHub Actions to Netlify.
- **Code:** `src/features/deckcraft/`:
  - `designer/` holds the UI.
  - `components/viewer3d/` holds the 3D view (three r185, react-three-fiber).
  - `drawings/` holds the permit set.
  - `structure/` holds the framing engine.
- **Checks and tests:**
  - Checks: `scripts/check-*.ts|.cjs|.mts`.
  - Browser tests: `e2e/*.spec.ts` (Playwright).

**Branch stack, oldest first:**

| Ref | Head | State |
|---|---|---|
| `main` | `10f779d` | Live. Has DeckCraft through PR 112: permit sheets A-0, A-1, S-1 to S-5; framing engine; full designer with patios. |
| PR 113 `feat/deckcraft-schedules` | `c08a3b5` | S-6 schedules. CI green and mergeable; waiting for the owner to merge. |
| PR 114 `feat/estimator-unlock-deckcraft` | `c8e369c` | Estimator unlocked, DeckCraft inside /cost-estimator. Stacked on 113. CI green; waiting for the owner. **Do not push to this branch.** |
| `wip/deckcraft-2026-10-03` | `9b2ee11` | **Your branch.** Stacked on 114. Holds all work since. Not merge-ready. |
| `archive/deckcraft-*` (7 branches) | — | Snapshots of old worktrees whose work is already on main. Reference only. Never merge them. |

## 2. What the WIP branch contains

One commit, `9b2ee11`, covering 421 files:

- **Designer Mode phase 1 (shape design).** Its benchmark is Realtime Landscaping Architect 2026. New files:
  - `shapeTools.ts` (pure engine);
  - `designer/designerMode.ts`, `ShapeDrawTool.tsx`, `DesignerShapePanel.tsx`, `DesignerAreaPanel.tsx`, `DesignerAreaHost.tsx`;
  - `pathSpine` on yard features (`types.ts`, `designPersistence.ts`);
  - checks `check-shape-tools.ts` (24) and `check-designer-draw.cjs` (13).
- **3D renderer leak fix.** `releaseDrawnResources(gl)` in `renderPipeline.tsx`, plus module-level swatch-worker listeners in `useSwatchTexture.ts`. Check: `check-renderer-release.cjs` (8).
- **Site and yard tools:**
  - pools;
  - site surface, contours, grading transitions and earthwork;
  - landscape objects and surfaces (Poly Haven CC0 GLBs in `public/deckcraft/landscape/`);
  - wall construction and caps;
  - stone steps and stair refit;
  - project bundles;
  - supplier ratebook editor;
  - scene presentation and still export.
- **Permit-set additions:**
  - G-0 code references (`drawings/codeReferences.ts`; all eight stay "(confirm)");
  - `check-deck-honesty.ts`;
  - `cadExports.ts` with `check-deck-cad-3d.ts`.
- **Dependencies and build:**
  - new deps `delaunator 5.1.0`, `pdfjs-dist 5.7.284`, `fflate 0.8.3` (already installed in this worktree);
  - `netlify.toml` NODE_VERSION 20 → 22;
  - `buildTools/clipperPrivateMinification.ts`, used by `vite.config.ts`.

**Verified:**

- `react-router typegen && tsc --noEmit` passes on `9b2ee11` (run 2026-10-03).
- On 2026-10-02 these also passed: the 19 audit commands, `check-renderer-release` 8/8, `check-plan-gestures` 7/7 and `react-router build`.
- Route JS was **269.76 / 270 KB gzip**, which leaves almost no headroom.

**Failing:** the Designer Mode real-browser e2e passed 2 of 11 steps, with 0 console errors. All three causes are in the test, not the app.

## 3. Your first task: finish Designer Mode phase 1

The full handoff is at `C:\Users\yorki\Documents\Codex\2026-10-02\continue-working-on-deckcraft-from-its\outputs\designer-phase1\CONTINUATION-PROMPT.md`. Read it. It has:

- file hashes;
- the e2e and GPU scripts (`designer-lib.mjs`, `designer-e2e.mjs`, `designer-debug.mjs`, `run-fresh-checks.py`, `shapeTools.bundle.mjs`, `gpu-stability.mjs`, `gpu-heap.mjs`, `gpu-retainers.mjs`). They were copied on 2026-10-03 to `...\outputs\designer-phase1\scripts\`; run them from there. Their results and screenshots go to `...\outputs\designer-phase1\browser\`, and they load Playwright from this worktree's `node_modules`. If you change `shapeTools.ts`, rebuild `shapeTools.bundle.mjs` with esbuild.

Steps:

1. **Fix the e2e test:**
   - (a) Click `getByRole('button',{name:'Apply preview'})` after every yard action: patio draw, round corner, walkway, planting bed around, rectangle and Add. Plan edits are staged by `PlanEditingWorkspace`/`EditReview` and saved only on Apply. Landscape areas have their own Apply button.
   - (b) The arc middle point snaps to a nearby bed outline. Snap reach is 12 screen px, about 46 plan inches at the default zoom of 0.257 px/in. Zoom in first ("Zoom in" button), or draw in clear space, then assert the exact area. The expected area is about 75.5 sq ft; it got 99.8.
   - (c) The "remembered" step must tick the "Designer tools" toggle before reloading. `?designer=1` is per-visit by design; only the toggle persists, in `localStorage` key `deckcraft.designer-mode`.
2. **UX fix in `ShapeDrawTool.tsx`.** In 3-point arc mode, when the cursor is on the middle point, `threePointBulge(from, mid, cursor)` throws and an error notice flashes. Skip the arc preview, or draw a straight line, when cursor ≈ mid.
3. **Rebuild from the worktree root.** Never run anything with the shell's working directory inside `build/`, which causes EBUSY. Serve on `http://localhost:4329/deck-designer/` with the trailing slash.
   - Never use `127.0.0.1`: that origin holds the owner's real saved designs.
   - Never use port 4319, the owner's live tab, or 4045, which Chromium blocks.
4. **Rerun `designer-e2e.mjs` until all steps pass.** It uses Playwright Edge headless with `--use-angle=d3d11` and an isolated profile. It must cover:
   - a patio with tangent and 3-point arcs;
   - round corner;
   - planting bed around (an offset band with a hole);
   - a curved 4 ft walkway with round ends (`pathSpine` kept);
   - Add (union) of two patios;
   - a landscape circle area plus Apply;
   - estimate and quantity changes;
   - a 3D render;
   - saving, then reloading;
   - an export/import round trip;
   - a 390×844 phone viewport with no horizontal overflow;
   - turning designer mode off restores the standard UI;
   - 0 console errors.
5. **Run about 5 Plan↔3D cycles** with `gpu-stability.mjs`. There must be 0 detached canvases.
6. **Rerun the gates:**
   - `npm run lint` (typecheck, pricing parity and every `check:deck` script; about 5 minutes);
   - `npm run build` (its postbuild runs `scripts/check-deck-bundle.ts`, where route JS must stay ≤ 270 KB);
   - `git diff --check`.
   - After a build, run `git restore public/llms.txt docs/business-facts-audit/build-claim-gate.json`; both are build artifacts.
7. **Write a receipt** in `...\outputs\designer-phase1\` with the patch, test results and screenshots.

## 4. After that, in order

Each of these needs the owner's OK on a plan before you build it.

1. Designer Mode phases 2–5:
   - live direct design;
   - plant design;
   - walkthrough and sun;
   - terrain and water.
   Plan: `C:\Users\yorki\.claude\plans\pasted-content-id-a4fb-continue-deckcra-splendid-pelican.md`.
2. Split the WIP into reviewable PRs off `main` once 113 and 114 are merged. Suggested split:
   - the renderer leak fix (small; ship first);
   - G-0, honesty check and CAD exports;
   - site, pool and wall tools;
   - Designer Mode.
   Each PR must pass CI (`deckcraft-e2e.yml`: 6 shards, about 15–21 minutes).
3. Lighting L2 is not started:
   - an optional WEDGE downlight on each post, off by default;
   - one EVO HYDE per 3 ft of step width, `round(w/36)`, minimum 1;
   - lights at the top of every stair and level drop.
   Plan: `C:\Users\yorki\.claude\plans\the-deckcarft-outdoor-lighting-mellow-moth.md`.
4. Platform stream B (tenant module, CRM design store) comes later, per `C:\Users\yorki\.claude\plans\pasted-content-id-3aea-continue-my-twinkly-pine.md`.

## 5. Owner rules (non-negotiable)

**Gates:**

- Plan first, get the owner's OK, then build. The owner reviews between phases.
- Commits use the format `[golden-maple] action: description`.
- The owner asked on 2026-10-03 that all DeckCraft work live on GitHub. You may commit to `wip/deckcraft-2026-10-03` at checkpoints and push that branch.
- **Never** push to `main`, merge a PR, run `netlify deploy`, or publish or post anything. A merge to main is a production deploy, and only the owner does it.
- Don't install new dependencies, change secrets, run migrations or call paid APIs without asking.

**Pricing honesty:**

- Work without a price shows as a supplier or builder quote, never $0.
- Existing designs must never change price silently. A price change needs a `parity --report` before/after and the owner's approval.
- Never run `--update` on a golden without the owner's OK. That covers `scripts/deck-legacy-golden.json` (213 designs), `deck-plan-sheet-golden.json`, `deck-house-finishes-golden.json` and `deck-permit-set-golden.json`.
- The site has one deck price, DeckCraft's. The estimator never prices a deck itself (`check-deck-site-price.ts`).

**Data:**

- Don't invent survey, soils, engineering, manufacturer, supplier or plant data. Keep "(confirm)", DRAFT and pending inputs visible.
- Permit sheets never say approved, engineered, stamped, code compliant or permit-ready. They carry the "not a professional engineer's design" footer.
- Brand and contact facts come only from `src/data/business.ts`.
- Never echo the competitor Outside Logic or Simcoe Decks in the UI or marketing.

**Bundle:**

- Keep editors and designer code in lazy chunks.
- Audit harnesses mock React with only useRef, useState and useEffect, so keep `lazy()` out of files they load. That is why `DesignerAreaHost.tsx` exists.

## 6. Windows gotchas on this machine

- **Git Bash:**
  - `sed -i` turns CRLF files into LF and can corrupt backslashes, so use a real editor or patch tool.
  - Many tracked files are CRLF; match each file's endings.
  - `ln -s` copies rather than links.
  - Use `git -c core.longpaths=true` for new worktrees.
- **Probe scripts:** a probe with top-level await must be `.mts`, importing repo modules by `file:///C:/...` URLs.
- **Playwright:**
  - Never run two Playwright runs in one checkout at once.
  - Give each worktree its own `E2E_PORT`.
  - CI uses Chromium headless with SwiftShader, which is 2.5–3× slower than this machine. Reproduce CI-only failures with `CI=1`.
- **Background jobs:** run them silently (hidden PowerShell); never pop console windows. Never attach to Telegram bots.

## 7. Hand back

When you stop, write `C:\Users\yorki\Documents\Codex\2026-10-02\continue-working-on-deckcraft-from-its\outputs\HANDBACK-<date>.md`. It should list:

- what you changed (files, commits, branch head);
- every test and gate result, with its exact numbers;
- what is still failing;
- decisions the owner still needs to make.

Claude Code will resume from that file.

**Still owed by the owner:**

- Merge PRs 113 and 114.
- The CASL mailing address.
- The porch-wrap labour factor.
- The cable and glass ×1.30 / ×1.40 rates.
- Sign-off on the F5–F7 finish choices.
