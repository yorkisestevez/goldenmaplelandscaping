# DeckCraft redesign: baseline (R0) and results (R6, R7)

The figures the "Drawing Set" redesign (R1–R7) is measured against. Recorded 2026-09-24 on `feat/deckcraft-r0-prep`, cut from `f2bfb8d` (feat/deckcraft-v2 with F4, F5 and F7; F6 not yet in). R0 changes no rendered output, so the base and R0 columns describe the same page.

## Bundle (production build, gzip)

| | Base `f2bfb8d` | R0 |
|---|---|---|
| Route first-load JS, as `check-deck-bundle.ts` counts it | 180.02 KB (prints 180.0) | 180.16 KB (prints 180.2) |
| of which the route chunk `DeckDesigner-*.js` | 170.67 KB | 170.80 KB |
| of which its other imports (estimatorHandoff 7.20, leadScoring 0.78, SEO 0.76, route entry 0.27, eventId 0.18, projectBudgets 0.17) | 9.36 KB | 9.36 KB |
| Route CSS `DeckDesigner-*.css` | 6.53 KB (32,613 bytes raw) | the same file, byte for byte |
| 3D viewer chunk | 291.3 KB | 291.3 KB |
| PDF engine chunk | 126.0 KB | 126.0 KB |

The route budget is 185 KB, so R0 leaves 4.8 KB. Fonts are not counted anywhere yet: the page uses the site-wide Inter and Cormorant Garamond only.

## Load performance

`node scripts/measure-deck-perf.mjs 5`: Pixel 7, 4× CPU slowdown, Slow 4G, the production build served gzipped by `e2e/static-server.mjs`, median of 5 runs. JS transferred was 699 KB in every run.

| Build | Run | FCP / LCP | Blocking time | Long tasks before the 3D viewer is requested | 3D viewer requested at |
|---|---|---|---|---|---|
| Base | 1 | 2,364 ms | 1,805 ms | 376 ms | 5.3–5.4 s |
| Base | 2 | 1,772 ms | 1,687 ms | 480 ms | 4.5–5.9 s |
| R0 | 1 | 2,620 ms | 2,307 ms | 639 ms | 4.7–5.9 s |
| R0 | 2 | 2,592 ms | 2,431 ms | 637 ms | 4.7–5.6 s |

The same builds measured in alternation (6 runs each, base and R0 taking turns, so load on the machine falls on both alike):

| Build | FCP / LCP median | Blocking time median |
|---|---|---|
| Base | 2,612 ms | 2,420 ms |
| R0 | 2,572 ms | 2,396 ms |

**Baseline for later phases: LCP 2,572 ms and blocking time 2,396 ms** (the R0 medians from the alternating run).

**The noise is larger than the gates.** On this machine, single runs of the same page ranged from 1,448 to 2,700 ms for LCP and from 1,583 to 4,436 ms for blocking time, and the medians of two 5-run sets of the base build differed by 592 ms. The phase gates (LCP no worse than +100 ms, blocking time no worse than +50 ms) are well inside that spread. So compare each phase against a base build measured in the same session, in alternation, rather than against the figures above.

## Rendered output

- The prerendered `/deck-designer/index.html` is identical to the base once asset hashes are masked (39,901 bytes in both).
- `DeckDesigner.css` is byte-identical, with the same hashed file name.

## Tests

- e2e: 28 tests on the base; 29 on R0, the new one being "reaches every feature of the designer". It covers every row of the plan's reachability matrix except F6 deck-part finishes, which has a TODO until F6 lands.
- All layout-dependent locators in `e2e/deckcraft.spec.ts` go through the helpers at the top of the file: `price`, `size`, `schedule`, `quotes`, `summary`, `openSection`, `viewTab`, `contractorView`, `contractorFiles`, `openExterior` and the rest.

## R6: price effect on each option

Recorded 2026-09-24 on `feat/deckcraft-r6-deltas`, cut from `63fdaa7` (R5).

### Engine timing spike

`calculateDeckReleaseEstimate`, bundled on its own for the browser, run in Edge under Playwright's Pixel 7 emulation at 1× and at 4× CPU slowdown (`Emulation.setCPUThrottlingRate`). Each design had one cold run, then 30 warm runs, and the whole spike was run twice. Ranges cover both sessions.

| Design | 1× median / max | 4× first (cold) run | 4× median | 4× p90 | 4× max |
|---|---|---|---|---|---|
| Default deck (16 × 12 ft, $24,388) | 2.2–2.4 / 4.9–6.1 ms | 137–150 ms | 10.5–10.7 ms | 15.9–18.6 ms | 29.7–37.4 ms |
| Two-corner wrap, check-deck-ledger's (22 × 12 ft, 8 ft and 6 ft wings, $81,204) | 6.1–6.5 / 12–15 ms | 78–117 ms | 25.5–27.2 ms | 35–36 ms | 47–54 ms |
| Larger two-wing wrap (30 × 14 ft at 48 in, two 12 × 16 ft wings, glass railing, two flights, one border row, $253,220) | 13.5–13.6 / 20–23 ms | 80–92 ms | 62–63 ms | 77–89 ms | 82–97 ms |

**Phone decision: tap to show.** The two-corner wrap's slowest runs pass 50 ms at 4×, and the larger wrap's median does too. Phones (and any screen without a fine pointer, or with Save-Data) get a "Show price effect" button in each section with option groups. Once tapped it stays on for the visit. Desktops show the deltas without asking.

Pricing single options showed that a herringbone layout is the outlier. In Node, warm, it takes 44 ms on the two-corner wrap and 121–126 ms on the larger wrap, against 9 and 15 ms for the design itself. In the browser on this desktop at 1×, those runs were 55–69 ms and 183–205 ms. One option per idle slice on the page could not keep that under 50 ms. The deltas are therefore priced in a worker (`optionDeltas.worker.ts`), one option per task, and the page only receives each result. The idle-slice runner stays as the fallback wherever a worker cannot start.

### Long tasks attributable to the deltas (desktop)

This harness is `scratchpad/r6/delta-longtasks.mjs` against the production build at 1280 × 900. It loads each design, opens Boards & finish, Stairs & railings and Site & foundation, and waits for every delta. It then picks a collection, so every open option is priced again for the new design, and waits again. The page's work on each result is a user-timing measure (`deckcraft-option-delta`). A long task counts as the deltas' when it contains one.

| Design | Results | Page work per result (median / max) | Long tasks after settling | Attributable to deltas |
|---|---|---|---|---|
| Default, 1× | 114 | 0.3 / 6.1 ms | 0 | 0 |
| Two-corner wrap, 1× | 114 | 0.4 / 0.7 ms | 0 | 0 |
| Larger wrap, 1× | 114 | 0.4 / 0.9 ms | 1 (73 ms, the page's own re-estimate after the click) | 0 |
| Default, 4× | 114 | 1.6 / 6.3 ms | 1 (105 ms) | 0 |
| Two-corner wrap, 4× | 114 | 2.7 / 4.9 ms | 1 (162 ms) | 0 |
| Larger wrap, 4× | 114 | 3.1 / 11.8 ms | 2 (56, 556 ms) | 0 |

With the pricing on the page, before the worker, the same run at 1× had two attributable long tasks on each wrap: 69 and 55 ms, and 205 and 183 ms. Both were the herringbone option, once per design.

### Load (hermetic A/B against `63fdaa7`)

The harness is `perf-ab.mjs`, with the `measure-deck-perf.mjs` settings: Pixel 7, 4× CPU, Slow 4G, a 12 s settle, trackers answered empty and fonts stubbed. The two builds take turns run by run.

On this machine LCP falls into one of two modes, about 1.2–1.3 s or about 2.0–2.2 s, in both builds alike.

| Run | Base LCP / blocking | R6 LCP / blocking | Within-mode LCP |
|---|---|---|---|
| 5 pairs | 1,344 / 146 ms | 2,124 / 139 ms | fast runs −12 ms (3 base, 2 R6), slow runs +126 ms (2 base, 3 R6) |
| 10 pairs | 2,160 / 264 ms | 2,126 / 200 ms | fast runs +12 ms (2 and 2), slow runs −34 ms (8 and 8) |

The 5-pair medians differ only because base drew three fast runs and R6 two. R6 adds nothing to the first load: 0.11 KB of JS, and no delta runs until a section with option groups is open. Across 15 pairs the builds are level, and CLS was 0 in every run.

### Bundle

| | `63fdaa7` | R6 |
|---|---|---|
| Route first-load JS | 176.41 KB | 176.52 KB |
| Route CSS | 8.54 KB | 8.66 KB |
| `useOptionDeltas` chunk (with the option groups), loaded with the section bodies | – | 2.4 KB |
| `optionDeltas` chunk, loaded once deltas are wanted | – | 1.9 KB |
| `optionDeltas.worker` (its own copy of the engine), started with the first delta | – | 122.5 KB (budget 140) |

## R7: final numbers

Recorded 2026-09-24 on `feat/deckcraft-r6-deltas` after R7: the redesign complete.

### Bundle (production build, gzip) and headroom

| | R0 (`f2bfb8d` + R0) | `2e33ca2` (R2, before the look) | R6 | R7, final | Budget | Headroom |
|---|---|---|---|---|---|---|
| Route first-load JS | 180.16 KB | 172.96 KB | 176.52 KB | 176.75 KB | 185 KB | 8.25 KB |
| Route CSS | 6.53 KB | 7.73 KB | 8.66 KB | 8.64 KB | 12 KB | 3.36 KB |
| 3D viewer chunk | 291.3 KB | – | 291.5 KB | 291.5 KB | 340 KB | 48.5 KB |
| PDF engine chunk | 126.0 KB | – | 126.0 KB | 126.0 KB | 150 KB | 24.0 KB |
| Option deltas' worker | – | – | 122.5 KB | 122.5 KB | 140 KB | 17.5 KB |

R7 adds 0.23 KB of route JS, for the drawer's own focus trap. It removes one unused rule (`dd-contractor-view`). The wizard-era classes the plan listed (`dd-steps`, `dd-navigation`, `dd-intro`, `dd-live-price`, `dd-finish`, `dd-breakdown`) were already gone after R3; `check-deck-ledger` keeps them out. `STEPS` and `stepLabel` stay for the GA4 step labels.

### Load: the redesign against `2e33ca2`

This uses `perf-ab.mjs`: Pixel 7, 4× CPU, Slow 4G, a 12 s settle, trackers answered empty and fonts stubbed, the builds taking turns. It ran twice, with 10 pairs each time.

| | `2e33ca2` | R7 | Change |
|---|---|---|---|
| LCP median, first 10 pairs | 2,040 ms | 2,158 ms | +118 ms (two base runs fell between the modes, at about 1,950 ms) |
| LCP median, second 10 pairs | 2,100 ms | 2,120 ms | +20 ms |
| LCP median, all 20 pairs | 2,100 ms | 2,128 ms | +28 ms. Within each mode: +2 ms (fast runs, 4 and 3) and +20 ms (slow runs, 16 and 17) |
| Blocking time median, all 20 pairs | 1,296 ms | 104 ms | −1,192 ms |
| JS transferred | 715 KB | 442 KB | −273 KB: phones fetch 3D only when the 3D tab is chosen |
| CLS | 0 | 0 | – |

### Contrast, touch and layout

The audit (`scratchpad/r6/r7-audit.mjs`) ran from the worktree against the production build, and was deleted afterwards. It used the visibility-audit script in strict AA mode, and also checked for controls and plan handles under 44 px, text under 11 px, SVG plan text under 4.5:1, gold plan graphics under 3:1, sideways scroll and console errors.

It covered 375, 390, 412, 768, 1280 and 1536 px. At each width it checked the first screen, every section open (with the option deltas shown; phones tapped "Show price effect"), the price schedule (the column from 1280 px, the drawer below), the pinned drawing on phones, the 3D sheet, and the Framing sheet with each of its views. That is 105 states, with **0 issues**.

### Phone pass (375, 390, 412 px)

- **The pinned drawing** stays at the top while you edit: 335, 344 and 366 px tall, the plan at 30vh under its tabs and heading. Its handles are 44 × 44 px and there is no sideways scroll. The open section's fields stay visible below it and above the price bar.
- **The price schedule drawer** used to let Tab leave it: from its last button, focus went to the page behind. It now traps focus itself. Focus goes to Close on opening, Tab and Shift+Tab loop, Escape closes it, and focus returns to the price bar. The e2e test checks the loop.

### Tests

- e2e: 48 tests, 46 from R5 plus the two R6 price-effect tests; the phone drawer test now also checks the focus loop.
- Lint runs all check:deck suites, `check-deck-option-deltas` included. Legacy parity (213 designs), the engine snapshot and the price book all pass without `--update`.
