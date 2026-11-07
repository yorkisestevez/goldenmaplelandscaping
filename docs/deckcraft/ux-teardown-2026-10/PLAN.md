# DeckCraft ease of use: GA4 read and competitor teardown

21 October 2026 · plan only, nothing built · for owner approval

> Keep this folder out of the public repo: it holds screenshots of competitors' tools.

## In one paragraph

GA4 can't tell us what to fix, because almost nobody real uses DeckCraft yet. Since v2 went live on
28 September there have been about 10 real page views. The big launch-week numbers were our own
automated tests, and no DeckCraft visit has been measured since 8 October. The teardown of Trex,
TimberTech, Deckorators and Fiberon shows that DeckCraft already beats all of them on the things that
win leads:
- a live price;
- sending a design without an account;
- working on phones;
- fast loading.

It loses on two things. Changing the board colour takes 5 clicks and hides the deck, and the first
screen is a flat 2D plan instead of the 3D view. The fix is to borrow three habits from them, not
their look. The plan has five phases, each waiting on your OK.

## 1. What GA4 says

Source: the read-only service account already used by the daily Google metrics brief (property
519541477). The raw pulls are in `ga4/`.

| Period | DeckCraft page views | Who |
|---|---|---|
| 7 Sep – 21 Sep | 7 | A few real visitors (Toronto, Puslinch) |
| **22 – 23 Sep** | **435** | **Our own automated tests.** See the evidence below. |
| 24 Sep – 8 Oct | 15 | Mostly real, maybe some of ours |
| **9 Oct – 20 Oct** | **0** | Nothing measured at all |

How we know 22–23 September was us:
- The screens were all 1280×720 or 412×839, which are Playwright's default sizes.
- Every visit came in "direct" on Edge.
- The locations were Greater Napanee and Kawartha Lakes.
- The visits arrived in hourly bursts.
- There were 19 identical saves, imports, PDFs and proposals.

The 10 `generate_lead` events in that window came from the same traffic.

What follows from it:
1. **There's too little traffic to judge the design from data.** Correction from the P0 work: most
   of GA4's "site" traffic is our own tests, too.
   - By hostname since July, `127.0.0.1` and `localhost` sent 5,388 events against 5,813 from
     goldenmaplelandscaping.ca.
   - In the week of 12 October, 52 users came from 127.0.0.1 and only 12 from the real domain.
   - The "data-centre" cities (Des Moines, Boydton, San Jose…) are GitHub Actions runners
     executing the e2e suite.
   - DeckCraft on the real domain: 10 users and 26 page views, all time.

   Watching 5 real people try it is the only way to learn about ease of use right now.
2. **The tracking went dark on 8 October.** That's the day the cookie bar and deferred trackers
   shipped (#128).
   - Real-domain measured users fell from about 100 a week to 12.
   - Visitors who don't click Accept now send only cookieless pings, and GA4's normal reports drop
     those.

   I'm not proposing to change the cookie bar; that's your call. But it means GA4 will stay nearly
   blind on DeckCraft.
3. **Lost events: proven in P0.** With the real gtag.js and a fake ID (every hit answered
   locally), an event queued before gtag's `config` line is silently dropped. The same event queued
   after it is sent. On the live site that loses every DeckCraft "opened" event (`deckcraft_step`,
   `deckcraft_view`), which fire at mount, before the tag loads.
4. **Test leads may have counted as ad conversions.** If the 10 test `generate_lead` events on
   22–23 September reached Google Ads as conversions, they skew ad bidding. That's worth a look in
   the Ads conversion report for those dates.

## 2. The teardown

Same four tasks in every tool, at laptop size (1366×768) and phone size (375×812):

- **T1** Make the deck 20 × 14 ft.
- **T2** Change the board colour.
- **T3** See a price.
- **T4** Send or save the design.

Each was stopped before any submit or account step. Clicks are the fewest a person needs once they
know the way. Wait times were measured once in the Claude browser, so treat them as rough.

### Scorecard

| | DeckCraft | Trex | TimberTech (3D Cloud, same engine as Lowe's and RONA) | Deckorators (2025) | Fiberon |
|---|---|---|---|---|---|
| Wait before you see a deck | ~1–2 s (cached; cold load not measured) | **~35 s, ~157 MB**, plus a cookie banner | ~10 s, 4 clicks of start screens, then a rebuild bar on each mode switch | ~5 s plus 3 picture choices | **~32 s** with a tips carousel; starts empty and you must drag a shape onto the grid |
| First view | 2D plan of the default deck on a house | Full-screen 3D, deck with no house | 3D template against a house | Photo-quality pre-rendered scene | Empty 3D grid |
| T1 size | **2 clicks + 2 typed values** | 2 clicks + feet/inch fields | ~9 clicks + 2 values (zoom in to see sizes, hide the guidance box, then rebuild in 3D) | Not possible (fixed layouts) | Not measured |
| T2 board colour | **5 clicks plus 1 dead end; a modal hides the deck** | **2 clicks**, docked panel, 3D updates live beside it | 3 clicks, plus an upsell pop-up | 3 clicks, scene updates | Bottom dock (not measured) |
| T3 price | **Always on screen, updates live** | Always on screen (top right) | None ("$$$$" tiers only) | None | None |
| T4 send or save | **"Send my design": name + email, no account** | Save needs a Trex account; no send to a builder | Save needs an account | Emails a selection summary, no account | My Projects / Save (not tested) |
| Phone | Works | Desktop only (their FAQ) | Refuses portrait ("flip your device") | **Works well: scene on top, half-height drawer** | Desktop only (their page) |

### Where DeckCraft already wins (keep it)

- **Live dollar price.** Only Trex also shows one.
- **Sending without an account.** Trex and TimberTech both hit a sign-in wall (shots 14, 21).
- **Phones.** Only Deckorators also works; Trex, TimberTech and Fiberon don't.
- **Speed.** Trex took 35 s and 157 MB; Fiberon took 32 s.
- **Real house and real sizes.** Deckorators looks better but can't resize anything.

### Where DeckCraft loses (fix it)

1. **Changing the board colour is buried.** The "Materials" ribbon tab offers only Board layout,
   Inlays and Draw a new shape (shot 02). The colour lives under All options → Design → Boards &
   finish. "All options" reflows the whole page (shot 03). The board sheet then covers the deck,
   and on phones it also covers the price (shots 04, 08). Trex does the same job in 2 clicks with
   the 3D still visible (shot 13).
2. **The first screen is a 2D plan.** Every competitor opens on a 3D view or a photo-quality scene
   (shots 11, 17, 25). Our 3D view looks good (shot 05) but is one tap away.
3. **On phones, the plan's size labels are 5–7 px tall** (measured 7×14 px for "20 ft"). That's
   unreadable, and the labels are hard to hit.
4. **The size fields don't select their number** when opened, so you have to delete "16" first.
   TimberTech preselects it (shot 19). The editable label is shown only by a dashed box.
5. **The phone 3D toolbar runs off the right edge** (Day/Night is cut off, shot 09).

### Habits worth borrowing (how it works, not how it looks)

| Habit | Seen in | Why |
|---|---|---|
| Material swatches in a **docked side panel with the 3D still visible** (desktop) | Trex (shot 13) | You see the colour on the deck as you pick it, in 2 clicks |
| A **half-height bottom drawer** with the scene above it (phone) | Deckorators (shot 28) | The same benefit on a phone; our full sheet hides everything |
| Photo swatches **with names and filter chips** (Browns / Greys) | Trex, Deckorators | Faster scanning than one long grid |
| A **summary with an "Edit" link per choice** before sending | Deckorators (shot 27) | It reads like a quote; each line jumps back to that choice |
| **Number preselected** when a size field opens | TimberTech (shot 19) | Type and go |
| **Shortcut letter in the tool label** ("Select [S]") | TimberTech (shot 18) | Pros learn the keys without a help page |

### Habits to avoid

- **Account walls before saving or sending:** Trex, TimberTech.
- **Upsell pop-ups mid-task:** TimberTech, shot 20.
- **Separate layout and 3D modes with a rebuild bar:** TimberTech.
- **An empty start where you drag to place:** Fiberon.
- **Hiding the price:** TimberTech, Deckorators, Fiberon.
- **Desktop only.**
- **Numbered step bars ("1 2 3 4"):** TimberTech's layout mode has one, and it is also the
  Outside Logic look we already ruled out.
- **Deckorators' "First, choose… Now choose…" sequence:** fine for them, too close to a wizard
  for us.

### Pro tools: the keys contractors already know

SketchUp's official default keys ([help.sketchup.com](https://help.sketchup.com/en/default-keyboard-shortcuts))
are: Space Select, L Line, R Rectangle, M Move, Q Rotate, S Scale, P Push/Pull, T Tape Measure,
E Eraser, C Circle, O Orbit and H Pan.

DeckCraft's Designer Mode (`ArchitectShortcuts.tsx`) matches on **M (move)** and **S (scale)**, and
its Enter-to-type-a-length works like SketchUp's Measurements box. It **clashes** on five keys:

| Key | DeckCraft | SketchUp |
|---|---|---|
| R | rotate | rectangle |
| T | move | tape measure |
| E | point editing | eraser |
| L | select similar | line |
| A | select all | arc |

A SketchUp user's muscle memory will pick the wrong tool. Designer Mode's Uvision-style layout
(Pro phases 1–5) already covers the look side for pros.

## 3. The plan (each phase waits for your OK)

Order follows your priorities: realism first, then sensible designs, then ease of use. These
phases are ease-of-use work, so they slot in where you say. Route JS on live main was
275.75/276 KB on 19 October, so all new panel code must load lazily. The headroom branch,
`perf/deckcraft-route-headroom` (237 KB, unpushed), would make room.

### P0 Measure honestly (small; recommended first)
- **Keep our own tests out of analytics.** Skip GA4, Meta and Ads when the browser reports
  automation (`navigator.webdriver`) or a test flag is set. Today our Playwright runs land in GA4
  and can fire lead conversions.
- **Check the queued-events question.** If gtag drops the load-time events, send them after
  `config`.
- **Owner checks (no code):**
  - Google Ads conversions on 22–23 September.
  - Whether `VITE_CLARITY_ID` is set in Netlify. Clarity session recordings of DeckCraft, for
    visitors who accept cookies, would show us real struggles.

### P1 Fold the teardown into PR 2 (four sheets: Draw · Materials · Extras · Price & send)
- **Materials** opens straight on board colours, as photo swatches with names and filter chips.
  - **Desktop:** a docked side panel beside the 3D view.
  - **Phone:** a half-height drawer with the deck still visible above.
  - Picking a colour shows it on the 3D deck.
  - Target: **2 taps** from opening Materials to a new colour, down from 5 plus a dead end.
- The ribbon's current Materials tab (Board layout, Inlays, Draw a new shape) moves into this sheet,
  so the dead end goes away.
- **Price & send** becomes a quote-style summary: each choice with its price and an Edit link,
  then the itemized total and the Send form, still with no account.

### P2 Open in 3D
- The first screen shows the default deck on the house in 3D, on desktop and phone; Plan stays one
  tap away.
- Optional, your call: a single row of 4 starting-deck pictures on the first visit. It's one choice
  and then you're in, with no step bar and no Next/Back.

### P3 Phone fixes
- Plan size labels at least 12 px, with 44 px tap areas.
- Size fields preselect their number when opened.
- The 3D toolbar wraps, or folds into one "View" menu, instead of running off the screen.

### P4 Pro keys (Designer Mode only)
- A **SketchUp keys** layout: Space select, L line, R rectangle, M move, Q rotate, S scale,
  T tape, E erase, O orbit, H pan.
- The letter shows in each tool's label, e.g. "Move [M]".
- Homeowners never see this.

### P5 Watch five people
- Three homeowners on their own phones and two contractors on laptops.
- They run the same four tasks while we watch without helping.
- **Pass:** each homeowner sizes the deck, changes the colour and reaches Send in under 2 minutes,
  with no help.
- Run it once before P1 to get a baseline, and again after P3.

## 4. Questions for you

1. **P0 first?** It's small and makes every later number honest.
2. **Open in 3D by default (P2)?** And do you want the 4-picture starting row?
3. **SketchUp keys (P4):** replace the current Designer Mode keys, or offer them as a setting?
4. **Testers (P5):** who are the five? Past clients, friends, crew?
5. **Clarity on DeckCraft:** do you want session recordings? They cover only visitors who accept
   cookies.
6. **Traffic:** DeckCraft gets about 1–2 real visitors a week. Should it get a bigger spot on the
   home page, the estimator and the menu? That's separate from this plan, but none of the above
   matters much without visitors.

## Ledger

### P0 scope lock (approved 2026-10-21: "Go with P0 … first")

**Objective:** keep our own tests out of analytics, and stop losing the events DeckCraft fires
before gtag.js loads.

Worktree `.claude/worktrees/analytics-p0`, branch `fix/analytics-skip-automation` off main ab447e1.

Acceptance checks:
- **A1.** On any host other than goldenmaplelandscaping.ca (or www.):
  - gtag.js, the Meta Pixel and Clarity never load;
  - no GA4, Ads or Meta event goes out, including lead and call conversions.
- **A2.** When `navigator.webdriver` is true (an automated browser), the same applies, even on the
  live host.
- **A3.** The `?notrack=1` opt-out:
  - opening any page with it remembers the choice in this browser and sends nothing;
  - `?notrack=0` clears it.
- **A4.** A `trackEngagement` event fired before gtag.js is configured is held. It is sent after the
  config and the queued page views, in order. Events after load send at once, as today.
- **A5.** `e2e/google-page-views.spec.ts` opts in through an init script and keeps passing. Its hits
  are answered locally, so none reaches Google.
- **A6.** Unchanged for a real visitor on the live host:
  - the head's consent default and the gtag load timing (first input, or 2.5 s at most);
  - one GA4 and one Ads page_view per navigation;
  - call and lead conversions fired before load are still sent;
  - Meta and Clarity only after consent;
  - the cookie bar;
  - the CRM behaviour trail (`behavior.ts`).

**Out of scope:** consent defaults and the cookie bar, GA4 admin settings, Ads settings, the
Clarity ID, and the P1 UI.

### Progress
- 2026-10-21 17:53: proved the drop. Event queued before config → not sent; after config → sent.
  Probe: session scratchpad `gtag-order-probe.mjs`.

- 2026-10-21 18:10: the hostname split shows 127.0.0.1 and localhost (CI on GitHub's Azure runners
  plus local runs) sent about half of all GA4 events since July.
- Test-first:
  - `scripts/check-tracking-gate.ts` (14 checks) was red because the module was missing, then green.
  - In `e2e/google-page-views.spec.ts`, 3 new tests were red on the unchanged build for the right
    reasons:
    - only `page_view` and `scroll` arrived, with no deckcraft events;
    - tags loaded on 127.0.0.1;
    - no `gm-notrack` was stored.
  - On the fixed build, 6/6 pass.
- Build: bundle unchanged (route JS 276.5/277, CSS 11.9/12). `npm run lint` exit 0, with the gate
  check wired into lint.

### P1 scope lock (approved 2026-10-21: "then fold the teardown into PR 2 as P1")

**Objective:** Option B's PR 2 (simplify plan, 2026-10-19), with the teardown's habits folded in.
One strip of four non-linear tabs, **Draw · Materials · Extras · Price & send**, replaces the
ribbon's category tabs and the "All options" task rail for homeowners.

Worktree `.claude/worktrees/four-sheets`, branch `feat/deckcraft-four-sheets` off main ab447e1.

Acceptance checks, for a homeowner (Designer Mode off):
- **B1. One navigation system.** The four tabs are the only design navigation:
  - no ribbon category tabs;
  - no "All options" toggle;
  - no task rail;
  - no modal design inspector.

  Any tab can be picked at any time, with no counter and no Next or Back. Plan / 3D / Framing
  stay as the view switch.
- **B2. Draw.**
  - The plan shows the tools Deck size, Shape & points, Stairs, House, Rails & screens and "Draw a
    new shape".
  - "Start with a shape" is open above the drawing.
  - Deck shape & size, Stairs & railings and House are one tap away in the panel.
- **B3. Materials.**
  - Opening it shows the 3D view, with the board colours in a panel and the deck still on screen.
    On desktop that's a docked panel beside the drawing; on phones the panel sits below a drawing
    that stays visible.
  - A new colour takes **2 taps** from load (Materials, then a colour), down from 5 plus a dead end.
  - Each colour shows its name.
  - Board layout and Inlays stay reachable from the panel.
- **B4. Extras.**
  - The plan tools are Patios & walls and Landscape.
  - The panel holds Lighting, Privacy, skirting & extras, and Backyard.
- **B5. Price & send.** A quote-style summary:
  - each section's current choice, its price effect and an **Edit** link that jumps to that tab and
    section;
  - the items still to quote;
  - **Send my design**, Share link and Download PDF.

  There is still no account. "Proposal & files" stays reachable below it.
- **B6. Unchanged:**
  - pricing, saved designs, autosave, share links and JSON;
  - the Send dialog;
  - the phone price bar;
  - the Pro workspace (`?designer=1`);
  - existing analytics labels.

  The one new label is `deck_home_tab_<draw|materials|extras|send>`, through `trackDeck`.
- **B7. Budgets and checks.** These pass:
  - the bundle budget, with route JS ≤ 277 KB and CSS ≤ 12 KB;
  - the first-paint check;
  - lint and typecheck.

  New e2e covers the homeowner path, draw → materials → price → the Send dialog opens, at desktop
  and phone widths. The deck e2e suite passes after the nav helpers and specs are updated.

**Out of scope:**
- P2 (open in 3D by default);
- P3 phone label sizes;
- P4 SketchUp keys;
- swatch filter chips;
- removing permit, CAD and crew exports from Proposal & files (D2 stays deferred).

### P0 review (engineering gate, independent Sonnet reviewers)
- **Round 1: CONCERNS.**
  - One IMPORTANT finding: the opted-in "accepted consent" spec still loaded Meta and Clarity for
    real.
  - Eight MINOR findings.
- **Fixes:**
  - One shared tag-host list; only Google's tag-manager scripts load, everything else is answered
    locally.
  - An ordering assertion (page_view before deckcraft_step).
  - `decideTracking` moved into `trackingGate.ts` with injected storage, plus 9 cases (throwing and
    missing storage).
  - `?notrack=` leaves the address bar once read.
  - A dev log; the queue flushed in a `finally`; a docblock fix.
- **Round 2: PASS.**
  - Applied: a try/catch around the address-bar cleanup, country-code Google hosts in the spec, and
    tag-manager libraries allowed through.
- Final: gate check 23/23, build OK, page-view spec 6/6.

### P1 rulings (author, for owner review on the preview)
- **R1.** The four tabs sit where the ribbon's category row was (`PlanToolPicker`) and show on every
  sheet.
  - Their tools show only on the plan.
  - Materials and Extras open the 3D view; Draw opens the plan; Price & send keeps the current view.
- **R2.** The page opens on Draw with no panel. Draw's own panel (Deck shape & size, Stairs &
  railings, House) opens from a new "Deck settings" button in the tools row.
- **R3.** Picking a tab doesn't change the plan tool, as the old category tabs didn't. Draw is the
  exception: it takes back a sizing tool. A tool picked from elsewhere (a section link, a warning,
  the agent) brings its own tab forward.
- **R4.** Phones get a drawer over the foot of the screen, above the price bar (at most 46% of the
  screen height). Desktop gets a 360 px docked column; the price moves left of it.
- **R5.** The cost estimator's studio leaves out Price & send, because it has its own price and "Use
  this deck".
- **R6.** Each section keeps its "next" link at the end of its body, as the old inspector did.
- **R7.** The rail, its "All options" toggle and the modal inspector are gone for homeowners.
  - `SectionList.tsx` is deleted.
  - `WorkspaceNavigation.tsx` keeps only the section icons Designer Mode shares.
  - Designer Mode keeps its "Focus drawing" toggle.
- **R8.** (after review round 1)
  - Opening a section from somewhere else (an Edit or next link, a warning, the agent, the context
    menu) brings its tab and panel forward but leaves the view and the plan tool alone. Only a tab
    click changes the view.
  - Phones: the drawer is at most 40% of the screen height and 360 px (this replaces R4's 46%).
    - When it opens, the drawing moves up under the header.
    - Going back to the drawing ("Edit on the plan", "Add") puts the drawer away.
  - A hidden panel stays loaded, so it reopens where it was left.
    - Picking the open tab again while its panel shows changes nothing.
    - Once the panel is hidden, picking the open tab brings it back, in the tab's view.
  - Replacing the design (import, start over, a shared link) closes the panel but keeps the tab.
  - Arrow keys move between the tabs; Enter or Space opens one, since Materials and Extras load 3D.
  - In the estimator's studio, Site & foundation and Proposal & files sit under Extras, so every next
    link stays inside its three tabs.

### P1 progress
- `scripts/check-deck-home-tabs.ts` (44 checks): red because the module was missing, then green.
  Wired into `check:deck`.
- `e2e/deck-home-tabs.spec.ts` (8 tests): 7 red on the unchanged designer; the eighth guards that
  Designer Mode has no tabs.
- First build:
  - route JS 276.5 → 274.4/277 KB;
  - route CSS 11.9 → 11.5/12 KB;
  - first paint 69 checks OK;
  - streamed Suspense boundaries 7 → 6 (the Deck body is no longer prerendered; count updated).
- On that build, 7/8 new tests passed. The 8th was my own over-broad "N of N" check, now scoped to
  the tab strip.
- Specs updated for the tabs:
  - the helpers in `e2e/nav.ts`;
  - architect-keys, architect-workspace, canvas-first, context-menu, deck-customer-view,
    deck-first-paint, deck-hardscape-picker, deck-homeowner-trim, deck-stair-path,
    deckcraft-ground-fit, deckcraft-site-designer, deckcraft-workspace, deckcraft, drawing-room and
    workspace-space.
- Checks OK: plan-sheet, funnel, ledger, home tabs.
- Full e2e on build 2: 309 passed, 26 failed, 2 skipped (1.1 h).
  - The failures were old-layout assumptions:
    - a price footer that "All options" used to create;
    - the toggle in the first paint;
    - a Home key pressed while focus was on the sheet tabs;
    - a "Download PDF" locator that now matches two buttons;
    - specs' own helpers clicking a "Materials" tab that now opens 3D;
    - a revision check that counted view changes, not design changes;
    - an open Files menu covering the tabs.
  - Two were real phone problems, fixed in the product:
    - **On phones the drawer covered almost all of the 3D view.** The drawer is now capped at 40% of
      the screen, and the drawing moves up under the header when a panel opens. The phone test now
      measures at least 200 px of drawing visible above the drawer.
    - **"Edit on the plan" and "Add" (inlays) sent the visitor to a drawing hidden by the drawer.**
      On phones, going back to the drawing now puts the drawer away.
  - Not a bug: tab and sheet changes move the agent snapshot's `revision`, while undo history stays
    empty and the design is byte-identical (probe in the session scratchpad,
    `revision-probe.mjs`).
- Price & send's summary hides the House row's "Looks never priced…" note; it showed squeezed into
  the quote list in the desktop capture.
- **Review round 1** (independent Sonnet reviewer): BLOCK. 1 critical, 4 important. Fixed:
  - the ledger check;
  - the estimator's tabs (no Price & send);
  - opening a section no longer changes the view or the tool;
  - section analytics;
  - the yard focus;
  - focus handling;
  - the panel preload;
  - the section-body styles;
  - manual tab activation;
  - dead CSS;
  - the bundle check;
  - missing tests.
- **Review round 2:** every round-1 finding resolved except B2 ("Start with a shape" above the
  drawing), which waits for you (D3). It raised 4 minor findings, all fixed:
  - reopening the same tab;
  - focus on a cold panel;
  - phone focus;
  - test comments and tolerances.
- **Visibility audit** (production build, third-party hosts blocked; tabs, tools, panel and price;
  desktop and phone; estimator): nothing under 3:1.
  - One AA miss was in the new UI: the panel's Send, white on #bb744b, 3.7:1. It now uses
    #a55e38 (4.9:1).
  - The older Send buttons are D6.
- **Review round 3:** PASS with 5 minor findings, all fixed:
  - phone refocus reads the tab at focus time;
  - focus requests cleared on a tab pick or Hide panel;
  - pergola test keeps CI's limit;
  - deterministic cold-panel test;
  - comment counts.
- **Full e2e on build 7:** 339 passed, 2 skipped, 1 failed.
  - The failure was the medallion inlay test, flaky 1 in 3.
  - Cause: since round 2, picking the open tab again switched to 3D even with its panel showing. The
    spec's helper does that between two inlays, so the medallion's tap was worked out while the
    plan came back from 3D.
  - Fix: picking the open tab with its panel showing changes nothing again (R8), with a test.
- **Build 8** (final code). Checks:
  - tsc and lint pass;
  - route JS 274.7/277 KB, route CSS 11.4/12 KB;
  - home tabs 82 checks; first paint 69; the bundle check's 105 checks pass.

  Tests:
  - deck-home-tabs: 15/15;
  - the medallion test: 5/5;
  - full e2e: 341 passed, 2 skipped, 1 failed (54.7 min).

  The failure is google-page-views' "call click before gtag.js arrives is queued and then sent":
  - it's on the home page and outside P1's diff;
  - it also failed 1 in 5 in isolation on this branch;
  - on the P0 branch, which reworks that queue, the spec passes 30/30 (6 tests × 5).

  So it's an existing flake on `main` that P0 fixes.
- **2026-10-22, committed and opened as PRs:** P0 is #202 (06e2d7f6) and P1 is #203 (55bf3239).
  #203's first CI run failed for one reason: opening Materials or Extras now switches to 3D, and
  CI's software WebGL is slow.
  - Comparable tests went from 50 to 83 minutes; shard 4 ran past its 22-minute step limit.
  - The PDF survey test starved, because 3D was drawing while the PDF rendered.

  The fix is in `e2e/nav.ts`:
  - `openDesignTask` and `pickPlanTool` reach Materials' and Extras' sections and tools the way a link
    does (the agent's `section.open`, which leaves the view as it is);
  - the tabs' own specs still click them.

  The local full suite went from 54.7 to 39.1 minutes.
- **CI run 2 (c12a09a1):** shards 1, 2 and 5 came back near their old times. Shard 4 passed all 57 tests in 20.8 minutes,
  but with about 4 minutes of setup the job hit its 25-minute limit and failed. The 3D drawing staying beside an open
  panel is by design (R4), and it slows that shard's proposal, night and PDF tests. Fix 5e1b5232:
  - seven shards; the timeouts and the `e2e` check name are unchanged;
  - `showTabTools` in nav.ts, which the tool-row spec now uses (it took 55 s, against 2 s before the tabs).
- **CI run 3 (5e1b5232):** seven shards didn't help. The count split put the 3D-heavy block plus the pergola tests in
  shard 5 of 7, which the 25-minute limit cancelled at test 45 of 49, every test passing so far. Fix f582ed21: back to
  six shards, with the step limit 22→28 minutes and the job limit 25→32.
- **2026-10-28: P0 and P1 merged and live.**
  - #202 merged; its production deploy succeeded at 14:13 UTC.
  - Two more commits went onto #203 before it merged:
    - 25b4055a: selecting Price & send now sends `deck_step_6_estimate`;
    - 886a371d: the proposal spec reads the phone from `business.ts`. `main` changed the public number to
      (705) 500-3581 on 10-25, and the spec still expected (705) 300-8015.
  - CI at 886a371d was all green (longest shard 17m39s). The owner merged #203 at 14:54 UTC (3842d49c); its deploy was
    still running when this was written.
  - **Open copy question:** the proposal's Next steps reads "Call or text Sophie, our AI receptionist, at (705)
    500-3581". `business.ts` says Sophie's own line, 705-300-8015, is now for texts and AI only.

### Deferred
- **D1.** Hydration still waits for the `DimensionsStep` chunk (`piecesReady`), although the Deck
  body is no longer prerendered. Dropping it needs `check-deck-first-paint.ts` changed. It's a small
  speed-up, left for later.
- **D2.** `WorkspaceNavigation.tsx` now holds only icons. Renaming it would touch 2 Designer Mode
  files.
- **D3.** The "Start with a shape" promotion (simplify plan B) is still below the drawing. It costs
  phone height; decide with P3.
- **D4.** Leads submitted from untracked pages still reach the CRM with their event id. Whether the
  CRM relays a server-side Meta CAPI Lead is outside this repo and unverified.
- **D5.** Headless browsers that hide `navigator.webdriver` aren't caught; use `?notrack=1` in those
  profiles.
- **D6.** Two "Send" buttons from before P1 are white on #bb744b, 3.7:1, which is under the 4.5:1 AA
  bar:
  - the price bar's "Send my design" (13 px);
  - the header's Send button (12 px; not measured in this audit).

  The new panel's Send uses the deeper gold (#a55e38, 4.9:1). Moving the other two to it changes the
  brand colour on every page view, so it's left for you.
- **D7, fixed in #203.** Review round 4 flagged a race on phones: a drawer button that picks another
  tab's tool (such as "Place screens on the drawing") could hand the focus to the old tab. The
  2026-10-22 local full run caught it once. `showCanvas(tool)` now works out the tab from the tool
  the click picked.
- **D8.** Review round 4 (minor). When a tool picked on the drawing or by the agent brings another
  tab forward while the panel is open, the panel shows that tab with every row collapsed. Picking the
  tab again leaves it so, by R8.

## Screenshots

DeckCraft: [01 first load](shots/01-deckcraft-desktop-first-load.jpg) ·
[02 Materials tab dead end](shots/02-deckcraft-materials-tab-dead-end.jpg) ·
[03 All options reflow](shots/03-deckcraft-all-options-reflow.jpg) ·
[04 boards modal](shots/04-deckcraft-boards-modal-covers-deck.jpg) ·
[05 3D](shots/05-deckcraft-desktop-3d.jpg) · [06 send form](shots/06-deckcraft-send-form.jpg) ·
[07 phone](shots/07-deckcraft-phone-first-load.jpg) · [08 phone boards sheet](shots/08-deckcraft-phone-boards-sheet.jpg) ·
[09 phone 3D](shots/09-deckcraft-phone-3d.jpg)

Trex: [10 loading](shots/10-trex-loading.jpg) · [11 first load](shots/11-trex-first-load.jpg) ·
[12 shape panel](shots/12-trex-shape-panel.jpg) · [13 colour, docked and live](shots/13-trex-colour-docked-live.png) ·
[14 account wall](shots/14-trex-save-needs-account.png)

TimberTech: [15 start chooser](shots/15-timbertech-start-chooser.jpg) · [16 templates](shots/16-timbertech-templates.jpg) ·
[17 3D](shots/17-timbertech-3d.jpg) · [18 layout mode + stepper](shots/18-timbertech-layout-mode-stepper.jpg) ·
[19 edit measurement](shots/19-timbertech-edit-measurement.jpg) · [20 upsell](shots/20-timbertech-upsell-interstitial.jpg) ·
[21 account wall](shots/21-timbertech-save-needs-account.jpg) · [22 portrait blocked](shots/22-timbertech-portrait-blocked.jpg)

Deckorators: [23 home style](shots/23-deckorators-home-style.jpg) · [24 deck layout](shots/24-deckorators-deck-layout.jpg) ·
[25 scene](shots/25-deckorators-scene.jpg) · [26 deck board](shots/26-deckorators-deck-board.jpg) ·
[27 summary](shots/27-deckorators-summary.jpg) · [28 phone drawer](shots/28-deckorators-phone-drawer.jpg)

Fiberon: [29 loading tips](shots/29-fiberon-loading-tips.jpg) · [30 empty start](shots/30-fiberon-empty-start.jpg) ·
[31 after drag](shots/31-fiberon-after-drag.jpg)

## Method notes and limits

- Trex and Fiberon run as game-engine canvases. They ignored automated clicks until the mouse
  hovered first, and Trex's typed size fields didn't register. Their T1 counts come from the panels
  as seen, not a finished run.
- The TimberTech test deck broke in 3D after the width edit. That may be my input, not their bug,
  so it isn't counted against them.
- Load times are single runs in the Claude browser, with DeckCraft cached; they aren't lab
  measurements.
- No accounts were made, no forms were sent, and cookie banners were declined.
