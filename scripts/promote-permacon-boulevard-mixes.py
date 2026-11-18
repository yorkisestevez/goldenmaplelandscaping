"""Promote the three Permacon Boulevard 300 PDF97 mixes whose drawings conflict with their printed captions.

The drawn layouts were independently verified against every complete source face on Ontario product guide page 97
(work/source-face-verifier; report outputs/deckcraft-source-face-verification/batch-b-permacon-boulevard); a blind hand count is a veto only. The names
describe what is DRAWN; the printed captions, which do not describe these drawings, are kept only as notes.
Output: scripts/permacon-boulevard-mix-recovery.json (listed in the reviewed manifest).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SO = ROOT.parents[1]
CANDIDATES = SO / 'work' / 'permacon-patterns' / 'mix-conflict-candidate-recipes.json'
REPORT = SO / 'outputs' / 'deckcraft-source-face-verification' / 'batch-b-permacon-boulevard' / 'report.json'
REVIEW = SO / 'work' / 'source-face-verifier' / 'review' / 'blind-review.json'
STOCK = {'e-150-300-100-mm': (150, 300), 'f-300-300-100-mm': (300, 300), 'h-300-600-100-mm': (300, 600)}
LETTER = {'e-150-300-100-mm': 'E', 'f-300-300-100-mm': 'F', 'h-300-600-100-mm': 'H'}
PLAN = {
    'source-97-modular-67F33E-depicted': ('source-97-modular-drawn-4E1F', 'cand-67F33E', '67% F + 33% E (stacked with "67% I + 33% H")'),
    'source-97-modular-67H25F8E-depicted': ('source-97-modular-drawn-2H1F2E', 'cand-67H25F8E', '67% H + 25% F + 8% E'),
    'source-97-modular-71H25F5E-depicted': ('source-97-modular-drawn-3H2F1E', 'cand-71H25F5E', '71% H + 25% F + 5% E (sums to 101%)'),
}


def ratios(cells):
    counts = {}
    for c in cells:
        counts[c['unitId']] = counts.get(c['unitId'], 0) + 1
    area = {u: n * STOCK[u][0] * STOCK[u][1] for u, n in counts.items()}
    total_n, total_a = sum(counts.values()), sum(area.values())
    order = sorted(counts, key=lambda u: -area[u])
    return order, counts, {u: 100 * counts[u] / total_n for u in counts}, {u: 100 * area[u] / total_a for u in counts}


def main():
    candidates = json.loads(CANDIDATES.read_text(encoding='utf8'))['recipes']
    report = {r['id']: r for r in json.loads(REPORT.read_text(encoding='utf8'))['reports']}
    digest = json.loads(REPORT.read_text(encoding='utf8'))['sha256']
    review_file = json.loads(REVIEW.read_text(encoding='utf8'))
    review = {rid: dict(v, countsAsConfirmation=review_file['countsAsConfirmation'], decoyGate=review_file['decoyGate'])
              for rid, v in review_file['verdicts'].items()}
    out = []
    for rec in candidates:
        new_id, report_id, caption = PLAN[rec['patternId']]
        check = report[report_id]
        assert check['verdict'] == 'pass', report_id
        assert (review.get(report_id) or {}).get('verdict') not in (None, 'FAIL'), f'blind hand count vetoed {report_id}'
        order, counts, piece, area = ratios(rec['layout']['cells'])
        drawn = ':'.join(f"{counts[u]}{LETTER[u]}" for u in order)
        by_area = ' / '.join(f"{area[u]:.0f}% {LETTER[u]}" for u in order)
        by_pieces = ' / '.join(f"{piece[u]:.0f}% {LETTER[u]}" for u in order)
        name = f'Modular — as drawn {drawn} ({by_area} by area) · source mix differs'
        notes = (f'Actual Permacon 2026 Ontario product guide PDF97 drawing, verified against all {check["completeSourceFaces"]} complete source faces '
                 f'(no missing or extra stone, both extraction methods agreeing, perturbation controls rejected). The repeat as drawn is {drawn}: '
                 f'{by_area} by area, {by_pieces} by pieces. The caption printed beside it reads "{caption}", which does not describe this drawing; '
                 'the drawn stones are used and the caption is not. Permacon states its laying patterns are shown by way of example. '
                 'Nominal zero-joint topology of full published stock: no installed joint schedule, spacer detail or pack ratio is established.')
        layout = dict(rec['layout'])
        layout.update({'version': 1, 'jointMm': 0, 'jointStatus': 'unspecified-zero-nominal-model', 'jointNotes': notes})
        out.append({'productId': rec['productId'], 'finishId': rec['finishId'], 'patternId': new_id, 'patternName': name, 'originalPatternId': 'modular',
                    'sourceUrl': 'https://permacon.ca/wp-content/uploads/2022/12/2026-guideproduitsamengta-14avr-3.pdf#page=97', 'sourcePdfPage': 97,
                    'sourcePdfSha256': digest, 'verifiedOn': '2026-09-27', 'layout': layout,
                    'digitization': {'sourceDiagram': '2026 Ontario product guide / PDF 97', 'printedCaption': caption, 'captionConflict': True,
                                     'drawnStockCount': {LETTER[u]: counts[u] for u in order}, 'drawnAreaPct': {LETTER[u]: round(area[u], 2) for u in order},
                                     'drawnPiecePct': {LETTER[u]: round(piece[u], 2) for u in order}, 'sourceFacesMatched': check['matched'],
                                     'verifier': 'work/source-face-verifier/verify.py', 'verifierReport': f'outputs/deckcraft-source-face-verification/batch-b-permacon-boulevard/{report_id}.png',
                                     'periodsPerBasis': check['periodsPerBasis'], 'blindReview': review[report_id]},
                    'checks': {'physicalStocks': len(layout['cells']), 'repeatAreaMm2': abs(layout['repeatBasisMm'][0][0] * layout['repeatBasisMm'][1][1] - layout['repeatBasisMm'][0][1] * layout['repeatBasisMm'][1][0])}})
    (ROOT / 'scripts' / 'permacon-boulevard-mix-recovery.json').write_text(json.dumps({'schemaVersion': 1, 'verifiedOn': '2026-09-27', 'recipes': out}, indent=1), encoding='utf8')
    for r in out:
        print(r['finishId'], r['patternId'], '|', r['patternName'])


if __name__ == '__main__':
    main()
