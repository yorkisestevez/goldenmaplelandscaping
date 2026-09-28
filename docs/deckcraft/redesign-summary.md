# DeckCraft redesign: "Drawing Set" (summary)

The redesign, built 2026-09-24 in phases R0 to R7, replaces DeckCraft's numbered wizard with a drawing set. You draw the deck on a plan of your house, open the design's sections in any order, and read an itemized price schedule. The plan is `~/.claude/plans/deckcraft-redesign-drawing-set.md`; the measurements are in `redesign-baseline.md`, and the analytics changes in `funnel-report.md`.

No price, engine, geometry, takeoff, persistence, 3D-scene or price-book code changed in any phase. The 213 legacy designs price exactly as before, no golden was regenerated, and the contractor plan in the PDF is byte-identical.

## What changed from the old wizard

| Before | After |
|---|---|
| Six numbered steps with Back, "N of 6" and Continue | Nine sections (House, Deck shape & size, Boards & finish, Stairs & railings, Lighting, Privacy/skirting & extras, Site & foundation, Backyard, Proposal & files), opened in any order. Several can be open on a desktop, one at a time on a phone. Each row shows the current choice, its price and a "changed" mark. (R1) |
| One big total, a finish row and a quote notice | A price schedule: engine lines under engine titles, in whole dollars, with supplier or builder quote tags (never $0). It shows the priced subtotal, HST and total, everything still to be quoted, and "Your changes" with what each edit, undo and redo did to the price. It is a column from 1280 px and a drawer from the price bar below that. (R2) |
| Cream cards, rounded corners, eyebrows, italic serif | A drawing set: square ruled sheets on vellum over a sage table, forest ink and gold dimension lines, and a title block. Type is Archivo headings, Plex Mono figures and Inter text; no italics, shadows or eyebrows. Every control is at least 44 px. (R3) |
| The page opened on the 3D view; shapes came first | The page opens on a site plan of the house. You drag gold handles to size and place the deck, or type the figures, and shapes are shortcuts on the plan. Tabs switch between Plan, 3D and Framing. Phones never download three.js until 3D is chosen. (R4) |
| Outlines, stairs and the house were edited only in forms | The plan's tools (Size & place, Draw outline, Stairs, House) drag outline edges, put stairs on an edge and slide them, and size the house from its wall ends. Every gesture is one undo step. (R5) |
| No idea what a choice would cost until it was picked | Each collection, board layout, fastener, border, railing style, manufacturer railing, stair count and layout, and foundation shows its effect: "+$1,240", "−$380", "no change" or "supplier quote". It is priced off the page in a worker. Phones ask first ("Show price effect"). (R6) |
| — | Phone finish: the price schedule drawer traps focus itself, the pinned plan was checked at 375, 390 and 412 px, dead CSS was removed, and these docs were written. (R7) |

## Against the competitor's look (plan section 1.6)

| The competitor | DeckCraft now |
|---|---|
| A full-bleed 3D house with a card floating over it | A plan drawing sheet first. 3D is a tab. No floating card. |
| A rounded cream card | Square ruled columns on vellum and sage, hairline rules, no shadows. |
| Small-caps eyebrows ("YOUR DECK, YOUR WAY") and tab labels ("SHAPE L-shape") | No eyebrows anywhere. Captions appear only inside the title block's cells. |
| "1 of 6", ← Back, Save for later, a dark "Next: Stairs →" pill | No numbering, Back or Next. Sections open in any order, each with a changed mark. Square buttons. Saving lives in the file toolbar and the share link. |
| The first choice is a shape button | The first action is dragging the deck against the house. Shapes are shortcuts on the drawing. |
| One big total ("$26,945.48 + HST") | An itemized schedule. Quote lines are tagged supplier or builder, every choice shows its effect, figures are whole dollars, and the priced portion is kept apart from quotes. |
| A fixed order: shape → stairs → collection → railing → lighting → site visit | House, deck, boards, stairs and railings, lighting, privacy and extras, site, backyard, proposal. Any order. |
| "Book a site visit $250, credited" | "Send my design", the proposal PDF and a share link. No paid visit. |
| Cream italic serif on navy | Archivo upright with Plex Mono figures and Inter, forest ink on vellum, gold dimension lines. No navy: the Night button is forest. |

## Owner decisions
- **2026-09-23:** redesign in all four directions (draw it on the house, an honest price list that absorbs A2, the drawing-set look, new colours and type), built after the Finishes track. No DeckCraft social posts until the redesign is live; launch it as the new designer.
- **2026-09-24, fonts:** Archivo and IBM Plex Mono load from Google Fonts (a `<link>`, `display=swap`) on the designer page only. They are not self-hosted, so the bundle check's font budget does not apply and the 12 KB CSS budget does.
- **Open questions kept at their defaults:**
  - Vellum and sage page colours, with brand cream only for text on forest.
  - The printed proposal and PDF are not restyled in this track.
  - Option deltas on phones follow the timing spike. One engine run passes 50 ms at 4× CPU, so phones tap "Show price effect".
  - The engine's own "(builder quote)" / "Builder quote required" wording decides builder quotes.
  - Cormorant only in the "Golden Maple" wordmark.

## Choices made during the build (for the owner to confirm)
- **R1**
  - Shared links, going back to your own design and Start over close every section.
  - The railing colour belongs to Stairs & railings.
  - A section with nothing in it reads "Adds nothing yet".
- **R2**
  - A "builder quote required" spec anywhere in a line makes it a builder quote.
- **R3**
  - The 3D camera button "3D" is now "Corner".
  - The contractor views sit on the Framing sheet (sheet 3 of 3).
  - The title block's date is filled in on the device.
  - Every Send action is gold.
- **R4**
  - A width drag keeps the other end fixed.
  - The plan's handles are HTML sliders over the drawing.
  - A drag commits once, on release.
- **R5**
  - Stair targets come from the page's stair edges and the house contact's open sides.
  - The House tool draws the whole house.
  - The second level's depth handle is shown only for front and back levels.
  - "Draw my own" opens the Draw outline tool.
- **R6**
  - Deltas are priced in a Web Worker, not in idle slices on the page. A herringbone layout on a wrap-around takes 55–205 ms on a desktop, which idle slices cannot keep under 50 ms. The worker carries its own copy of the engine (122.5 KB gzip, loaded only once deltas are wanted); idle slices remain the fallback.
  - Save-Data behaves like a phone: nothing is priced until "Show price effect" is tapped.
  - A select's effects read as one line under it ("Price effect: None −$9,535 · Glass Panels +$21,920 · …"), as its description. Three or more options that would each be a supplier quote fold into one ("19 choices: supplier quote").
  - Beyond the plan's four wordings:
    - a quote added beside priced work reads "+$904 + supplier quote";
    - a choice that takes items off the quote list says so ("−$4,308 · 1 fewer to quote").
  - "Your changes" and the deltas both use the difference of the whole-dollar subtotals, so a figure always matches what the schedule's subtotal moves by.
- **R7**
  - The drawer's focus trap is written out: focus in on opening, Tab loops, Escape closes, focus back to the price bar.
