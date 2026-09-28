"""Promote the verified Techo-Bloc hatch-atlas drafts into reviewed overlays.

A draft record is promoted only when the independent source-face verifier (work/source-face-verifier) reports "pass"
for its figure, and the blind hand-count reviewer (who saw only shuffled source/recipe image pairs) did not fail it.
The blind review passed a known-bad decoy, so it is recorded as a veto only and never cited as confirmation.
Anything else stays in the draft and is listed with its exact reason. Printed percentages are compared with the drawn
stones by area; a caption more than 1.5 points from the drawing is named "source mix differs" and never corrected.

Inputs (outer workspace): outputs/deckcraft-source-face-verification/<batch>/report.json and
work/source-face-verifier/review/blind-review.json. Outputs: scripts/hardscape-techo-diamond-recovery.json and
scripts/hardscape-techo-mixed-recovery.json (both listed in the reviewed manifest).
"""
import copy
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SO = ROOT.parents[1]
REPORTS = SO / 'outputs' / 'deckcraft-source-face-verification'
REVIEW = SO / 'work' / 'source-face-verifier' / 'review' / 'blind-review.json'
DIAMOND_DRAFT = ROOT / 'scripts' / 'hardscape-techo-diamond-draft.json'
MOTIF_DRAFT = ROOT / 'scripts' / 'hardscape-techo-atlas-motifs-draft.json'
WESTMOUNT_DRAFT = ROOT / 'scripts' / 'hardscape-techo-westmount-draft.json'
SIMPLE_OVERLAY = ROOT / 'scripts' / 'hardscape-techo-simple-pattern-recovery.json'
VERIFIED_ON = '2026-09-27'
CAPTION_TOLERANCE_PTS = 1.5  # integer captions that must total 100 can round a third to 32 or 34

MOTIF_REPORT_IDS = {
    'herringbone-pattern-07-80-250x500-20-250x250': 'everest-07',
    'l81-modular-pattern-10-80-500x500-20-250x250': 'everest-10',
    'modular-pattern-11-63-500x500-25-250x500-12-250x250': 'everest-11',
    'modular-pattern-12-45-500x500-45-250x500-10-250x250': 'everest-12',
    'linear-laying-pattern-10-75-500x750-25-500x250': 'para-750-10',
    'linear-laying-pattern-11-50-500x750-50-500x500': 'para-750-11',
    'linear-laying-pattern-12-40-500x500-32-500x250-28-500x750': 'para-750-12',
    'modular-laying-pattern-13-25-500x250-50-500x500-25-500x750': 'para-750-13',
    'herringbone-laying-pattern-14-18-500x250-32-500x500-50-500x750': 'para-750-14',
    'modular-pattern-01-100-various': 'eva-01',
    'herringbone-pattern-07-100-victorien': 'victorien-07',
}


def load(path):
    return json.loads(Path(path).read_text(encoding='utf8'))


def reports(batch):
    data = load(REPORTS / batch / 'report.json')
    return {r['id']: r for r in data['reports']}, data['sha256']


def dims(unit_id):
    a, b = (int(v) for v in unit_id.split('-')[:2])
    return tuple(sorted((a, b)))


def drawn_mix(layout):
    counts = {}
    for cell in layout['cells']:
        counts[cell['unitId']] = counts.get(cell['unitId'], 0) + 1
    area = {u: n * dims(u)[0] * dims(u)[1] for u, n in counts.items()}
    total_n, total_a = sum(counts.values()), sum(area.values())
    order = sorted(counts, key=lambda u: (-area[u], u))
    return order, counts, {u: 100 * counts[u] / total_n for u in counts}, {u: 100 * area[u] / total_a for u in counts}


def label(unit_id):
    """The stock as the manufacturer writes it (the unit id keeps Techo's own width x length order)."""
    a, b = unit_id.split('-')[:2]
    return f'{a}x{b}'


def caption_mix(name):
    """Printed percentages keyed by stock size, e.g. '75% 500x750 | 25% 500x250' -> {(500, 750): 75, (250, 500): 25}."""
    found = {}
    for pct, a, b in re.findall(r'(\d+)%\s*-?\s*(\d+)\s*[xX]\s*(\d+)', name):
        found[tuple(sorted((int(a), int(b))))] = int(pct)
    return found


def caption_check(record):
    order, counts, piece, area = drawn_mix(record['layout'])
    printed = caption_mix(record['patternName'])
    result = {'drawnStockCount': {label(u): counts[u] for u in order}, 'drawnAreaPct': {label(u): round(area[u], 2) for u in order},
              'drawnPiecePct': {label(u): round(piece[u], 2) for u in order}}
    if not printed:
        return result, None, order, counts, area
    by_dims = {dims(u): u for u in order}
    if set(printed) != set(by_dims):
        raise SystemExit(f"caption sizes {sorted(printed)} differ from drawn stock {sorted(by_dims)}: {record['patternId']}")
    worst = max(abs(area[by_dims[d]] - p) for d, p in printed.items())
    result.update({'printedCaption': record['patternName'], 'captionDifferencePts': round(worst, 2),
                   'captionMatchesPieces': all(abs(piece[by_dims[d]] - p) <= 1.0 for d, p in printed.items())})
    return result, worst, order, counts, area


def promote(record, report, review, pdf_sha):
    out = copy.deepcopy(record)
    mix, worst, order, counts, area = caption_check(record)
    layout = out['layout']
    notes = layout['jointNotes']
    digit = out['digitization']
    digit.update(mix)
    digit.update({'independentVerifier': 'work/source-face-verifier/verify.py',
                  'verifierReport': f"outputs/deckcraft-source-face-verification/{report['batch']}/{report['id']}.png",
                  'sourceFacesMatched': report['matched'], 'completeSourceFaces': report['completeSourceFaces'],
                  'periodsPerBasis': report['periodsPerBasis'], 'perturbationControlsRejected': report['controlsDetected'],
                  'blindReview': review})
    notes += (f" Independently verified against all {report['completeSourceFaces']} complete stones of the figure"
              ' (vector and raster extraction agreeing, perturbation controls rejected).')
    if worst is not None and worst > CAPTION_TOLERANCE_PTS:
        drawn = ':'.join(str(counts[u]) for u in order)
        by_area = ' / '.join(f'{area[u]:.0f}% {label(u)}' for u in order)
        base = re.split(r'\s+-?\s*\d+%', record['patternName'])[0].strip()
        out['patternName'] = f'{base} — as drawn {drawn} ({by_area} by area) · source mix differs'
        digit['captionConflict'] = True
        basis = 'matches the drawn piece count, not the area' if mix['captionMatchesPieces'] else 'matches neither the drawn area nor the piece count'
        notes += (f" The printed caption \"{record['patternName']}\" differs from the drawn stones by up to {worst:.1f} points by area and {basis};"
                  ' the drawn stones are used and the caption is not.')
    elif worst is not None and worst > 1.0:
        notes += (f" Drawn mix by area: {', '.join(f'{area[u]:.1f}% {label(u)}' for u in order)}; the printed whole-number caption"
                  f' differs by up to {worst:.1f} points.')
    layout['jointNotes'] = notes
    out['sourcePdfSha256'] = pdf_sha
    out['verifiedOn'] = VERIFIED_ON
    return out


def main():
    review_file = load(REVIEW)
    review = {rid: dict(v, countsAsConfirmation=review_file['countsAsConfirmation'], decoyGate=review_file['decoyGate'])
              for rid, v in review_file['verdicts'].items()}
    diamond_reports, diamond_sha = reports('batch-c1-techo-diamond')
    motif_reports, motif_sha = reports('batch-c2-techo-atlas-motifs')
    calibration, _ = reports('calibration-techo-atlas')
    promoted, held = {'diamond': [], 'mixed': []}, []
    for kind, draft, table in (('diamond', DIAMOND_DRAFT, diamond_reports), ('mixed', MOTIF_DRAFT, motif_reports)):
        for record in load(draft)['recipes']:
            rid = (f"diamond-{re.search(r'pattern-(\d\d)-', record['patternId']).group(1)}" if kind == 'diamond'
                   else MOTIF_REPORT_IDS[record['patternId']])
            report = dict(table.get(rid) or {}, batch='batch-c1-techo-diamond' if kind == 'diamond' else 'batch-c2-techo-atlas-motifs')
            verdict = (review.get(rid) or {}).get('verdict')
            if report.get('verdict') != 'pass' or verdict in (None, 'FAIL'):
                held.append((record['productId'], record['finishId'], record['patternId'], rid, report.get('verdict'), verdict))
                continue
            promoted[kind].append(promote(record, report, review[rid], diamond_sha if kind == 'diamond' else motif_sha))
    westmount, gaps = westmount_records(review)
    promoted['mixed'] += westmount
    para9 = calibration['para-09']
    withheld = [{'productId': 'techo-para-slab', 'finishId': 'hd', 'patternId': 'l77-herringbone-laying-pattern-09-100-500x750',
                 'reason': ('Withheld: the earlier Para 750 herringbone 09 recipe does not match the Techo-Bloc AutoCAD hatch-atlas drawing '
                            f"(page 9). Independent source-face verification matched {para9['matched']} of {para9['completeSourceFaces']} complete "
                            f"drawn stones, with {para9['missing']} missing and {para9['extra']} extra. The drawing does not close into a repeat "
                            'the generator can prove, so no replacement is offered; use the linked Techo-Bloc guide.')}]
    header = {'schemaVersion': 1, 'verifiedOn': VERIFIED_ON,
              'scope': ('Techo-Bloc AutoCAD hatch-atlas originals promoted only after the independent source-face verifier passed them (a blind '
                        'hand count was run as a veto). Nominal zero-joint topology of full published stock; no installed joint, spacer or pack '
                        'ratio is certified.')}
    (ROOT / 'scripts' / 'hardscape-techo-diamond-recovery.json').write_text(
        json.dumps(dict(header, recipes=promoted['diamond']), indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    (ROOT / 'scripts' / 'hardscape-techo-mixed-recovery.json').write_text(
        json.dumps(dict(header, recipes=promoted['mixed'], withheldRecipes=withheld + gaps['withheld'], evidenceGaps=EVIDENCE_GAPS),
                   indent=1, ensure_ascii=False) + '\n', encoding='utf8')
    for note in gaps['notes']:
        print(note)
    for kind in promoted:
        for r in promoted[kind]:
            print('promoted', r['productId'], r['finishId'], r['patternId'], '|', r['patternName'])
    for h in held:
        print('held', *h)
    return 0


EVIDENCE_GAPS = [{'productId': 'techo-eva-paver', 'patternId': 'linear-pattern-02-100-various',
                  'sourceUrl': 'https://www.techo-bloc.com/assets/a2/b0/a2b028a8-8390-491a-a35f-f8111cc607bb/AutoCAD%20Hatch%20Patterns%20PDF.pdf#page=12',
                  'reason': ('The Techo-Bloc AutoCAD hatch-atlas figure TB01_EVA 02 (page 12) was digitized, but its drawn stones do not form a '
                             'translation repeat that can be proven within the figure. No recipe is offered and the published Eva stock is not '
                             're-arranged into an invented bond; use the linked Techo-Bloc guide.')}]
WESTMOUNT_NOTE = (" Topology independently verified at the drawing's own stone proportion (about 4.2:1, laid only for verification): all {n} "
                  'complete drawn stones matched and every other chirality was rejected. Installed '
                  'with the published 60 x 240 mm (4:1) stock, so the finished bond is proportionally shorter than the illustration.')
WESTMOUNT_DRAWN = {'04': 'a double herringbone (two upright beside two lying stones)', '05': 'a single herringbone',
                   '06': 'one upright stone between two lying stones'}


def westmount_records(review):
    """Westmount 04/05/06 replace earlier imports that do not match their atlas figures. A figure is promoted only when
    exactly one candidate variant passed at the drawn stone proportion (not vetoed by the blind count) while every other failed;
    otherwise its earlier recipe is withheld."""
    table, sha = reports('batch-c3-techo-westmount')
    drafts = {(r['patternId'], r['draftVariant']): r for r in load(WESTMOUNT_DRAFT)['recipes']}
    earlier = {r['patternId']: r for r in load(SIMPLE_OVERLAY)['recipes'] if r['productId'] == 'techo-westmount-paver'}
    out, gaps = [], {'withheld': [], 'notes': []}
    for number in ('04', '05', '06'):
        pid = f'herringbone-pattern-{number}-100-westmount'
        names = [v for p, v in drafts if p == pid]
        ok = [v for v in names if table.get(f'westmount-{number}-{v}', {}).get('verdict') == 'pass-topology-at-drawn-proportion'
              and (review.get(f'westmount-{number}-{v}') or {}).get('verdict') not in (None, 'FAIL')]
        wrong = [v for v in names if table.get(f'westmount-{number}-{v}', {}).get('verdict') == 'fail']
        if len(ok) != 1 or len(wrong) != len(names) - 1:
            bond = {'hb3': 'stones in threes', 'hb2': 'stones in pairs', 'hb1': 'a single herringbone'}[earlier[pid]['digitization']['sourceStockBond']]
            gaps['withheld'].append({'productId': 'techo-westmount-paver', 'finishId': 'hd', 'patternId': pid,
                                     'reason': (f'Withheld: the earlier Westmount herringbone {number} recipe ({bond}) does not match the Techo-Bloc AutoCAD '
                                                f'hatch-atlas figure (page 21), which draws {WESTMOUNT_DRAWN[number]}; no corrected recipe passed independent '
                                                'verification, so use the linked Techo-Bloc guide.')})
            gaps['notes'].append(f'westmount {number}: withheld (verified {ok}, rejected {wrong} of {names})')
            continue
        variant = ok[0]
        report = table[f'westmount-{number}-{variant}']
        record = copy.deepcopy(drafts[(pid, variant)])
        record.pop('draftVariant', None)
        record['layout']['jointNotes'] += WESTMOUNT_NOTE.format(n=report['completeSourceFaces'])
        record['digitization'].update({'independentVerifier': 'work/source-face-verifier/verify.py', 'verifiedAtDrawnStoneMm': report['drawnUnitMm'],
                                       'verifierReport': f'outputs/deckcraft-source-face-verification/batch-c3-techo-westmount/westmount-{number}-{variant}.png',
                                       'sourceFacesMatched': report['matched'], 'completeSourceFaces': report['completeSourceFaces'],
                                       'periodsPerBasis': report['periodsPerBasis'], 'rejectedVariants': wrong,
                                       'blindReview': review[f'westmount-{number}-{variant}']})
        record['sourcePdfSha256'] = sha
        record['verifiedOn'] = VERIFIED_ON
        out.append(record)
        gaps['notes'].append(f'westmount {number}: {variant} promoted')
    return out, gaps


if __name__ == '__main__':
    sys.exit(main())
