# DeckCraft drop-off report (GA4)

Where visitors leave the deck designer, and what the ones who send a design did first. Built entirely from events the designer already sends (`src/features/deckcraft/deckAnalytics.ts`), so it needs no code, only a one-time GA4 setting and two saved explorations.

## What the designer sends
Every event goes to GA4 as an event name with an `event_label` parameter (`trackEngagement`, `src/utils/analytics.ts`). Labels are fixed words, never customer text, sizes or prices.

| Event | Labels | Counted |
|---|---|---|
| `deckcraft_step` | `deck_step_1_dimensions` … `deck_step_5_estimate` | once per visit |
| `deckcraft_feature` | `deck_shape_*`, `deck_pattern_*`, `deck_wrap`, `deck_corner_chamfer`, `deck_level_2`, `deck_stairs_*`, `deck_lighting`, `deck_bench`, … | once per visit |
| `deckcraft_view` | `deck_view_3d`, `deck_view_plan`, … | once per visit |
| `deckcraft_output` | `deck_pdf`, `deck_proposal`, `deck_summary`, `deck_json_save`, `deck_json_import` | every time |
| `deckcraft_link` | `deck_link_opened`, `deck_link_failed`, `deck_link_went_back` | every time |
| `deckcraft_send` | `deck_send_opened`, `deck_send_submitted`, `deck_send_sent`, `deck_send_failed` | every time |

A sent design also fires the site's lead conversion (`generate_lead`, form `deck-design`). Its value is the priced subtotal, and it passes the same qualification rules as every other form.

## One-time setting
GA4 → Admin → Custom definitions → **Create custom dimension**: name `Event label`, scope **Event**, event parameter `event_label`. Without it the labels are not available in reports. It only applies to data collected after it is created.

## Exploration 1: the design funnel
GA4 → Explore → **Funnel exploration**, open funnel off, device category as the breakdown:

1. Page view, page path contains `/deck-designer`
2. `deckcraft_step`, Event label = `deck_step_2_materials`
3. `deckcraft_step`, Event label = `deck_step_3_stairs_railings`
4. `deckcraft_step`, Event label = `deck_step_5_estimate`
5. `deckcraft_send`, Event label = `deck_send_opened`
6. `deckcraft_send`, Event label = `deck_send_sent`

Read it as: the biggest percentage drop is the next thing to improve. For example, a large drop from 5 to 6 points at the send form, while a phone-only drop at step 2 points at the phone layout (item A3 in the plan).

## Exploration 2: what senders did first
GA4 → Explore → **Free form**. Segment A is users with `deckcraft_send` / `deck_send_sent`; segment B is all users with `deckcraft_step` / `deck_step_1_dimensions`. Rows are Event label, filtered to event name `deckcraft_feature` or `deckcraft_view`. The metric is Total users.

A feature much more common among senders than among all designers is worth promoting, for example in the default design or the intro text. A feature nobody uses is a candidate to simplify.

## Monthly check (10 minutes)
- Funnel completion rate and the step with the biggest drop, desktop compared with phone.
- `deck_send_failed` and `deck_link_failed` counts. Both should stay near zero; a rise means something is broken.
- The five most common features among senders.
- Outputs (`deck_pdf`, `deck_proposal`) compared with sends. Many PDFs but few sends suggests people shop the proposal elsewhere, so follow up on the proposal itself.

## Limits
- Steps and features count once per visit (per browser tab session), so the numbers mean "visits that reached…", not total clicks.
- Ad blockers and declined tracking hide some visits. Sent designs are also recorded in Netlify and the CRM, which remain the source of truth for lead counts.
