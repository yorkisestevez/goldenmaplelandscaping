"""
Cuts the home-hero concept image into three depth layers for the pinned
parallax push-in (src/components/HeroDepth.tsx).

Why a script and not hand-masking: the layers have to be regenerated every time
the hero picture changes, and a depth model splits "stone wall in front of the
patio in front of the trees" far more consistently than a matting model, which
only knows subject/background.

  python scripts/build-hero-depth-layers.py
  python scripts/build-hero-depth-layers.py --near 0.62 --mid 0.34   # override the split
  python scripts/build-hero-depth-layers.py --preview out.jpg         # contact sheet, writes nothing

The exact flags used for the picture that is currently live are recorded in
src/data/heroDepth.ts.

Fully local, $0: Depth-Anything-V2-Small (transformers, CPU is fine — it runs
once per image) + OpenCV + Pillow. The source master lives OUTSIDE public/ so
the multi-MB original never ships (same masters/derivatives split as
build-founder-images.mjs).

Outputs, per width in WIDTHS, into public/images/concepts/:
  <slug>-flat  the untouched picture — mobile / reduced-motion hero and the LCP
  <slug>-bg    far layer, with the nearer layers painted out behind their edges
  <slug>-mid   middle layer (alpha), nearer layer painted out behind its edge
  <slug>-fg    nearest layer (alpha)

The paint-out matters: each layer scales more than the one behind it, so a thin
strip behind every cut edge gets uncovered during the push-in. Without it the
strip shows a doubled copy of the nearer object.

The -vN suffix is cache-busting against netlify.toml's 1-year immutable
/images/* header — NEVER overwrite a versioned file in place. New picture =
bump VERSION here and in src/data/heroDepth.ts.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "pictures for website 2026" / "hero-backyard-master.jpg"
OUT_DIR = ROOT / "public" / "images" / "concepts"
SLUG = "backyard-hero-depth"
VERSION = "v1"
WIDTHS = (1280, 1920, 2560)
MODEL = "depth-anything/Depth-Anything-V2-Small-hf"


def estimate_depth(img: Image.Image) -> np.ndarray:
    """Relative depth in 0..1, 1 = nearest the camera."""
    import torch
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    # predicted_depth, not the pipeline's "depth" image: that one is 8-bit, and
    # the whole far half of a backyard lives inside its bottom ~12 grey levels.
    processor = AutoImageProcessor.from_pretrained(MODEL)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL).eval()
    with torch.inference_mode():
        depth = model(**processor(images=img, return_tensors="pt")).predicted_depth[0].float().numpy()
    depth = cv2.resize(depth, img.size, interpolation=cv2.INTER_CUBIC)
    lo, hi = np.percentile(depth, (0.5, 99.5))
    return np.clip((depth - lo) / max(hi - lo, 1e-6), 0.0, 1.0)


def three_way_split(depth: np.ndarray) -> tuple[float, float]:
    """1-D k-means (k=3) on depth; thresholds are the midpoints between centres."""
    samples = depth[::4, ::4].reshape(-1, 1).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 1e-4)
    _, _, centres = cv2.kmeans(samples, 3, None, criteria, 5, cv2.KMEANS_PP_CENTERS)
    far, middle, near = sorted(float(c) for c in centres.ravel())
    return (middle + near) / 2, (far + middle) / 2


def soft_mask(depth: np.ndarray, threshold: float, width_px: int) -> np.ndarray:
    """Alpha 0..1 for everything nearer than `threshold`, with a clean soft edge."""
    hard = (depth >= threshold).astype(np.uint8)
    k = max(3, width_px // 320) | 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, kernel)   # drop speckle
    hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, kernel)  # fill pinholes
    # Drop stray islands (a clump of leaves that pokes past the threshold): a
    # speck of the wrong layer drifting across the sky is the most visible tell.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(hard, connectivity=8)
    keep = np.zeros(count, dtype=np.uint8)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= hard.size * 0.002
    hard = keep[labels]
    # Relative depth bunches up near 0 for distant things, so a fixed-width ramp
    # that is right for the near cut leaves the whole house half-transparent on
    # the far cut. Scale the ramp with the threshold.
    band = max(0.006, min(0.035, threshold * 0.2))
    ramp = np.clip((depth - (threshold - band)) / (2 * band), 0.0, 1.0)
    alpha = np.minimum(ramp, cv2.dilate(hard, kernel).astype(np.float32))
    alpha = np.maximum(alpha, cv2.erode(hard, kernel).astype(np.float32) * ramp)
    return cv2.GaussianBlur(alpha, (0, 0), sigmaX=max(1.0, width_px / 1600))


def polygon_mask(spec: str, w: int, h: int) -> np.ndarray:
    """'x,y x,y ...' in 0..1 image fractions -> soft 0..1 mask."""
    pts = np.array([[float(v) for v in pair.split(",")] for pair in spec.split()], dtype=np.float32)
    pts = (pts * [w, h]).round().astype(np.int32)
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(mask, [pts], 255)
    return cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), sigmaX=max(1.5, w / 1200))


def vegetation_matte(rgb: np.ndarray) -> np.ndarray:
    """Soft 0..1 mask of green-to-straw foliage, to matte grasses blade by blade.
    A depth cut around grasses is a blob that drags the paving between the blades
    along with it; the paving is grey, so saturation + hue separates them."""
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    hue, sat, val = hsv[..., 0] * 2, hsv[..., 1] / 255, hsv[..., 2] / 255   # hue in degrees
    in_hue = np.clip((hue - 18) / 12, 0, 1) * np.clip((150 - hue) / 20, 0, 1)
    saturated = np.clip((sat - 0.16) / 0.14, 0, 1)
    # deep shadow at the base of the clump has no reliable hue; keep it, it is never paving
    dark = np.clip((0.22 - val) / 0.08, 0, 1)
    return cv2.GaussianBlur(np.maximum(in_hue * saturated, dark), (0, 0), sigmaX=0.8)


def paint_out(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Fill the area under `alpha` from its surroundings, so the strip uncovered
    behind a nearer layer's edge shows plausible scenery instead of a double."""
    h, w = alpha.shape
    # Grow the hole well past the nearer layer's soft edge before filling. If the
    # hole stops AT the edge, the fill is seeded from the object's own fringe
    # pixels and the uncovered strip comes out as a dark smudge of house colour.
    grow = max(5, w // 140) | 1
    hole = cv2.dilate((alpha > 0.02).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow, grow)))

    small_w = 1280
    small = cv2.resize(rgb, (small_w, round(h * small_w / w)), interpolation=cv2.INTER_AREA)
    small_hole = cv2.resize(hole, small.shape[1::-1], interpolation=cv2.INTER_NEAREST)
    filled = cv2.inpaint(small, small_hole, 7, cv2.INPAINT_TELEA)
    filled = cv2.resize(filled, (w, h), interpolation=cv2.INTER_CUBIC)
    filled = cv2.GaussianBlur(filled, (0, 0), sigmaX=max(1.5, w / 1100))

    # Fully replaced everywhere inside the hole; feathered only on its OUTSIDE.
    feather = max(3, w // 500) | 1
    outer = cv2.dilate(hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (feather * 2 + 1, feather * 2 + 1)))
    blend = cv2.GaussianBlur(outer.astype(np.float32) / 255, (0, 0), sigmaX=feather / 2)
    blend = np.maximum(blend, hole.astype(np.float32) / 255)[..., None]
    return (rgb * (1 - blend) + filled * blend).astype(np.uint8)


def save(arr: np.ndarray, name: str, *, alpha: np.ndarray | None = None) -> list[dict]:
    written = []
    h, w = arr.shape[:2]
    for width in WIDTHS:
        if width > w:
            continue
        size = (width, round(h * width / w))
        if alpha is None:
            im = Image.fromarray(arr).resize(size, Image.LANCZOS)
        else:
            rgba = np.dstack([arr, (alpha * 255).astype(np.uint8)])
            im = Image.fromarray(rgba, "RGBA").resize(size, Image.LANCZOS)
        path = OUT_DIR / f"{SLUG}-{name}-{VERSION}-{width}.webp"
        if path.exists():
            sys.exit(f"refusing to overwrite {path.name} — /images/* is immutable-cached; bump VERSION")
        im.save(path, "WEBP", quality=82 if alpha is None else 84, method=6, exact=alpha is not None)
        written.append({"file": path.name, "kb": round(path.stat().st_size / 1024)})
    return written


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=SOURCE)
    ap.add_argument("--near", type=float, help="depth threshold for the nearest layer (0..1)")
    ap.add_argument("--mid", type=float, help="depth threshold for the middle layer (0..1)")
    ap.add_argument("--far-poly", help="'x,y x,y ...' (0..1 fractions): force this polygon into the far layer. "
                    "For scenery the depth model puts level with something nearer — a tree canopy that reads "
                    "as close as the fence in front of it has no threshold that separates the two.")
    ap.add_argument("--near-poly", help="'x,y x,y ...': restrict the near layer to this polygon. Only DISCRETE objects "
                    "belong in the near layer — anything that recedes continuously (a wall running away from the "
                    "camera, the ground) tears where the cut crosses it, because the two halves scale differently.")
    ap.add_argument("--near-foliage", action="store_true",
                    help="matte the near layer on foliage colour, and leave the original foliage in the middle layer "
                         "instead of painting it out — doubled grass reads as denser grass; a filled hole reads as haze")
    ap.add_argument("--preview", type=Path, help="write a debug contact sheet here and skip the real outputs")
    args = ap.parse_args()

    if not args.source.exists():
        sys.exit(f"source not found: {args.source}")
    img = Image.open(args.source).convert("RGB")
    rgb = np.asarray(img)
    h, w = rgb.shape[:2]

    depth = estimate_depth(img)
    auto_near, auto_mid = three_way_split(depth)
    near_t = args.near if args.near is not None else auto_near
    mid_t = args.mid if args.mid is not None else auto_mid

    fg_alpha = soft_mask(depth, near_t, w)
    if args.near_poly:
        fg_alpha = fg_alpha * polygon_mask(args.near_poly, w, h)
    if args.near_foliage:
        fg_alpha = fg_alpha * vegetation_matte(rgb)
    mid_alpha = np.clip(soft_mask(depth, mid_t, w), 0, 1)
    if args.far_poly:
        mid_alpha = mid_alpha * (1 - polygon_mask(args.far_poly, w, h))
    # The far layer only needs painting out behind the MIDDLE layer's edge (the
    # roofline / fence top). The near layer never uncovers the far one.
    bg_rgb = paint_out(rgb, mid_alpha)
    mid_rgb = rgb if args.near_foliage else paint_out(rgb, fg_alpha)

    report = {
        "source": str(args.source.relative_to(ROOT)) if args.source.is_relative_to(ROOT) else str(args.source),
        "size": [w, h],
        "thresholds": {"near": round(near_t, 3), "mid": round(mid_t, 3)},
        "coverage": {"fg": round(float(fg_alpha.mean()), 3), "mid": round(float(mid_alpha.mean()), 3)},
    }

    if args.preview:
        def tile(a: np.ndarray) -> np.ndarray:
            return cv2.resize(a, (640, round(h * 640 / w)), interpolation=cv2.INTER_AREA)
        checker = np.full_like(rgb, 255)
        checker[..., 1] = 0  # magenta = transparent
        def over(c: np.ndarray, a: np.ndarray) -> np.ndarray:
            return (c * a[..., None] + checker * (1 - a[..., None])).astype(np.uint8)
        depth_vis = cv2.applyColorMap((depth * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)[..., ::-1]
        top = np.hstack([tile(rgb), tile(depth_vis), tile(bg_rgb)])
        bottom = np.hstack([tile(over(mid_rgb, mid_alpha)), tile(over(rgb, fg_alpha)), tile(mid_rgb)])
        Image.fromarray(np.vstack([top, bottom])).save(args.preview, quality=85)
        print(json.dumps(report, indent=1))
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report["files"] = (
        save(rgb, "flat")
        + save(bg_rgb, "bg")
        + save(mid_rgb, "mid", alpha=mid_alpha)
        + save(rgb, "fg", alpha=fg_alpha)
    )
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
