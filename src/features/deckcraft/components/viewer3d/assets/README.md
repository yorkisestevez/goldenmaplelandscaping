# 3D viewer assets

Every file here is CC0 1.0 (public domain), from Poly Haven (https://polyhaven.com). Each was downloaded on
2026-09-25 and converted by a script in `scripts/`. The downloads themselves are not committed.

## Lawn: `lawn-color.webp`, `lawn-normal.webp`, `lawn-roughness.webp`, `lawn.json`

- Leafy Grass by Charlotte Baglioni (published 2023-05-27), a photoscan 2 m square.
- Source: https://polyhaven.com/a/leafy_grass
- Files: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/leafy_grass/leafy_grass_{diff,nor_gl,rough}_1k.jpg
- Converted by `scripts/build-deck-textures.ts`. The scan is an autumn lawn with leaf litter, so its colour map is
  graded to a kept lawn (mean sRGB 77, 97, 49). Each pixel keeps its brightness relative to the scan's mean and 35% of
  its own tint. The OpenGL normal and roughness maps are only re-encoded as WebP.
- Replaces Grass 008 (ambientCG, procedural), which the viewer used until Real Life G3.

## Sky: `sky/sky-day-*`, `sky/sky-evening-*`, `sky/sky.json`

- Day: Suburban Field 02 by Jacopo Voltolina (2020-10-22), https://polyhaven.com/a/suburban_field_02.
  File: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/8k/suburban_field_02_8k.hdr
- Evening: Steinbach Field by Adrian Kubasa (2024-01-28), https://polyhaven.com/a/steinbach_field.
  File: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/8k/steinbach_field_8k.hdr
- Converted by `scripts/build-deck-sky.ts`:
  - The sun and its lens flare (12° round it) are painted out of the day sky with the sky beside it. Its energy
    becomes the scene's directional light, whose direction, colour and intensity are in `sky.json`. The evening sun is
    too dim to paint out and stays as the dusk glow.
  - Both skies are white-balanced so sun plus sky light a horizontal card in neutral grey, and scaled so that card's
    irradiance is π.
  - `sky-*-ibl.hdr` is the 1024 × 512 lighting image (Radiance RGBE, run-length encoded).
  - `sky-*-band.webp` is the 8192 × 1024 horizon from −4° to +41°, stored as the sRGB of radiance ÷ `bandScale`.
