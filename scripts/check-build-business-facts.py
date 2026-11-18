"""Offline publication gate over every prerendered route, not helper-only tests.
Run after a fresh build. Does not deploy, fetch, or certify business facts.
"""
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.skip=0; self.parts=[]; self.schema=False; self.schema_parts=[]; self.schemas=[]; self.contacts=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag in ('script','style'): self.skip+=1
        if tag=='script' and a.get('type')=='application/ld+json': self.schema=True; self.schema_parts=[]
        if tag=='meta' and a.get('name')=='description': self.parts.append(a.get('content',''))
        if tag=='a' and a.get('href','').startswith(('tel:','mailto:')): self.contacts.append(a['href'])
    def handle_endtag(self,tag):
        if tag=='script' and self.schema:
            self.schemas.append(json.loads(''.join(self.schema_parts))); self.schema=False
        if tag in ('script','style'): self.skip=max(0,self.skip-1)
    def handle_data(self,text):
        if self.schema: self.schema_parts.append(text)
        if not self.skip: self.parts.append(text)

RULES_FILE=ROOT/'scripts/claim-rules.json'
FACT_STATUS_FILE=ROOT/'build/fact-status.json'
RULES=json.loads(RULES_FILE.read_text(encoding='utf-8'))['rules']

def _matches(text,tier,confirmed):
    for rule in RULES:
        if rule.get('tier','block')!=tier: continue
        if rule.get('allowWhenConfirmed') in confirmed: continue
        m=re.search(rule['pattern'],text,re.I)
        if m: yield {'rule':rule['id'],'excerpt':text[max(0,m.start()-65):m.end()+100]}

def violations(text,confirmed=frozenset()):
    """Blocking findings. `confirmed` = register fact paths that pass canPublish()."""
    return list(_matches(text,'block',confirmed))

def warnings(text,confirmed=frozenset()):
    return list(_matches(text,'warn',confirmed))

def load_confirmed():
    """Publishable fact paths from build/fact-status.json (scripts/export-fact-status.ts).
    Every allowWhenConfirmed path must exist in the export, so a typo fails instead of allowing."""
    facts=json.loads(FACT_STATUS_FILE.read_text(encoding='utf-8'))['facts']
    unknown=sorted({r['allowWhenConfirmed'] for r in RULES if r.get('allowWhenConfirmed')}-set(facts))
    assert not unknown,f'claim-rules.json allowWhenConfirmed paths not in the register: {unknown}'
    return frozenset(k for k,v in facts.items() if v['publishable'])

def main():
    # Detector negative/control fixtures: patterns cannot silently become a no-op.
    assert violations('5.0 GOOGLE RATING 8 VERIFIED GOOGLE REVIEWS')
    assert violations('WSIB Certified')
    assert not violations('Ask for current coverage documents. Confirm consultation scope before booking.')
    files=sorted((ROOT/'build/client').rglob('index.html'))
    assert len(files)>80,'Missing/truncated build is not a pass'
    confirmed=load_confirmed()
    findings=[]; warned=[]; schema_count=0
    for path in files:
        page=Page(); page.feed(path.read_text(encoding='utf-8'))
        text=' '.join(' '.join(page.parts).split())
        route='/'+str(path.parent.relative_to(ROOT/'build/client')).replace('\\','/').strip('.')
        for finding in violations(text,confirmed): findings.append({'route':route,**finding})
        for finding in warnings(text,confirmed): warned.append({'route':route,**finding})
        for schema in page.schemas:
            schema_count+=1
            for finding in violations(json.dumps(schema,ensure_ascii=False),confirmed):
                findings.append({'route':route,'surface':'schema',**finding})
            if re.search(r'"(?:AggregateRating|Review)"|"ratingValue"',json.dumps(schema)):
                findings.append({'route':route,'rule':'unverified_review_schema'})
        for href in page.contacts:
            if '*' in href or re.search(r'790\D*3838',href): findings.append({'route':route,'rule':'invalid_or_legacy_contact','excerpt':href})
    out=ROOT/'docs/business-facts-audit'; out.mkdir(parents=True,exist_ok=True)
    report={'passed':not findings,'routes_checked':len(files),'schemas_checked':schema_count,'allowed_by_register':sorted(confirmed&{r['allowWhenConfirmed'] for r in RULES if r.get('allowWhenConfirmed')}),'findings':findings,'warnings':warned,'scope':'Known-disputed-claim detector across all prerendered HTML including metadata. Does not certify generic educational facts or owner facts; requires a fresh build.'}
    (out/'build-claim-gate.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'passed':not findings,'routes_checked':len(files),'schemas_checked':schema_count,'findings':len(findings),'warnings':len(warned),'warned_routes':len({w['route'] for w in warned}),'first_findings':findings[:8]},indent=2))
    raise SystemExit(1 if findings else 0)

if __name__=='__main__': main()
