# 3D viewer assets

The photographed scans and environments here are CC0 1.0 (public domain), from Poly Haven (https://polyhaven.com). The original material scans were downloaded on
2026-09-25; the replacement meadow environment was downloaded on 2026-09-26. Files are converted by scripts in `scripts/`.
The source downloads themselves are not committed.

## Lawn: `lawn-color.webp`, `lawn-normal.webp`, `lawn-roughness.webp`, `lawn.json`

- Leafy Grass by Charlotte Baglioni (published 2023-05-27), a photoscan 2 m square.
- Source: https://polyhaven.com/a/leafy_grass
- Files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/leafy_grass/leafy_grass_{diff,nor_gl,rough}_1k.jpg
- Converted by `scripts/build-deck-textures.ts`. The scan is an autumn lawn with leaf litter, so its colour map is
  graded to a kept lawn (mean sRGB 77, 97, 49). Each pixel keeps its brightness relative to the scan's mean and 35% of
  its own tint. The OpenGL normal and roughness maps are only re-encoded as WebP.
- Replaces Grass 008 (ambientCG, procedural), which the viewer used until Real Life G3.

## House detail: `masonry-detail.webp`, `masonry-normal.webp`, `rock-detail.webp`, `rock-normal.webp`

- Masonry: Concrete Floor 01 by Rob Tuytel (2018-07-16), a 2 m scan. https://polyhaven.com/a/concrete_floor_01
  Files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_01/concrete_floor_01_{diff,nor_gl}_1k.jpg
- Rock: Rock Face 03 by Dario Barresi and Rico Cilliers (2024-02-06), a 2.7 m scan. https://polyhaven.com/a/rock_face_03
  Files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/rock_face_03/rock_face_03_{diff,nor_gl}_1k.jpg
- Converted by `scripts/build-deck-textures.ts`. The colour map becomes a grey detail map, linear, with a mean of
  exactly 0.5; the wall's own colour, doubled, multiplies it, so the wall keeps the colour the customer picked. The
  OpenGL normal map is only re-encoded. Painted boards get a fine grain made in code instead (`houseSurfaces.ts`).

## Sky: `sky/sky-day-*`, `sky/sky-evening-*`, `sky/sky.json`

- Day: Suburban Garden by Dimitrios Savva (photography) and Jarod Guest (processing), https://polyhaven.com/a/suburban_garden.
  Source: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/suburban_garden_4k.hdr
  MD5: b4832c8c17072eeb4720d5dd9da2366f (downloaded 2026-09-29).
  The 4K residential panorama supplies daylight reflections and the generic background. Its photographed sun is
  extracted into the directional light, aligned with the panorama. This is illustrative staging, not the customer's site.
- Evening: Meadow, https://polyhaven.com/a/meadow.
  Source: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/8k/meadow_8k.hdr
  MD5: c1e25ad9fb1aba9ebc8babb952292727 (108457266 bytes).
  Evening retains the previous cool tree-lined clearing at 16%; this is an evening lighting study, not a separately photographed night sky.
- Converted by `scripts/build-deck-sky.ts`:
  - A bright sun and lens flare (12° round it) can be extracted into the directional light. Meadow's tree-filtered sun
    is below the extraction threshold and remains in the evening environment. Suburban Garden's bright sun is extracted.
    Daylight transfers some extracted sun energy to 2.2× sky fill for readable shaded surfaces, conserving measured
    horizontal-card luminance. The light intensity compensates the stored sun colour's max normalisation.
    Panorama exposure stays unchanged. Evening retains environment lighting without a directional key.
  - Both skies are white-balanced so sun plus sky light a horizontal card in neutral grey, and scaled so that card's
    irradiance is π.
  - `sky-*-ibl.hdr` is the 1024 × 512 lighting image (Radiance RGBE, run-length encoded).
  - `sky-*-band.webp` is the horizon from −4° to +41°, stored as the sRGB of radiance ÷ `bandScale`; daylight uses the
    4K source's band and evening the 8K source's band.

## Interior staging: `room-lounge.webp`

- Lebombo by Greg Zaal, CC0, https://polyhaven.com/a/lebombo.
- Source: https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/lebombo.jpg
  MD5: 64ac9ae7e4711d96da237d85e929337a (1873244 bytes), downloaded 2026-09-26.
- Resized to 2048 × 1024 and encoded as WebP at quality 86. Window-room shader projects this panorama onto
  a virtual room box behind each pane, with camera parallax and daytime/evening brightness.
- This is generic visual staging; it is not a photograph or reconstruction of the customer's interior.

## Furnished staging: room-atelier.webp

Generated with Codex imagegen on 2026-09-26 for generic contemporary living-room staging: cream sofa, walnut table, oak flooring and warm lighting. Encoded at 1600 px wide as WebP quality 90. It is a rectilinear interior photograph-style asset projected behind each house opening; it is not the customer's actual interior and is not a whole-house generated render. Daylight glass instead receives a planar reflection of the actual editable DeckCraft scene. Both sliding leaves use the same opening-space projection.

