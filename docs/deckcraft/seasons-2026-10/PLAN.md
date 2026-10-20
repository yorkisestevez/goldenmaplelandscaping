# DeckCraft seasons — plan (2026-10-20)

Owner ask: see a design in spring, summer, fall and winter. Snow in winter, coloured leaves in fall, and every
flowering plant looking its best in its own season.

## How it works

- **A season switch in the 3D view**: Spring · Summer · Fall · Winter. Summer stays the default, so nothing changes
  for anyone who never touches it.
- **View-only, not saved in the design.** Prices, quotes and share links stay exactly as they are. Like the
  day / golden hour / night switch, it also works from the link (`?deck-season=winter`) for stills and reels.
- **All the code lives in the 3D view's own lazy chunk.** The designer route is at 275.75 of 276 KB, so it gets nothing
  new.

## What changes per season

| | Spring (mid-May) | Summer (mid-July, today's look) | Fall (mid-October) | Winter (January) |
|---|---|---|---|---|
| Maples, serviceberry, redbud | fresh yellow-green leaves; serviceberry white, redbud magenta flowers | green | sugar maple orange, red maple scarlet, serviceberry orange-red, redbud yellow | bare branches (the tree model already has its own branch part) |
| Lilac, spirea, ninebark, dogwood | lilac purple panicles, ninebark white clusters | spirea pink flat-tops | ninebark bronze, dogwood maroon | bare twigs; red-osier dogwood's red stems |
| Hydrangeas | small green buds | big white mopheads / cones | Annabelle tan heads, panicle heads blushing pink | dried tan heads left standing, capped with snow |
| Perennials | low new growth; catmint and salvia start flowering late May | coneflower, black-eyed Susan, bergamot, daylily, catmint, salvia in full bloom | coneflower and Susan seed heads, foliage turning | cut back: low brown stubs; hosta and fern gone below the snow |
| Grasses | short green tufts | green with plumes | Karl Foerster tan plumes, bluestem copper, switchgrass gold | tan and standing, snow on top |
| Evergreens (cedar, boxwood, yew, spruce, pine) | green | green | green | green, a little darker, snow resting on the tops |
| Ground and beds | bright lawn | today's lawn | lawn a touch warmer, fallen leaves scattered under each deciduous tree and drifting onto lawn and patio | snow over lawn and beds; light snow on roof, rails, wall caps and furniture |
| Light | sun at Barrie's May noon height | today | lower, warmer sun | low winter sun (about 22° at noon), long shadows, soft cool sky |

Seasonal colours and bloom windows come from the extension pages each species already cites.

## Flowering plants that look amazing

Today's flowers are soft round blobs on cards, and only 8 perennials have any. The flowers will be redrawn as real
flower shapes, one for each species:
- coneflower: drooping purple rays around a spiky orange cone;
- black-eyed Susan: gold rays around a dark dome;
- bergamot: ragged lavender heads;
- daylily: six-petal orange trumpets;
- catmint and salvia: dense spikes of small florets;
- hydrangea: mopheads and cones built from four-petal florets.

The shrubs and trees that bloom get flowers too: lilac, spirea, ninebark, serviceberry and redbud. Redbud flowers
along its bare spring branches.

Each flower keeps its own colour in shade (as now) and is checked in day, golden hour and photo mode.

## Phases (each one is its own PR, each needs your OK to merge)

1. **S1: switch + plants by season** (about 2 days). The season switch, the table of seasonal looks for all 26
   species, bare winter trees and shrubs, fall colours, spring and summer blooms, and the new flower shapes.
2. **S2: snow and fallen leaves** (about 2 days). Snow on every upward-facing surface, done as one material patch (lawn,
   beds, roof, rails, caps, evergreen tops, context trees). Fallen-leaf scatter in fall. Lawn tint per season, and sun
   height and sky per season.
3. **S3: stills and reels** (about 1 day). Photo mode and still export use the season. The fly-through can play
   "through the seasons", the way it already does day → golden hour → night.

Each phase gets tests first (a check script for the season table and an e2e that switches all four seasons with no
console errors), the speed probe on each device tier (within 1.15× of today), and before and after shots on desktop and
phone.

## Scope note

Since 2026-10-17, realism work has been limited to the house, materials and placed plants. Seasons also touches the
lawn, the sky light and the context trees, because snow and fallen leaves can't look right without them. That covers
seasons only; it doesn't reopen general scenery work.

## Ledger

### Owner choices (2026-10-20)
Winter deck and patio shovelled with a light dusting · falling snow on desktop only · chips on the main 3D toolbar ·
build S1 → S2 → S3.

### Scope Lock — S1 (switch + plants by season)
Acceptance:
1. The 3D bar shows Spring · Summer · Fall · Winter chips; choosing one re-renders the plants without changing the
   design data (no `onUpdate` call), and `?deck-season=` picks the start season.
2. Summer is the default and draws the same programs and colours as before (no season patch on any summer material).
3. A season table covers all 26 catalogue species and every generic plant model, for all four seasons (check script).
4. Winter: deciduous trees show branches and trunk only; deciduous shrubs show bare stems (red-osier dogwood red);
   perennials are cut back; grasses stand tan; evergreens keep their needles.
5. Fall recolours deciduous leaves to each species' fall colour; spring shows fresh leaves and the spring bloomers.
6. Flowers are redrawn per species shape; lilac, spirea, ninebark, serviceberry and redbud bloom in their season.
7. Route JS/CSS unchanged (bundle gate); the viewer and landscape chunks stay inside their budgets; e2e switches all four
   seasons with no shader or console errors.

In: viewer3d (Landscape3D, plantBlooms, foliageLighting, new plantSeasons/sceneSeason/plantStems), Deck3DViewer bar,
ShowcaseContext3D trees, viewerBar.css, a new check script and e2e. Out: snow, fallen leaves, lawn, sun, photo
mode, stills, fly-through (S2/S3). Must not change: prices, saved designs, share links, summer look.

Each season shows its highlights: every plant at its peak for that season (spring = late April to early June
bloomers), not one calendar day.

### Scope Lock — S2 (snow, fallen leaves, lawn and sun)
Acceptance:
1. Winter: level surfaces take snow in world-space drifts (lawn, beds, roof, rails, caps, foliage tops, the tree line). Deck boards, pavers and stone steps are shovelled to a dusting. Glass, water and lit fixtures stay clear.
2. Winter on computers: snow falls. Phones and software renderers show settled snow only.
3. Leaving winter returns every surface to its own look, with no change to the design.
4. Fall: maple leaves lie under each broadleaf tree in the design. The lawn yellows a little and the sun is lower and warmer.
5. Spring's lawn is fresher. Winter's sun is about 22°, with no grass blades poking through the snow.
6. Route bundle unchanged. The viewer chunk stays within 340 KB (the snow code is lazy). e2e passes with no shader errors.

Out of scope: photo mode snow and the seasons fly-through (S3).

### Scope Lock — S3 (photo mode and fly-throughs)
Acceptance:
1. Winter photos show snow on the surfaces that are mostly snow (lawn, roof, beds, caps), and everything is restored after the photo.
2. Photo mode's day sun stands at the season's height and strength.
3. The fly-through can run "Through the seasons": spring, summer, fall, winter, a quarter each. The video keeps settled snow but not falling snow, and the view's own season comes back afterwards.
4. Existing photo and fly-through checks still pass.

Known limit: in photos, evergreen needles stay green under snow (the tracer cannot add snow to an alpha-cut leaf card without losing the cut-out).

- 2026-10-20: plan approved; worktree `.claude/worktrees/seasons` off origin/main 3e94257.
- 2026-10-20: S1 built.
  - Checks: check-plant-seasons 44 checks; check:deck and check:landscape green.
  - e2e: deck-seasons and deck-plants-render pass.
  - Bundle: route unchanged at 275.7/276 KB; viewer 337.8/340 KB.
  - Speed, interleaved A/B against main on the demo bed:
    - high tier: GPU p95 5.58 vs 5.29 ms (1.05×), CPU 1.05×, +4 draw calls;
    - constrained tier: no slower.
  - Independent review: 0 critical. 2 important, both fixed: the URL season is now read by the first reader, not only the bar; flower textures are no longer redrawn on every level-of-detail change. Minors fixed: the stem shadow follows the tier, context tree instances are disposed, evergreens are not rebuilt on a season switch, and the atlas mean is cached per texture. Photo mode now paints seasonal leaves from a grey atlas.
- 2026-10-20: S2 built.
  - Checks: check-season-snow 26 checks; check:deck and check:landscape green.
  - e2e: deck-seasons-snow, deck-seasons and plants-render pass.
  - Bundle: viewer 338.2/340 KB, because the winter scene is lazy; route unchanged.
  - Surprise: three r185 lights from `material.diffuseContribution` and `specularColorBlended`, so the first snow patch drew nothing until it wrote those.
  - Independent review: 0 critical, 5 important, all fixed:
    - grass blades now stay mounted, so they come back after winter;
    - snow is picked up on the first frame that draws a new material;
    - pavers are tagged when their material is made;
    - the far lawn takes the season tint;
    - fallen leaves sample the ground on a 5×5 grid per tree, with a cap of 6,000.
  - Also from verification: dried hydrangea heads use rounder cards, plants that have died back cast no contact shade, and lilac is lighter.
- 2026-10-20: S3 built.
  - Checks: check-season-media 12 checks, including a functional bake-and-restore test caught by a mutation; check-photo-trace and check-flythrough green.
  - A headless "through the seasons" export (24 fps, 4 s) cycled Spring, Summer, Fall and Winter, then restored Summer. Its frames show spring, summer and fall lawns, then a snowy roof and ground.
  - The winter photo shows a snowy roof and ground with long shadows.
  - Independent review: 0 critical, 2 important, both fixed with tests. Snow coverage is now measured by area, so wall caps take snow. A material that an instanced or multi-material mesh also draws is left unbaked.
  - Visibility audit: no contrast findings below 3:1 on the 3D view in any season, desktop or phone.

### Deferred
- Snow on the horizon belt and the neighbour houses (presentation context, a shader material): it stays as it is.
- A winter-maple leaf-removal and fall-colour pixel assertion in e2e (the review's test gaps); hosta's summer flower scapes and spirea's late-spring bloom are deliberate (bloom windows on the cited pages), not drive-bys.
