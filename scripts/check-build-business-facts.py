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

RULES={
 'manufacturer_installer_claim':r'certified installers? for|contractors are certified',
 'unsupported_experience':r'contractors have assessed hundreds|contractors have completed across',
 'unsupported_accuracy':r'lock to\s*±\s*5%|real Carr Landscape Depot pricing|we handle the engineering',
 'rewrite_artifact':r"contractors['’]d|record verification in progress",
 'review_rating':r'5\.0\s*(?:GOOGLE RATING|[·/]|-?stars?|out of)',
 'review_count':r'8\s*(?:VERIFIED\s*)?(?:GOOGLE\s*)?REVIEWS',
 'wsib_certified':r'WSIB[ -]CERTIFIED',
 'insurance_amount':r'\$5\s*(?:M|million|,000,000)\s*(?:in\s*)?(?:liability|coverage)',
 'installer_certified':r'(?:ICPI|CMHA)[ -]certified|certified\s*(?:ICPI|CMHA)',
 'brand_authorization':r'(?:certified|authorized)\s*(?:Techo|Permacon|TimberTech)|(?:Techo-Pro|TimberTech Pro)',
 'blanket_warranty':r'(?:our|a|by a|with a|includes a|include a)\s*(?:written\s*)?(?:5|five|10|ten)[ -]year\s*(?:sink|structural|craftsmanship|workmanship)|\b(?:5|five|10|ten)[ -](?:year|yr)\s*(?:(?:structural|craftsmanship|workmanship|sink\s*(?:&|and)?\s*settlement)\s*)?warranty',
 'free_visit':r'free\s*(?:on[ -]site|site\s*(?:visit|assessment)|consultation|15[ -]minute|design\s*(?:session|consultation))|(?:no fee|complimentary)\s*(?:visit|consultation|site)',
 'design_credit':r'(?:100%|fully)\s*credited|design\s*fee\s*(?:is\s*)?(?:credited|waived)',
 'permit_promise':r'we\s*(?:handle|take care of|manage)\s*(?:all|every|the|your)?\s*(?:permits|permit applications|permit paperwork)',
 'obsolete_phone':r'705[\s().-]*790[\s.-]*3838',
}

def violations(text):
    result=[]
    for name,pattern in RULES.items():
        m=re.search(pattern,text,re.I)
        if m: result.append({'rule':name,'excerpt':text[max(0,m.start()-65):m.end()+100]})
    return result

def main():
    # Detector negative/control fixtures: patterns cannot silently become a no-op.
    assert violations('5.0 GOOGLE RATING 8 VERIFIED GOOGLE REVIEWS')
    assert violations('WSIB Certified')
    assert not violations('Ask for current coverage documents. Confirm consultation scope before booking.')
    files=sorted((ROOT/'build/client').rglob('index.html'))
    assert len(files)>80,'Missing/truncated build is not a pass'
    findings=[]; schema_count=0
    for path in files:
        page=Page(); page.feed(path.read_text(encoding='utf-8'))
        text=' '.join(' '.join(page.parts).split())
        route='/'+str(path.parent.relative_to(ROOT/'build/client')).replace('\\','/').strip('.')
        for finding in violations(text): findings.append({'route':route,**finding})
        for schema in page.schemas:
            schema_count+=1
            for finding in violations(json.dumps(schema,ensure_ascii=False)):
                findings.append({'route':route,'surface':'schema',**finding})
            if re.search(r'"(?:AggregateRating|Review)"|"ratingValue"',json.dumps(schema)):
                findings.append({'route':route,'rule':'unverified_review_schema'})
        for href in page.contacts:
            if '*' in href or re.search(r'790\D*3838',href): findings.append({'route':route,'rule':'invalid_or_legacy_contact','excerpt':href})
    out=ROOT/'docs/business-facts-audit'; out.mkdir(parents=True,exist_ok=True)
    report={'passed':not findings,'routes_checked':len(files),'schemas_checked':schema_count,'findings':findings,'scope':'Known-disputed-claim detector across all prerendered HTML including metadata. Does not certify generic educational facts or owner facts; requires a fresh build.'}
    (out/'build-claim-gate.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'passed':not findings,'routes_checked':len(files),'schemas_checked':schema_count,'findings':len(findings),'first_findings':findings[:8]},indent=2))
    raise SystemExit(1 if findings else 0)

if __name__=='__main__': main()
