#!/usr/bin/env bash
# Renders every DeckCraft still and camera move the reels use (video/README.md). Needs `npm run build` and the
# static server (node e2e/static-server.mjs) running. Software WebGL: about 45 minutes for the stills, 6 per clip.
#   video/render-assets.sh [stills|clips|all] [design-slug ...]
set -euo pipefail
cd "$(dirname "$0")/.."
what=${1:-all}; shift || true
designs=${*:-shanty-bay oro-station minets-point snow-valley}
# name@size:azimuth:elevation:distance:lift — azimuth -35 looks straight at the house, 0 is the designer's 3/4 view.
# The *-t shots are 2560x1920 so a 9:16 reel can pan across them at 1:1 pixels (a portrait camera crops a wide deck).
DAY="hero@1920x1080:0:13:0.9:2;front@1920x1080:-35:10:0.85:3;left@1920x1080:-72:14:0.9:2;plan@1920x1080:-35:86:1.0:0;low@1920x1080:-14:6:0.62:3;hero-t@2560x1920:0:14:1.05:3;front-t@2560x1920:-35:11:1.0:4"
NIGHT="hero@1920x1080:0:13:0.9:2;front@1920x1080:-35:10:0.85:3;hero-t@2560x1920:0:14:1.05:3;front-t@2560x1920:-35:11:1.0:4"
for d in $designs; do
  if [[ $what == all || $what == stills ]]; then
    npx tsx scripts/render-deck-orbit.ts --design video/designs/$d.json --scene day --stills "$DAY" --out video/out/stills/$d/day
    npx tsx scripts/render-deck-orbit.ts --design video/designs/$d.json --scene night --stills "$NIGHT" --out video/out/stills/$d/night
  fi
  if [[ $what == all || $what == clips ]]; then
    npx tsx scripts/render-deck-orbit.ts --design video/designs/$d.json --scene day --size 1280x720 --move orbit \
      --az -18 --elev 12 --dist 0.88 --lift 2 --sweep 28 --seconds 4 --fps 12 --interp 30 --out video/out/clips/$d-orbit.mp4
  fi
done
