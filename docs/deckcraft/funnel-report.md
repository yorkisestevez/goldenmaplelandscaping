# DeckCraft drop-off report (GA4)

This report shows where visitors leave the deck designer, and what the ones who send a design did first. It is built entirely from events the designer already sends (`src/features/deckcraft/deckAnalytics.ts`). It needs no code, only a one-time GA4 setting and a few saved explorations.

## What the designer sends
Every event goes to GA4 as an event name with an `event_label` parameter (`trackEngagement`, `src/utils/analytics.ts`). Labels are fixed words, never customer text, sizes or prices.

| Event | Labels | Counted |
|---|---|---|
| `deckcraft_step` | `deck_step_1_dimensions` … `deck_step_5_backyard`, `deck_step_6_estimate`. Since the redesign, a label means "opened a section" (see below). | once per visit |
| `deckcraft_section` | `deck_section_<id>` when a section is opened, and `deck_changed_<id>` on the first edit in it. The ids are `house`, `deck`, `boards`, `stairs`, `lighting`, `extras`, `site`, `backyard` and `proposal`. | once per visit |
| `deckcraft_plan` | Size & place tool: `deck_plan_drag` (a handle on the site plan dragged, or moved from the keyboard), `deck_plan_typed` (a width or depth typed on the plan), `deck_plan_shortcut` (a shape shortcut). Stairs tool: `deck_plan_stairs` (stairs put on an edge or slid along it). Draw outline tool: `deck_plan_outline` (a custom outline started, or an edge moved). House tool: `deck_plan_house` (the house resized from its wall ends). | once per visit |
| `deckcraft_feature` | `deck_shape_*`, `deck_pattern_*`, `deck_wrap`, `deck_corner_chamfer`, `deck_level_2`, `deck_stairs_*`, `deck_lighting`, `deck_bench`, `deck_backyard`, `deck_patio`, `deck_retaining_wall`, `deck_water_feature`, `deck_fire_pit`, `deck_outdoor_kitchen`, `deck_turf`, `deck_landscape_lighting`, … | once per visit |
| `deckcraft_view` | `deck_view_plan` (the site plan, sent on every page load), `deck_view_3d`, `deck_view_overview`, `deck_view_front`, `deck_view_top` (the 3D sheet's cameras), `deck_view_drawing` (the Framing sheet's 2D plan), `deck_view_structure`, `deck_view_hardware`, `deck_view_foundation`, `deck_view_docked` (a phone pinned the drawing while editing) | once per visit |
| `deckcraft_output` | `deck_pdf`, `deck_proposal`, `deck_summary`, `deck_json_save`, `deck_json_import` | every time |
| `deckcraft_link` | `deck_link_opened`, `deck_link_failed`, `deck_link_went_back` | every time |
| `deckcraft_send` | `deck_send_opened`, `deck_send_submitted`, `deck_send_sent`, `deck_send_failed` | every time |

A sent design also fires the site's lead conversion (`generate_lead`, form `deck-design`). Its value is the priced subtotal, and it passes the same qualification rules as every other form.

## What changes on the day the redesign goes live
The "Drawing Set" redesign (phases R1 to R7, built 2026-09-24) goes live as one release. From that day:

- **A step label means "opened a section", not "pressed Continue".** The numbered wizard became sections a visitor opens in any order. The page load still sends `deck_step_1_dimensions`, and opening a section sends the label of the wizard step it replaced:

  | Section | Step label it sends |
  |---|---|
  | House, Deck shape & size | `deck_step_1_dimensions` |
  | Boards & finish | `deck_step_2_materials` |
  | Stairs & railings | `deck_step_3_stairs_railings` |
  | Lighting; Privacy, skirting & extras; Site & foundation | `deck_step_4_site_extras` |
  | Backyard | `deck_step_5_backyard` |
  | Proposal & files (the estimate, send, proposal, PDF and files) | `deck_step_6_estimate` |

- **The page opens on the site plan.** `deck_view_plan` is sent on every load, where before the redesign the load sent `deck_view_3d`. `deck_view_3d` now means "chose the 3D sheet", so its share of visits drops by design. Phones no longer download the 3D view until it is chosen.
- **Drawing on the plan is counted by `deckcraft_plan`.** Every label starts at zero on the release date. "Draw my own" opens the Draw outline tool rather than the Deck section, so `deck_section_deck` may be a little lower for visitors who draw their own outline.
- **The price effect beside each option sends no event of its own.** A choice made after seeing it is counted as before, by `deck_changed_<id>` and the feature labels. The phone's "Show price effect" button is not counted.

Because visitors no longer have to pass step 2 to reach step 6, the step funnel's percentages are not comparable across the release. Judge the redesign by the send rate instead: `deck_send_sent` ÷ page views of `/deck-designer`, for the four weeks before the release against the four weeks after. Write the release date here when it ships: ____.

## One-time setting
GA4 → Admin → Custom definitions → **Create custom dimension**: name `Event label`, scope **Event**, event parameter `event_label`. Without it the labels are not available in reports. It only applies to data collected after it is created.

## Exploration 1: the design funnel
GA4 → Explore → **Funnel exploration**, open funnel off, device category as the breakdown.

From the redesign release:

1. Page view, page path contains `/deck-designer`
2. Any `deckcraft_section` event, or `deckcraft_plan` with Event label = `deck_plan_drag` (a visitor who opened a section or sized the deck on the plan)
3. `deckcraft_step`, Event label = `deck_step_2_materials` (opened Boards & finish)
4. `deckcraft_step`, Event label = `deck_step_6_estimate` (opened Proposal & files)
5. `deckcraft_send`, Event label = `deck_send_opened`
6. `deckcraft_send`, Event label = `deck_send_sent`

For data before the release, steps 2 to 4 were `deck_step_2_materials`, `deck_step_3_stairs_railings` and `deck_step_6_estimate` (step 5 is the backyard, which people may skip).

Read it as: the biggest percentage drop is the next thing to improve. For example, a large drop from 5 to 6 points at the send form, while a phone-only drop at step 2 points at the phone layout.

## Exploration 2: what senders did first
GA4 → Explore → **Free form**. Segment A is users with `deckcraft_send` / `deck_send_sent`; segment B is all users with `deckcraft_step` / `deck_step_1_dimensions`. Rows are Event label, filtered to event name `deckcraft_feature` or `deckcraft_view`. The metric is Total users.

A feature much more common among senders than among all designers is worth promoting, for example in the default design or the intro text. A feature nobody uses is a candidate to simplify.

Note: before 2026-09-23 the estimate was `deck_step_5_estimate`; the backyard step came in then.

## Exploration 3: section reach (from the redesign release)
GA4 → Explore → **Free form**. Rows are Event label, filtered to event name `deckcraft_section`; the metric is Total users. For each section, compare `deck_section_<id>` (opened) with `deck_changed_<id>` (changed something in it).

A section that many open but few change is a candidate to simplify. One that senders change far more often than others is worth promoting.

## Exploration 4: drawing on the plan (from the redesign release)
GA4 → Explore → **Free form**. Segment A is users with `deckcraft_send` / `deck_send_sent`; segment B is all users with `deckcraft_view` / `deck_view_plan`. Rows are Event label, filtered to event name `deckcraft_plan` or `deckcraft_view`; the metric is Total users.

It shows, for senders against everyone:
- how many visitors size the deck on the plan (`deck_plan_drag`), type a figure (`deck_plan_typed`) or use a shape shortcut (`deck_plan_shortcut`);
- which of the plan's other tools they use (`deck_plan_stairs`, `deck_plan_outline`, `deck_plan_house`);
- how many go on to the 3D sheet (`deck_view_3d`) or pin the drawing on a phone (`deck_view_docked`).

## Monthly check (10 minutes)
- Funnel completion rate and the step with the biggest drop, desktop compared with phone.
- `deck_send_failed` and `deck_link_failed` counts. Both should stay near zero; a rise means something is broken.
- The five most common features among senders, and how many senders add a backyard (`deck_backyard`).
- Outputs (`deck_pdf`, `deck_proposal`) compared with sends. Many PDFs but few sends suggests people shop the proposal elsewhere, so follow up on the proposal itself.

## Limits
- Steps, sections, plan use and features count once per visit (per browser tab session), so the numbers mean "visits that reached…", not total clicks.
- Ad blockers and declined tracking hide some visits. Sent designs are also recorded in Netlify and the CRM, which remain the source of truth for lead counts.
