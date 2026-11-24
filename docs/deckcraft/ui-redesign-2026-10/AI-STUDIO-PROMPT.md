# DeckCraft redesign: prompt for Google AI Studio (Build mode)

> How to use: paste everything below the line into a new Google AI Studio **Build** app. It asks for a clickable
> prototype with sample data. The real app keeps its pricing engine, 3D renderer and drawing math; this
> prototype only replaces the screens, so every control carries the code hook it must call when we port it back.
> Mapped from `origin/main` at 97d0bc1e (PR #209), 2026-10-31.

---

## 1. Your job

Design and build a **clickable, high-fidelity prototype** of a brand-new interface for **DeckCraft by Golden Maple**,
a web app where a homeowner draws a deck on their own house, sees it in realistic 3D, adds the backyard around it,
and gets a live, line-item price they can send to Golden Maple Landscaping (Barrie, Ontario) without an account.

The current app works, but it feels like an engineering tool: too much text, too many panels, two navigation systems,
and important choices buried 3–5 clicks deep. I want a **complete change in feel and usability**. Make it:

- **Intuitive**: a first-time homeowner changes the deck colour, size and stairs in under a minute, with no help.
- **Quiet**: almost no text. Pictures, icons and numbers do the talking.
- **Clear controls**: one obvious way to do each thing, big targets, nothing hidden behind hover.
- **Smooth**: the 3D scene never disappears while choosing; panels glide; the camera eases between views.

**Do not invent features.** Every control the prototype shows must come from the control map in section 7, and every
control in that map must exist somewhere in the prototype (the ones marked **Pro** only in Pro mode). You may
regroup, rename for clarity, merge and hide controls behind "More", but keep the **accessible name** given in quotes
as the control's `aria-label` (our automated tests find controls by those names).

## 2. Tech for the prototype

- React 18 + TypeScript + Tailwind. Icons: `lucide-react`. Motion: `framer-motion`.
- The 3D area is a **placeholder**: a simple `@react-three/fiber` scene (a flat lawn, a plain house box, a deck slab
  with boards drawn as stripes, OrbitControls) or a large static image. Do not try to build a real renderer.
- All state is local and fake. Prices come from the sample data in section 10. No backend, no network calls.
- Put every control's hook in **`src/controlMap.ts`**: an array of `{id, surface, label, ariaLabel, hook, notes}`
  copied from section 7. Every button's `onClick` calls `runHook(id)`, which logs the hook name in a small
  on-screen "hook log" (dev only, toggled with the `~` key) and updates the fake state so the UI responds.
- Add a dev-only **state switcher** (also behind `~`) to jump between: desktop / phone width, Homeowner / Pro,
  loading 3D, 3D failed, autosave paused, customer view, internal staff mode, and estimator embed (section 9).

## 3. The feel (a 360° change)

**Direction: "calm, tactile, canvas-first."** The 3D scene of their house *is* the app. Controls float over it like
tools on a table, appear when needed, and get out of the way.

- **Full-bleed scene.** The 3D view fills the screen edge to edge. No page header bar, no side columns of text.
- **Icon-first, few words.** Labels are 1–2 words ("Boards", "Stairs", "Night"). No sentences in panels. A hint may
  appear once as a small chip ("Tap the deck to change it") and disappear after the first tap.
- **Visual pickers, not forms.** Replace dropdowns with photo swatches, picture tiles, segmented controls and
  steppers. A dropdown is only allowed for long technical lists, and only under "More".
- **Direct manipulation.** Tap the deck, a stair or a patio to select it; drag its handles; tap a dimension label to
  type a new size (the number is **pre-selected**, so typing replaces it; Enter applies, Esc cancels).
- **Progressive disclosure.** Each panel shows the 3–6 choices most people make. Everything else sits under one
  "More" row at the bottom of that panel.
- **The price is always visible**, on every screen and every width, as a pill. The **Send** button is always one tap
  away.
- **Every change is reversible.** Undo/Redo are always on screen. AI and "fit to ground" suggestions are shown as a
  preview first, then applied as one undo step.

**Visual language**

- Light, neutral UI: white and warm stone greys for surfaces, so the 3D colours read true.
- Brand accents only: forest `#14261C` (primary, selected states, icons), gold `#C08A2E` (the single primary
  action: Send, and the price pill outline), cream `#F6F0DF` used sparingly as a highlight, never as a big panel
  colour.
- Type: **Inter** for everything in the app (tabular numbers for prices and sizes). Large, confident numbers.
- Floating surfaces: solid white with a soft shadow and 16 px radius. No heavy glass blur, no gradients behind text.
- Motion: 180–240 ms ease-out for panels; the camera glides (about 600 ms) between views; selections pulse once.
  Respect `prefers-reduced-motion` (cut to fades).
- Touch targets at least 44 × 44 px. Visible focus rings. Everything works by keyboard.

**Avoid (these looks belong to competitors or tested badly)**

- Dark navy screens with cream italic serif headings and heavy all-caps.
- Cream "cards" with small-caps eyebrows.
- Numbered steps ("1 of 6", "1 2 3 4") with Back / Next / Save for later. Our groups are non-linear: any can open
  at any time.
- Account or sign-in walls before saving or sending; upsell pop-ups mid-task.
- An empty start screen. We always open on a ready-made deck on their house.
- Panels that cover the deck while you pick its colour, or that hide the price on phones.
- Separate "layout mode" and "3D mode" with a rebuild step.

## 4. Who uses it

1. **Homeowner** (default, the priority). On a phone or laptop, often in the evening. Wants to see it, change it,
   know the price, and send it.
2. **Pro / designer** (Golden Maple staff and contractors). Opens **Pro mode** (`?designer=1`, remembered on the
   device). Needs density, precision, drawings and files. Pro mode keeps a desktop CAD-style layout (section 8).
   Never show Pro tools in the homeowner UI.

## 5. Layout

### Desktop (≥ 801 px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [◆ DeckCraft]  [My deck · 16×12 ft ●]        [ 3D | Plan | Framing ]   [↶][↷] [⋯] [ Send ] │  ← floating, no bar
│                                                                              │
│ ┌──┐                                                                         │
│ │▦ │ Shape        3D SCENE (full bleed)                                      │
│ │▤ │ Boards                                                                  │
│ │⌸ │ Stairs                                                                  │
│ │✿ │ Yard                     ┌ selection bar appears by the selected object ┐│
│ │✦ │ Extras                   └──────────────────────────────────────────────┘│
│ └──┘                                                                         │
│   ┌ group panel (docked left, 360 px, scene stays visible) ┐                  │
│                                                                              │
│            [ Corner·Overview·Front·Above ] [☀/☾] [💡] [Season] [More]        [ $24,380 ▸ ] │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Top-left:** logo mark (goes home) and a **project chip**: deck size plus a save dot (green = saved on this device,
  amber = saving, grey = paused). Tapping the chip opens the **File** menu.
- **Top-centre:** view switch **3D · Plan · Framing**.
- **Top-right:** Undo, Redo, ⋯ (File menu), **Send** (gold, primary).
- **Left rail:** five groups (icon plus one word): **Shape, Boards, Stairs, Yard, Extras**. Tapping one opens its
  panel docked on the left (360 px). The scene shifts right; it is never covered. Tapping again closes it.
- **Bottom-centre (3D only):** the view bar (section 7.4).
- **Bottom-right:** the **price pill**. Tapping it opens the **Quote** panel docked on the right.

### Phone (≤ 800 px)

```
┌────────────────────────────┐
│ [◆]  [3D|Plan]   [↶][↷][⋯] │
│                            │
│        3D SCENE            │
│                            │
│ ┌ half-height drawer ────┐ │  ← opens at 45 %, drag up to 90 %, down to close
│ │  swatches / tiles      │ │
│ └────────────────────────┘ │
│ [ $24,380 ▸ ]   [  Send  ] │  ← always visible
│ [▦ ][▤ ][⌸ ][✿ ][✦ ]       │  ← dock: Shape Boards Stairs Yard Extras
└────────────────────────────┘
```

- The scene stays visible above the drawer. Text and dimension labels on the plan are at least 14 px.
- The 3D view bar folds into one **View** button that opens a small sheet (camera, day/night, lights, season, more).
- No hover-only controls. No keyboard-shortcut hints.
- Framing view is reachable from the ⋯ menu on phones (it is a contractor view).

## 6. Key moments to prototype (make these feel effortless)

1. **First 10 seconds:** opens in **3D, Corner camera**, a sample deck already on the house, the price pill showing,
   one hint chip. No splash text.
2. **Change the board colour in 2 taps:** Boards → tap a swatch. The deck changes colour live while the panel stays
   open. Swatches are photos with names, with filter chips (Browns · Greys · Light · Dark).
3. **Resize:** tap the "16 ft" label on the deck → the number is selected → type 20 → Enter. Or drag the edge handle.
4. **Change shape:** Shape → picture tiles: Rectangle, L-shape, Multi-corner, Curved, Wrap left, Wrap right,
   Wrap both, Split level, Draw my own.
5. **Add stairs:** Stairs → tap the edge on a mini plan (or on the deck) → stairs appear with the right number of
   steps; tweak width with a stepper.
6. **See it at night:** View bar → ☾ Night, lights on.
7. **Quote and send:** price pill → Quote panel reads like a quote, each line with an **Edit** link that jumps to that
   group → Send → short form → done screen.

## 7. Control map (where every control leads, from the code)

Hook names are the real functions/props in `src/pages/DeckDesigner.tsx` and the designer components:

- `openSection(id)`: opens a design section. `id` is one of `house`, `deck`, `boards`, `stairs`, `lighting`,
  `extras`, `site`, `backyard`, `proposal`.
- `setPlanTool(tool)`: picks a drawing tool. `tool` is one of `components` (Select parts), `outline` (Shape &
  points), `size` (Size & place), `stairs`, `house`, `edges` (Rails & screens), `boards` (Board layout), `inlays`,
  `yard` (Patios & walls), `landscape` (Landscape areas).
- `setMode(mode)`: picks a view. `mode` is one of `3d` (Corner), `overview`, `front`, `top` (Above), `plan`,
  `drawing`, `structure` (Framing), `hardware` (Pro), `foundation` (Below ground, Pro).
- `update({...})`: changes a design value, such as `sceneLighting` or `lightingPreviewOn`.

Today's homeowner tabs, which this redesign replaces: Draw (`size, outline, stairs, house, edges` / sections `deck,
stairs, house` / Plan view), Materials (`boards, inlays` / `boards` / 3D), Extras (`landscape, yard` / `lighting,
extras, backyard` / 3D), Price & send (sections `site, proposal`).

### 7.1 Always-on controls

| New control | Opens / does | Hook | Accessible name |
|---|---|---|---|
| Logo mark | Goes to the Golden Maple home page | link `/` | "Golden Maple home" |
| Project chip + save dot | Opens the File menu; dot shows "Auto-save on this device" / "Saving changes…" / "Auto-save paused" / "Not saved · use Save JSON" / "Restoring design…" | autosave state | n/a |
| View switch: 3D | 3D sheet | sheet `3d` → `setMode('3d')` | tab "3D" |
| View switch: Plan | 2D plan sheet | sheet `plan` → `setMode('plan')` | tab "Plan" |
| View switch: Framing | Contractor framing sheet (Plan / Framing; Pro adds Hardware / Below ground) | sheet `framing` → `setMode('structure')` | tab "Framing" |
| Undo | Undo last change (Ctrl/Cmd+Z) | `undo()` | "Undo" |
| Redo | Redo (Ctrl/Cmd+Shift+Z) | `redo()` | "Redo" |
| Send | Opens the Send dialog (7.8) | `setSendOpen(true)` | "Send my design" |
| Price pill | Opens the Quote panel (7.7) | `openSection('proposal')` | "Live price" |
| Review badge on the price pill (count of items to check) | Opens the design review | `setIssuesOpen(true)` | n/a |
| Staff badge (only in internal mode) | Shows "Internal · no leads"; not clickable | `internalMode` | n/a |

### 7.2 File menu (⋯)

| New control | Opens / does | Hook | Accessible name |
|---|---|---|---|
| Save design file | Downloads the design JSON | `saveJSON()` | "Save JSON" |
| Open design file | File picker for a design JSON | `importFile` | "Import Golden Maple design JSON" |
| Share link | Copies a link that carries the whole design (no server) | `ShareDesignLink` | "Link to this design" / "Share…" |
| Start a new design | Resets to the starter deck (confirm first) | `startOver()` | "Start a new design" |
| Go back to my own design | Only after opening someone's shared link | `restoreOwnDesign()` | "Go back to my own design" |
| Download previous design | Only when an older autosave was not restored | `downloadFile(...)` | "Download previous design" |
| Export project ZIP / Import project ZIP | Portable project bundle | `ProjectFileTools` | "Export project ZIP" / "Import portable project ZIP" |
| Framing view (phone only) | Same as the Framing tab | `setMode('structure')` | n/a |

### 7.3 Left rail groups (homeowner)

Each group opens a docked panel: **top** = the big visual choices, **More** = everything else listed. Opening a
group also sets the plan tool shown in brackets, so the plan view is ready if they switch to it.

**Shape** (sections `deck`, `house`; tools `size` / `outline` / `house`)

| Control | Does | Hook / field |
|---|---|---|
| Shape tiles: Rectangle, L-shape, Multi-corner, Curved, Wrap left, Wrap right, Wrap both, Split level, Draw my own | Sets the deck shape | plan shortcuts (`SHORTCUTS`) via `setPlanTool('size')`; "Draw my own" → `setPlanTool('outline')` |
| Width / Depth / Height steppers (ft, in) | Resize | fields `width`, `length`, `height` ("Deck width", "Deck depth") |
| Levels: 1 · 2 · 3 | Adds second/third level | "Number of levels"; More: "Connect second level to", "Join the third level to", "Third level side", wrap edges |
| Attach: house / freestanding | How the deck connects | "How the deck connects" |
| Angled corners | 45° front corners | "Angled front corners (45°)" |
| Edit points | Plan view, point editing | `setMode('plan')` + `setPlanTool('outline')` ("Edit points on the plan") |
| Sketch it | Opens the freehand sketch canvas | `setSketchOpen(true)` ("Sketch a design") |
| House | House size and position on the plan | `setPlanTool('house')` |
| Doors & windows | Add / pick / restyle / remove a door or window; "Done" | `HouseOpeningsBar` ("House doors and windows", "Add", "Remove", "Done") |
| House look | Exterior finishes: walls, wainscot (height), gables, roof, fascia, soffit, gutters, doors, window frames, garage doors, ready-made looks; Apply to whole house / Reset this wall / Reset every wall | `ExteriorStudio` ("Exterior finishes", "Apply to the whole house") |

**Boards** (section `boards`; tools `boards` / `inlays`; view 3D)

| Control | Does | Hook / field |
|---|---|---|
| Colour swatches with filter chips | Board colour, live on the deck (each product line has its own colours) | field `deckingColor` |
| Product line | Pressure Treated, Western Red Cedar, TimberTech (EDGE Prime+, Terrain, Reserve, Harvest, Landmark, Legacy, Vintage), Deckorators (Vista, Voyage) | field `deckingMaterial` |
| Layout tiles: Straight · Diagonal · Picture Frame · Herringbone | Board pattern | field `pattern` ("Board layout") |
| Direction: 0° · 45° · 90° · 135° | Board angle per level | "Board direction", "Direction presets" (`setPlanTool('boards')`) |
| Picture frame: off · 1 · 2 rows | Border rows | "Border rows", "Add picture frame", "Border finish" |
| Inlays | Centre stripe, band, or a custom inlay drawn on the plan | "Centre inlay stripe", "Replace with a band"; `setPlanTool('inlays')` → "Draw custom inlay", "Edit custom shape", "Move", "Cancel placement" |
| Paint boards | Tap boards to make accent boards: "One board" / "Whole row", "Paint this row", "Remove", "Clear all accent boards", "Done" | `BoardColourPanel` ("What a click paints") |
| More → Board layout | Per-level layout, select many boards, find boards, select all matching, batch edits, review changes, Apply layout / Clear selection / Remove layout | `BoardLayoutEditor` ("Board layout tools") |
| More → Fasteners (Face · Hidden), board stock planning | Fastening system, stock lengths | "Fasteners", "Board stock planning" |

**Stairs** (section `stairs`; tools `stairs` / `edges`)

| Control | Does | Hook / field |
|---|---|---|
| Edge picker (mini plan) | Where the stairs go | "Primary stair location", "Stair edge" |
| Stair layout tiles: Straight · Landing · Winder | Stair layout | "Stair layout" |
| Flights: 0 · 1 · 2 · 3, turn Left · Right | Number of flights and turn direction | "Number of stair flights", "Stair turning direction" |
| Width stepper, risers, tread depth | Stair size | "Number of risers", "Tread depth" |
| Railing style tiles: None, Wood Picket, Aluminum, Cable, Glass Panels, Frameless Glass, Fortress AL13, TT Classic, TT Impression | Railing style; Frameless Glass then shows mount and hardware finish | "Railing style", "Glass railing mount", "Glass hardware finish", "Manufacturer railing system" |
| Edit railings by section | Plan tool for rails and screens: pick an edge or "Whole edge", start/end ft, "Add railing here", "Remove railing here", "Restore edge railings" | `setPlanTool('edges')` ("Railing and privacy screen controls") |
| Privacy screens | Add a screen on an edge, its height, product, design, finish, position; delete | "Add privacy screen here", `PrivacyScreenCard`, "Screen products & finishes" |
| Stair shape | Add/remove stair points, run depth | `StairShapeEditor` ("Add stair point at start", "Add stair point at end", "Remove last stair point") |
| Fit stairs to ground | Re-fit stairs to the measured ground | `StairRefitEditor` |
| Remove stairs | Removes drawn stairs | "Remove drawn stairs" |

**Yard** (section `backyard`; tools `yard` / `landscape`; view 3D)

| Control | Does | Hook / field |
|---|---|---|
| Add tiles: Patio, Wall, Walkway, Planting bed, Stone steps, Fire feature, Pool, Plants & stone | Adds that item, then shows its handles | "Draw patio", "Draw wall path", "Add stone stairs", "Add fire feature", `PoolEditor` ("Preview rectangular pool", "Preview rounded pool"), `LandscapeEditor` ("Ontario planting palette", "Stone", "Boulder shape"), "Add editable area", "New landscape starter shape", "Add shape" |
| Selected patio/wall material | Supplier library (Permacon, Techo-Bloc, Unilock, Oaks, Carr), product, finish, colour, unit size, laying pattern, wall cap, joint width, laying direction, rotate pattern, Apply pattern | `HardscapePicker` ("Ontario supplier library", "Find hardscape product", "Hardscape laying pattern", "Apply pattern") |
| Selected shape edit | Pull/add/remove points, midpoints, curve an edge (depth, Flip, Apply, Cancel), exact edge length/angle, overall size, point X/Y, Redraw, Delete | `YardShapeEditor`, `YardDrawingTools` ("Curve selected edge", "Apply curve", "Delete selected feature") |
| Selected feature | Name, product, concept colour, move, "Fit to the ground…", "Remove this feature" | `YardEditor` ("Selected yard feature") |
| Pool details (More) | Construction type, scope, depth profile, coping, custom outline, levels | `PoolEditor` |
| Fire details (More) | Product, what it stands on, finish level (clearance warnings shown) | `FireFeatureEditor` |
| Fire pit, kitchen, turf, lighting quick adds | Simple backyard extras; "No thanks" | `BackyardStep` ("Fire pit", "Outdoor kitchen") |
| My ground: Import survey | U-Level / Smart Level / CSV import wizard | `SiteReadingImport` ("Import from U-Level or survey file") |
| My ground: Design from my ground | AI designer: optional budget, which way the yard faces, your words, "Ask the AI designer"; returns 2–3 priced concepts, each with "Preview in 3D" and "Apply"; "Stop" | `SiteDesignerPanel` ("AI designer", "Design from my ground") |
| My ground: Fit to ground | Priced options so patio, stairs and deck meet the ground; "Preview in 3D" / "Apply" / "Stop" | `GroundFitPanel` ("Ground fit") |

**Extras** (sections `lighting`, `extras`, `site`)

| Control | Does | Hook / field |
|---|---|---|
| Lights | Light zones (steps, posts, under picture frame, under-step style), find lighting products, wire distance | section `lighting` ("Include lighting installation by zone", "Find lighting", "Lighting wire distance", `SimpleLighting`) |
| Skirting | Style, colour, corners | `SkirtingEditor` |
| Under the deck | Drainage, ceiling finish, platform scope, gravel depth | `UnderDeckEditor` ("Under-deck options") |
| Pergola | Aluminium pergolas: supplier, size, roof operation, variant, louver opening, LED, who supplies, remove | `PergolaEditor` ("Aluminum pergolas") |
| Remove old deck | Toggle | "Remove an existing deck" |
| Finishing accessories | Manufacturer accessories | "Manufacturer finishing accessories" |
| My site (More) | Project area, site conditions, soil, foundation, build season, load, joist size, species, joist spacing, board width | section `site` |

### 7.4 3D view bar (bottom-centre over the scene)

| Control | Does | Hook | Accessible name |
|---|---|---|---|
| Camera: Corner · Overview · Front · Above | Camera presets, eased | `setMode('3d' / 'overview' / 'front' / 'top')` | group "Camera" |
| ☀ Day / ☾ Night | Scene lighting | `update({sceneLighting:'Daylight' / 'Evening'})` | group "Day or night preview" |
| 💡 Lights on/off | Preview the lights | `update({lightingPreviewOn})` | "Preview lights on/off" |
| Season | Spring, summer, fall, winter (blooms, leaves, snow) | `SeasonPicker` | group "Season" |
| More → Realistic look | Higher-quality render | `RealisticLookToggle` | "Realistic look" |
| More → Surfaces | "Finished" / "Construction inspection" | `ScenePresentationTools` | "Surface presentation" |
| More → Saved views | "Current camera", "Whole terrace", "Pool & coping", "Retaining-wall face", "Save current camera", "Remove saved camera" | `ScenePresentationTools` | "Landscape camera" |
| More → Save image | Exports a PNG of the current view | `SceneStillExport` | n/a |
| More → Photo mode | Path-traced still: samples, time of day, f-stop | `PhotoModePanel` | "Photo mode" |
| More → Fly-through | Keyframes ("Add keyframe", "Use saved cameras", "Showcase tour"), resolution, frame rate, start/end, "Export fly-through", "Cancel" | `FlythroughLauncher` | "Fly-through recorder" |
| More → Pergola preview (when a pergola exists) | Product, move ½ ft, rotate ±15°, LED | `PergolaTools` | "Pergola preview controls" |
| **Pro:** Select in 3D, Add to selection, Show selection on plan | 3D multi-select | `setPicking`, then `setMode('plan')` | "3D selection tools" |

### 7.5 Plan view tools (floating toolbar on the left of the plan)

| Control | Does | Hook | Accessible name |
|---|---|---|---|
| Select | Select parts | `setPlanTool('components')` | "Select parts" |
| Points | Shape & points | `setPlanTool('outline')` | "Shape & points" |
| Size | Size & place | `setPlanTool('size')` | "Size & place" |
| Stairs | Stair tool | `setPlanTool('stairs')` | "Stairs" |
| House | House tool | `setPlanTool('house')` | "House" |
| Rails | Rails & screens | `setPlanTool('edges')` | "Rails & screens" |
| Boards | Board layout | `setPlanTool('boards')` | "Board layout" |
| Inlays | Inlays | `setPlanTool('inlays')` | "Inlays" |
| Patios | Patios & walls | `setPlanTool('yard')` | "Patios & walls" |
| Areas | Landscape areas | `setPlanTool('landscape')` | "Landscape areas" |
| New shape | Shape drawing: snap grid, typed length and direction (15° snap), walkway width/ends, "Place", "Finish", "Undo point", "Cancel" | `ShapeDrawTool` | "Draw a new shape" |
| Sketch | Freehand sketch → design | `setSketchOpen(true)` | "Sketch a design" |
| Zoom: Pan, −, %, +, Fit | Navigation (bottom-right) | `PlanViewport` | "Pan drawing", "Zoom out", "Zoom in", "Fit drawing" |
| Tap a dimension | Type a new length (number pre-selected) | edge dimension edit | "type a new …" |
| Point tools (when a point/edge is selected) | "Add pull point", "Add point", "Remove point", pull direction, custom angle, edge length/angle "Apply", "Unlock edge", "Toward the house", "Toward the yard", "Move left", "Move right", "Add a step", "Square this corner", "Remove this step" | `PlanBoundaryEditor`, `OutlineEditor` | "Deck outline controls" |

### 7.6 Selection bar (appears next to whatever is selected, in 3D or plan)

| Control | Does | Hook | Accessible name |
|---|---|---|---|
| Material | Opens that object's material choices | `CanvasContextMenu` "Materials…" | "Object edit menu" |
| Duplicate | Copies it | "Duplicate" | |
| Delete | Removes it (undoable) | "Delete" | |
| Size | Dimensions inspector for the object | `PreviewedObjectInspector` / `HardscapeInspector` | "Selected object settings" |
| Preview → Apply / Cancel | For geometry and quantity changes: "Preview geometry and quantities", "Apply preview", "Cancel preview" | `HardscapeInspector`, `EditReview` | |
| Edit shape / Edit boards (deck level) | Jumps to points or board layout for that level | "Edit level shape", "Edit level boards" | |
| **Pro:** batch edit parts | Find part, type, select many, select all matching, batch value, review, "Apply to selected parts", "Duplicate part", "Remove part", "Add opening" | `PlanComponentEditor` | "Selected plan component controls" |

### 7.7 Quote panel (opens from the price pill; replaces "Price & send")

Reads like a real quote. Top: the big total and "Planning estimate".

| Control | Does | Hook |
|---|---|---|
| Line per section (Framing, Decking, Stairs, Railings, Lighting, Yard, …) with **Edit** | Jumps to the matching left-rail group | `openSection(id)` |
| "Still to be quoted" list (not in the total) | Supplier-quote items, shown apart | "Still to be quoted: not in the planning total" |
| Check before building (count) | Opens the review list; each item can locate the problem on the drawing | `setIssuesOpen(true)` → `IssueReviewDialog` (`onLocate`) |
| Full price list | The full schedule | `showFullList()` → `PriceLedger` ("Full price list") |
| Your name / Project address | Stay on this device; go on the proposal | "Your name", "Project address" |
| **Send my design** (gold) | Send dialog | `setSendOpen(true)` |
| Download PDF | Branded proposal PDF | `downloadPdf()` |
| Print proposal | Proposal preview with "Print / save as PDF" and "Close" | `openProposal()` → `ProposalDialog` |
| Share link | Same as File → Share | `ShareDesignLink` |
| Save design file | Same as File → Save | `saveJSON()` |
| Contractor files (collapsed) | "Open permit drawings", "Download DXF", "Download OBJ", "Download GLB", "Materials CSV", "Cut list CSV", "Connectors CSV" | `setPermitOpen(true)` → `PermitSetDialog`; `exportModel('dxf'/'obj')`; CSV exports |
| **Pro:** Review quote costs | Owner cost editor: material markup, per-line overrides, installation labour (crew × hours × rate), feature labour, guillotined stone setting, Save/Load my defaults, Reset, Done | `setQuoteReviewOpen(true)` → `QuoteReviewPanel` / `OwnerCostEditor` |

### 7.8 Dialogs

| Dialog | Contents | Exits |
|---|---|---|
| Send my design | Name, email, phone, project address, notes, consent checkbox, Send. After sending: a calm "Sent" screen | "Download PDF", "Print your proposal", "Back to my design", "Cancel" |
| Design review | Review areas and items, tap to locate on the drawing | "Back to design", "Close issue review" |
| Permit drawings | Sheet list A-0 site plan, A-1 elevations, S-1 foundation, S-2 framing, S-3 decking & guards, S-4 typical section, S-5 details, S-6 schedules; lot/site entry; PDF + DXF; stamped DRAFT until open items are resolved | "Back to design", "Close permit drawings" |
| Proposal preview | The printable proposal with the 3D hero | "Print / save as PDF", "Close" |
| Sketch | Freehand sketch canvas; Apply turns it into the deck shape and opens Points on the plan | Apply / Close |
| Survey import | File, columns, units, decimal mark, zero point, placement, matching shots, "Preview survey import", "Save columns" | "Close import" |

## 8. Pro mode (`?designer=1`, desktop-first, density allowed)

Keep the same visual language but denser. Layout: **menu bar** on top, **ribbon** under it, **tool strip** on the
left, the canvas with **rulers**, a **properties** dock on the right (the open section docks here instead of the
homeowner panel), **layers**, and a **status bar**. Show the shortcut letter in each tool label, using the keys common to 3D modelling programs:
Space Select, L Line, R Rectangle, M Move, Q Rotate, S Scale, P Push/Pull, T Tape measure, E Eraser, C Circle,
O Orbit, H Pan. Enter types an exact length.

Header extras (Pro only): **Presets** → `setPresetsOpen(true)` (contractor presets: framing, joist spacing,
foundation, decking, pattern, picture frame, railing, glass, skirting, lighting), **Agents** → `setAgentOpen(true)`
("Agent tools": "Load example command", "Preview command", "Apply command", "Read current design").

Ribbon tabs: Undo, Redo, Sketch, Presets, Ground & survey, Deck levels, Patio & wall levels, Sections & earthwork,
Plan, 3D, Framing, Permit set.

Menu bar (every item must exist):

- **File:** New design… (`startOver`), Open design file… (`importFile`), Save design file (`saveJSON`), Saved jobs &
  versions… (`setJobsOpen(true)`), Print proposal… (`openProposal`), Download proposal PDF (`downloadPdf`), Permit
  set… (`setPermitOpen(true)`), Export 3D model (DXF) / (OBJ) (`exportModel`), Export plan drawing (DXF)
  (`exportPermit('dxf2d')`), Send my design… (`setSendOpen(true)`).
- **Edit:** Undo, Redo, Select parts, Edit shape & points, Describe a change… (`setAskOpen(true)`), Layout expert…,
  Decking expert…, Outdoor living expert…, Construction expert…, Design critique… (`setAskExpert(expert)`).
- **Add:** Deck shape & size, Stairs & railings, House, doors & windows, Lighting, Privacy, skirting & extras,
  Patios, walls & pools (each `openSection`).
- **Settings:** Boards & finish, Site & foundation, Contractor presets…, Quote costs… (`setQuoteReviewOpen(true)`).
- **View:** Plan, 3D, Framing, Full price list (`showFullList`), Leave the Pro workspace.
- **Tools:** Deck wizard…, House wizard…, Patio wizard…, Pool wizard… (step wizards; the last step reviews what
  will change), Site survey & photo import…, Sketch a design… (`setSketchOpen(true)`), Agents…, Proposal & files.
- **Help:** Keyboard shortcuts.

The **Describe a change** assistant (Pro only today): a side dock with text or voice input, example instructions
("Make the deck 20 by 14 feet", "Rotate selected boards to 45 degrees", "Raise this wall 6 inches", "Make selected
flight curved"), expert picker, a preview of what it understood with its assumptions, then "Apply reviewed edit",
Undo/Redo, "Start a new request", Close. It never applies anything without the preview.

Pro also has the **elevation workspace** (deck levels, patio and wall levels, sections and earthwork, stair refit,
ground fit) and the **Framing** sheet with Plan / Framing / Hardware / Below ground.

## 9. States and variants

- **Loading 3D:** a soft skeleton of the house and deck, "Loading the 3D view…".
- **3D failed (no WebGL):** the plan shows instead, with one button "Try the 3D view again".
- **Autosave paused / not saved:** the save dot turns grey; the File menu offers "Save JSON".
- **Shared link opened:** a slim banner offers "Go back to my own design".
- **Customer view** (a proposal link opened by a homeowner): hides contractor costs, files and specs.
- **Internal staff mode:** the "Internal · no leads" badge; Send and PDFs still work but create no lead.
- **Estimator embed** (inside `/cost-estimator?type=deck`): no Send and no Quote panel; a bottom bar from the
  estimator shows the deck price with "Use this deck". Site and Proposal & files move into Extras.
- **Empty yard:** the Yard panel opens on the Add tiles, never on an empty list.

## 10. Sample data (fake, for the prototype only)

```json
{
  "deck": {"shape": "Rectangle", "widthFt": 16, "depthFt": 12, "heightIn": 24, "levels": 1, "attached": true},
  "boards": {"line": "TimberTech Vintage", "colour": "Coastline", "layout": "Straight", "pictureFrameRows": 1},
  "swatches": {
    "TimberTech Vintage": ["Coastline", "Mahogany", "Weathered Teak", "Cypress"],
    "TimberTech EDGE Prime+": ["Coconut Husk", "Sea Salt Gray", "Dark Cocoa"],
    "TimberTech Harvest": ["Brownstone", "Slate Gray", "Kona"],
    "Deckorators Vista": ["Dunewood", "Silverwood", "Driftwood", "Ironwood"]
  },
  "stairs": {"edge": "front", "layout": "Straight", "widthFt": 6, "risers": 3},
  "railing": {"style": "Aluminum"},
  "yard": [{"type": "Patio", "product": "Permacon paver (sample)", "areaSqFt": 180}],
  "price": {
    "total": 24380,
    "lines": [
      {"section": "Framing & foundation", "amount": 6120},
      {"section": "Decking", "amount": 8450},
      {"section": "Stairs", "amount": 1680},
      {"section": "Railings", "amount": 3990},
      {"section": "Lighting", "amount": 940},
      {"section": "Patio", "amount": 3200}
    ],
    "stillToQuote": ["Pergola (supplier quote required)"],
    "reviewItems": 2
  }
}
```

## 11. What to hand back

1. The running prototype with: Homeowner desktop, Homeowner phone, Pro desktop, and every state in section 9
   (reachable from the dev state switcher).
2. `src/controlMap.ts` covering **every** row in section 7 and section 8, with its hook and accessible name.
3. A short `DESIGN.md`: the colour and type tokens, spacing scale, radius, shadows, motion timings, the component
   list (rail item, panel, swatch, tile, stepper, segmented control, price pill, selection bar, drawer, dialog), and
   which old controls you merged, renamed or moved under "More".
