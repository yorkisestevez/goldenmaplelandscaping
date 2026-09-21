"""
Upscales the home-hero master so it holds up full-bleed on a 2560px display.

Image generators hand back ~1376px-wide files; the hero pushes in to 1.3x on
top of covering the viewport, so the raw file goes visibly soft. This runs an
ESRGAN-family model tiled on the local GPU ($0), then settles at TARGET_WIDTH
with Lanczos — a 4x model downsampled to 2x keeps the recovered edge detail
without the crunchy over-sharpened look of the native 4x output.

  python scripts/upscale-hero-master.py
  python scripts/upscale-hero-master.py --weights "D:/models/4x-UltraSharp.pth"

Output lands next to the source as <name>-up.png (masters folder, never
shipped). Feed it to build-hero-depth-layers.py with --source.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "pictures for website 2026" / "hero-backyard-master.jpg"
WEIGHTS = Path.home() / "Documents" / "ComfyUI" / "models" / "upscale_models" / "4x-UltraSharp.pth"
TARGET_WIDTH = 2752
TILE = 384
OVERLAP = 32


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=SOURCE)
    ap.add_argument("--weights", type=Path, default=WEIGHTS)
    args = ap.parse_args()
    for p in (args.source, args.weights):
        if not p.exists():
            sys.exit(f"not found: {p}")

    from spandrel import ModelLoader

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = ModelLoader().load_from_file(str(args.weights)).to(device).eval()
    scale = model.scale

    src = np.asarray(Image.open(args.source).convert("RGB"), dtype=np.float32) / 255
    h, w = src.shape[:2]
    out = np.zeros((h * scale, w * scale, 3), dtype=np.float32)
    weight = np.zeros((h * scale, w * scale, 1), dtype=np.float32)

    # Feathered tile blend: a hard tile seam shows up as a faint grid on flat
    # areas like the sky and the paver faces.
    ramp = np.minimum(np.arange(TILE * scale) + 1, OVERLAP * scale) / (OVERLAP * scale)

    step = TILE - OVERLAP
    with torch.inference_mode():
        for y in range(0, h, step):
            for x in range(0, w, step):
                y0, x0 = min(y, max(h - TILE, 0)), min(x, max(w - TILE, 0))
                tile = src[y0:y0 + TILE, x0:x0 + TILE]
                t = torch.from_numpy(tile).permute(2, 0, 1).unsqueeze(0).to(device)
                up = model(t).clamp(0, 1).squeeze(0).permute(1, 2, 0).float().cpu().numpy()
                th, tw = up.shape[:2]
                wy = np.minimum(ramp[:th], ramp[:th][::-1])[:, None, None]
                wx = np.minimum(ramp[:tw], ramp[:tw][::-1])[None, :, None]
                m = wy * wx
                ys, xs = y0 * scale, x0 * scale
                out[ys:ys + th, xs:xs + tw] += up * m
                weight[ys:ys + th, xs:xs + tw] += m

    out = np.clip(out / np.maximum(weight, 1e-6), 0, 1)
    big = Image.fromarray((out * 255).round().astype(np.uint8))
    size = (TARGET_WIDTH, round(big.height * TARGET_WIDTH / big.width))
    final = big.resize(size, Image.LANCZOS)
    dest = args.source.with_name(f"{args.source.stem}-up.png")
    final.save(dest)
    print(f"{dest.name}: {final.size[0]}x{final.size[1]} (model x{scale}, device {device.type})")


if __name__ == "__main__":
    main()
