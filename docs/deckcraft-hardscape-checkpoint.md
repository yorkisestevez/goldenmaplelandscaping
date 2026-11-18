# DeckCraft hardscape continuation checkpoint

Local checkpoint, 27 September 2026 (continuation of `148c8a1`). It is not a release certification. Do not deploy or push
from this handoff. The full continuation record is the outer workspace's `outputs/deckcraft-continuation-report.md`.

## Inventory now

| | Count |
|---|---|
| Original stock/finish/pattern recipe bindings | 513 (was 487): 29 added, 3 withheld |
| Paving lines with a runtime original | 79 of 143 lines (191 finishes) |
| Lines with every listed nominal dimension | 142 (Techo Antika has no published individual sizes) |
| Lines with all retained originals recovered | 52 |
| Lines partly recovered | 27 |
| Lines with no runtime original | 64 |
| Unique unresolved product source references | 190 (was 204) |
| Catalogue | 193 products, 768 stock records, 961 colour records |

These counts describe the imported inventory. They are not a claim that every supplier original, mould or installed
joint is certified.

## Workspace

- Repository: `C:/Users/yorki/Documents/Codex/2026-09-26/so/work/deckcraft-consolidated`, branch `review/deckcraft-consolidated`.
- Outer workspace `C:/Users/yorki/Documents/Codex/2026-09-26/so`:
  - `outputs/` holds reports and proof images.
  - `work/` holds research PDFs, the independent verifier and QA helpers.
  - These live outside this Git repository; preserve them.
- Previews:
  - The user's design tab is on `http://127.0.0.1:4319/deck-designer/?review=inlays`. Never navigate it, write its
    storage or run tests against it.
  - Isolated QA preview: `http://127.0.0.1:4320/deck-designer/`.

## User's objective

Every paving product uses its actual published stock sizes and original shape, with the appropriate original supplier
patterns; Techo-Bloc Aberdeen is the example. Patio patterns rotate through the full 360° without rotating the perimeter.
Patio inlays add, position, shape, rotate, recolour, select and delete like decking. Keep direct point/edge editing,
elevations, material selection, deck editing, sketch/plan, pricing, proposals and agent control.

## Source import contract

- **Reviewed overlays only.** `scripts/import-deck-landscape-catalogue.mjs` imports ONLY the files listed in
  `scripts/hardscape-pattern-recovery-manifest.json`. Later exact keys override earlier ones. An unlisted overlay
  (`*-draft.json`) is a draft.
- **Promotion rule.** A record is promoted only when the independent source-face verifier (outer
  `work/source-face-verifier`) passes it against its cited source figure.
  - A blind hand-count review was run, but it passed a known-bad decoy, so it is a veto only, never confirmation.
- **Caption conflicts.** A recipe whose drawn stones contradict its printed mix must be named "… · source mix differs".
  The importer refuses it otherwise, and the drawing is used, never the caption.
- **Withheld recipes.** `withheldRecipes` removes a positively contradicted earlier recipe from runtime. Its exact
  geometry and guide are kept as evidence.
- **Engineering index.** Schema 3 decodes against each RAW finish unit table. Supplier swatch image paths live in the
  lazily fetched `public/deckcraft/hardscape-swatches.json`, which only the 3D viewer reads; the index keeps a swatch flag
  per colour.
- **Parity.** `check-deck-landscape-catalogue.ts` proves decoded parity with the lazy public catalogue and swatch map.
- **Joints.** Nominal diagram topology and installed joints stay distinct. Never borrow another SKU's price.

## Done in this continuation

- **Defects fixed.**
  - Shaped-stock order area used the rectangular envelope; it now uses the real face area.
  - No recipe coverage (hole) check existed, and recipes could be skipped silently.
  - Shaped bonds (hex, diamond, triangle, vertex) did not show their stated joint width.
  - Rotated rectangular stones without inlays or a shape profile were drawn as seamed decomposition cells, in plan and 3D.
  - The route bundle was over its cap.
  - Each is guarded by `check-deck-landscape-catalogue.ts`, `check-deck-hardscape-shapes.ts` or
    `check-deck-patio-inlays.ts`.
- **Source work**, each record passed by the final verifier:
  - Techo Diamond 02–07 on both finishes.
  - Everest 07/10/11/12, Para 750 10–14 and Eva 01.
  - Corrected Victorien 07 and Westmount 04.
  - Permacon Boulevard PDF97's three drawn motifs × two finishes, named "as drawn … · source mix differs".
- **Withheld as contradicting their own atlas figure:** Para 750 herringbone 09 and Westmount 05/06.
- **Eva 02** has an evidence gap: its drawing forms no repeat that can be proven.

## Open work, in priority order

1. **Reconcile the Techo atlas audit.** It is in `outputs/deckcraft-source-face-verification/audit-techo-atlas/`,
   summarised in the line audit. 55 of 111 earlier Techo atlas recipes are not confirmed against the figure their record
   cites:
   - 17 match every drawn stone but fail one gate;
   - 4 Aquastorm figures give no scale fit;
   - 34 do not match.

   Some mismatches are numbering or provenance conflicts, not wrong layouts. The atlas figure labelled Aberdeen 04 is a
   mixed modular, while the current reference is a single-stock checkerboard, and Blu 03 looks similar. Review each one;
   confirm, re-source or withhold it.
2. **Colonnade A/D/E/G/H.** These need a shaded-module generator and verifier support for grey (luminance 0.5–0.7)
   joints.
3. **Web sources.**
   - Blu 04/07/08/10 and the current Aberdeen pattern sheets, from the current Techo images (built-in browser only; stop
     on any challenge).
   - The Oaks resource PDFs and Unilock `lp_*` PDFs, hash-logged.
4. **Remaining Techo items** from the outer `outputs/deckcraft-techo-source-recovery-handoff.md`: Linea, Mista, Pure,
   Villagio, Sleek 03, Borealis 07 and others.
5. **Cosmetic, pre-existing.**
   - The selected patio's Move chip covers its name label in plan.
   - The phone zoom bar covers the bottom dimension label.

## Commands and runtimes

Run commands from the repository.

- Node: `C:/Users/yorki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`.
- Python: the matching `dependencies/python/python.exe`; Shapely lives in outer `work/shape-python-deps`.
- Git: `dependencies/native/git/cmd/git.exe`.
- npm: `C:/Program Files/nodejs/npm.cmd`.

```text
node scripts/import-deck-landscape-catalogue.mjs --evidence-dir=C:/Users/yorki/Documents/Codex/2026-09-26/so/outputs/deckcraft-landscape-catalogue --validate-only
python scripts/audit-hardscape-line-accuracy.py
node node_modules/tsx/dist/cli.mjs scripts/check-deck-landscape-catalogue.ts
node node_modules/tsx/dist/cli.mjs scripts/check-deck-patio-inlays.ts
node node_modules/tsx/dist/cli.mjs scripts/check-deck-hardscape-shapes.ts
node node_modules/tsx/dist/cli.mjs scripts/check-deck-yard-elevations.ts
node node_modules/typescript/bin/tsc --noEmit
npm run check:deck
```

**Building.** Outer `work/rebuild-continuation.ps1` builds with postbuild hooks off, then runs the publication checks and
the bundle guard. It then copies the 4319 tab's old hashed chunks back (`work/build-snapshots/merged-4319.txt`). Before
any standalone guard re-run, run `work/unmerge-4319-chunks.ps1`.

- Caps: route JS 270, worker 205, CSS 12, viewer 340, PDF 150 KB gzip. Do not raise them.

**Browser runs.** `work/run-continuation-e2e.ps1 -Tag <t> [-Specs …]` runs each spec against 4320 with a unique `--output`.

**Verifier.** From outer `work/source-face-verifier`:

- `python verify.py claims/<batch>.json` runs one batch.
- `tmp/run_final.py` runs every batch with one verifier version.
