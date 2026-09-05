"""Release check for known disputed assertions in saved browser evidence.
Not a general fact checker. Fails closed on these unresolved business claims.
"""
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
proof=ROOT/'docs/business-facts-browser-proof/proof.json'
checks={
    'unverified_review_rating':r'5\.0\s*(?:GOOGLE RATING|·\s*8 REVIEWS)',
    'unverified_review_count':r'8 VERIFIED GOOGLE REVIEWS',
    'unverified_wsib_credential':r'WSIB CERTIFIED',
    'unverified_insurance':r'\$5M\s*LIABILITY',
    'unverified_blanket_warranty':r'5-year craftsmanship warranty on all installations|Every build is backed by a 5-year',
}
data=json.loads(proof.read_text(encoding='utf-8'))
assert data['pages'], 'Empty browser evidence is not a pass'
findings=[]
for page in data['pages']:
    for rule,pattern in checks.items():
        match=re.search(pattern,page['text'],re.I)
        if match:
            findings.append({'route':page['route'],'rule':rule,'excerpt':page['text'][max(0,match.start()-40):match.end()+100]})
result={'publication_check_passed':not findings,'pages_checked':len(data['pages']),'findings':findings,'scope':'Known disputed business claims in browser-rendered local build. Unknown owner facts remain unresolved; generic education not assessed.'}
(ROOT/'docs/business-facts-browser-proof/claim-gate.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps({'publication_check_passed':not findings,'pages_checked':len(data['pages']),'findings':len(findings),'affected_routes':sorted({f['route'] for f in findings})},indent=2))
raise SystemExit(1 if findings else 0)
