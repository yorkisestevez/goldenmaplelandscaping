# Ontario plants: plan for owner approval

Written 2026-10-20. Plan only: no code, nothing committed. It follows the hydrangea pilot ([PR #193](https://github.com/yorkisestevez/goldenmaplelandscaping/pull/193), branch `feat/deckcraft-hydrangeas`). Nothing here is built until you approve it.

## What you asked for

"All those plants you can have in Ontario", looking real. Your choices on 2026-10-20:
- about 70 Ontario nursery staples for zones 5–6;
- natives flagged;
- invasives left out (burning bush, Japanese barberry, Norway maple, miscanthus);
- CC0 iNaturalist photos now, swapped for your own photos in summer 2027;
- no paid plant libraries.

## The short version

- **73 species.** That is the 27 already in the catalogue on the pilot branch (26 on main, plus Endless Summer) and 46 new ones. 29 of the 73 are native to Ontario.
- **One method.** Every plant is built in-repo from its botany, with real-photo leaves and flowers at real size, as the hydrangeas are. The species are sorted into seven plant shapes (archetypes). Each shape needs its builder work once; after that, a species is a spec row plus its photos.
- **Waves.** There are 10 PRs after the pilot: a foundation PR, then 9 waves of 4–11 species each. Each wave gets your look sign-off, the 1.15× speed gate, CC0 manifest checks and the four seasons.
- **Honest size.** About 70–90 agent-days, plus your review of each wave. The pilot took about 7 days for 3 species and one new builder. The trees and the evergreens are the hardest and slowest waves.
- **Photos.** 5 species have no usable CC0 close-ups at their own taxon. They need a genus-level stand-in (the D20 rule you approved), your own photos, or dropping. They are listed under "CC0 photo supply".
- **One blocker to fix first.** 46 more species records add about 4–5 KB gzip to the page. The route bundle has 0.3 KB of headroom (275.7 of 276 KB) and the 3D viewer 1.8 KB (338.2 of 340 KB). The foundation PR moves the plant list into its own lazily loaded file, so no budget has to rise.

## 1. The species list (73)

**How to read the table**
- **In repo.**
  - **C**: one of the 26 species in `landscapeCatalogue.ts` on main.
  - **P**: one of the 3 pilot hydrangeas (PR #193). Annabelle and Limelight are both C and P. Endless Summer was added by the pilot.
  - **new**: proposed here.
- **Mature height × spread.**
  - For the 27 species in the catalogue, these are the catalogue's own sourced ranges, unchanged.
  - For new species, they come from the Missouri Botanical Garden (MBG) Plant Finder page for the named cultivar. They were read from the page on 2026-10-20, and each row links to its page.
  - These are mature sizes. Planting sizes stay the palette's own, as today.
- **USDA zone.** The hardiness range on the MBG page for that plant.
- **Zones 5–6.** Read from the USDA minimum as a rough rule:
  - USDA 4 or colder: **Yes**.
  - USDA 5: fine in zone 6, but needs a sheltered site in zone 5.
  - USDA 6: **No**.

  Canadian and USDA zone numbers are worked out differently, so treat this as a screen, not a guarantee. Your nursery's tag wins.
- **Native to Ontario.** This comes from VASCAN (the Database of Vascular Plants of Canada) where GBIF carries its Ontario row; otherwise from iNaturalist's Ontario checklist, queried with `preferred_place_id=6883`.
  - "Cultivar of a native" means the species is native and the nursery plant is a selection of it.
  - VASCAN's own site refused connections on 2026-10-20, so rows marked "confirm in VASCAN" should be checked there before the picker shows a native badge.
- **Shape.** The archetype (section 2).
- **Wave.** The PR that builds it (section 4).

**Left out on purpose**
- The four invasives you named: burning bush, Japanese barberry, Norway maple and miscanthus.
- Everything on the Ontario Invasive Plant Council's *Grow Me Instead* (Southern Ontario, 3rd edition) invasive list or its Watch List. That includes the following:
  - **Japanese tree lilac** ('Ivory Silk'), a common Ontario street tree. It is on the OIPC Watch List, so it is replaced here by 'Heritage' river birch.
  - Periwinkle, goutweed and lily-of-the-valley.
  - Wintercreeper and running euonymus.
  - Amur maple and Callery pear.
  - Guelder rose (*Viburnum opulus*). Arrowwood viburnum is used instead.
  - Privet, pachysandra and reed canarygrass.
  - Orange ditch daylily (*Hemerocallis fulva*). The daylily default is 'Stella de Oro'.
  - Yellow flag iris. Siberian iris is used instead.
  - Japanese honeysuckle.
- 'Little Giant' cedar has no MBG page, so the globe cedar is 'Danica', which has one.


### Trees (13)

| Species | Botanical name | Mature height × spread | Size source | USDA zone | Zones 5–6 | Native to Ontario | In repo | Shape | Wave |
|---|---|---|---|---|---|---|---|---|---|
| Sugar maple | *Acer saccharum* | 40–120 ft × 30–60 ft | [NC State](https://plants.ces.ncsu.edu/plants/acer-saccharum/) | 3–8 | Yes | **Yes** | C | C | W9 |
| Red maple | *Acer rubrum* | 40–120 ft × 30–50 ft | [NC State](https://plants.ces.ncsu.edu/plants/acer-rubrum/) | 3–9 | Yes | **Yes** | C | C | W9 |
| Eastern white pine | *Pinus strobus* | 50–80 ft × 20–40 ft | [NC State](https://plants.ces.ncsu.edu/plants/pinus-strobus/) | 3–8 | Yes | **Yes** | C | D | W8 |
| Serviceberry | *Amelanchier canadensis* | 15–25 ft × 15–20 ft | [NC State](https://plants.ces.ncsu.edu/plants/amelanchier-canadensis/) | 4–8 | Yes | Unconfirmed (confirm in VASCAN; several *Amelanchier* are native) | C | C | W9 |
| Eastern redbud | *Cercis canadensis* | 20–30 ft × 25–35 ft | [NC State](https://plants.ces.ncsu.edu/plants/cercis-canadensis/) | 4–8 | Yes | **Yes** | C | C | W9 |
| Colorado blue spruce | *Picea pungens* | 30–60 ft × 10–20 ft | [NC State](https://plants.ces.ncsu.edu/plants/picea-pungens/) | 2–7 | Yes | No (introduced) | C | D | W8 |
| Autumn Blaze maple | *Acer x freemanii 'Jeffersred'* | 40–55 ft × 30–40 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=255063) | 3–8 | Yes | Native parents (red × silver maple hybrid) | new | C | W9 |
| 'Heritage' river birch | *Betula nigra 'Cully'* | 40–70 ft × 40–60 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=242291) | 4–9 | Yes | No (introduced) | new | C | W9 |
| 'Prairifire' flowering crabapple | *Malus 'Prairifire'* | 15–20 ft × 15–20 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=249521) | 4–8 | Yes | No | new | C | W9 |
| 'Skyline' thornless honeylocust | *Gleditsia triacanthos var. inermis 'Skyline'* | 35–45 ft × 25–35 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=293826) | 3–8 | Yes | **Yes** (rare in SW Ontario; cultivar of a native) | new | C | W9 |
| Pagoda dogwood | *Cornus alternifolia* | 15–25 ft × 20–32 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=279335) | 3–7 | Yes | **Yes** | new | C | W9 |
| 'Bloodgood' Japanese maple | *Acer palmatum 'Bloodgood'* | 15–20 ft × 15–20 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=241781) | 5–8 | Zone 6; sheltered sites in 5 | No | new | C | W9 |
| Star magnolia | *Magnolia stellata* | 15–20 ft × 10–15 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=282531) | 4–8 | Yes | No (introduced) | new | C | W9 |

### Evergreens (8)

| Species | Botanical name | Mature height × spread | Size source | USDA zone | Zones 5–6 | Native to Ontario | In repo | Shape | Wave |
|---|---|---|---|---|---|---|---|---|---|
| 'Smaragd' emerald cedar | *Thuja occidentalis 'Smaragd'* | 12–14 ft × 3–4 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=254004) | 2–7 | Yes | **Yes** (cultivar of a native) | C | D | W8 |
| Boxwood | *Buxus microphylla* | 3–4 ft × 2–4 ft | [NC State](https://plants.ces.ncsu.edu/plants/buxus-microphylla/) | 5–8 ('Green Velvet' (MBG); the species is 6–9) | Zone 6; sheltered sites in 5 | No (introduced) | C | D | W8 |
| Yew | *Taxus × media* | 2–20 ft × 2–12 ft | [NC State](https://plants.ces.ncsu.edu/plants/taxus-x-media/) | 4–7 ('Hicksii' (MBG)) | Yes | No (Canada yew is native) | C | D | W8 |
| Dwarf Alberta spruce | *Picea glauca 'Conica'* | 10–13 ft × 7–10 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=252800) | 3–6 | Yes | **Yes** (cultivar of a native) | new | D | W8 |
| 'Blue Chip' creeping juniper | *Juniperus horizontalis 'Blue Chip'* | 0.5–0.75 ft × 8–10 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=249867) | 3–9 | Yes | **Yes** (cultivar of a native) | new | D | W8 |
| 'Danica' globe cedar | *Thuja occidentalis 'Danica'* | 1–2 ft × 1–2 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=267837) | 2–7 | Yes | **Yes** (cultivar of a native) | new | D | W8 |
| 'Mops' mugo pine | *Pinus mugo 'Mops'* | 3–4 ft × 2.5–3 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=254871) | 2–7 | Yes | No (introduced) | new | D | W8 |
| Eastern hemlock | *Tsuga canadensis* | 40–70 ft × 25–35 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=285010) | 3–7 | Yes | **Yes** | new | D | W8 |

### Shrubs (22)

| Species | Botanical name | Mature height × spread | Size source | USDA zone | Zones 5–6 | Native to Ontario | In repo | Shape | Wave |
|---|---|---|---|---|---|---|---|---|---|
| Ninebark | *Physocarpus opulifolius* | 5–8 ft × 4–6 ft | [NC State](https://plants.ces.ncsu.edu/plants/physocarpus-opulifolius/) | 3–7 ('Diabolo' (MBG)) | Yes | **Yes** | C | B | W3 |
| Red-osier dogwood | *Cornus sericea* | 5–9 ft × 5–10 ft | [NC State](https://plants.ces.ncsu.edu/plants/cornus-sericea/) | 3–7 | Yes | **Yes** | C | B | W2 |
| 'Annabelle' hydrangea | *Hydrangea arborescens 'Annabelle'* | 3–5 ft × 3–5 ft | [NC State](https://plants.ces.ncsu.edu/plants/hydrangea-arborescens/) | 3–9 | Yes | No (introduced) | C, P | A | pilot |
| Panicle hydrangea (Limelight) | *Hydrangea paniculata* | 8–25 ft × 6–25 ft | [NC State](https://plants.ces.ncsu.edu/plants/hydrangea-paniculata/) | 3–8 | Yes | No (introduced) | C, P | A | pilot |
| Endless Summer hydrangea | *Hydrangea macrophylla Endless Summer 'Bailmer'* | 3–5 ft × 3–5 ft | [Endless Summer](https://endlesssummerhydrangeas.com/our-hydrangeas/the-original/) | 4–9 | Yes | No (introduced) | P (added) | A | pilot |
| Spirea | *Spiraea japonica* | 4–6 ft × 4–7 ft | [NC State](https://plants.ces.ncsu.edu/plants/spiraea-japonica/) | 3–8 | Yes | No (introduced) | C | B | W3 |
| Lilac | *Syringa vulgaris* | 8–16 ft × 6–12 ft | [NC State](https://plants.ces.ncsu.edu/plants/syringa-vulgaris/) | 3–7 | Yes | No (introduced) | C | B | W2 |
| Incrediball hydrangea | *Hydrangea arborescens 'Abetwo'* | 4–5 ft × 4–5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=270963) | 3–9 | Yes | No (introduced) | new | A | W1 |
| Little Lime hydrangea | *Hydrangea paniculata 'Jane'* | 3–5 ft × 3–5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=273280) | 3–8 | Yes | No (introduced) | new | A | W1 |
| Quick Fire hydrangea | *Hydrangea paniculata 'Bulk'* | 6–8 ft × 4–6 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=442966) | 3–8 | Yes | No (introduced) | new | A | W1 |
| Oakleaf hydrangea | *Hydrangea quercifolia* | 6–8 ft × 6–8 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=286892) | 5–9 | Zone 6; sheltered sites in 5 | No | new | A | W1 |
| Weigela | *Weigela florida 'Alexandra'* | 4–5 ft × 4–6 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=241521) | 4–8 | Yes | No (introduced) | new | B | W2 |
| Bush honeysuckle | *Diervilla lonicera* | 2–3 ft × 2–4 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=278946) | 3–7 | Yes | **Yes** | new | B | W2 |
| Knock Out shrub rose | *Rosa 'Radrazz'* | 3–4 ft × 3–4 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=252230) | 5–9 | Zone 6; sheltered sites in 5 | No | new | B | W3 |
| 'Miss Kim' lilac | *Syringa pubescens subsp. patula 'Miss Kim'* | 4–9 ft × 5–7 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=260601) | 3–8 | Yes | No | new | B | W2 |
| Arrowwood viburnum | *Viburnum dentatum* | 6–10 ft × 6–10 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=278980) | 2–8 | Yes | **Yes** (as northern arrowwood, *V. recognitum*; confirm in VASCAN) | new | B | W2 |
| Potentilla | *Potentilla fruticosa* | 2–4 ft × 3–5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=286391) | 3–7 | Yes | **Yes** | new | B | W3 |
| 'Gro-Low' fragrant sumac | *Rhus aromatica 'Gro-Low'* | 1.5–2 ft × 6–8 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=252495) | 3–9 | Yes | **Yes** (SW Ontario; cultivar of a native; confirm in VASCAN) | new | B | W3 |
| Winterberry | *Ilex verticillata* | 6–12 ft × 6–12 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=276156) | 3–9 | Yes | **Yes** | new | B | W3 |
| Black chokeberry | *Aronia melanocarpa* | 3–6 ft × 3–6 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=286429) | 3–8 | Yes | **Yes** | new | B | W3 |
| 'PJM' rhododendron | *Rhododendron 'P.J.M.'* | 3–6 ft × 3–7 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=265576) | 4–8 | Yes | No | new | B | W3 |
| Smokebush | *Cotinus coggygria 'Royal Purple'* | 10–15 ft × 15–20 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=244021) | 4–8 | Yes | No (introduced) | new | B | W3 |

### Perennials (24)

| Species | Botanical name | Mature height × spread | Size source | USDA zone | Zones 5–6 | Native to Ontario | In repo | Shape | Wave |
|---|---|---|---|---|---|---|---|---|---|
| Purple coneflower | *Echinacea purpurea* | 3–4 ft × 1–2 ft | [NC State](https://plants.ces.ncsu.edu/plants/echinacea-purpurea/) | 3–8 | Yes | No (introduced) | C | G | W4 |
| Black-eyed Susan | *Rudbeckia hirta* | 2–4 ft × 1–2 ft | [NC State](https://plants.ces.ncsu.edu/plants/rudbeckia-hirta/) | 3–7 | Yes | **Yes** | C | G | W4 |
| Wild bergamot | *Monarda fistulosa* | 2–4 ft × 2–3 ft | [NC State](https://plants.ces.ncsu.edu/plants/monarda-fistulosa/) | 3–9 | Yes | **Yes** | C | G | W5 |
| Hosta | *Hosta* | 0.33–2.5 ft × 0.5–3 ft | [NC State](https://plants.ces.ncsu.edu/plants/hosta/) | 3–9 ('Francee' (MBG)) | Yes | No | C | F | W6 |
| Ostrich fern | *Matteuccia struthiopteris* | 3–5 ft × 2–4 ft | [NC State](https://plants.ces.ncsu.edu/plants/matteuccia-struthiopteris/) | 3–7 | Yes | **Yes** | C | F | W6 |
| Daylily | *Hemerocallis* | 1–3 ft × 1–3 ft | [NC State](https://plants.ces.ncsu.edu/plants/hemerocallis/) | 3–10 ('Stella de Oro' (MBG)) | Yes | No (never H. fulva, which is invasive) | C | E | W6 |
| Catmint | *Nepeta × faassenii* | 1.5–2 ft × 2–3 ft | [NC State](https://plants.ces.ncsu.edu/plants/nepeta-x-faassenii/) | 4–8 ('Walker's Low' (MBG)) | Yes | No | C | G | W4 |
| Salvia | *Salvia nemorosa* | 1.5–3 ft × 0.5–2 ft | [NC State](https://plants.ces.ncsu.edu/plants/salvia-nemorosa/) | 4–8 ('May Night' (MBG)) | Yes | No (introduced) | C | G | W4 |
| Coral bells | *Heuchera americana* | 1–2 ft × 1–1.5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=286871) | 4–9 | Yes | No (nursery hybrids; H. americana is native to SW Ontario) | new | F | W6 |
| Astilbe | *Astilbe x arendsii* | 1–1.5 ft × 0.75–1 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=242008) ('Fanal') | 3–8 | Yes | No | new | G | W5 |
| 'Autumn Joy' sedum | *Hylotelephium 'Herbstfreude'* | 1.5–2 ft × 1.5–2 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=249042) | 3–9 | Yes | No | new | G | W5 |
| Peony | *Paeonia lactiflora* | 1.5–2.5 ft × 1.5–2.5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=286081) | 3–8 | Yes | No (introduced) | new | G | W5 |
| Garden phlox | *Phlox paniculata* | 2–4 ft × 2–3 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=285435) | 4–8 | Yes | No (introduced) | new | G | W5 |
| Shasta daisy | *Leucanthemum x superbum* | 3–4 ft × 2–3 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=250265) ('Becky') | 5–9 | Zone 6; sheltered sites in 5 | No | new | G | W4 |
| English lavender | *Lavandula angustifolia 'Hidcote'* | 1–1.5 ft × 1–1.5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=249421) | 5–8 | Zone 6; sheltered sites in 5 | No (introduced) | new | G | W4 |
| Butterfly milkweed | *Asclepias tuberosa* | 1–2.5 ft × 1–1.5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=276924) | 3–9 | Yes | **Yes** | new | G | W5 |
| Threadleaf coreopsis | *Coreopsis verticillata 'Zagreb'* | 1–1.5 ft × 1.5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=243951) | 3–9 | Yes | No (introduced) | new | G | W4 |
| Yarrow | *Achillea millefolium* | 2–3 ft × 2–3 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=277129) | 3–9 | Yes | Partly (a native variety exists; garden yarrows are European; confirm in VASCAN) | new | G | W5 |
| Siberian iris | *Iris sibirica* | 3–4 ft × 2.5–3 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=259310) ('Caesar's Brother') | 3–8 | Yes | No (introduced) | new | E | W6 |
| 'Rozanne' cranesbill | *Geranium 'Gerwat'* | 1–1.5 ft × 1–2 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=254303) | 5–8 | Zone 6; sheltered sites in 5 | No | new | G | W5 |
| 'Jack Frost' brunnera | *Brunnera macrophylla 'Jack Frost'* | 1–1.5 ft × 1–1.5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=255997) | 3–8 | Yes | No (introduced) | new | F | W6 |
| Russian sage | *Perovskia atriplicifolia* | 3–5 ft × 2–4 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=281634) | 5–9 | Zone 6; sheltered sites in 5 | No (introduced) | new | G | W4 |
| New England aster | *Symphyotrichum novae-angliae* | 3–6 ft × 2–3 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=292654) | 4–8 | Yes | **Yes** | new | G | W4 |
| Blazing star | *Liatris spicata* | 2–4 ft × 0.75–1.5 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=277448) | 3–8 | Yes | **Yes** | new | G | W4 |

### Grasses (6)

| Species | Botanical name | Mature height × spread | Size source | USDA zone | Zones 5–6 | Native to Ontario | In repo | Shape | Wave |
|---|---|---|---|---|---|---|---|---|---|
| Karl Foerster feather reed grass | *Calamagrostis × acutiflora 'Karl Foerster'* | 5 ft × 2 ft | [U of Minnesota](https://plantsearch.extension.umn.edu/searchplants/view?editid1=1551) | 4–8 (U of Minnesota; MBG says 5–9) | Yes | No | C | E | W7 |
| Little bluestem | *Schizachyrium scoparium* | 2–4 ft × 1.5–3 ft | [NC State](https://plants.ces.ncsu.edu/plants/schizachyrium-scoparium/) | 3–9 | Yes | **Yes** | C | E | W7 |
| Switchgrass | *Panicum virgatum* | 3–7 ft × 2–3 ft | [NC State](https://plants.ces.ncsu.edu/plants/panicum-virgatum/) | 5–9 | Yes (native to Ontario) | **Yes** | C | E | W7 |
| Japanese forest grass | *Hakonechloa macra* | 1–1.5 ft × 1–2 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=285349) | 5–9 | Zone 6; sheltered sites in 5 | No (introduced) | new | E | W7 |
| Prairie dropseed | *Sporobolus heterolepis* | 2–3 ft × 2–3 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=285254) | 3–9 | Yes | **Yes** | new | E | W7 |
| Blue fescue | *Festuca glauca 'Elijah Blue'* | 0.75–1 ft × 0.5–0.75 ft | [MBG](https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=245730) | 4–8 | Yes | No (introduced) | new | E | W7 |

**Watch points in the list**
- **Sizes.** Several mature sizes are much bigger than a backyard planting reads:
  - 'Royal Purple' smokebush, 10–15 ft;
  - river birch, eastern hemlock, honeylocust and the maples, 35–80 ft.

  The palette keeps planting-size envelopes, as it does today for sugar maple.
- **Spirea** (*Spiraea japonica*) is not on any OIPC list, but it is invasive in parts of the eastern US. Keeping it is your call (see the owner decisions).
- **Annabelle and oakleaf** are not Ontario natives. *H. arborescens* is native to the eastern US, not Ontario.
- **Coreopsis verticillata** is filed by iNaturalist as *Anacis verticillata* (a 2023 rename). The common name is unchanged.


## 2. Plant shapes (archetypes) and the builder work each needs

### What the pilot already gives every species

These are read from `hydrangeaModel.ts`, `Hydrangeas3D.tsx` and `scripts/build-hydrangea-textures.mts` on the pilot branch.

**Model (`hydrangeaModel.ts`)**
- A seeded builder: the same plant id always builds the same plant.
- Bezier canes that rise from a crown.
- Opposite leaves at nodes, turned a quarter at each node, with optional whorls of 3. Leaves droop toward the tip and get smaller.
- Floret cards placed evenly over a dome or a panicle: a Fibonacci sphere, or area-weighted samples along the panicle. Each card has its own tilt, size, sink and colour.
- Levels of detail that keep the same area: one card in 6 or 16, enlarged.
- A positions-only fit to the drawn envelope, so sizes stay real and nothing pops between levels.

**Renderer (`Hydrangeas3D.tsx`)**
- Each plant is its own node. Each near level is built once and then only shown or hidden.
- Far plants are batched into one draw per part per cultivar.
- Leaves are one double-sided card. The back face reads the underside row of the atlas through `gl_FrontFacing`.
- Florets cast no shadow.
- One invisible pick box per plant.
- Season looks are colour multipliers on shared materials, so changing season rebuilds nothing.
- The renderer is lazy-loaded (6.8 KB gzip).

**Photos (`build-hydrangea-textures.mts`)**
- An offline cut-out: a region grown by Lab colour inside hand-placed ellipses, with holes filled and edges softened.
- Leaves are turned to their long axis, with the tip found automatically. Leaf and floret colours are balanced to the spec's hex colours.
- Florets are made grey, so each instance tints them.
- Cluster cards for distant heads are synthesised from the single floret.
- Edges are padded so mipmaps do not darken them.
- `SOURCES.json` holds a SHA-256 for every texture, and `check-hydrangeas.ts` checks it offline.

### What is hard-wired to hydrangeas today

The foundation PR generalises these:
- `HydrangeaCultivar` is a three-name union.
- Both atlases are three columns wide (`atlasCell` divides by 3).
- `HYDRANGEA_SPECS` has the hydrangea shape only.
- Heads are only `'panicle' | 'dome'`, with exactly one head per flowering cane tip.
- Canes never branch.
- Leaves are only opposite (or in whorls of 3).
- The season table lives inside the renderer.
- The texture build has its photo list and cut outlines as constants in code.
- `Landscape3D.tsx` and `landscapeRenderLods` route by `hydrangeaCultivar()` and `hydrangeaTriangleCounts()`.

### The seven archetypes

| Archetype | Species | New builder work |
|---|---|---|
| **A. Canes with floret heads** (the pilot) | 7 hydrangeas | None for Incrediball, Little Lime and Quick Fire: these are spec rows only. Oakleaf needs a lobed-leaf photo and a panicle that mixes fertile and sterile florets (a second floret size and colour on the same head). |
| **B. Branched shrubs: leaf cards, small flowers, fruit** | 15 | **Branching.** Laterals off the canes (1–2 orders) for twiggy shrubs: spirea, ninebark, aronia, winterberry, potentilla. **Leaf arrangement.** Alternate leaves in a 2/5 spiral, or two-ranked, besides opposite ones. **Compound leaves.** Leaflet cards on a short rachis: pinnate for rose and potentilla, trifoliate for Gro-Low. **Flowers.** New head types: a flat cyme or corymb (the dome code with a flat aspect), small flowers in the leaf axils (weigela trumpets as two crossed cards, diervilla) and rhododendron trusses. **Fruit.** Instanced berries (a small ellipsoid with a photo-tinted material) for dogwood, viburnum, aronia and winterberry. **Smokebush plumes.** Hair-fine clusters as alpha-tested cards. **Rose.** A double flower made of a cup of petal cards. |
| **C. Trees** | 11 | **A new skeleton builder.** A tapered trunk with recursive branches, in two branching styles: a central leader (honeylocust, red maple) and spreading or vase-shaped (maples, crabapple). It also needs the tiered layers of pagoda dogwood and multi-stem trunks (river birch, serviceberry). **Twig cards.** A tree carries 20,000–100,000 leaves, so twig cards are composed offline from single-leaf cut-outs, the way the pilot synthesises floret clusters. Each card carries 8–15 real-size leaves. **Bark.** A tiling CC0 bark photo per species, plus river birch's peeling bark. **Blossom.** Spring blossom on bare twigs (redbud, serviceberry, crabapple, magnolia) reuses floret instancing on the twigs. **Winter.** The bare winter skeleton must hold up on its own, which is the hardest look in the list. |
| **D. Evergreen sprays** | 10 | **Hull and shell.** An opaque inner hull with spray cards bent to it, as approved for the cedar in plants-realism PLAN.md P3. **Sprays.** Spray cards are composed offline from CC0 sprig photos: scale sprays for cedar and juniper, flat two-ranked needles for yew and hemlock, bottlebrush twigs for spruce, and needle bundles at branch tips for pine and mugo. Boxwood uses small leaf sprays. **Winter.** Snow sits on the hull. **Cedar pilot.** The R-P2 cedar pilot (your photos, CEDAR-SHOOT.md) builds the first hull-and-spray model, so this wave follows it. |
| **E. Blades and straps** | 8 | **Grass blades.** New ribbon blades with taper, arch, twist and a fold. **Clump styles.** Upright for Karl Foerster, fountain for dropseed and switchgrass, tufted for fescue, and a one-way arch for Hakonechloa. **Plumes.** Airy seed plumes reuse the panicle sampler at low coverage. **Fall and winter.** Grasses stand tan or copper all winter. **Strap fans.** Daylily and Siberian iris are wider straps in fans, with flower scapes. **Flowers.** Daylily trumpets and iris flowers are small petal-card assemblies. |
| **F. Basal rosettes** | 4 | **Rosette.** Leaves on petioles radiating from a crown, sized larger outside and smaller inside. This reuses the pilot's leaf cards and petiole tubes. **Leaf shape.** A larger leaf grid, so a hosta leaf can cup and wave. **Scapes.** Hosta, heuchera and brunnera scapes reuse spike heads. **Fern fronds.** Ostrich fern is a vase of long pinnate frond cards that bend. |
| **G. Leafy-stem perennials** | 18 | **Stems.** Thin, many-stem clumps, which are small canes from the pilot. **Leaves.** Opposite and alternate leaves, linear and threadlike leaf cards, feathery cut-out leaves (yarrow) and thick small cards (sedum). **Daisy head.** One ray-floret card plus a 3D disc cone for echinacea and rudbeckia (the cone is what reads as real), and many small daisies for aster. **Spikes.** A panicle with a small radius, for salvia, nepeta, lavender, Russian sage, liatris and astilbe plumes. **Other heads.** Flat heads (yarrow, sedum, milkweed umbels), whorls (monarda), domed panicles (phlox), saucers (Rozanne) and peony's layered bowl. **Budget.** Perennials go in drifts of 5–15, so each plant needs to stay at about 5,000 triangles or fewer up close. |

### Work every wave repeats

1. **A spec row per species**, with sizes and colours from cited sources (a `research/botany-wN.md` per wave, as the pilot's `botany.md`), and a checks block against those ranges, not the builder's own table.
2. **Photo cuts.** Each photo cut is drawn by hand: a seed and outline ellipses checked on a preview. Budget 1–2 hours per photo. Most species need 3 photos: leaf upper side, leaf underside, and flower or floret.
3. **A season record** in `plantSeasons.ts` (spring, summer, fall, winter), plus the species' own season looks.
4. **Triangle costs** per level of detail for the shared near-detail budget, checked within 30%.
5. **Review sheets** in the same format as the pilot: close up and in a bed, beside a real CC0 habit photo at a similar framing, in live, phone and Photo mode.

## 3. CC0 photo supply

**Method (2026-10-20)**
- **Counts.** The iNaturalist API was queried per species with `photo_license=cc0` for:
  - all observations;
  - research grade;
  - observations annotated "Flowers and Fruits: Flowers" (`term_id=12&term_value_id=13`). Few observers add this annotation, so it undercounts.
- **By eye.** The 24 most-faved CC0 photos were viewed as contact sheets for every thin or hybrid taxon and for a sample of the rest.
- **D20 rule.** Under the D20 sourcing rule you approved for plants-realism:
  - cultivated, casual-grade photos count;
  - a genus stands in where the species has nothing;
  - every photo's licence is re-read at fetch time.
- **The exact photos** for a wave are picked in that wave's dry-run listing, as the pilot's `inat-cc0-candidates.json` was.

**A verdict of "None", "Thin" or "No usable close-ups" is a flag.** It means the species has no usable CC0 close-up at its own taxon.

| Species | iNaturalist taxon queried | CC0 observations | Research grade | Annotated flowering | Fallback | Verdict |
|---|---|---|---|---|---|---|
| Sugar maple | *Acer saccharum* (complex) | 3212 | 1925 | 18 |  | Enough |
| Red maple | *Acer rubrum* | 3337 | 2201 | 107 |  | Enough |
| Eastern white pine | *Pinus strobus* | 3343 | 3109 | 0 |  | Enough |
| Serviceberry | *Amelanchier canadensis* (complex) | 1070 | 208 | 121 |  | Enough |
| Eastern redbud | *Cercis canadensis* | 2148 | 1580 | 124 |  | Enough |
| Colorado blue spruce | *Picea pungens* | 329 | 69 | 0 |  | Usable (needle twigs seen). |
| 'Smaragd' emerald cedar | *Thuja occidentalis* | 1847 | 1556 | 0 |  | Enough |
| Boxwood | *Buxus microphylla* | 58 | 0 | 1 |  | Usable (leaf close-ups seen). |
| Yew | *Taxus × media* (hybrid) | 0 | 0 | 0 | *Taxus* genus: 3,417 CC0 (2,358 research grade) | **None at this taxon.** Use genus *Taxus* (D20, as plants-realism PLAN.md P3 already planned). |
| Ninebark | *Physocarpus opulifolius* | 662 | 319 | 25 |  | Enough |
| Red-osier dogwood | *Cornus sericea* | 2864 | 1950 | 148 |  | Enough |
| 'Annabelle' hydrangea | *Hydrangea arborescens* | 579 | 230 | 32 |  | Used by the pilot. |
| Panicle hydrangea (Limelight) | *Hydrangea paniculata* | 181 | 0 | 6 |  | Used by the pilot. |
| Endless Summer hydrangea | *Hydrangea macrophylla* | 537 | 63 | 29 |  | Used by the pilot (no usable underside; the pilot recoloured the upper side). |
| Spirea | *Spiraea japonica* | 548 | 122 | 37 |  | Enough |
| Lilac | *Syringa vulgaris* | 977 | 389 | 79 |  | Enough |
| Purple coneflower | *Echinacea purpurea* | 830 | 328 | 87 |  | Enough |
| Black-eyed Susan | *Rudbeckia hirta* | 2284 | 1511 | 548 |  | Enough |
| Wild bergamot | *Monarda fistulosa* | 1811 | 1356 | 225 |  | Enough |
| Hosta | *Hosta* (genus) | 761 | 7 | 16 |  | Usable (white-margin Francee-type and blue leaves seen; cultivated, casual grade). |
| Ostrich fern | *Matteuccia struthiopteris* | 1006 | 845 | 0 |  | Enough |
| Daylily | *Hemerocallis* (genus) | 1263 | 465 | 127 |  | Enough |
| Catmint | *Nepeta × faassenii* (hybrid) | 27 | 13 | 2 | *Nepeta* genus: 1,312 CC0 (407 cultivated) | Thin count, but leaf and spike close-ups seen. |
| Salvia | *Salvia nemorosa* | 367 | 197 | 27 |  | Enough |
| Karl Foerster feather reed grass | *Calamagrostis × acutiflora* (hybrid) | 7 | 1 | 0 | *Calamagrostis* genus: 2,643 CC0 | **Thin.** Plume close-ups seen; no blade close-up. Blades are plain enough to colour from the genus. |
| Little bluestem | *Schizachyrium scoparium* | 928 | 598 | 5 |  | Enough |
| Switchgrass | *Panicum virgatum* | 692 | 368 | 3 |  | Enough |
| Autumn Blaze maple | *Acer × freemanii* (hybrid) | 86 | 34 | 0 |  | Usable (leaves and bark seen). |
| 'Heritage' river birch | *Betula nigra* | 556 | 202 | 1 |  | Enough |
| 'Prairifire' flowering crabapple | *Malus* (genus) | 4922 | 1211 | 179 |  | Genus only (includes orchard apples): pick crabapple photos by eye. |
| 'Skyline' thornless honeylocust | *Gleditsia triacanthos* | 1547 | 840 | 9 |  | Enough |
| Pagoda dogwood | *Cornus alternifolia* | 762 | 586 | 40 |  | Enough |
| 'Bloodgood' Japanese maple | *Acer palmatum* (complex) | 1383 | 747 | 28 |  | Enough |
| Star magnolia | *Magnolia stellata* | 120 | 0 | 14 | *Magnolia* genus: 3,177 CC0 (1,507 cultivated) | Usable (flower close-ups seen). |
| Dwarf Alberta spruce | *Picea glauca* | 671 | 297 | 0 |  | Enough |
| 'Blue Chip' creeping juniper | *Juniperus horizontalis* | 453 | 334 | 0 |  | Enough |
| 'Danica' globe cedar | *Thuja occidentalis* | 1847 | 1556 | 0 |  | Enough |
| 'Mops' mugo pine | *Pinus mugo* | 204 | 84 | 0 |  | Usable (needle tufts seen; mostly wild mountain pines, not the dwarf form). |
| Eastern hemlock | *Tsuga canadensis* | 2142 | 1932 | 0 |  | Enough |
| Incrediball hydrangea | *Hydrangea arborescens* | 579 | 230 | 32 |  | Species-level (reuses the Annabelle photos). |
| Little Lime hydrangea | *Hydrangea paniculata* | 181 | 0 | 6 |  | Species-level (reuses the Limelight photos). |
| Quick Fire hydrangea | *Hydrangea paniculata* | 181 | 0 | 6 |  | Species-level (reuses the Limelight photos). |
| Oakleaf hydrangea | *Hydrangea quercifolia* | 585 | 111 | 25 |  | Enough |
| Weigela | *Weigela florida* | 118 | 22 | 12 | *Weigela* genus: 226 CC0 (140 cultivated) | Usable (flower and leaf close-ups seen). |
| Bush honeysuckle | *Diervilla lonicera* | 949 | 787 | 110 |  | Enough |
| Knock Out shrub rose | *Rosa* (genus) | 19017 | 7351 | 1809 | Cultivated *Rosa*: 1,622 CC0 | Species-level photos are wild single roses. **Cultivated** *Rosa* photos (1,622 CC0) show double garden roses (seen): usable under D20. |
| 'Miss Kim' lilac | *Syringa pubescens* | 3 | 0 | 0 | *Syringa* genus: 1,355 CC0 | **No usable close-ups.** 3 wild observations, no cultivated plants. Florets from genus *Syringa*; Miss Kim's smaller, wavy leaf has no CC0 stand-in. Your photos, or drop. |
| Arrowwood viburnum | *Viburnum dentatum* | 451 | 91 | 7 |  | Enough |
| Potentilla | *Dasiphora fruticosa* | 1487 | 1122 | 121 |  | Enough |
| 'Gro-Low' fragrant sumac | *Rhus aromatica* (complex) | 1788 | 1092 | 41 |  | Enough |
| Winterberry | *Ilex verticillata* | 1256 | 820 | 43 |  | Enough |
| Black chokeberry | *Aronia melanocarpa* | 459 | 153 | 17 |  | Enough |
| 'PJM' rhododendron | *Rhododendron* (genus) | 7699 | 4559 | 711 |  | Genus only: pick small-leaf, PJM-like photos by eye. The cultivar cannot be verified. |
| Smokebush | *Cotinus coggygria* | 242 | 101 | 5 |  | Enough |
| Coral bells | *Heuchera* (genus) | 2712 | 1227 | 231 |  | Genus only: cultivated foliage colours are plentiful. |
| Astilbe | *Astilbe × arendsii* (hybrid) | about 1 | 0 | 0 | *Astilbe* genus: 149 CC0 (29 research grade, 8 flowering, 93 cultivated) | **None at this hybrid.** Genus *Astilbe* is usable (plumes and compound leaves seen). |
| 'Autumn Joy' sedum | *Hylotelephium* (genus) | 1480 | 773 | 65 |  | Genus only: Autumn Joy-type flat heads are common in cultivated photos. |
| Peony | *Paeonia lactiflora* | 99 | 7 | 2 | *Paeonia* genus: 723 CC0 (353 cultivated) | Usable (double and single flowers and leaves seen). |
| Garden phlox | *Phlox paniculata* | 560 | 324 | 78 |  | Enough |
| Shasta daisy | *Leucanthemum × superbum* (hybrid) | 23 | 11 | 2 | *Leucanthemum* genus: 5,919 CC0 (127 cultivated) | Usable (daisy close-ups seen). Watch for ox-eye daisy misidentifications. |
| English lavender | *Lavandula angustifolia* | 302 | 30 | 15 | *Lavandula* genus: 846 CC0 (495 cultivated) | Usable (spikes and grey leaves seen). |
| Butterfly milkweed | *Asclepias tuberosa* | 1508 | 1296 | 310 |  | Enough |
| Threadleaf coreopsis | *Anacis verticillata* | 224 | 98 | 45 |  | Enough |
| Yarrow | *Achillea millefolium* (complex) | 12396 | 10451 | 993 |  | Enough |
| Siberian iris | *Iris sibirica* | 72 | 62 | 8 |  | Usable (flower close-ups seen; mostly wild plants). |
| 'Rozanne' cranesbill | *Geranium* (genus) | 27339 | 20597 | 4273 |  | Genus only: pick violet-blue saucer photos by eye. |
| 'Jack Frost' brunnera | *Brunnera macrophylla* | 167 | 59 | 7 |  | Usable (silver Jack Frost-type leaves seen). |
| Russian sage | *Salvia yangii* | 117 | 3 | 8 |  | Usable (spikes and cut leaves seen). |
| New England aster | *Symphyotrichum novae-angliae* | 1307 | 906 | 285 |  | Enough |
| Blazing star | *Liatris spicata* | 290 | 106 | 24 |  | Enough |
| Japanese forest grass | *Hakonechloa macra* | 9 | 0 | 0 | None: *Hakonechloa* has only this species | **Thin.** 9 observations, habit shots only. Blade colour can be read from them, but there is no close-up. |
| Prairie dropseed | *Sporobolus heterolepis* | 61 | 27 | 0 |  | Usable (tufts and seed heads seen). |
| Blue fescue | *Festuca glauca* | 40 | 2 | 0 | *Festuca* genus: 2,586 CC0 | Usable (tufts and seed heads seen). |

**Flagged: no usable CC0 close-ups at their own taxon**
1. **'Miss Kim' lilac** (*Syringa pubescens*). Only 3 wild observations. Its florets can come from the genus, but its leaf has no stand-in. Options: your 2027 photos, a common-lilac leaf as an honest stand-in, or drop it.
2. **Yew** (*Taxus × media*). 0 photos at the hybrid. The genus *Taxus* (3,417) stands in, as already planned in plants-realism P3.
3. **Astilbe** (*Astilbe × arendsii*). Almost nothing at the hybrid. The genus (149, plumes seen) stands in.
4. **Karl Foerster** (*Calamagrostis × acutiflora*). 7 observations: the plume is usable, but there is no blade close-up. The genus stands in for blades.
5. **Japanese forest grass** (*Hakonechloa macra*). 9 observations, habit shots only. Usable for colour; there is no close-up. This is a good first candidate for your own photos, since it is a grass you can shoot this month.

**Genus only:**
- Knock Out rose, PJM rhododendron, Prairifire crabapple, Rozanne, coral bells and Autumn Joy sedum have photos only at genus level, not at their cultivar.
- Plenty of photos exist. The agent picks photos that look right, and the cultivar stays unverified until your photos replace them, as with "Limelight-like" in the pilot.

**Not covered by any CC0 photo here:**
- Bark tiles for the trees need close-ups of bark. They are present for maples (seen) but were not checked species by species. The tree wave's dry run checks them.
- Leaf undersides are rarely photographed. Expect more "recoloured upper side" undersides, as with Endless Summer.


## 4. Waves

### Rules every wave keeps (from the pilot)

- **Speed.** Interleaved A/B runs against an exact main build stay within 1.15× on CPU and GPU p50 and p95, on every tier (high, balanced, constrained), using `scripts/plants-probe.mts`. The runs use two scenes: the estate showcase, and the plants-realism demo fixture with a bed of that wave's species added. The estate alone would not contain most new species.
- **No persisted-field changes.**
  - A new species saves on the closest existing asset id (for example `rounded-shrub` or `perennial-bloom`) and renders by `speciesRecord.id`, as the hydrangeas do.
  - No new asset ids, no new record keys, no migration.
  - Saved designs, quotes, share links and prices stay byte-identical.
  - The legacy plant GLBs stay byte for byte, because the context trees use them.
  - New source notes stay short (150 characters or fewer), because every placed plant carries its species record in the share link. The estate link is at 98.4 of 100 KB.
- **CC0 manifest checks.** Every texture is listed in a `SOURCES.json` with its photo id, observer, `cc0` licence (re-read from the API at fetch time) and SHA-256, and the check fails otherwise. Cultivated photos graded "casual" are allowed under D20.
- **Seasons.** Spring, summer, fall and winter looks per species, with snow from the existing patch.
- **Bundle gate.** Builders are lazy chunks, loaded only when a design contains that archetype.
- **Your eye.** No wave merges without your look sign-off.
- **Detail budget.** A wave's species are costed in the shared near-detail triangle budget, so a crowd of them steps down with distance.

### Wave list

Each wave is one PR off main, after the one before it has merged.

| Wave | Species | Builder work | Effort (agent-days) |
|---|---|---|---|
| **W0. Foundation** | No new species visible. The hydrangeas move onto the generic kit. | **Kit.** A species registry: species id → archetype → spec row. The pilot's renderer becomes `PlantModels3D` with a per-archetype builder interface (leaves, flower cards, cores, berries, stems). **Atlases.** One per species (each loads only when used), in place of the three-column hydrangea atlas. **Photo build.** Cut settings move from code into a per-species JSON manifest. `scripts/build-plant-textures.mts` gains a cut-preview contact sheet. **Checks.** `check-plants-cc0.ts` covers every species folder; `check-plant-models.ts` covers sizes against each wave's sourced ranges. **Catalogue.** The species list moves to a lazily loaded file: the plant picker and AI concepts await it, and saved designs need nothing, because each placed plant carries its own record. **Speed.** A per-wave A/B fixture. **Acceptance.** The hydrangeas' review shots match the pilot's, and the route and viewer bundles get lighter, not heavier. | 5–6 |
| **W1. Hydrangea cultivars** | Incrediball, Little Lime, Quick Fire, oakleaf (4) | Spec rows; oakleaf's lobed leaf and mixed fertile and sterile panicle; Quick Fire's early pink season colours. | 3–4 |
| **W2. Opposite-leaf flowering shrubs** | Red-osier dogwood\*, lilac\*, Miss Kim lilac, weigela, bush honeysuckle, arrowwood viburnum (6; \* in the catalogue now) | Laterals; axillary flowers; flat cymes; berries; dogwood's red winter stems. | 7–9 |
| **W3. Alternate-leaf shrubs** | Ninebark\*, spirea\*, black chokeberry, winterberry, potentilla, Gro-Low sumac, smokebush, Knock Out rose, PJM rhododendron (9) | Alternate leaves; compound leaves; twiggy laterals; evergreen leaves; smoke plumes; the double rose. | 8–10 |
| **W4. Sun perennials: daisies and spikes** | Coneflower\*, black-eyed Susan\*, Shasta daisy, New England aster, threadleaf coreopsis, salvia\*, catmint\*, lavender, Russian sage, blazing star (10) | Herbaceous stem clumps; the daisy head with its 3D cone; spike heads; linear and threadlike leaves; standing seed heads in winter. | 7–9 |
| **W5. Perennials: clusters and big blooms** | Wild bergamot\*, garden phlox, yarrow, butterfly milkweed, Autumn Joy sedum, astilbe, peony, Rozanne (8) | Flat heads, umbels, whorls, plumes, saucers; peony's layered bowl; succulent and feathery leaves. | 6–8 |
| **W6. Rosettes, ferns and fans** | Hosta\*, coral bells, Jack Frost brunnera, ostrich fern\*, daylily\*, Siberian iris (6) | Basal rosettes; cupped large leaves; fern fronds; strap fans; trumpets and iris flowers on scapes. | 6–8 |
| **W7. Grasses** | Karl Foerster\*, little bluestem\*, switchgrass\*, prairie dropseed, blue fescue, Japanese forest grass (6) | Ribbon blades; four clump styles; airy plumes; tan and copper standing winter looks. | 6–8 |
| **W8. Evergreens** (after the R-P2 cedar pilot) | Boxwood\*, yew\*, Smaragd cedar\* (from the pilot), Danica globe cedar, dwarf Alberta spruce, Colorado blue spruce\*, eastern white pine\*, mugo pine, Blue Chip juniper, eastern hemlock (10) | Hull and spray cards, generalised from the cedar pilot to needles, bottlebrush twigs and pine bundles; snow load. | 8–10 (after the cedar pilot's own 6–9) |
| **W9. Trees** (may split into small ornamentals, then shade trees) | Sugar maple\*, red maple\*, Autumn Blaze maple, serviceberry\*, eastern redbud\*, Prairifire crabapple, Skyline honeylocust, pagoda dogwood, Bloodgood Japanese maple, star magnolia, Heritage river birch (11) | Trunk and branch skeleton; twig cards; bark; blossom on bare twigs; a winter skeleton that holds up on its own. | 12–16 |

**Total:** about 70–90 agent-days for W0–W9, not counting the cedar pilot, plus 10 look reviews from you. The waves run one at a time. W1 can start the day W0 merges.


**Why this order:**
- The hydrangea cultivars are a quick win on code that is already approved.
- Flowering shrubs and perennials are what homeowners place most and notice first.
- The evergreens wait for the cedar pilot, which is built from your photos.
- The trees go last: they are the hardest look, the biggest speed risk, and seasons already shows blossom on the tree proxy.

### Risks

- **Trees and speed.** A real-looking 15–20 ft crown up close costs more than today's 65k-triangle tree model. Expect the tree wave to need the most speed work, and possibly a smaller near-detail radius for trees.
- **Hand cut-outs** are the steady cost: about 130 photo cuts in all. A soft or busy photo can take several tries, as Annabelle's did.
- **Photo mode** bakes every instance. A yard full of species-built plants could reach millions of triangles. Each wave re-measures it, and a Photo-mode cap is added only if the trace stalls.
- **Phones.** Each wave runs the iPhone check from plants-realism D21, using the Showcase-quality fly-through.
- **Shared files.** `Landscape3D.tsx`, `landscapeModelRuntime.ts` and `plantSeasons.ts` change in every wave. Other sessions touching them means a rebase per wave.
- **Cultivar truth.** Photos show the species, not the exact cultivar, so "Limelight-like" holds until your 2027 photos replace them. The manifest per species makes that swap a rebuild with new photos, with no code change.

## Sources

All read on 2026-10-20 unless noted.

- **Mature sizes and USDA zones, new species:** Missouri Botanical Garden Plant Finder. Each row links to its page: <https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderSearch.aspx>.
- **Mature sizes, existing 27 species:** the cited sources already in `landscapeCatalogue.ts`: NC State Extension Plant Toolbox, MBG, University of Minnesota Extension and Endless Summer. Each row links to its page.
- **Native status:**
  - VASCAN, the Database of Vascular Plants of Canada (<https://data.canadensys.net/vascan/>), through its Ontario distribution rows in GBIF (<https://api.gbif.org/v1/species/{key}/distributions>);
  - otherwise iNaturalist's Ontario establishment means (<https://api.inaturalist.org/v1/taxa?preferred_place_id=6883>).

  VASCAN's site refused connections on the day.
- **Invasives:** Ontario Invasive Plant Council, *Grow Me Instead: Beautiful Non-Invasive Plants for Your Garden, Southern Ontario*, 3rd edition, including its Watch List (p. 53): <https://www.ontarioinvasiveplants.ca/wp-content/uploads/2020/04/Southern-Grow-Me-Instead-1.pdf>.
- **CC0 photo supply:** the iNaturalist API, `/v1/observations?taxon_id=…&photo_license=cc0` (<https://api.inaturalist.org/v1/docs/>).
- **Builder reading:** on branch `feat/deckcraft-hydrangeas` (head c907290):
  - `src/features/deckcraft/components/viewer3d/hydrangea/hydrangeaModel.ts`, `Hydrangeas3D.tsx`, `hydrangeaSpecs.ts` and `hydrangeaTextures.ts`;
  - `scripts/build-hydrangea-textures.mts` and `scripts/check-hydrangeas.ts`;
  - `docs/deckcraft/hydrangeas-2026-10-20/SPEC.md` (pilot effort, speed and ledger).
- **Earlier decisions this plan keeps:**
  - `docs/deckcraft/plants-realism-2026-10-17/PLAN.md` (D6 cultivar defaults, D20 photo sourcing, D21 phone showcase, P3 hull-and-spray evergreens);
  - `REVISION-photoreal.md` (no paid libraries, the cedar pilot, your 2027 photos);
  - `CEDAR-SHOOT.md`.
- **Bundle headroom:** `scripts/check-deck-bundle.ts` (route budget 276 KB, viewer 340 KB) and the pilot's measured 275.7 KB route and 338.2 KB viewer.


## Owner decisions

1. **The list.** Approve the 73 species, or swap some. Each recommendation below is made in the plan; the alternative is in brackets.
   - **Japanese tree lilac** stays out (OIPC Watch List). [Keep it, with a "watch list" note.]
   - **Spirea** stays. It is on no Ontario list. [Swap to native meadowsweet, *Spiraea alba*.]
   - **The rose is Knock Out.** It is the commonest, but dies back in zone 5. [An Explorer rose such as 'John Cabot'.]
   - **Zone-5-marginal plants stay**, marked "zone 6; sheltered in 5": Japanese maple, oakleaf hydrangea, lavender, Japanese forest grass, Shasta daisy, Rozanne, Russian sage and Green Velvet boxwood (by its MBG listing). [Drop them.]
   - **Globe cedar is 'Danica'.** [Little Giant, sized from another source.]
2. **'Miss Kim' lilac** has no usable CC0 photos. Recommended: drop it until your 2027 photos. [Common-lilac leaves as a stand-in.]
3. **Order of waves.** Recommended: W0 → W1 hydrangea cultivars → W2–W3 shrubs → W4–W5 perennials → W6 rosettes → W7 grasses → W8 evergreens → W9 trees.
4. **Evergreens wait for the cedar pilot**, built from your photos (CEDAR-SHOOT.md, shoot by about 7 November). [Build the evergreens from CC0 sprigs now and swap them later.]
5. **Bundle.** Recommended: move the plant list into a lazily loaded file in W0, so no budget rises. [Raise the route budget by about 5 KB, as you did for the hardware rates.]
6. **New species in the picker.** Recommended: a species appears in the picker only once its wave is built, so nothing new shows on today's generic models. [Add all 46 records now on the generic models.]
7. **Native badge.** Show a "Native to Ontario" mark (and a natives filter) in the plant picker? It is display only: it lives on the palette entry, not the saved record, so no persisted field changes. Recommended: yes, after the rows marked "confirm in VASCAN" are checked.
8. **Cultivar looks for the new species** (as D6 did for the old ones). Recommended:
   - weigela 'Wine & Roses' (purple leaves) [green];
   - smokebush 'Royal Purple' [green 'Young Lady'];
   - coral bells in purple [lime];
   - coreopsis 'Zagreb' (gold) [pale-yellow 'Moonbeam'];
   - Knock Out red [pink].
9. **Your photos** replacing the CC0 ones in summer 2027.
   - Which species do you shoot first?
   - Recommended this month: the evergreens and grasses, as REVISION-photoreal planned. Add Japanese forest grass and Karl Foerster blades, the two thinnest CC0 grasses.
10. **Look review for each wave** in the pilot's format: close up and in a bed, beside a real CC0 habit photo, in live, phone and Photo mode. Do you want the speed tables in each review too, or only a pass or fail?

