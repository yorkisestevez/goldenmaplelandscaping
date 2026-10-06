# DeckCraft motion reels

Marketing videos built from DeckCraft's own 3D renders and composed in [HyperFrames](https://github.com/heygen-com/hyperframes)
(HTML → MP4). Deliverables: one 15 s vertical reel per design (1080×1920), a 30 s 16:9 showcase, and a 6 s bumper.

| Path | What it is |
| --- | --- |
| `designs/build-designs.ts` | The showcase designs: reviewed base designs + a patch each, validated like a customer upload. Writes `<slug>.json` (opens in the designer) and `specs.json` (on-screen facts from the engine's takeoff; no prices). |
| `../scripts/render-deck-orbit.ts` | Opens `/deck-designer?deck-capture=1`, sizes the 3D view to the output frame, and grabs posed stills or a camera move through the page's photographic pipeline. |
| `render-assets.sh` | Every still and orbit clip the videos use → `out/` (git-ignored). |
| `hyperframes/build.mjs` | Writes one HyperFrames project per deliverable to `hyperframes/projects/` (git-ignored), every scene a sub-composition. |
| `hyperframes/design.md`, `BRIEF.md` | Brand spec and brief the compositions follow. |

## Rebuild everything

```bash
npm ci --legacy-peer-deps && npm run build
node e2e/static-server.mjs &                      # serves build/client on :4031
npx tsx video/designs/build-designs.ts            # only after changing a design
CHROMIUM_PATH=/opt/pw-browsers/chromium video/render-assets.sh   # ~75 min on software WebGL
node video/hyperframes/build.mjs
for p in video/hyperframes/projects/*/; do (cd "$p" && npx --yes hyperframes@0.8.134 check && \
  npx --yes hyperframes@0.8.134 render -q delivery -o "../../../out/final/$(basename "$p").mp4"); done
```

`CHROMIUM_PATH` is only needed where Playwright's own browser isn't installed. The capture hook in
`Deck3DViewer.tsx` (`SnapshotBridge`) exists only with `?deck-capture=1`; customers never get it.

Software WebGL draws about 0.1 megapixel a second, so the reels pan across 2560×1920 stills at 1:1 pixels rather than
rendering 1080×1920 frames, and the orbit clips are drawn at 12 fps and motion-interpolated to 30.

Masters are silent: add the music bed at posting time (or mux one with ffmpeg).
