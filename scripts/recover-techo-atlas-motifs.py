"""Recover Techo-Bloc mixed-size rectangular laying patterns from the manufacturer's AutoCAD hatch atlas.

For each target figure this generator (independent of the source-face verifier):
  1. takes the figure's own frame (the rounded border under its TB01_ label) and every dark joint inside it;
  2. snaps joint endpoints to shared vertices and forms the stones as faces of that joint graph;
  3. squares diagonal figures (joints at 45 degrees) and fits the drawing scale to the documented stock sizes;
  4. snaps each stone to the stock module (the stock sizes' common unit), identifying its stock and direction;
  5. finds the shortest translations that carry every drawn stone onto a drawn stone of the same stock and
     direction, and keeps one stone per repeat.
Published stock sizes are never changed. Where the sizes are not exact multiples of the module (Eva 112/223/335 mm),
stones are set out on the smallest module that holds every stone, and the resulting nominal clearance is stated.
Output: scripts/hardscape-techo-atlas-motifs-draft.json (a draft; only reviewed records reach the manifest).
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
from shapely.affinity import rotate, translate  # noqa: E402
from shapely.geometry import LineString, MultiPoint, Point, box  # noqa: E402
from shapely.ops import polygonize, unary_union  # noqa: E402

ATLAS = WORK / 'paver-pattern-recovery' / 'techo-hatch-atlas.pdf'
BASE_URL = 'https://www.techo-bloc.com/assets/a2/b0/a2b028a8-8390-491a-a35f-f8111cc607bb/AutoCAD%20Hatch%20Patterns%20PDF.pdf'
CATALOGUE = ROOT / 'public' / 'deckcraft' / 'hardscape-catalogue.json'

TARGETS = [
    # label, page, product, pattern id, stock module (mm)
    ('TB01_EVEREST 07', 6, 'techo-everest-slab', 'herringbone-pattern-07-80-250x500-20-250x250', 250),
    ('TB01_EVEREST 10', 7, 'techo-everest-slab', 'l81-modular-pattern-10-80-500x500-20-250x250', 250),
    ('TB01_EVEREST 11', 7, 'techo-everest-slab', 'modular-pattern-11-63-500x500-25-250x500-12-250x250', 250),
    ('TB01_EVEREST 12', 7, 'techo-everest-slab', 'modular-pattern-12-45-500x500-45-250x500-10-250x250', 250),
    ('TB01_PARA 750 09', 9, 'techo-para-slab', 'l77-herringbone-laying-pattern-09-100-500x750', 125),
    ('TB01_PARA 750 10', 9, 'techo-para-slab', 'linear-laying-pattern-10-75-500x750-25-500x250', 125),
    ('TB01_PARA 750 11', 9, 'techo-para-slab', 'linear-laying-pattern-11-50-500x750-50-500x500', 125),
    ('TB01_PARA 750 12', 9, 'techo-para-slab', 'linear-laying-pattern-12-40-500x500-32-500x250-28-500x750', 125),
    ('TB01_PARA 750 13', 9, 'techo-para-slab', 'modular-laying-pattern-13-25-500x250-50-500x500-25-500x750', 125),
    ('TB01_PARA 750 14', 9, 'techo-para-slab', 'herringbone-laying-pattern-14-18-500x250-32-500x500-50-500x750', 125),
    ('TB01_EVA 01', 12, 'techo-eva-paver', 'modular-pattern-01-100-various', 112),
    ('TB01_EVA 02', 12, 'techo-eva-paver', 'linear-pattern-02-100-various', 112),
    ('TB01_VICTORIEN 07', 20, 'techo-victorien-paver', 'herringbone-pattern-07-100-victorien', 108),
]


def luminance(colour):
    values = colour if isinstance(colour, (list, tuple)) else [colour]
    try:
        values = [float(v) for v in values if v is not None]
    except (TypeError, ValueError):
        return None
    if len(values) == 4:
        c, m, y, k = values
        return (1 - k) * (1 - (c + m + y) / 3)
    return sum(values) / len(values) if values else None


def frame(page, label):
    words = page.extract_words(keep_blank_chars=True)
    word = next(w for w in words if w['text'].strip() == label)
    below = [o for o in list(page.rects) + [c for c in page.curves if c.get('stroke') and (c.get('linewidth') or 0) >= 0.25]
             if o['x1'] - o['x0'] > 60 and o['bottom'] - o['top'] > 60 and 0 < o['top'] - word['bottom'] < 80 and o['x0'] - 6 < word['x0'] < o['x1']]
    rect = min(below, key=lambda r: r['x1'] - r['x0'])
    borders = [c for c in page.curves if c.get('stroke') and (c.get('linewidth') or 0) >= 0.25 and c['x0'] >= rect['x0'] - 0.5 and c['x1'] <= rect['x1'] + 0.5
               and c['top'] >= rect['top'] - 0.5 and c['bottom'] <= rect['bottom'] + 0.5 and c['x1'] - c['x0'] > 0.85 * (rect['x1'] - rect['x0'])]
    b = min(borders, key=lambda c: c['x1'] - c['x0']) if borders else rect
    return (b['x0'], b['top'], b['x1'], b['bottom'])


def joints(page, fr):
    x0, t0, x1, b1 = fr
    clip = box(x0, t0, x1, b1)
    segs = []
    rects = [r for r in page.rects if r.get('stroke') and r['x1'] - r['x0'] < 60]
    for obj in list(page.lines) + [c for c in page.curves if c.get('stroke')] + rects:
        lum = luminance(obj.get('stroking_color'))
        if lum is not None and lum >= 0.65:
            continue  # light grey (0.735) strokes triangulate the highlighted module's fill; joints are darker
        if (obj.get('linewidth') or 0) >= 0.25 and obj['x1'] - obj['x0'] > 0.85 * (x1 - x0):
            continue  # the figure border
        if 'pts' in obj and obj['pts']:
            pts = [(p[0], p[1]) for p in obj['pts']]
        else:
            pts = [(obj['x0'], obj['top']), (obj['x1'], obj['top']), (obj['x1'], obj['bottom']), (obj['x0'], obj['bottom'])]
        if obj in rects:
            pts = pts + [pts[0]]
        for a, b in zip(pts, pts[1:]):
            seg = LineString([a, b])
            if seg.length > 0.05 and seg.intersects(clip):
                segs.append(seg.intersection(clip))
    return segs


def stones(page, fr):
    """Stones as faces of the joint graph (endpoints snapped to shared vertices); complete ones only."""
    segs = joints(page, fr)
    ends = []
    for s in segs:
        for geom in getattr(s, 'geoms', [s]):
            ends += list(geom.coords)
    clusters = []
    for p in ends:
        if not any(math.hypot(c[0] - p[0], c[1] - p[1]) < 0.3 for c in clusters):
            clusters.append(p)

    def snap(p):
        return min(clusters, key=lambda c: math.hypot(c[0] - p[0], c[1] - p[1]))
    lines = []
    for s in segs:
        for geom in getattr(s, 'geoms', [s]):
            cs = [snap(p) for p in geom.coords]
            if cs[0] != cs[-1]:
                lines.append(LineString(cs))
    x0, t0, x1, b1 = fr
    lines.append(box(x0, t0, x1, b1).exterior)
    inner = box(x0 + 0.5, t0 + 0.5, x1 - 0.5, b1 - 0.5)
    faces = []
    for f in polygonize(unary_union(lines)):
        if f.area < 1 or not inner.contains(f):
            continue
        simple = f.simplify(0.25)
        if len(simple.exterior.coords) != 5 and f.area >= 0.97 * f.convex_hull.area:
            simple = f.convex_hull.simplify(0.25)
        if len(simple.exterior.coords) == 5 and 2 * f.area / f.length > 0.8:
            faces.append(simple)
    return faces


def direction(poly):
    pts = list(poly.exterior.coords)[:-1]
    edges = [(pts[i], pts[(i + 1) % 4]) for i in range(4)]
    a, b = max(edges, key=lambda e: math.dist(*e))
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180


def dims(poly):
    pts = list(poly.exterior.coords)[:-1]
    s1, s2 = math.dist(pts[0], pts[1]), math.dist(pts[1], pts[2])
    return min(s1, s2), max(s1, s2)


def recover(page, label, units, module):
    fr = frame(page, label)
    faces = stones(page, fr)
    angles = [direction(f) % 90 for f in faces]
    tilt = 45.0 if sum(1 for a in angles if 30 < a < 60) > len(angles) / 2 else 0.0
    cx, cy = (fr[0] + fr[2]) / 2, (fr[1] + fr[3]) / 2
    square = [rotate(f, -tilt, origin=(cx, cy)) if tilt else f for f in faces]
    sizes = sorted({(min(u['widthMm'], u['lengthMm']), max(u['widthMm'], u['lengthMm'])) for u in units})
    # scale: points per mm, from the most common drawn stone against the documented sizes
    drawn = [dims(f) for f in square]
    best = (0, None)
    for a, b in drawn:
        for w, g in sizes:
            for s in (a / w, b / g):
                score = sum(1 for p, q in drawn if any(abs(p - s * w2) < 0.05 * p and abs(q - s * g2) < 0.05 * q for w2, g2 in sizes))
                if score > best[0]:
                    best = (score, s)
    s = best[1]
    typed = []
    for f in square:
        a, b = dims(f)
        match = min(sizes, key=lambda wg: abs(a - s * wg[0]) / a + abs(b - s * wg[1]) / b)
        if abs(a - s * match[0]) > 0.08 * a or abs(b - s * match[1]) > 0.08 * b:
            continue
        x0, y0, x1, y1 = f.bounds
        along_x = (x1 - x0) >= (y1 - y0)
        unit = next(u for u in units if (min(u['widthMm'], u['lengthMm']), max(u['widthMm'], u['lengthMm'])) == match)
        rot = 0 if along_x else 90
        # a unit's length runs along x at rotation 0; square stock is direction-free
        if match[0] == match[1]:
            rot = 0
        typed.append((unit['id'], rot, x0, y0, match))
    if not typed:
        return {'label': label, 'status': 'no-stones'}
    ref = min(typed, key=lambda t: math.hypot(t[2] - cx, t[3] - cy))
    corners = np.array([[t[2] - ref[2], t[3] - ref[3]] for t in typed])
    mapping = np.eye(2) * s * module  # module grid -> drawing points; refined from the reference stone outward
    shift = np.zeros(2)
    radius = 3.0
    for _ in range(4):
        grid = (corners - shift) @ np.linalg.inv(mapping).T
        near = np.linalg.norm(grid, axis=1) <= radius
        if near.sum() >= 6:
            design = np.column_stack([np.round(grid[near]), np.ones(near.sum())])
            coef, *_ = np.linalg.lstsq(design, corners[near], rcond=None)
            mapping, shift = coef[:2].T, coef[2]
        radius *= 2
    grid = (corners - shift) @ np.linalg.inv(mapping).T
    offsets = list(np.max(np.abs(grid - np.round(grid)), axis=1)) if len(grid) else [0.0]
    keyed = {(int(round(g[0])), int(round(g[1])), t[0], t[1]) for g, t in zip(grid, typed)}
    region = MultiPoint([(k[0], k[1]) for k in keyed]).convex_hull.buffer(-2.0)
    cands = sorted(((i, j) for i in range(-24, 25) for j in range(-24, 25) if (i, j) != (0, 0)), key=lambda v: v[0] ** 2 + v[1] ** 2)
    period = []
    for di, dj in cands:
        tested = [k for k in keyed if region.contains(Point(k[0] + di, k[1] + dj))]
        if len(tested) < 8 or any((k[0] + di, k[1] + dj, k[2], k[3]) not in keyed for k in tested):
            continue
        if not period or period[0][0] * dj - period[0][1] * di != 0:
            period.append((di, dj))
        if len(period) == 2:
            break
    out = {'label': label, 'frame': [round(v, 2) for v in fr], 'tiltDeg': tilt, 'scalePtPerMm': round(s, 6), 'stonesObserved': len(typed), 'moduleMm': module,
           'moduleSnapWorst': round(max(offsets), 3), 'period': period}
    if len(period) != 2:
        out['status'] = 'no-closed-repeat'
        return out
    (ai, aj), (bi, bj) = period
    det = ai * bj - aj * bi
    motif = {}
    for gx, gy, uid, rot in keyed:
        m = math.floor((gx * bj - gy * bi) / det + 1e-9)
        n = math.floor((ai * gy - aj * gx) / det + 1e-9)
        rx, ry = gx - m * ai - n * bi, gy - m * aj - n * bj
        motif.setdefault((rx, ry), (uid, rot))
    out.update({'status': 'draft', 'motif': motif, 'basis': [[ai * module, aj * module], [bi * module, bj * module]]})
    return out


def validate(cells, basis, units):
    by_id = {u['id']: u for u in units}
    b1, b2 = np.array(basis[0], dtype=float), np.array(basis[1], dtype=float)
    polys = []
    for m in range(-10, 11):
        for n in range(-10, 11):
            off = m * b1 + n * b2
            for c in cells:
                u = by_id[c['unitId']]
                w, h = (u['lengthMm'], u['widthMm']) if c['rotationDeg'] == 0 else (u['widthMm'], u['lengthMm'])
                polys.append(translate(box(c['xMm'], c['yMm'], c['xMm'] + w, c['yMm'] + h), off[0], off[1]))
    span = min(np.linalg.norm(b1), np.linalg.norm(b2)) * 3
    test = box(-span, -span, span, span)
    clipped = [p.intersection(test) for p in polys if p.intersects(test)]
    union = unary_union(clipped)
    stock = sum(by_id[c['unitId']]['widthMm'] * by_id[c['unitId']]['lengthMm'] for c in cells)
    return {'overlapAreaMm2': round(sum(p.area for p in clipped) - union.area, 3), 'coverage': round(union.area / test.area, 6), 'physicalStocks': len(cells),
            'stockAreaMm2': stock, 'repeatAreaMm2': abs(b1[0] * b2[1] - b1[1] * b2[0])}


def main():
    catalogue = {p['id']: p for p in json.loads(CATALOGUE.read_text(encoding='utf8'))['products']}
    digest = hashlib.sha256(ATLAS.read_bytes()).hexdigest()
    recipes, report = [], []
    with pdfplumber.open(str(ATLAS)) as pdf:
        for label, page_no, product_id, pattern_id, module in TARGETS:
            product = catalogue[product_id]
            finish0 = product['finishes'][0]
            units = [u for u in finish0['units'] if u.get('widthMm') and u.get('lengthMm')]
            try:
                res = recover(pdf.pages[page_no - 1], label, units, module)
            except (StopIteration, ValueError) as err:
                report.append({'label': label, 'status': f'not-recovered: {type(err).__name__} {err}'})
                continue
            entry = {k: v for k, v in res.items() if k != 'motif'}
            if res.get('status') != 'draft':
                report.append(entry)
                continue
            cells = [{'unitId': uid, 'xMm': float(rx * module), 'yMm': float(ry * module), 'rotationDeg': rot} for (rx, ry), (uid, rot) in sorted(res['motif'].items())]
            checks = validate(cells, res['basis'], units)
            entry['checks'] = checks
            entry['stockMix'] = dict(collections.Counter(c['unitId'] for c in cells))
            report.append(entry)
            exact = all(min(u['widthMm'], u['lengthMm']) % module == 0 and max(u['widthMm'], u['lengthMm']) % module == 0 for u in units if u['id'] in entry['stockMix'])
            clearance = '' if exact else f' Stock is set out on a {module} mm module that holds every published size; stones shorter than their module slots leave up to {max(module * math.ceil(v / module) - v for u in units if u["id"] in entry["stockMix"] for v in (u["widthMm"], u["lengthMm"]))} mm of nominal clearance, not an installed joint.'
            notes = ('Actual Techo-Bloc AutoCAD hatch-atlas figure, digitized from its drawn joints: every complete stone is identified by its published full size and '
                     'direction, and the shortest translations that carry every drawn stone onto a drawn stone give the repeat. No stone is resized.' + clearance +
                     ' The atlas gives no numeric installed joint; mould edges, spacers and pack ratios are not certified.')
            layout = {'version': 1, 'widthMm': max(abs(res['basis'][0][0]), abs(res['basis'][1][0]), module), 'depthMm': max(abs(res['basis'][0][1]), abs(res['basis'][1][1]), module),
                      'jointMm': 0, 'jointStatus': 'unspecified-zero-nominal-model' if exact else 'nominal-clearance-module-set-out', 'jointNotes': notes, 'repeatBasisMm': res['basis'], 'cells': cells}
            if res['tiltDeg']:
                layout['angleDeg'] = res['tiltDeg']
            name = next(q['name'] for q in finish0['patterns'] if q['id'] == pattern_id)
            for finish in product['finishes']:
                recipes.append({'productId': product_id, 'finishId': finish['id'], 'patternId': pattern_id, 'patternName': name, 'originalPatternId': pattern_id,
                                'sourceUrl': f'{BASE_URL}#page={page_no}', 'sourcePdfSha256': digest, 'sourcePdfPage': page_no, 'verifiedOn': '2026-09-27', 'layout': layout,
                                'digitization': {'atlasLabel': label, 'method': 'faces of the drawn joint graph, snapped to the stock module; repeat from full drawn-stone translation support',
                                                 'tiltDeg': res['tiltDeg'], 'scalePtPerMm': res['scalePtPerMm'], 'stonesObserved': res['stonesObserved'], 'moduleSnapWorst': res['moduleSnapWorst'],
                                                 'periodModules': res['period'], 'stockMix': entry['stockMix']},
                                'checks': checks})
    (ROOT / 'scripts' / 'hardscape-techo-atlas-motifs-draft.json').write_text(json.dumps({'schemaVersion': 1, 'verifiedOn': '2026-09-27', 'status': 'draft - not in the reviewed manifest until independently verified', 'recipes': recipes}, indent=1), encoding='utf8')
    print(json.dumps(report, indent=1))


if __name__ == '__main__':
    main()
