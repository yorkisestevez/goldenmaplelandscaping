# DeckCraft new look: merging the AI Studio prototype into the real app

2026-10-31. Source: `~/Downloads/deckcraft-by-golden-maple.zip` (AI Studio Build app made from
`AI-STUDIO-PROMPT.md`). Base: origin/main 97d0bc1e. Work: worktree `.claude/worktrees/new-shell`, branch
`feat/deckcraft-new-shell`.

## 1. What the zip is

- **Homeowner screens** follow the prompt: a full-bleed scene, a top bar (logo, project chip with a save dot,
  3D · Plan · Framing, Undo, Redo, ⋯, gold Send), a left rail (Shape, Boards, Stairs, Yard, Extras) with a docked
  360 px panel, a bottom view bar (camera, Day, Lights, season, More), a price pill with a review badge, a docked
  quote panel, a selection bar, a phone dock with a half-height drawer, and every dialog.
- **Pro screens** are a near-copy of a commercial landscape CAD program: its window title, ribbon tabs (Main,
  Building, Terrain, Landscape, Water Features, Swimming Pool, Utilities, Modeling), left tool strip, right "Add …"
  inspector, compass puck, Plan / Perspective / Walkthrough tabs and the click-hint status bar.
- **Everything is fake:** its own toy 3D, sample prices and local state. Nothing in it reads or changes a real
  design, so it cannot be dropped in; it is a picture of the target.

## 2. What must not come across

1. **Competitor branding:** the zip copies that program's window title (product, year, maker and file type), its
   renderer overlay and its walkthrough tooltip. We copy layout habits, never names, wording or icons (same rule as
   the 2026-10-04 Pro shell).
2. **Features shown that DeckCraft lacks or has elsewhere:**
   - Golden hour and night skies already exist as presentation settings (`ProjectFileTools`: "Showcase time of
     day", Day / Golden hour / Night, not saved with the design). Pro already has layers (`ProLayers`, Show / Lock).
   - Missing: eye-level walkthrough, fences and gates. Also in the zip but not asked for: columns, accent strips,
     lot boundary, slope tools, a style "library", and made-up colours ("Dark Hickory", "English Walnut").
3. **Its layout bugs:** the docked panel overlaps the rail; opening the quote blanks the docked panel; the
   selection bar covers the hint chip and shows with nothing selected; it opens in Pro mode.

## 3. Approach

- **The engine stays as it is:** `DeckDesigner` state, `update` / `atomicUpdate`, the nine sections, the 3D
  viewer, the plan editors, pricing, dialogs and the agent interface. Only the screens around them change.
- **Behind a switch until finished:** `?ui=next`, remembered on the device like `?designer=1`, and `?ui=classic`
  turns it off. The new shell is a lazy chunk, so the public route does not grow and the 345 existing browser
  tests keep running on today's screens. The last slice flips the default and deletes the old screens.
- **Nothing gets lost:** each rail panel shows the few big visual choices on top. Under them, "More" holds that
  group's sections exactly as today (`renderSection`), so every field still has a home. The checklist is
  `AI-STUDIO-PROMPT.md` §7 (about 150 controls); a browser test walks it.
- **Rail groups to sections:** Shape → deck, house (tools size, outline, house) · Boards → boards (boards,
  inlays) · Stairs → stairs (stairs, edges) · Yard → backyard (yard, landscape) · Extras → lighting, extras,
  site. The price pill → quote panel (the quote summary + Proposal & files). The estimator embed keeps its own
  price bar and leaves the quote panel out.

## 4. Slices (one PR each, owner review between)

| Slice | Delivers |
|---|---|
| S1 Desktop shell | Switch, top bar, ⋯ file menu, rail + docked panel (sections under More), price pill + quote panel, full-bleed canvas, the view switch in the top bar, the 3D bar restyled as the view bar |
| S2 Quick pickers | Shape tiles + size steppers (number pre-selected), photo board swatches with colour chips, layout and direction tiles, stair layout + mini-plan edge picker, railing tiles, Yard add tiles, Extras tiles |
| S3 Phone | Five-icon dock, half-height drawer (drag 45 % ↔ 90 %), price + Send always visible, View sheet, 14 px labels |
| S4 Pro workspace | The CAD layout from the zip with our name and icons: ribbon tabs grouped by what DeckCraft can build, left tool strip, right properties inspector, compass, Plan / 3D tabs, hint status bar, layers |
| S5 Make it the default | Open in 3D, move the e2e helpers to the new screens, delete the old chrome, bundle budget, one visibility audit |
| S6 Skies | Day / Golden hour / Night in the view bar, from the existing showcase time of day (owner: saved with the design or not) |
| S7 Walkthrough | Eye-level walk mode in the 3D view (about 5.5 ft eye height, walk with keys or touch, back to orbit) |
| S8 Layers | The design's layers (`editorOrganization`) reachable outside Pro, with Show / Lock |
| S9 Fences and gates | Drawn fence runs and gates, in 3D, plan and price. Priced from cited standard rates, listed as unconfirmed and editable per user (owner, 2026-11-03; see section 6) |

## 5. Scope Lock: S1

- **Objective:** "combine our work with this … make it look even better and make more sense, miss no capability".
- **Acceptance:**
  1. WHEN `/deck-designer/?ui=next` loads on a desktop THE SYSTEM SHALL show the scene full-bleed with the top bar,
     the five-group rail and the price pill, and no old header, tab row or price bar.
  2. WHEN a rail group is picked THE SYSTEM SHALL dock its panel beside the scene, holding that group's sections,
     each with its full editor.
  3. WHEN the price pill is picked THE SYSTEM SHALL open the quote panel (summary, Edit links, still-to-quote,
     Send, PDF, link, Proposal & files); Send opens the existing Send dialog.
  4. WHEN ⋯ is picked THE SYSTEM SHALL offer Save, Open, Share link, Export / Import project ZIP and Start over,
     plus "Go back to my own design" and "Download previous design" when they apply.
  5. WHEN the switch is off THE SYSTEM SHALL render today's page unchanged (existing e2e green).
  6. The route's first-load JS stays inside `scripts/check-deck-bundle.ts`.
- **Must not change:** prices, the design file, autosave, share links, leads, the agent interface, Pro mode.

## 5b. Scope Lock: S2 (owner go-ahead 2026-11-01)

- **Objective:** the same, for the panels: "make it look even better and make more sense, miss no capability".
- **Acceptance:**
  1. WHEN a rail group opens THE SYSTEM SHALL show its quick picks first and its sections, folded, under "More";
     opening a section row shows its full editor as today.
  2. Shape: shape tiles apply `chooseShape`; Width, Depth and Height steppers select their number on focus, commit a
     typed value on Enter or blur, clamp to the editor's limits and are disabled where the editor is; connection
     (Attached, Freestanding, Floating, Add-on); levels 1 · 2 · 3 with the editor's patch (off for a custom outline).
  3. Boards: collection photo swatches (`collectionPatch`), colour chips, layout tiles, border rows and fasteners,
     through `selectPatch`. DeckCraft has no separate board-direction field: Straight / Diagonal is the direction, and
     single-board angles stay in the plan's board tool.
  4. Stairs: flights (none, 1, 2, 3), layout tiles when there is a flight, a mini-plan side picker over the sides
     `availableStairSides` allows (picking a side follows it, clearing a picked edge), a stair-width stepper and the nine
     railing styles. A drawn stair path keeps its own editor.
  5. Yard: add a patio, wall, water feature or fire feature (`newYardFeature`, the new one selected); Patios & walls and
     Landscape areas open their plan tools; fire pit, kitchen, turf and yard-lighting allowances with BackyardStep's patch.
  6. Extras: post and step lights (disabled as in SimpleLighting), add a privacy screen (same limits), remove an existing
     deck, and the three foundations.
  7. The classic page is unchanged (existing e2e green) and the route stays inside `scripts/check-deck-bundle.ts`.
- **In:** `designer/next/QuickPicks.tsx` (+ CSS), HomePanel (quick slot, More heading), DeckDesigner (the slot; new-look
  groups open folded), `deckShapeActions.ts` (`SHAPES`, `levelsPatch`, shared with DimensionsStep), `backyard.ts`
  (`yardAllowancesPatch`, shared with BackyardStep), the new-look spec.
- **Out:** price effects on tiles (the pill updates live), quick picks for corners, wrap, house, pergola, skirting,
  under-deck and accessories (all under More), the phone layout (S3).
- **Must not change:** prices, the design file, autosave, the classic page, the agent interface, Pro mode.

## 5c. Scope Lock: S3 (owner go-ahead 2026-11-01)

- **Objective:** the same, on phones (AI-STUDIO-PROMPT.md §5 "Phone").
- **Acceptance (≤ 800 px, new look only):**
  1. WHEN the page opens THE SYSTEM SHALL show a top bar with the logo, 3D · Plan, Undo, Redo and ⋯ only; Framing
     moves into ⋯ as "Framing view"; nothing in the bar overlaps.
  2. The price and Send sit in one row above the five-icon dock and stay visible and uncovered whatever is open; the
     price opens the quote, Send opens the Send dialog, the review badge stays reachable.
  3. A group or the quote opens as a drawer at about 45 % of the screen height above that row; its handle drags it up to
     about 90 % (of the space under the top bar) or down to close it, and tapping the handle toggles the two heights.
  4. In 3D the view bar folds into one View button that opens it as a sheet above the price row; tapping View again
     closes it.
  5. On the plan the inspector card does not open by itself, and the zoom controls clear the price row.
  6. Desktop and the classic page unchanged (existing e2e green); the route stays inside its budget.
- **In:** nextShell.css (phone block), NextShell.tsx (phone Send in the price row, View button, drawer handle,
  sheet keys), DeckDesigner (view-sheet state, Framing in ⋯, the handle slot), HomePanel (handle slot), PreviewPanel
  (no auto-open on phones), `e2e/next-ui.ts` (shared helpers), `e2e/deckcraft-next-phone.spec.ts`.
- **Out:** plan labels of at least 14 px. Plan text is sized in drawing units and reads 7–9 px on a phone; reaching
  14 px means zooming the plan in or reworking label layout in the plan the classic page shares, so it goes to the
  owner as a decision. The 3D viewer itself (its chunk is at its budget).
- **Must not change:** prices, the design file, desktop layout, the classic page, Pro, the agent interface.

## 5d. Scope Lock: S4 (owner go-ahead 2026-11-01, "go to s4 now")

- **Objective:** Pro mode in the zip's CAD layout "with our brand and only real tools" (§6). Behind the switch: Pro with
  `?ui=next` gets it; Pro without the switch stays as today until S5.
- **Acceptance (desktop, `?designer=1&ui=next`):**
  1. WHEN the page opens THE SYSTEM SHALL fill the window with no page scroll: a title bar (DeckCraft Pro, the
     project and save state, the menus, Files, Presets, Agents, Send), the ribbon, a left tool strip, the drawing in the
     middle, the inspector on the right, a bottom bar (Plan · 3D · Framing, Layers) and the status bar (tool hint and
     keys). No classic header and no bottom price bar.
  2. The ribbon's tabs follow what DeckCraft builds (Home, Deck, Stairs & rails, House, Yard, Terrain, Documents), with
     Undo and Redo always at its start; every button of today's Pro ribbon is still on it (the sheets move to the bottom
     bar), plus the four wizards from Tools.
  3. The inspector shows the picked subject's areas as tabs, one full editor at a time (the deck also has its
     Information), and at its foot the live price with today's price-bar actions, Proposal PDF and Permit set.
  4. In 3D a compass-style puck at the drawing's lower left picks the four real cameras (Corner, Overview, Front,
     Above); Day / Night and Preview lights sit in the bottom bar.
  5. The tool strip keeps Select parts, Shape & points, Deck size and the plan's own pan, zoom and fit.
  6. Pro without the switch, the homeowner new look and the classic page are unchanged (existing e2e green); the route
     stays inside `scripts/check-deck-bundle.ts`.
- **In:** `pro/` (title bar, CAD ribbon tabs, inspector tabs + price foot, camera puck, `proCad.css`), PreviewPanel and
  DeckDesigner hooks (the `cad` flag, `data-ui=cad`), a new `e2e/deckcraft-pro-cad.spec.ts`.
- **Out:** free orbit or a true-north compass (the viewer chunk is at its budget; the puck uses the camera presets), the
  zip's fake tools (rotate, line, curve, grid, magnet snaps, style library, fences: S9), walkthrough (S7), phones (Pro
  stacks at ≤ 800 px: ribbon scrolls sideways, inspector under the drawing).
- **Must not change:** prices, the design file, autosave, the agent interface, what each menu, ribbon and section
  action does.

## 5e. Scope Lock: S5 (owner 2026-11-01, "lets work towards the finish line")

- **Objective:** the new look becomes the page everyone gets (homeowner and Pro), and the old screens go.
- **Order (each step its own commit, stacked on PR #213):**
  - S5a: flip the switch's default (new look on; `?ui=classic` stays as a temporary escape while S5 runs) and move every
    browser test to the new screens. The failing-test list from one full run with the default flipped is the work list.
  - S5b: delete the old chrome (homeowner header, tab row and bottom price bar; the non-CAD Pro shell's layout),
    `?ui=classic` and the tests that only covered them. The estimator embed keeps what it renders.
  - S5c: prerender the new look (no flash of the old page) and open in 3D, inside the bundle budget (S5b frees room).
  - S5d: one fresh-context review and one contrast audit across the new screens.
- **Acceptance:**
  1. WHEN `/deck-designer/` loads with no switch THE SYSTEM SHALL show the new look (homeowner) or the CAD workspace
     (`?designer=1`), prerendered, opening in 3D where WebGL works and on the plan where it does not.
  2. No old header, tab row or bottom price bar remains in the source; the estimator embed still works.
  3. Every capability the old screens reached is reachable in the new ones (the full browser suite, moved over, green).
  4. Route JS, CSS and the viewer stay inside `scripts/check-deck-bundle.ts`.
- **Must not change:** prices, the design file, autosave, share links, leads and their consent, the agent interface.

## 5f. Scope Lock: S6 (owner 2026-11-03, "Start S6"; sky saved with the design)

- **Objective:** the 3D view bar offers Day / Golden hour / Night, and the pick is saved with the design like Day and
  Night already are.
- **Found:** Day / Night is the saved `sceneLighting` ('Daylight' | 'Evening') with its own bar toggle. Golden hour is
  only the showcase presentation hour (not saved), and it draws only with the realistic grade on.
- **Acceptance checks:**
  1. The view bar (new look, CAD bottom bar, classic) shows Day, Golden hour and Night; the picked one is pressed.
  2. Golden hour is saved: `sceneLighting: 'Golden'` survives a reload, a share link and the project file; older saves
     and their prices are unchanged; the price does not move when the sky changes.
  3. Golden hour draws in the live editor (low raking warm sun, warm sky) with or without the realistic look; Night
     and Day draw as before.
  4. A presentation hour (`?deck-hour`, Showcase time of day) still wins over the design's sky for stills.
  5. The assistant can set it (agent options), phone bar fits at 375 px with 44 px targets, contrast AA, budgets hold.
- **In:** types, designPersistence enum, agent options, showcaseMode (design hour + effective hour), Environment3D,
  Sky3D, plantContactDecals, grade hour, SceneRenderQuality dataset, PreviewPanel day/night group, bar CSS, a new e2e
  spec. **Out:** fly-through time-of-day, photo mode looks, GA4 events, proposal cover hour.
- **Must not change:** Day and Night rendering, old saves' look and price, the showcase stills' controls.

## 5g. Scope Lock: S7 (owner 2026-11-03, "Start S7")

- **Objective:** an eye-level walk mode in the 3D view: about 5.5 ft eye height, walk with keys or touch, back to orbit.
- **Acceptance checks:**
  1. A "Walk" button sits with the camera buttons (new look bar and phone View sheet, CAD puck, estimator studio).
     Pressing it stands the visitor in the yard about 10 ft in front of the deck, at 5.5 ft eye height, looking at it.
  2. W A S D / arrow keys walk and turn (Shift runs), dragging looks around; on touch, a pad of 44 px hold buttons
     walks and turns. Keys used by walking do not reach the designer's shortcuts while walking.
  3. The walker follows the ground, climbs stairs (a step up of 9 in at most), does not walk through the house,
     railings, walls or off a drop of more than 2 ft.
  4. Esc, "Stop walking" or another camera button returns to the orbit view exactly as it was.
  5. Nothing is saved with the design; the 3D viewer chunk and route budgets hold (no raise without the owner).
- **In:** a lazy walk chunk (in-canvas controller), a lazy DOM pad, PreviewPanel camera groups, the viewer's walk prop.
  **Out:** saved walk paths, fly-through, GA4 events, head-bob, collisions with plants' canopies.
- **Must not change:** the orbit cameras and controls, the designer's keyboard shortcuts outside walking.

## 5h. Scope Lock: S8 (owner 2026-11-03, "Start S8")

- **Objective:** the design's layers (`editorOrganization`) reachable outside Pro, with Show / Lock (§4 row S8).
- **Acceptance checks:**
  1. The homeowner page's ⋯ file menu (desktop and phone) has a "Layers" fold listing every layer with Show and Lock.
  2. Show / Lock there is the same change Pro makes: validated, one undo step, honoured by the plan, 3D and editors.
  3. "Manage layers & groups…" closes the menu and opens Yard → Pools & backyard at the full layers editor.
  4. While nothing is on a layer yet, the fold says so (Show / Lock would change nothing).
  5. Pro's Layers control behaves as before (its spec passes); route JS / CSS budgets hold with no raise.
- **In:** one shared lazy layer list (Pro's popover and the menu fold), DeckDesigner's menu extra.
  **Out:** new layer kinds, auto-layering objects, renaming / deleting layers, a layers button on the canvas.
- **Must not change:** what layers do; the full editor in Pools & backyard; Pro's control and its placement.

## 5i. Scope Lock: S9 (owner 2026-11-03, "Start S9")

- **Objective:** drawn fence runs and gates, in 3D, plan and price (§4 row S9), priced from cited standard rates,
  listed as unconfirmed and editable per user (owner ruling 2026-11-03, §6).
- **Owner picks (2026-11-03):** five styles: wood privacy (pressure-treated or cedar), horizontal cedar, vinyl privacy,
  black aluminum picket, chain link. Rates at the midpoint of HomeStars' 2026 Canadian installed ranges. Heights 4, 5
  and 6 ft (6 ft default and the guide's base; each foot shorter about 11.5% less, the guide's per-foot step applied down).
- **Source:** HomeStars, "How Much Does Fence Installation Cost in Canada in 2026?", updated 2026-08-21
  (homestars.com/gardening-outdoors/price-guides/fence-installation-cost). Installed per lf: chain link $15–25,
  pressure-treated $27–45, cedar $45–85, vinyl $35–65, aluminum $45–90; single walk gate $400–1,500, double swing
  $800–3,500; each extra foot of height +8–15%. Midpoints: $20, $36, $65, $50, $67.50; gates $950 and $2,150.
  Horizontal cedar has no row of its own: it uses the cedar midpoint (unconfirmed).
- **Model:** `fences?:Fence[]` on the design (not a yard-feature kind: the wall code assumes walls throughout). A fence
  is a named open run of plan points in world inches (`xIn`, `zIn`, the site model's frame), a style, a height and gates
  placed by distance along the run (single 4 ft, double 10 ft). The fence's price counts the run less its gate openings.
- **Size:** checks, pricing and geometry live in a lazy fence runtime loaded for designs with fences (the
  `designExtensions` pattern, so the price worker gets it too); 3D is a lazy chunk mounted from the lazy Landscape3D
  chunk; editors are lazy. No budget raise.
- **Sub-slices (each its own local commit):**
  - **S9a** model, saved-design checks, price rows (Yard · Fence …), per-user rates (in the hardscape rate settings,
    owner cost editor), `rateConfidence` entries, the editor in Pools & backyard (add, name, style, height, points, gates),
    and the fence on the plan drawing.
  - **S9b** drawing and editing a run on the plan (point handles, like a wall path), gates placed on the plan.
  - **S9c** the 3D look for each style, with posts, rails, boards or pickets, gates, following the ground.
  - **S9d** a Fence tile in the new look's Yard picks, the Pro ribbon tool, layers and locks, the agent's commands.
- **Acceptance (whole slice):**
  1. A homeowner adds a fence, picks its style and height, shapes the run and adds gates, on the plan and in 3D.
  2. The price shows each fence as a Yard line (run less gates × rate × height step, plus each gate) and changes when the
     style, height, run or gates change; the rates are editable per user and listed by `npm run deck:rates` as unconfirmed.
  3. Designs with fences save, reload, share, import, undo and redo; designs without fences load no fence code and
     price exactly as before (legacy parity unchanged).
  4. Route JS / CSS, viewer and worker budgets hold with no raise.
- **Out:** fence permits or by-law checks, slopes (stepped or racked runs priced extra), removal of an old fence,
  pool-code gates, ornamental iron and composite, automated gates, neighbour cost sharing.
- **Must not change:** any existing price, the wall and patio tools, designs without fences.

## 6. Decisions (owner, 2026-10-31)

- Pro mode: the zip's CAD layout (ribbon, tool strip, right inspector, compass) with DeckCraft's name, icons and
  wording, and only tools DeckCraft has. Replaces today's Pro shell.
- Rollout: behind the `?ui=next` switch until finished, then flip for everyone.
- The zip's extras: build them too (slices S6–S9).

- 2026-11-01 (S3): plan labels of at least 14 px on phones by zooming the plan in, not by reworking label layout.
- 2026-11-01 (S5a): on phones a drawing tool's own controls open as a drawer above the price row, with the plan zoomed
  onto the deck in the space above it (replaces S3's "the inspector never opens by itself on phones" for every tool but
  Deck size, Stairs and House). Built: `useLayoutEffect` open rule in PreviewPanel (so the plan measures the space the
  drawer leaves), `phoneArea` bottom = the drawer's top, phone CSS (bar above the price row → 42 dvh / 360 px drawer,
  zoom controls ride above it); new @phone test, red then green. With the drawer open the plan also fits the whole deck
  and its stairs in that space (`openArea().fit`; it may zoom out a little, labels then read under 14 px); without it
  the S3 14 px opening zoom stands. The plan-tool strip scrolls a tool chosen elsewhere into view.
- 2026-11-02 (S5c order): S5b first. The new look's styles must ride with the prerendered page and the route CSS had
  0.6 KB of 12 KB left (nextShell.css alone is 4.7 KB gzip); deleting the old screens frees that room. If it still does
  not fit, show the measured overage before changing anything (no budget raise yet).
- 2026-11-02 (S5c 3D): desktops with WebGL open in 3D; phones keep opening on the plan with the drawer (no 3D viewer
  download at load on phones).
- 2026-11-03 (S6): the sky a homeowner picks (Day / Golden hour / Night) is saved with the design, like Day and Night.
- 2026-11-03 (rates not yet defined, S9 fences and gates and anything else): "use standard rates for what we haven't
  defined and add a note for when the software is finished to address it properly, either way that should be
  customisable". So:
  - Price undefined items from a cited industry benchmark (Ontario/Canadian retail or published installed rates), with
    the source and date beside the rate in code.
  - List each one in `rateConfidence.ts` as `unconfirmed`, so `npm run deck:rates` shows it in the finish-line rate
    review.
  - Make each rate editable per user in the owner cost editor, as featureLabour and hardscapeLabour already are.
  - Finish-line item: review every `unconfirmed` rate with the owner before calling DeckCraft finished.

## 7. Progress

- 2026-10-31: zip unpacked and run (scratchpad `aistudio-proto`, preview `aistudio-proto` on port 3015);
  worktree made from origin/main and `npm ci` done.

- 2026-10-31 S1 built (uncommitted, worktree `new-shell`):
  - `designer/uiMode.ts` (switch), `homeTabs.ts` `NEXT_TABS`, lazy `designer/next/NextShell.tsx` (top bar, rail,
    price pill) and `nextShell.css` (all rules scoped to `[data-ui=next]`).
  - Small hooks in `DeckDesigner`, `PreviewPanel` (`next`: no sheet head; the inspector opens off the plan only
    for a selection), `PlanToolPicker` (`flat`: every tool, one word each, full accessible names), `HomePanel`
    (`onSchedule`), `WorkspaceTools` (`compact`, `extra` for the project ZIP tools).
  - `e2e/deckcraft-next-shell.spec.ts`: 7 tests, red before, green on the dev server.
- 2026-11-01 S1 verified on the production build: tsc 0, `npm run lint` 0, deck bundle OK (route JS 275.8/277 KB,
  CSS 11.4/12 KB), full e2e 351 passed / 2 skipped / 1 failed (`context-menu` right-click, then 9/9 alone: a load
  flake on a path S1 does not touch), new-look + classic home-tab specs 19/19. Contrast audit (headless Edge, desktop
  and phone, start / Boards / quote / file menu): 0 below WCAG AA after fixing the open file-menu button (white on stone
  while hovered).

- 2026-11-01 S2 built (uncommitted, worktree `new-shell`):
  - `next/QuickPicks.tsx` (+ `quickPicks.css`), its own lazy chunk fetched when the new look turns on. Shape: shape
    tiles, Width / Depth / Height steppers, connection, levels. Boards: colour chips, layout tiles, border, fasteners,
    then the collection photos. Stairs: flights, layout tiles, a mini-plan side picker, stair width, nine railing tiles.
    Yard: add a patio / wall / fire / water feature, Patios & walls and Landscape areas on the plan, fire pit, kitchen,
    turf, yard lighting. Extras: post and step lights, add a privacy screen, remove an existing deck, foundation.
  - Shared with the full editors so both write the same design: `SHAPES`, `levelsPatch` (deckShapeActions.ts),
    `DECK_TYPES` (optionGroups.ts), `yardAllowancesPatch` (backyard.ts). HomePanel takes a `quick` slot and puts the
    sections under "More"; new-look groups open folded.
  - Independent review (4 lenses, 2 skeptics per finding): 43 findings, 37 upheld, merged into 11 fixes: groups opening
    expanded after a plan tool or Start over, a re-tapped railing tile dropping a manufacturer railing (picking the
    current choice now does nothing, as a select does), the stepper rounding and writing on a bare blur, an invisible
    pressed + disabled label, a weakened source check, "Rails & screens" (out of scope, switched the panel; removed),
    label-in-name, the mini plan's house, Boards order, CSS polish. Six regression tests added.
  - Re-review of the fixes (2 lenses, 2 skeptics each): 9 of 11 confirmed; 8 small items fixed: the share-link path
    still reopened Deck expanded (closeSections now reads the switch through a ref, since useDeckDesign keeps the
    first render's callback), a group brought forward by a plan tool now counts its visit, arrow keys step from a typed
    number, the preload honours Save-Data, the release check reads every allowance control from BackyardStep, and four
    tests tightened or added (readable locked choice, Boards order, label-in-name, the house on a wrap-around, a shared
    link opening folded).
  - Verified: tsc 0, `npm run lint` 0, deck bundle OK (route JS 276.1/277 KB, CSS 11.4/12 KB), contrast 0 below WCAG
    AA across 16 states (desktop and phone: start, the five groups, quote, file menu). Full e2e on the final build:
    364 passed / 2 skipped / 1 failed (`google-page-views` call-click timing, 6/6 when rerun alone; code this slice does
    not touch), the 20 new-look tests among the passes.

- 2026-11-01 S3 built (uncommitted, worktree `new-shell`), phones ≤ 800 px:
  - Top bar: logo, 3D · Plan, Undo, Redo, ⋯; Framing is "Framing view" in ⋯ (focus returns to the menu button). At
    ≤ 380 px the gaps and buttons shrink so a 320 px phone fits, and the menu stays inside the screen.
  - Price row: the total (its "Planning estimate" label kept for screen readers only) and Send, above the dock.
  - Drawer: 45 % of the screen; `next/DrawerHandle.tsx` taps between half and tall, drags to size, snaps to the
    nearer height or closes below 30 %; the grip stays on top while the drawer scrolls; it slides up; it reopens at half
    per group. The quote's focus returns to the price when the drawer is put away.
  - 3D: `NextViewButton` opens the view bar as a wrapping sheet; the button is unmounted under a drawer, without
    WebGL and before the viewer has loaded. The plan's inspector no longer opens by itself on phones; hints and
    Framing's modes span the screen; landscape phones drop the desktop's 520 px floor.
  - Helpers moved to `e2e/next-ui.ts`; `e2e/deckcraft-next-phone.spec.ts` (7 @phone tests, Pixel 7, plus 320 px and
    landscape cases).
  - Fresh-context review: CONCERNS, 15 findings (narrow-phone overlap, a swallowed tap after a touch drag, the grip
    scrolling away, clipped price labels, landscape, cramped Framing modes, focus); all fixed except safe-area
    padding (needs `viewport-fit=cover`, not set on the site) and the inspector rule not re-running on rotation.
  - Verified: tsc 0, lint 0, deck bundle OK (route JS 276.3/277 KB), contrast 0 below WCAG AA across 18 states (adds
    the 3D view, phone sheet open). Full e2e on the final build: 370 passed / 2 skipped / 2 failed; both pass on rerun
    (13/13 with their specs): `google-page-views` consent timing (code this slice does not touch) and the phone price-row
    test, which measured the drawer mid slide-up and now waits for it to land.

- 2026-11-01 S3 plan labels (owner chose zoom): on phones the plan opens zoomed onto the deck and its stairs so the
  smallest labels (6.5 drawing units) read at 14 px, centred in the band between the tools and the price row; Fit still
  shows the whole design. PlanViewport `labelPx` + `openArea`, measured once the new look's layout has settled (a
  ResizeObserver looks again until then). About 210 % on a Pixel 7 for the default deck. New @phone test. Verified: tsc 0,
  lint 0, deck bundle OK (route JS 276.3/277 KB), contrast clean on 18 states, full e2e 372 passed / 2 skipped /
  1 failed (classic 3D mesh-picking under load; 2/2 when rerun alone, a path this change does not touch).

- 2026-11-01 S4 built (uncommitted, worktree `new-shell`), Pro with `?ui=next` (`data-ui=cad`):
  - Title bar = the classic header restyled (it keeps its classes until the Pro chunk's `proCad.css` arrives): DeckCraft
    PRO, the menus, save state, Files, Presets, Agents, Send. Ribbon: Home · Deck · Stairs & rails · House · Yard ·
    Terrain · Documents (every old button but the sheets, plus the four wizards via a `WIZARD_EVENT` the menu bar
    opens), Undo / Redo stacked at its start. Strip | drawing | side column fill the window; no page scroll.
  - Side column: the inspector (the subject's areas as tabs, Information for the deck, the drawing's notes, shape
    shortcuts and framing quantities under the editor), the drawing tool's options (a third at most), then the live
    price (today's price bar) with Proposal PDF and Permit set. Options and price render in PreviewPanel, outside the
    lazy inspector. 3D: a compass puck (Above · Overview · Corner · Front) over the drawing; Day / Night and Preview
    lights in the bottom bar with the sheets and Layers. ≤ 800 px: stacks, the title bar wraps.
  - `check-deck-send.ts` accepts the header's flag-dependent class (still requires Send in the header).
  - Fresh-context review: PASS with notes, 4 IMPORTANT fixed (tool options inside the lazy chunk, price clipped at
    ~700 px tall, phone title bar clipping its menus, Information stuck when the ribbon re-asked for the open area),
    MINOR fixed: shared event constant, opener fallback, named tab lookups, assistant column on phones, focusable
    tabpanel, elevation height. Spec 7 tests (adds 1280 × 700 and Pro-without-the-switch cases); the Information test
    was red before its fix.

- 2026-11-01 S5a in progress (branch `feat/deckcraft-new-default` off `feat/deckcraft-pro-cad`, uncommitted):
  - `uiMode.ts`: the new look is on by default; `?ui=classic` (remembered) turns it off, `?ui=next` clears that.
  - Full run with the default flipped: 194 failed / 186 passed in 49 specs. Causes: the classic "Design" tab row
    (~100), the bottom price bar's "Priced subtotal" status, `.dd-save-state`, the drawing head's h2, classic Pro ribbon.
  - `e2e/nav.ts` made look-aware (`isNextUi`, `railGroups`, `pricedSubtotal`, new-look group mapping in `openHomeTab`,
    sections via `section.open`, CAD ribbon tabs in `pickProTool`): rerun of the failures 145 failed / 49 passed.
  - `deckcraft.spec.ts` local helpers (Send, controls, price, size → project chip) pointed at both looks; running.
  - Specs that test the old screens themselves (deck-home-tabs, deck-homeowner-trim, drawing-room, architect-workspace,
    simple-controls, workspace-space, deckcraft-workspace, deckcraft-pro, deck-contractor-layout/-narrow) are pinned to
    `?ui=classic` with a note; S5b ports what still applies and retires them with the old chrome.
  - Real new-look fixes found by the moved tests: plan-tool buttons and the phone top bar's tabs, Undo, Redo, ⋯ and
    logo are now 44 px targets (they were 40 / 36 px).
  - Test-side: quick-pick tile groups share names with the full editors' selects ("Deck shape", "Board layout", …), so
    tests that read the select ask for the combobox; nav.ts waits for the design before reading which look shows (the
    prerendered page is still the classic one until S5c); `showSheet` reaches Framing from ⋯ on phones;
    `openPriceSchedule` goes through the quote.
  - Full run after those: 60 failed / 320 passed; rerun of the 60 after the next batch: 42 failed. Left: the prerender
    checks (deck-first-paint, expected until S5c); ~15 phone tests where a tool's controls sit in the closed "Drawing
    controls" card, which covers the plan once opened (owner decision asked, below); ~15 desktop one-offs (board taps
    after a section opens, edge labels, pergola select, step-shape hint, stairs slide, house ghost) still to read.
  - Probe: with nothing open, all 28 board hit areas on the desktop plan are reachable; the tests' centring
    `scrollIntoView` slid the drawing under the top bar, so those helpers now scroll only as needed.
  - Phone top bar is 70 px tall with 44 px controls (`--nx-top` 64 → 70).
  - Desktop finding (probe, 1280 × 720): with a group panel open, the panel covered the deck's left edge, its corner
    points and the left stair spot, and the controls card covered the right. Fixed in nextShell.css: the plan's paper
    fits the space the floating controls leave (`--nx-plan-left/right`: rail 120 px or panel 504 px; card 356 px or
    quote 436 px; under the top bar, above the plan tools and hint), so it re-fits beside whatever opens; the zoom
    controls keep to the paper's corner; the plan tools centre on the paper and scroll sideways when it is narrower.
    Re-probe: 0 of 17 outline handles and 0 of 7 stair marks covered. The controls card does not re-fit the drawing (it
    opens on a selection, and a right-click then found the deck moved from under the pointer); panels and the quote do.
  - Full runs: 344 → 350 → 356 → 362 passed (19 failed) as the fixes landed.
  - Plan editing on the new screens: the edge editor keeps clear of the top bar, the phone plan tools and an open
    controls card (PlanBoundaryEditor `roof` / `wall`); a phone's plan no longer re-fits on the outline tool's first open
    (fitTokenSeen starts at the current token when `labelPx` is set), and the drawer fit leaves 72 px for the edge
    dimensions; desktop zoom controls sit at the paper's upper-left corner (the card covers the right, zoomed decks
    reach the lower left). The phone navigation test reads zoom-out as 80 % of the opening zoom.
  - Full run 2026-11-02: 361 passed / 20 failed / 2 skipped. Left: deck-first-paint ×2 (until S5c), texture-ready
    (3D load timing, seen flaky), and ~17 precise plan gestures (phone touch drags and pulls, board taps beside the
    assistant dock, the edge editor in tight space, a pergola drag, the step-shape hint, deckcraft 564/1244/1388/1553).
  - Committed 79b9315a (local, not pushed). Gesture pass 2026-11-02, probes of each failure turned up real problems:
    - Desktop/tablet: the open controls card covered the deck's right side (820 px tablet: its corner points; 1280: the
      stone steps a selection opened it for). The plan now insets beside an open card too (`.dd-preview[data-card]`,
      PreviewPanel cardInset): always for a tool's card; for a card only a selection opened, only when the pick sat where
      the card now is (else a right-click → Escape → right-click at the same spot missed the deck, context-menu:10);
      once aside it stays until the card shuts; changes mid-press wait for the release. Visitor fold/unfold counts as
      a tool's card.
    - Phone: edge labels pushed past the zoom controls landed under the drawer. Labels and the edge editor now share one
      clear band (PlanBoundaryEditor clearBand: under the top bar and tools, left of a right-side card, above the drawer,
      price row and dock).
    - Phone: a selection opened the drawer over what was picked (steps' resize handle). On a phone's plan a selection
      now leaves the drawer folded; its bar names the selection. Tools still open it; 3D still opens it.
    - Phone: no page scrolls behind the plan, so a swipe did nothing. A one-finger swipe over bare drawing now pans it
      (PlanViewport swipeable; viewport touch-action none); controls and editors that own their touches keep them.
    - CAD on ≤800 px: the assistant kept grid column 2 and crushed the drawing to 0 px; it now stacks under the drawing.
    - 3D: the pergola card sat over the pergola when a panel was open; it now sits on the right (left of an open card).
    - Test-only: 3D delete test projects through the real orthographic Above camera; toolRow reads the accessible name
      (the strip shows "Rails"); a 43.99 px tolerance for zoom-scaled handles; the label-stability pan starts on bare
      drawing; the phone yard draw fits, folds the drawer while drawing, then reopens it; phone swipe tests assert the
      pan / unchanged design instead of page scroll.
    - Failing set + next-shell, next-phone, pro-cad: 77/77 after the navigation port. tsc 0, route 276.3/277 KB.
    - Full run 2026-11-02 (split by project): desktop 285 passed / 2 failed / 1 skipped, phone 92 passed / 2 failed /
      1 skipped. Left: deck-first-paint ×2 (until S5c) and google-page-views:121 (known flaky). The phone swipe test's
      one failure was its own fixed start point landing on the zoom controls; it now finds bare drawing (8/8 repeated).
  - 3D finding (probe): a design with a pergola rendered its preview tools as a full-width band at the top of the 3D
    view, under the top bar (its Select hidden) and pushing the view bar off screen. Now a floating card under the top
    bar beside the rail or open panel (phones: full width under the top bar).
  - **Asked the owner:** on phones, should a tool's controls open as a short drawer above the price row with the plan
    zoomed into the space above (recommended), or stay in the card that covers the plan when opened?
- 2026-11-02 S5a gestures committed locally as d866908d.
- 2026-11-02 S5b + S5c (one working stretch: removing the switch makes the prerender the new look, so they cannot land
  apart; uncommitted on feat/deckcraft-new-default):
  - `uiMode.ts` deleted: the homeowner page is the new look, Designer Mode the CAD workspace; the estimator's studio
    keeps its own screens (and, with Designer Mode on, the older Pro shell).
  - CSS: the old header, price bar, tabs and drawing-focus layout (60 rules) moved from DeckDesigner.css/workspace.css
    into `designer/classicChrome.css`, loaded before the designer renders for the estimator and Designer Mode only
    (piecesReady), lossless (rule-set diff 0/0). nextShell.css now rides with the page; 65 rules for states the first
    paint never shows moved to `next/nextShellLater.css` (with the controls' chunk). Route CSS 11.4 → 11.9/12 KB.
  - Order traps found and fixed: a lazy chunk re-adds DeckDesigner.css after other sheets, so (1) the old header's h1
    weight now outranks the page heading rule instead of relying on order, (2) the phone rules that show the drawer grip
    and View button stay in the page sheet beside the rule that hides them. Equal-specificity tie scan between the two
    new-look sheets: only an open/not-open pair left (never both).
  - Proof: a computed-style snapshot of every element (new look desktop/tablet/phone × start, Materials, Price & send,
    file menu; CAD and the estimator at three widths) matches the pre-change baseline exactly; with JavaScript off the
    later sheet changes nothing on the prerendered page at 1440/820/390.
  - Prerender: the top bar, rail and price pill are `preloadable` and preloaded before hydration; the file menu's
    project tools mount after start. Bundle check now expects 9 streamed boundaries. deck-first-paint: 3/3.
  - CAD's phone zoom: the page's first (homeowner) render gave Designer Mode the new look's phone zoom; leaving labelPx
    now fits again (PlanViewport).
  - Desktop opens in 3D (owner): after hydration, with WebGL, a wide fine-pointer screen not saving data hands the plan
    over to 3D once the viewer has loaded, unless the visitor pressed a key or pointer first. New deck-open-3d.spec
    (4 tests, 12/12 repeated): controls never move, an early click keeps the plan, no WebGL keeps the plan, a phone
    never fetches the viewer. deck_view_3d in GA4 will now count most desktop visits.
  - Pinned specs: deckcraft-pro ported to CAD (8/8), deck-contractor-layout/-narrow ported (2/2), switch tests rewritten
    (the retired switch cannot bring the old screens back). Real CAD bugs found by them: the assistant's stylesheet showed
    the shut keyboard-shortcuts sheet over the drawing (and the menus) with the assistant and an inspector area open;
    the title bar's Files, Presets and Agents were 34 px targets on phones (now 44).
  - Retired with the old screens: architect-workspace, deckcraft-workspace, drawing-room and workspace-space specs and
    the homeowner tab / header / price-bar tests in deck-home-tabs and deck-homeowner-trim. Kept or moved: the tab
    keyboard and any-order tests now run on the estimator (which still ships the tabs); the review-issues test now drives
    the price pill's issues button (nothing covered it); simple-controls keeps its selection-isolation checks on desktop.
  - Test helper `startOnPlan` (e2e/nav.ts): tests written for the plan pick the Plan sheet after each homeowner load and
    reload on desktop (the page used to open there); the click also cancels a late 3D hand-over. 67 loads, 40 reloads.
  - Full suite (run in chunks; the workstation kills long node runs, so interrupted tests were rerun on their own):
    desktop all passed (1 skipped), phone all passed (1 skipped). Fixes on the way: next-shell's locked pick is read once
    settled (it eases colours), the phone stone-step test fits the plan first (the plan opens zoomed onto the deck),
    a phone drawing-focus price-bar test retired (old screen; it passed before only through the old prerender).
  - Source checks updated: check-deck-ledger reads the price bar's rules from classicChrome.css; check-deck-plan-sheet
    knows the viewer is also loaded by the desktop 3D opening.
- 2026-11-02 S5b + S5c committed locally as c2299174.
- 2026-11-02 S5d (uncommitted):
  - Contrast audit (WCAG AA, rendered pixels): the new look (desktop and phone: start, Plan, every group, quote, file
    menu, 3D) and CAD (desktop and phone) 0 findings. The estimator's studio keeps 2 from its older screens: the
    header's "Send my design" white on #bb744b (3.68:1) and the sheet tabs #757870 on #f9f7f2 (4.19:1). Not changed
    (estimator styling, outside S5); offered to the owner.
  - Independent review (fresh context, another model): no critical findings. Fixed: a short phone (375 × 667) with a
    tool's drawer open zoomed the plan to the 15 % floor (dimension room now at most a quarter of the band, fit never
    below 40 %; new @phone test, red then green); the 3D opening never fired under React's development double run
    (re-arms unless settled); a wheel now counts as the visitor starting; the estimator studio imports the old screens'
    stylesheet with its own chunk (a client-side visit from the designer page painted it unstyled); the label band's foot
    used a selector that does not exist (.dd-next-dock → .dd-next-rail) and ignored the folded phone drawer; the inline
    edge editor's height has the same 120 px floor as its max-height; a key press before 3D is ready is tested too;
    a stale test name and comment. Checked, no change: the card inset and open rule, swipe guards, hydration.
  - Reviewer notes left as they are (owner to confirm or later): the desktop plan as a box that steps aside for panels
    and cards (S1–S5a design, reported then); Designer Mode hydrates through the homeowner look and fetches its
    controls (prerender is the homeowner page); arriving at the designer page from the estimator by client navigation
    draws the top bar, rail and price pill a moment late; a 761–800 px desktop window prefetches the viewer but stays
    on the plan (phone layout).
  - Snapshot after the fixes: only the intended differences (desktop and 820 px open in 3D, CAD phone Files 44 px).
- 2026-11-02 S5 committed locally as 96547a85, pushed (owner asked) and opened as PR #218, stacked on #213; Auto-fix on.
  - CI round 1: shard 6 phone yard drag landed on the zoom controls (Linux fonts); the drag now uncovers its handle
    (fit, then fold the drawer, then restore) — 940cc742.
  - CI round 2: four shards hit the 28-minute limit: every desktop test built the 3D scene on CI's software WebGL
    before switching to the plan. Automated browsers (navigator.webdriver, like the tracking gate) now stay on the plan;
    deck-open-3d.spec poses as a visitor and checks the automated case. be4920f0: all green.
  - 2026-11-03 rebalance (owner asked): shard 4 still took 26.0 of 28 minutes (count split kept deckcraft.spec's
    proposal, PDF and night tests together). `scripts/e2e-shard.mjs` now splits by CI times in `e2e/shard-times.json`
    (longest first onto the lightest shard, run via `--test-list`): about 11.5 minutes each. Four test titles lost a
    trailing space (`--test-list` trims). Refresh times with `node scripts/e2e-shard.mjs --record <shard logs>`.
    CI at 238a9c86: all green, shards 12–16 minutes each.
- 2026-11-03 S6 skies, committed locally as 62eb67a3 (owner asked) on `feat/deckcraft-skies` off 238a9c86, stacked on #218, PR #219:
  - `sceneLighting` gains 'Golden' (type, persistence enum, agent options). The view bar's group is "Time of day":
    Day / ◐ Golden hour / Night.
  - The viewer holds `designGolden` in the showcase flags (`holdDesignGolden`, counted per viewer). `sceneHour()` and
    `goldenHour(flags,graded)` decide: the design's golden draws at any quality; a presentation golden hour, as before,
    only with the grade.
  - Without the grade, golden hour keeps the graded look's sun ratio (`GOLDEN_SUN/SHOWCASE_DAY_SUN`) and the warm dome.
  - Fixed on the way: at about 1024 px the view bar's top row overflowed its box (before S6 too); the scene tools now
    shrink and wrap. Phone View sheet targets went from 40 to 44 px.
  - Review (fresh context): the stale source checks in check-deck-realism; a second viewer (the sketch) closing cleared
    the first one's golden sky; stills without the grade turned golden. All fixed, with checks added to
    check-deck-realism.
  - Verified: deck-skies.spec (3), the phone, CAD, landscape and night specs (31 tests), tsc, bundle budgets unchanged,
    browser at 1024/1440 px and in the estimator studio, realistic look on and off.
- 2026-11-03 S7 walkthrough (02954e6e on `feat/deckcraft-walkthrough` off 62eb67a3, PR #220):
  - "Walk" joins every camera group (new-look bar and phone View sheet, CAD puck at 2/1, estimator studio). The
    walk controller (`viewer3d/WalkMode.tsx`, lazy, in the canvas) and the pad (`designer/WalkPad.tsx` + walkPad.css,
    lazy DOM) share `viewer3d/walk.ts` (rules and the pad's held buttons).
  - The walker raycasts the scene's visible meshes (glass included, but not the sky, grass, leaves, glows or pool
    water): down-rays for the floor (9 in step up, 2 ft drop, two treads one radius ahead), waist rays from the centre
    and shoulders, and an up-ray for head room. It starts on the first open ground 10, 8, 12… ft in front of the deck.
  - Found by tests: the look-ahead blocked stairs (it reached two treads); the glass door let the walker into the
    house (see-through materials had been skipped); the phone View sheet covered the pad (now under the top bar on
    phones); the pad's root is a section because the canvas sizes its div children with !important rules.
  - Review (fresh context), fixed: the camera restore ran after the next camera button's own layout effect (now a layout
    effect); keys with modifiers, open dialogs and menus, focused tabs; pool spawn and water; head room; a design change
    leaving the walker stuck (floor re-snaps on refresh); per-frame rays now only test solids near the walker; no
    picking or edit handles while walking; walking from Above (orthographic) starts from Corner; pad Enter/Space; drag
    only with the main button.
  - Verified: deck-walk.spec (4; the stair climb 4 times in a row), CAD and new-look specs, tsc, budgets (3D viewer
    339.9/340 KB), browser: Front after a walk shows Front, a walk from Above, phone layout.
- 2026-11-03 S8 layers (88e15456 on `feat/deckcraft-layers` off 02954e6e, PR #221):
  - The homeowner ⋯ file menu has a "Layers (n)" fold (desktop and phone): each layer with Show and Lock, a note while
    nothing is on a layer, and "Manage layers & groups…" (closes the menu, opens Pools & backyard at the full editor).
  - `designer/LayerList.tsx` (+ layerList.css, lazy) is shared with Pro's pop-over (`ProLayers.tsx` keeps its toggle,
    look and placement). Each change goes through `atomicUpdate`, the same one-step change Pro's `apply` uses.
  - Found by tests: the page's `update` merges quick edits into one undo step, so the menu first undid both at once.
  - Review (fresh context), fixed: the editor search gave up after 60 frames (~1 s), too soon for a phone loading Pools
    & backyard (now a 10 s DOM watch; focus waits on ⋯ meanwhile); the note and error box changed Pro's pop-over (now
    the menu only); the fold has its own Suspense so the project ZIP tools do not wait on it.
  - Verified: deck-layers.spec (4, incl. a 2.5 s held-back editor), Pro, CAD and new-look specs (38), tsc, lint,
    budgets unchanged (route JS 276.5/277, CSS 11.9/12), browser at 1024 px and phone.

- 2026-11-03 S9 fences and gates (78b78441 on `feat/deckcraft-fences` off 88e15456, PR #222):
  - S9a: `fences?:Fence[]` (fences.ts stub; fenceRuntime.ts lazy via designExtensions): checks, Yard price rows (run less
    gate openings × rate × height step, plus gates), per-user rates in hardscapeLabour.fenceRates (owner cost editor),
    three unconfirmed rows in rateConfidence, the editor in Pools & backyard (FenceEditor.tsx), the site plan layer.
  - S9b: FenceShapeEditor.tsx from the Patios & walls tool: Draw fence (bar in the controls card), corner and gate drags,
    arrow nudges, Delete; handles sized in screen pixels (twice as big on touch). S9c: Fence3D.tsx (lazy, mounted from
    the lazy Landscape3D) with a look per style, on the ground. S9d: Fence tile in Yard picks, Fences & gates on both Pro
    ribbons, layers and locks, fences in the agent schema (a whole-design replace had dropped them).
  - Found by tests and browser: autosave refused fences (job library key list); the plan frame left fences off-screen;
    a refused field kept its text; the drawing bar sat over the plan and ate clicks.
  - Review (fresh context), fixed: a cleared owner rate priced fences at $0 and tabbing saved rates (now refused /
    unchanged saves nothing); gates slid along when a corner moved (now kept on the ground: fenceWithPoints); lock check
    on key nudges; gate keys; NaN mid-drag; instanced meshes rebuilt by key; patio drawing off while drawing a fence;
    unique fence names; rate notes in dollars. My "keep fence rates on reset all" change reverted (not asked for).
  - Verified: check-deck-fences (64), agent control (192), legacy parity 213 unchanged, owner costs, IO, links, price
    book, hardscape labour; deck-fences.spec 8/8; Pro, CAD, new-look, yard-shape, layers, quote specs 45/45; tsc; lint;
    budgets unchanged (route JS 276.8/277, CSS 11.9/12, viewer 339.9/340, worker 213.2/213.5); 3D shots of all 5 styles.

## 8. Surprises

- The top bar is not a banner landmark: the site wraps the page in `<main>`.
- With the switch on, the prerendered classic page shows for a moment before the new look loads (the prerender
  cannot read the switch). Goes away in S5, when the new look is prerendered.

- Vite reloads the page when Playwright writes artifacts to a new folder in the worktree (`--output=test-results-x`);
  keep the default `test-results`, which it ignores.

## 9. Deferred

- S6: the Designer Mode stills' "Showcase time of day" select treats Day as "follow the design", so on a Golden design
  it shows Day while the scene draws golden (a presentation Night was already plain day). Photo mode and fly-through
  day frames treat a Golden design as Daylight / golden respectively. A wrapped view bar row keeps its left divider.
- S7: no browser test yet for a pool or raised patio in front of the deck, railings, glass or drops (the default design
  only has stairs and the house wall). Saving a camera or sending a snapshot while walking keeps the walker's eye with
  the orbit target. The 3D viewer chunk has 0.1 KB left.

- Columns, accent strips, lot boundary, slope tools and a style library (in the zip, not asked for).
- Safe-area padding for the phone dock once the site sets `viewport-fit=cover`.
- The drawn-stair-path note in the Stairs picks has no browser test (it needs a drawn path fixture).
- The page repeats `setPlanTool(t);setMode('plan');showCanvas(t)` inline in renderSection; `openPlanTool` could
  replace those copies.
- The deck-type list is still written out in `designPersistence.ts`, `ProWizards.tsx` and the agent options.
- S4: the title bar shows the page heading, not a project name (designs have none; the new look's chip shows the deck
  size). A ribbon wizard clicked before the menu bar's chunk has loaded does nothing. Inspector tabs follow the arrow
  keys (each loads its area). The ribbon opens on the current tool's tab (Deck for Deck size), not Home.
- S8: the "nothing is on a layer" note hides once `objects` has any entry, even stale ids of deleted features. The full
  editor shows every unassigned object on the first layer although unassigned objects ignore Show / Lock. A failed
  layer change shows two alerts (the page's and the list's; Pro had this already). The full editor is found by its
  summary text ("Layers, groups"); a data attribute would be sturdier but touches OrganizationEditor.
- S9: fence boards are flat colours (no photo grain); the Overview and Corner cameras do not frame far fences; gates are
  added only in the side panel (moved on the plan); the height step is linear (4 ft = 23% off, not 21.7% compounded:
  owner to confirm with the rates review); saved fence rates (like setting labour) never reach new jobs because
  customHardscapeLabourDefaults has no callers (predates S9), and a failed defaults read can make Save overwrite the
  stored setting labour with defaults; FenceEditor and the Yard tile report success when the page refuses an edit;
  gate ids are not in assertUniqueObjectIds; fence rates are not in the price-book fingerprint; opening Pools & backyard
  or owner costs loads the fence code with no fences; Pro's Fences & gates opens the same section as Pools & backyard;
  3D, ZIP import and redo have no automated test; slopes, removal and permits are out of scope.
- 2026-11-03 ~19:20 ET (owner: "Merge when green"): #212, #213 and #218 merged to main (merge commits a85ceaf6, cae20149,
  64cddb51), each retargeted to main first; deploys queued. #219 retargeted to main; #219–#222 wait on CI.
