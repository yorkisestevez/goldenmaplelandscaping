"""Draft corrected Techo-Bloc Westmount herringbone 04/05/06 recipes from the AutoCAD hatch atlas (page 21).

The atlas figures, counted from their drawn stones and shaded modules:
  04  double herringbone - two upright stones beside two lying stones (38 upright / 38 lying complete faces)
  05  single herringbone - one upright, one lying (39 / 39)
  06  one upright between two lying stones - lying, upright beside its end, lying under the upright (26 / 52)
The earlier import had 04 as three-stone groups, 05 as pairs and 06 as a single herringbone. All three are rebuilt here
from full 60 x 240 x 80 mm published stock. The atlas draws every stone as its own outline, 6.08 x 25.65 pt (4.2:1)
against the published 4:1, so the figures are nominal diagrams and no stone is stretched.
Each figure gets every chirality (and, for 06, both lattices that tile its module); the independent source-face verifier
decides which the drawing shows, laying a VERIFICATION copy at the drawn stone proportion, and the others are its
controls. Output: scripts/hardscape-techo-westmount-draft.json (draft, not in the reviewed manifest).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UNIT = '60-240-80-mm-60-240-80'
W, L = 60, 240
# 60 mm x the drawn 4.215:1 stone FACE proportion (median complete face 6.084 x 25.646 pt, all three figures); the
# verifier fits its scale to faces, and the drawn joint gap (about 0.19 pt) stays inside its match tolerance. Verification only.
DRAWN_LENGTH = 252.9
ATLAS = 'https://www.techo-bloc.com/assets/a2/b0/a2b028a8-8390-491a-a35f-f8111cc607bb/AutoCAD%20Hatch%20Patterns%20PDF.pdf#page=21'
ATLAS_SHA = '993bdc4f27a991be65833ad1ab623eb569edeb2688b55e98cf55ffd4a35ea328'
NOTES = ('Actual Techo-Bloc AutoCAD hatch-atlas figure (page 21): {what}, rebuilt from full published 60 x 240 x 80 mm Westmount '
         'stock. The atlas draws the stone at about 4.2:1 rather than the published 4:1, so the figure is a nominal diagram; '
         'no stone is resized. The atlas gives no numeric installed joint; spacer nibs, chamfers and pack quantities are not certified.')
WHAT = {'04': 'double herringbone (two-stone groups)', '05': 'single herringbone',
        '06': 'herringbone with one upright stone between two lying stones'}


def cell(x, y, rot):
    return {'unitId': UNIT, 'xMm': x, 'yMm': y, 'rotationDeg': rot}


def mirrored(cells, basis, length):
    """Reflect across a vertical line: the other chirality of the same drawing."""
    out = [cell(-c['xMm'] - (length if c['rotationDeg'] == 0 else W), c['yMm'], c['rotationDeg']) for c in cells]
    shift = -min(c['xMm'] for c in out)
    return [dict(c, xMm=round(c['xMm'] + shift, 4)) for c in out], [[-v[0], v[1]] for v in basis]


def variants(number, length=L):
    """Every candidate layout for one figure: {variant: (cells, basis)}."""
    ln = length
    if number in ('04', '05'):
        group = 2 if number == '04' else 1
        g = group * W
        cells = [cell(0, k * W, 0) for k in range(group)] + [cell(k * W, g, 90) for k in range(group)]
        base = {'direct': (cells, [[ln, -ln], [g, g]])}
    else:
        # lying A, upright B beside A's right end (tops aligned), lying C under B (left aligned); stair step (W, -W)
        cells = [cell(0, 0, 0), cell(ln, 0, 90), cell(ln, ln, 0)]
        base = {'lattice-a': (cells, [[W, -W], [2 * ln, ln]]), 'lattice-b': (cells, [[W, -W], [ln, 2 * ln]])}
    out = {}
    for name, (cells, basis) in base.items():
        out[name] = (cells, basis)
        out[f'{name}-mirror' if name != 'direct' else 'mirror'] = mirrored(cells, basis, ln)
    return out


def layout(number, cells, basis, length=L):
    xs = [c['xMm'] + (length if c['rotationDeg'] == 0 else W) for c in cells]
    ys = [c['yMm'] + (W if c['rotationDeg'] == 0 else length) for c in cells]
    return {'version': 1, 'widthMm': max(xs) - min(c['xMm'] for c in cells), 'depthMm': max(ys) - min(c['yMm'] for c in cells), 'jointMm': 0,
            'jointStatus': 'unspecified-zero-nominal-model', 'jointNotes': NOTES.format(what=WHAT[number]), 'repeatBasisMm': basis, 'cells': cells}


def main():
    recipes = []
    for number, earlier in (('04', 'three-stone groups'), ('05', 'two-stone groups'), ('06', 'a single herringbone')):
        for name, (cells, basis) in variants(number).items():
            det = abs(basis[0][0] * basis[1][1] - basis[0][1] * basis[1][0])
            assert det == len(cells) * W * L, (number, name, det)
            recipes.append({'productId': 'techo-westmount-paver', 'finishId': 'hd', 'patternId': f'herringbone-pattern-{number}-100-westmount',
                            'patternName': f'Herringbone pattern {number} - 100% Westmount', 'draftVariant': name,
                            'sourceUrl': ATLAS, 'sourcePdfSha256': ATLAS_SHA, 'sourcePdfPage': 21, 'verifiedOn': '2026-09-27',
                            'layout': layout(number, cells, basis),
                            'digitization': {'atlasLabel': f'TB01_WESTMOUNT {number}', 'variant': name,
                                             'method': 'stones per repeat, their arrangement and chirality read from the drawn faces and shaded module; lattice from full published stock',
                                             'correctsEarlierImport': earlier, 'drawnStoneProportion': 'about 4.2:1 (published 4:1)'},
                            'checks': {'physicalStocks': len(cells), 'repeatAreaMm2': det, 'stockAreaMm2': len(cells) * W * L}})
    (ROOT / 'scripts' / 'hardscape-techo-westmount-draft.json').write_text(
        json.dumps({'schemaVersion': 1, 'verifiedOn': '2026-09-27', 'status': 'draft - not in the reviewed manifest until independently verified',
                    'recipes': recipes}, indent=1) + '\n', encoding='utf8')
    print(len(recipes), 'draft recipes')


if __name__ == '__main__':
    main()
