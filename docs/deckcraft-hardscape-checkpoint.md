# DeckCraft hardscape continuation checkpoint

This is a local progress checkpoint requested by Yorkis on September 27, 2026. It is not a release certification. Do not deploy or push from this handoff.

Final reviewed/imported inventory at checkpoint: 487 original stock/finish recipe bindings across 78 paving lines; 193 total catalogue products and 768 stock records. The paving audit covers143 lines/191finishes:142 lines have all listed nominal dimensions,50 have all retained original references recovered for applicable stocks,28 are partial,65 have no original runtime recipe, and204 unique product source references remain unresolved. These categories are inventory-specific, not a claim that every current supplier product has been found or certified. All22 Nueva originals and3 Colonnade shaded modules are included; the reviewed Permacon overlay contains80 recipes. The six conflicting-mix Permacon candidates remain excluded.

## Workspace

- Repository: `C:/Users/yorki/Documents/Codex/2026-09-26/so/work/deckcraft-consolidated`
- Branch: `review/deckcraft-consolidated`
- Outer workspace: `C:/Users/yorki/Documents/Codex/2026-09-26/so`
- Local preview: `http://127.0.0.1:4319/deck-designer/?review=inlays`
- Isolated browser QA server: `http://127.0.0.1:4320/deck-designer/`
- Reports and proof images: outer workspace `outputs/`
- Research PDFs, downloaded official guides and source-analysis helpers: outer workspace `work/landscape-research/`, `work/paver-pattern-recovery/`, `work/permacon-patterns/`, and the supplier folders referenced by recovery scripts. These local evidence files are outside this Git repository; preserve them.

## User's objective

Every paving product should use its actual published stock sizes and original shape, with the appropriate original supplier patterns, including Techo-Bloc Aberdeen. Rotate a patio pattern through the full 360 degrees without rotating its perimeter. Add, position, shape, rotate, recolour, select and delete patio inlays using the same interaction model as decking. Preserve direct point/edge editing and easy patio/wall elevations and material selection. Existing earlier requests for deck editing, sketch/plan, pricing, drainage, proposal presentation and agent control remain in the consolidated branch; do not replace it with an older main checkout.

## Implemented

- Obvious patio/wall material buttons, searchable supplier library, real stock sizes/finishes/colours and source-guide links. Confirmed originals appear as selectable recipes; unsupported source references are labelled guide-only.
- Physical shaped stock profiles and source-based bonds; rectangular envelopes remain explicitly qualified for moulds without adequate evidence.
- Full-circle pattern angle input and slider, and separately rotated patio inlays: rectangle, diamond, circle, compass rose, band and custom sketch.
- Cursor placement, right-click custom-shape completion, drag/move/corner editing, Delete, Undo/Redo and exact save/share persistence. Inlay editing hides the parent patio handles; Finish restores them.
- Actual field paving is cut around inlays. Each contrasting zone has its own stock/material quantities, while the whole patio's shared aggregate/base is counted once. Cut fragments count as one original stock. Invalid/overlapping/thickness-mismatched inlays are preserved for editing but excluded from installed quantities.
- Atomic agent commands `yard.inlay.place/move/rotate/remove`, strict validation, read/preview/execute parity, and a shared conservative 20,000-paver budget.
- Full-stock oblique repeats for non-2:1 herringbone and mixed motifs. Source cell rotations now support arbitrary finite angles in [0,360); do not shrink stones to force tiling.
- Larger desktop/phone plan canvas, reserved navigation-dock space and cursor-anchored Ctrl/Command-wheel zoom.
- Failed restoration cannot overwrite the original autosave. Auto-save stays paused through edits/shared links; Files downloads the exact previous bytes. Explicit import, new design or saved-job restore resumes only after preserving the original under `golden-maple.deck-studio.unrestored.v1`. If recovery storage fails, keep auto-save paused.

## Source import contract

`scripts/import-deck-landscape-catalogue.mjs` imports ONLY the reviewed files enumerated in `scripts/hardscape-pattern-recovery-manifest.json`. An unlisted overlay is a draft. Do not glob all recovery files into the app.

The generated lazy public catalogue preserves complete original source evidence. The engineering index supports schema 3, using a shared layout pool and finish-local stock-index tuples. Decode indexes against the RAW finish unit table before filtering undocumented units. Old inline-object layouts remain supported. `check-deck-landscape-catalogue.ts` independently compares decoded geometry, basis, joints and stock dimensions with the public catalogue.

Nominal diagram layouts and verified installed joints must stay distinct. Current Aberdeen mixes retain all full stocks and nominal topology; the published installed joint does not prove that the old illustration closes at that joint. Supplier pack ratios, cast spacer contours and exact pricing need separate evidence. Never apply unrelated generic prices to a selected supplier SKU.

## Verification and remaining work

The latest checkpoints are in `outputs/deckcraft-patio-inlay-independent-review.md`, `deckcraft-paver-line-accuracy-audit.md`, `deckcraft-restore-recovery-tests.json` and `deckcraft-material-button-build.log` outside the repository. Read their dates and scope: earlier browser/build results do not certify subsequently imported source batches.

Before the final source merge: the landscape catalogue/geometry/costing/persistence/agent suite passed 16,811 checks, then17,000 against the399-recipe source pool; original-shape tests passed1,466 checks across17stock variants/12bonds; independent patio/inlay tests passed117,692 assertions across16scenarios, including arbitrary source-cell rotation. The three failed-restore browser cases passed. TypeScript passed again against the final487-recipe index. Final487-recipe geometry/parity results are recorded below if completed before commit.

The earlier nine patio-inlay browser workflows, nine catalogue cases and two navigation cases passed, but the complete final source build and a clean final combined browser run still need confirmation. A temporary angular stock-bounds variable-shadowing defect existed in an intermediate production build; it is FIXED in source and the geometry suite passed afterwards. Rebuild before trusting the preview's source-pattern rendering.

Final checkpoint verification:18,848 catalogue/geometry/costing/persistence/source-parity checks PASSED against all487 recipe bindings;117,692 independent patio/inlay assertions PASSED against that same final inventory; TypeScript PASSED. Final production/bundle measurement and the combined browser suite remain unfinished for the continuation.

1. Inspect the manifest and updated line audit for the exact reviewed/imported inventory. Do not mistake source recipe bindings (per finish) for unique originals or product lines.
2. The Techo basic91 overlay was independently CLEARED at checkpoint, including corrected Aquastorm02 and the Westmount02/Valet03/Victorien03 source-phase overrides. It is included in the reviewed manifest. Continue the remaining Techo angular/mixed originals and source-stock reconciliation from outer `outputs/deckcraft-techo-source-recovery-handoff.md`; that report was written before clearance, so its basic91 pending label is superseded by this note. Historical source stocks and current product stock cannot be interchanged. Per-cell multi-colour compositions and undocumented cast outlines are separate gaps.
3. Review the six Permacon Boulevard PDF97 mix-conflict candidates in outer `work/permacon-patterns/mix-conflict-candidate-recipes.json`. Their drawn full-stock motifs are separate from inconsistent printed percentage captions. Do not promote until the actual complete source faces, repeat lattice and precise qualifications are checked independently. The reviewed Permacon runtime overlay remains separate.
4. Run strict source import validation, catalogue geometry/source parity, independent inlay checks, original-shape/elevation checks and TypeScript against the final merged index.
5. Rebuild the production preview. Keep performance limits at route JS270KB, worker205KB, CSS12KB, viewer340KB, PDF150KB; do not raise caps. The last measured pre-final tuple-index build was268.2KB route/201.3KB worker. Shared pool compression was added afterwards and requires measurement.
6. Run desktop/phone `deck-patio-inlays.spec.ts`, `deck-hardscape-picker.spec.ts`, `deckcraft-navigation.spec.ts`, `deck-yard-shape.spec.ts`, `deck-yard-elevations.spec.ts` and `deck-restore-recovery.spec.ts`. Use a unique `--output=test-results/<run>` for each parallel Playwright process; default-directory contention previously broke teardown.
7. Inspect a meaningful close-up of rotated Aberdeen and a compass/custom contrasting inlay in plan and 3D. Existing distant screenshots are insufficient for craftsmanship review. Preserve the user's design and browser tab; use4320/isolated fixtures.
8. Update the source gaps and test scope accurately. Do not claim every original pattern or mould is certified while source contradictions remain. Commit the finished follow-up locally after checks; no deployment/push without fresh explicit approval.

## Commands and runtimes

Run commands from the repository unless noted. Available Node: `C:/Users/yorki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`; Python: corresponding `dependencies/python/python.exe`; Git: corresponding `dependencies/native/git/cmd/git.exe`. npm is `C:/Program Files/nodejs/npm.cmd`.

```text
node scripts/import-deck-landscape-catalogue.mjs --evidence-dir=C:/Users/yorki/Documents/Codex/2026-09-26/so/outputs/deckcraft-landscape-catalogue --validate-only
node node_modules/tsx/dist/cli.mjs scripts/check-deck-landscape-catalogue.ts
node node_modules/tsx/dist/cli.mjs scripts/check-deck-patio-inlays.ts
node node_modules/tsx/dist/cli.mjs scripts/check-deck-hardscape-shapes.ts
node node_modules/tsx/dist/cli.mjs scripts/check-deck-yard-elevations.ts
node node_modules/typescript/bin/tsc --noEmit
```

Outer workspace `work/rebuild-materials.ps1` runs build with postbuild hooks disabled, then all required publication checks and the bundle guard, logging to `outputs/deckcraft-material-button-build.log`. Do not run another build while a browser process is fetching hashed assets. Playwright: set `E2E_PORT=4320`, then `node node_modules/@playwright/test/cli.js test <specs> --output=test-results/<unique-run>`.

Source PDFs may need the PDF skill and the existing local Shapely dependencies at outer `work/shape-python-deps`; do not reinstall them. Respect AGENTS.md and current local-build-only authorization. Do not touch secrets or production/customer systems.
