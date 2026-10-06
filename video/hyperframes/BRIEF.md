---
workflow: general-video
flow: automation
storyboard: no
message: "Your deck, designed before it's built — try DeckCraft free"
destination: instagram-reels / youtube / website
aspect: 1080x1920 (reels), 1920x1080 (showcase, bumper)
language: en
length: 4 x 15s reels, 30s showcase, 6s bumper
audience: Simcoe County homeowners planning a premium deck
---

## Intent

Marketing reels for Golden Maple Landscaping built from four new DeckCraft designs (video/designs). Each reel goes from
the drawn plan to the finished render, shows the design's real specs, turns day to night, and ends on the CTA:
"Design yours free — goldenmaplelandscaping.ca/deck-designer". Premium, calm, architectural; never salesy.

## Assets

- ../out/stills/<slug>/{day,night}/*.jpg — DeckCraft photographic renders (scripts/render-deck-orbit.ts)
- ../out/clips/<slug>-orbit.mp4 — 4s real-time 3D orbit per design, 1280x720, for the 16:9 showcase
- ../designs/specs.json — on-screen facts, computed by the DeckCraft engine (no hand-typed numbers, no prices)
- assets/brand/logo-mark.png — the GM maple mark

## Customizations

- Blueprint-to-render reveal, day-to-night crossfade on matched camera poses, spec count-ups, CTA end card.

## Notes

- Silent masters: the vidIQ music bed could not be generated (account out of credits). Audio is added at posting time.
- Brand fonts (Cormorant Garamond, Inter) are vendored under assets/fonts (OFL) and embedded with @font-face.
