"""Recover Techo-Bloc Diamond 02-07 laying patterns from the manufacturer's AutoCAD hatch atlas (page 12).

Every Diamond drawing is a lozenge tiling: each 60-degree rhombus covers two unit triangles of one triangular lattice.
This generator (independent of the source-face verifier) measures the lattice from the drawn vector joints, then
decides for every unit triangle which neighbour it shares a stone with by sampling a fresh raster render: exactly one
of its three edges is undrawn. The smallest translations that preserve that pairing give the repeat.

Geometry keeps the published 313 x 181 x 100 mm stone (acute angle 2*atan(90.5/156.5) = 60.08 degrees):
  * one edge direction (chevrons 02/03): rows are strips of the actual stone, exact, no residual;
  * three directions (04-07): an exact 60-degree set-out from the published 181 mm side; the stone fits inside its
    lozenge with at most 0.25 mm at each acute tip (a nominal clearance, not an installed joint).
The atlas figures are uncoloured line drawings: no colour or tonal composition is claimed.
Output: scripts/hardscape-techo-diamond-draft.json (a draft; only reviewed records are promoted to the manifest).
"""
from __future__ import annotations

import collections
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parent
sys.path.insert(0, str(WORK / 'shape-python-deps'))
import numpy as np  # noqa: E402
import pdfplumber  # noqa: E402
from shapely.affinity import translate  # noqa: E402
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box  # noqa: E402
from shapely.ops import polygonize, unary_union  # noqa: E402

ATLAS = WORK / 'paver-pattern-recovery' / 'techo-hatch-atlas.pdf'
SOURCE_URL = 'https://www.techo-bloc.com/assets/a2/b0/a2b028a8-8390-491a-a35f-f8111cc607bb/AutoCAD%20Hatch%20Patterns%20PDF.pdf#page=12'
PAGE = 12
SCALE = 8
LENGTH, WIDTH = 313.0, 181.0          # published envelope: long and short diagonals of the rhombus
SIDE = math.hypot(LENGTH / 2, WIDTH / 2)
HALF = math.degrees(math.atan2(WIDTH / 2, LENGTH / 2))   # half the acute angle
ACUTE = 2 * HALF
PATTERNS = {2: 'chevron-pattern-02-100-diamond', 3: 'chevron-pattern-03-100-diamond', 4: 'cubic-pattern-04-100-diamond',
            5: 'cubic-diamond-pattern-05-100-diamond', 6: 'cubic-diamond-pattern-06-100-diamond', 7: 'geometric-pattern-07-100-diamond'}
NAMES = {2: 'Chevron pattern 02 - 100% Diamond', 3: 'Chevron pattern 03 - 100% Diamond', 4: 'Cubic pattern 04 - 100% Diamond',
         5: 'Cubic diamond pattern 05 - 100% Diamond', 6: 'Cubic diamond pattern 06 - 100% Diamond', 7: 'Geometric pattern 07 - 100% Diamond'}


def frame(page, number):
    words = page.extract_words(keep_blank_chars=True)
    label = next(w for w in words if w['text'].strip() == f'TB01_DIAMOND 0{number}')
    rect = min((r for r in page.rects if r['width'] > 60 and 0 < r['top'] - label['bottom'] < 80 and r['x0'] - 6 < label['x0'] < r['x1']), key=lambda r: r['width'])
    border = [c for c in page.curves if c.get('stroke') and (c.get('linewidth') or 0) >= 0.25 and c['x0'] >= rect['x0'] - 0.5 and c['x1'] <= rect['x1'] + 0.5 and c['top'] >= rect['top'] - 0.5 and c['bottom'] <= rect['bottom'] + 0.5 and c['x1'] - c['x0'] > 0.85 * rect['width']]
    b = min(border, key=lambda c: c['x1'] - c['x0']) if border else rect
    return (b['x0'], b['top'], b['x1'], b['bottom'])


def joint_directions(page, fr):
    """The three drawn joint directions (degrees mod 180) and the spacing of parallel joints (points)."""
    x0, t0, x1, b1 = fr
    segs = []
    for line in page.lines:
        colour = line.get('stroking_color')
        values = colour if isinstance(colour, (list, tuple)) else [colour]
        if any(v is not None and float(v) >= 0.5 for v in values):
            continue  # grey strokes triangulate the highlighted module's fill; joints are black
        (ax, ay), (bx, by) = line['pts'][0], line['pts'][-1]
        if x0 <= min(ax, bx) and max(ax, bx) <= x1 and t0 <= min(ay, by) and max(ay, by) <= b1 and math.hypot(bx - ax, by - ay) > 1:
            segs.append(((ax, ay), (bx, by)))
    angles = collections.Counter(round(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180) % 180 for a, b in segs)
    dirs = []
    for ang, _ in angles.most_common():
        if all(min(abs(ang - d), 180 - abs(ang - d)) > 20 for d in dirs):
            dirs.append(ang)
        if len(dirs) == 3:
            break
    return sorted(dirs), segs


def refine(segs, deg):
    """Mean exact angle of the segments near deg, and the spacing between their parallel lines."""
    group = [(a, b) for a, b in segs if min(abs(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180 - deg), 180 - abs(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180 - deg)) < 3]
    ang = math.degrees(math.atan2(sum(b[1] - a[1] for a, b in group if b[0] >= a[0]) - sum(b[1] - a[1] for a, b in group if b[0] < a[0]),
                                  sum(abs(b[0] - a[0]) for a, b in group)))
    nx, ny = -math.sin(math.radians(ang)), math.cos(math.radians(ang))
    offsets = sorted({round((a[0] * nx + a[1] * ny) * 20) / 20 for a, _ in group})
    gaps = [q - p for p, q in zip(offsets, offsets[1:]) if q - p > 1]
    return ang, float(np.median(gaps)) if gaps else None


def lattice(page, fr):
    dirs, segs = joint_directions(page, fr)
    a_ang, _ = refine(segs, dirs[0])
    b_ang, _ = refine(segs, dirs[1])
    # every stone edge is drawn as its own segment: the unit triangle's side is their common length
    lengths = sorted(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in segs)
    mode = collections.Counter(round(v, 1) for v in lengths).most_common(1)[0][0]
    spacing = float(np.median([v for v in lengths if abs(v - mode) < 0.1 * mode]))
    e1 = np.array([math.cos(math.radians(a_ang)), math.sin(math.radians(a_ang))]) * spacing
    e2 = np.array([math.cos(math.radians(a_ang + 60)), math.sin(math.radians(a_ang + 60))]) * spacing
    # origin: an endpoint shared by segments of two directions near the frame centre
    cx, cy = (fr[0] + fr[2]) / 2, (fr[1] + fr[3]) / 2
    ends = collections.Counter((round(p[0], 1), round(p[1], 1)) for s in segs for p in s)
    origin = min((p for p, n in ends.items() if n >= 2), key=lambda p: math.hypot(p[0] - cx, p[1] - cy))
    return {'dirs': dirs, 'angle': a_ang, 'angleB': b_ang, 'spacing': spacing, 'e1': e1, 'e2': e2, 'origin': np.array(origin)}


def stones_from_joints(segs, lat):
    """Stones as faces of the drawn joint graph (endpoints snapped to shared vertices), keyed to the lattice.

    Each rhombic face gives (i, j, kind): kind 0/1/2 = its short diagonal (the edge its two unit triangles share)
    lies along e1, e2 - e1 or e2. Centres are rounded to half-cell lattice positions, so small shifts at the
    drawing's hatch-tile seams do not break the pattern."""
    ends = []
    for a, b in segs:
        ends += [a, b]
    clusters = []
    for p in ends:
        for c in clusters:
            if math.hypot(c[0] - p[0], c[1] - p[1]) < 0.35:
                break
        else:
            clusters.append(p)

    def snapped(p):
        return min(clusters, key=lambda c: math.hypot(c[0] - p[0], c[1] - p[1]))
    lines = [LineString([snapped(a), snapped(b)]) for a, b in segs if snapped(a) != snapped(b)]
    faces = [f for f in polygonize(unary_union(lines)) if f.area > 0.2 * lat['spacing'] ** 2]
    e1, e2 = lat['e1'], lat['e2']
    inv = np.linalg.inv(np.column_stack([e1, e2]))
    ref = min(faces, key=lambda f: math.hypot(f.centroid.x - lat['origin'][0], f.centroid.y - lat['origin'][1]))
    base = np.array([ref.centroid.x, ref.centroid.y])
    edge = {0: e1, 1: e2 - e1, 2: e2}
    # a dark fill edge can split one highlighted stone into two unit triangles: rejoin such pairs when their
    # union is a single stone-sized rhombus
    unit = lat['spacing'] ** 2 * math.sqrt(3) / 2
    halves = [f for f in faces if len(list(f.simplify(0.3).exterior.coords)) == 4 and abs(f.area / unit - 0.5) < 0.08]
    rejoined, used = [], set()
    for a in range(len(halves)):
        for b in range(a + 1, len(halves)):
            if a in used or b in used or halves[a].intersection(halves[b]).length < 0.8 * lat['spacing']:
                continue
            union = unary_union([halves[a], halves[b]])
            if union.geom_type == 'Polygon' and len(list(union.simplify(0.3).exterior.coords)) == 5 and abs(union.area / unit - 1) < 0.08:
                rejoined.append(union)
                used.update((a, b))
    faces = [f for f in faces if not any(f is halves[i] for i in used)] + rejoined
    stones, odd = [], 0
    for f in faces:
        pts = list(f.simplify(0.3).exterior.coords)[:-1]
        if len(pts) != 4 and f.area >= 0.97 * f.convex_hull.area:
            pts = list(f.convex_hull.simplify(0.3).exterior.coords)[:-1]  # a joint meets this edge mid-way (T-junction)
        if len(pts) != 4:
            odd += 1
            continue
        d1, d2 = np.subtract(pts[2], pts[0]), np.subtract(pts[3], pts[1])
        short = d1 if np.linalg.norm(d1) < np.linalg.norm(d2) else d2
        kind = max(edge, key=lambda k: abs(np.dot(short, edge[k])) / (np.linalg.norm(short) * np.linalg.norm(edge[k])))
        u, v = inv @ (np.array([f.centroid.x, f.centroid.y]) - base)
        stones.append((float(u), float(v), kind))
    return stones, faces, odd, len(rejoined)


def lattice_keys(stones, rounds=4):
    """Snap stone centres onto the lozenge lattice (half-cell steps). The key-to-centre map is refitted by least
    squares from stones near the reference outward, so a slightly mis-measured scale or angle cannot accumulate."""
    uv = np.array([[u, v] for u, v, _ in stones])
    kinds = [k for _, _, k in stones]
    mapping = np.eye(2)
    offset = np.zeros(2)
    radius = 3.0
    for _ in range(rounds):
        fitted = (uv - offset) @ np.linalg.inv(mapping).T
        near = np.linalg.norm(fitted, axis=1) <= radius
        keys = np.round(2 * fitted) / 2
        if near.sum() >= 6:
            design = np.column_stack([keys[near], np.ones(near.sum())])
            coef, *_ = np.linalg.lstsq(design, uv[near], rcond=None)
            mapping, offset = coef[:2].T, coef[2]
        radius *= 2
    fitted = (uv - offset) @ np.linalg.inv(mapping).T
    residual = float(np.max(np.abs(2 * fitted - np.round(2 * fitted)))) if len(fitted) else 0.0
    return {(int(round(2 * a)), int(round(2 * b)), k) for (a, b), k in zip(fitted, kinds)}, residual


def period(keys):
    """Two shortest independent translations (lattice cells) mapping every observed stone whose translate lands
    inside the drawn area onto an observed stone. The drawn area is the hull of the observed stones, one cell in."""
    have = set(keys)
    region = MultiPoint([(k[0], k[1]) for k in have]).convex_hull.buffer(-2.5)
    found = []
    cands = sorted(((i, j) for i in range(-20, 21, 2) for j in range(-20, 21, 2) if (i, j) != (0, 0)), key=lambda v: v[0] ** 2 + v[1] ** 2 + v[0] * v[1])
    for di, dj in cands:
        tested = [k for k in have if region.contains(Point(k[0] + di, k[1] + dj))]
        if len(tested) < 12 or any((k[0] + di, k[1] + dj, k[2]) not in have for k in tested):
            continue
        if not found or found[0][0] * dj - found[0][1] * di != 0:
            found.append((di // 2, dj // 2))
        if len(found) == 2:
            return found
    return found


def stone_polygon(cx, cy, rot):
    a = math.radians(rot)
    pts = [(LENGTH / 2, 0), (0, WIDTH / 2), (-LENGTH / 2, 0), (0, -WIDTH / 2)]
    return Polygon([(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in pts])


def anchor(cx, cy, rot):
    """Recipe x/y: upper-left of the rotated 313 x 181 rectangular envelope (the runtime's stockBounds)."""
    a = math.radians(rot)
    w = abs(math.cos(a)) * LENGTH + abs(math.sin(a)) * WIDTH
    h = abs(math.sin(a)) * LENGTH + abs(math.cos(a)) * WIDTH
    return cx - w / 2, cy - h / 2


def build_three_direction(stones, per, lat):
    """Cells on the exact 60-degree lattice: stone centres at shared-edge midpoints, long diagonal across the edge."""
    base_ang = lat['angle']
    snap = round(base_ang / 30) * 30
    e1 = np.array([math.cos(math.radians(snap)), math.sin(math.radians(snap))]) * WIDTH
    e2 = np.array([math.cos(math.radians(snap + 60)), math.sin(math.radians(snap + 60))]) * WIDTH
    edge_dirs = {0: snap, 1: snap + 120, 2: snap + 60}
    (pi, pj), (qi, qj) = per
    b1, b2 = pi * e1 + pj * e2, qi * e1 + qj * e2
    det = b1[0] * b2[1] - b1[1] * b2[0]
    cells = []
    seen = set()
    for hu, hv, k in sorted(stones):
        c = (hu / 2) * e1 + (hv / 2) * e2
        # reduce into the fundamental cell spanned by b1, b2
        m = math.floor((c[0] * b2[1] - c[1] * b2[0]) / det + 1e-9)
        n = math.floor((b1[0] * c[1] - b1[1] * c[0]) / det + 1e-9)
        c = c - m * b1 - n * b2
        key = (round(c[0], 3), round(c[1], 3), k)
        if key in seen:
            continue
        seen.add(key)
        rot = (edge_dirs[k] + 90) % 180
        x, y = anchor(c[0], c[1], rot)
        cells.append({'unitId': '313-181-100-mm-181-313-100', 'xMm': round(x, 6), 'yMm': round(y, 6), 'rotationDeg': round(rot, 6)})
    return cells, [[round(v, 4) for v in b1], [round(v, 4) for v in b2]]


def validate(cells, basis, window=4000.0):
    polys = []
    b1, b2 = np.array(basis[0]), np.array(basis[1])
    for m in range(-12, 13):
        for n in range(-12, 13):
            off = m * b1 + n * b2
            if abs(off[0]) > window or abs(off[1]) > window:
                continue
            for c in cells:
                a = math.radians(c['rotationDeg'])
                w = abs(math.cos(a)) * LENGTH + abs(math.sin(a)) * WIDTH
                h = abs(math.sin(a)) * LENGTH + abs(math.cos(a)) * WIDTH
                polys.append(translate(stone_polygon(c['xMm'] + w / 2, c['yMm'] + h / 2, c['rotationDeg']), off[0], off[1]))
    test = box(-window / 3, -window / 3, window / 3, window / 3)
    clipped = [p.intersection(test) for p in polys if p.intersects(test)]
    union = unary_union(clipped)
    overlap = sum(p.area for p in clipped) - union.area
    return {'overlapAreaMm2': round(overlap, 3), 'coverage': round(union.area / test.area, 6), 'stonesPerRepeat': len(cells), 'repeatAreaMm2': round(abs(b1[0] * b2[1] - b1[1] * b2[0]), 3), 'stockAreaPerRepeatMm2': round(len(cells) * LENGTH * WIDTH / 2, 3)}


def chevron_cells(lean_rows):
    """Exact chevron from the actual stone: strips of stones with a side along the row, rows stacked edge to edge."""
    side = SIDE
    height = side * math.sin(math.radians(ACUTE))
    shift = side * math.cos(math.radians(ACUTE))
    cells = []
    x_offset = 0.0
    for r, lean in enumerate(lean_rows):
        # lean +1: slanted sides go down-right (acute at left-bottom); -1: mirrored
        rot = HALF if lean > 0 else 180 - HALF
        cy = r * height + height / 2
        cx = x_offset + side / 2 + (shift / 2 if lean > 0 else -shift / 2)
        x, y = anchor(cx, cy, rot)
        cells.append({'unitId': '313-181-100-mm-181-313-100', 'xMm': round(x, 6), 'yMm': round(y, 6), 'rotationDeg': round(rot % 360, 6)})
        x_offset += shift if lean > 0 else -shift
    rows = len(lean_rows)
    return cells, [[round(side, 4), 0.0], [round(x_offset, 4), round(rows * height, 4)]]


def main():
    digest = hashlib.sha256(ATLAS.read_bytes()).hexdigest()
    recipes = []
    report = []
    with pdfplumber.open(str(ATLAS)) as pdf:
        page = pdf.pages[PAGE - 1]
        for number in range(2, 8):
            fr = frame(page, number)
            lat = lattice(page, fr)
            _, segs = joint_directions(page, fr)
            raw, faces, anomalies, rejoined = stones_from_joints(segs, lat)
            stones, key_residual = lattice_keys(raw)
            kinds = sorted({k for _, _, k in stones})
            per = period(stones)
            entry = {'figure': f'TB01_DIAMOND 0{number}', 'frame': [round(v, 2) for v in fr], 'jointDirectionsDeg': lat['dirs'], 'latticeAngleDeg': round(lat['angle'], 3),
                     'triangleSidePt': round(lat['spacing'], 4), 'stonesObserved': len(stones), 'keyResidualHalfCells': round(key_residual, 3), 'stoneDirections': kinds, 'nonRhombicFaces': anomalies, 'splitStonesRejoined': rejoined, 'periodLattice': per}
            if len(per) != 2:
                entry['status'] = 'no-closed-repeat'
                report.append(entry)
                continue
            if len(kinds) == 3:
                cells, basis = build_three_direction(stones, per, lat)
                construction = 'exact-60-degree-set-out-from-published-181-mm-side'
            else:
                # chevron: rows run along the lattice direction e1; each row's stones all lean one way
                rows = collections.defaultdict(set)
                for _, hv, k in stones:
                    rows[hv].add(k)
                leans = [(+1 if rows[j] == {kinds[0]} else -1) for j in sorted(rows)]
                pj = abs(per[0][1]) or abs(per[1][1])
                seq = leans[len(leans) // 2 - pj // 2:][:pj] if pj else leans[:2]
                cells, basis = chevron_cells(seq)
                construction = 'actual-stone-strips-no-residual'
                entry['rowLeanSequence'] = seq
            checks = validate(cells, basis)
            checks['expectedStonesPerRepeat'] = abs(per[0][0] * per[1][1] - per[0][1] * per[1][0])
            entry.update({'status': 'draft', 'construction': construction, 'checks': checks})
            report.append(entry)
            residual = 0.0 if construction.startswith('actual') else round((math.sqrt(3) * WIDTH - LENGTH) / 2, 4)
            notes = ('Actual Techo-Bloc AutoCAD hatch-atlas diagram (page 12) digitized as a lozenge tiling of the published 313 x 181 x 100 mm Diamond stone. '
                     + ('Rows are strips of the actual stone (a side along each row, rows edge to edge): exact, with no residual. ' if residual == 0 else
                        f'Three stone directions are set out on an exact 60-degree lattice from the published 181 mm side; the stone (acute angle {ACUTE:.4f} degrees) fits its lozenge with up to {residual} mm at each acute tip. This is a nominal geometric clearance, not an installed joint. ')
                     + 'The atlas gives no numeric installed joint; spacer nibs, chamfers and pack quantities are not certified. The drawing is uncoloured: no colour or tonal composition is claimed.')
            layout = {'version': 1, 'widthMm': round(max(abs(basis[0][0]), abs(basis[1][0]), 1.0), 4), 'depthMm': round(max(abs(basis[0][1]), abs(basis[1][1]), 1.0), 4), 'jointMm': 0,
                      'jointStatus': 'unspecified-zero-nominal-model' if residual == 0 else 'nominal-clearance-60-degree-set-out', 'jointNotes': notes + (f' Nominal clearance residual-{residual}mm.' if residual else ''),
                      'repeatBasisMm': basis, 'cells': cells}
            for finish in ('hd-smooth', 'hd-granitex-made-to-order'):
                recipes.append({'productId': 'techo-diamond-paver', 'finishId': finish, 'patternId': PATTERNS[number], 'patternName': NAMES[number], 'originalPatternId': PATTERNS[number],
                                'sourceUrl': SOURCE_URL, 'sourcePdfSha256': digest, 'sourcePdfPage': PAGE, 'verifiedOn': '2026-09-27', 'layout': layout,
                                'digitization': {'atlasLabel': f'TB01_DIAMOND 0{number}', 'method': 'faces of the drawn vector joint graph, keyed to the lozenge lattice by half-cell position', 'construction': construction,
                                                 'profileKey': 'techo-diamond-paver', 'stoneAcuteAngleDeg': round(ACUTE, 5), 'stoneSideMm': round(SIDE, 4), 'periodLatticeTriangles': per,
                                                 'sourceStonesObserved': len(stones), 'nonRhombicFaces': anomalies, 'splitStonesRejoined': rejoined, 'colourComposition': 'not shown in the source; none claimed'},
                                'checks': checks})
    out = {'schemaVersion': 1, 'verifiedOn': '2026-09-27', 'status': 'draft - not in the reviewed manifest until independently verified', 'recipes': recipes}
    (ROOT / 'scripts' / 'hardscape-techo-diamond-draft.json').write_text(json.dumps(out, indent=1), encoding='utf8')
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
