"""Offline semantic review of observed URLs. Outputs proposals, never server rules."""
import csv
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/seo-migration'
MAIN='https://goldenmaplelandscaping.ca'
FAMILIES={'paver-patio-installation':'interlocking','interlocking-driveway':'interlocking','front-walkway-installation':'interlocking','pool-deck-installation':'interlocking','retaining-wall-construction':'retaining-walls'}

def refine(raw, inventory):
    targets={urlparse(x['source_url']).path.rstrip('/'):x for x in raw['main_pages'] if x['status']==200 and x['title']}
    robots=raw['robots']['https://seo.goldenmaplelandscaping.ca/robots.txt']
    parser=RobotFileParser(); parser.parse(robots['body'].splitlines())
    rows=[]
    for original in inventory:
        row=dict(original)
        parts=urlparse(row['source_url']).path.strip('/').split('/')
        parts=[p for p in parts if p]
        service=parts[-1] if parts and parts[0]=='services' else parts[0] if parts else ''
        city=parts[1] if len(parts)==2 and parts[0]!='services' else ''
        choice=''; kind='NO_HONEST_EQUIVALENT_ESTABLISHED'
        reason='No confirmed offering or appropriate same-market destination; do not infer a 410 from this absence.'
        if not parts:
            choice=''; kind='BUSINESS_HOMEPAGE_ONLY'
            reason='Only the old homepage may have the main homepage as its direct counterpart; not a catch-all for child URLs.'
            target=targets.get('')
        else:
            target=None
            family=FAMILIES.get(service)
            combo=f'/services/{family}-{city}' if family and city else None
            if combo and combo in targets:
                choice=combo; target=targets[choice]
                kind='SAME_CITY_SERVICE_FAMILY'
                reason='Same city and relevant service family. Retaining-wall wording aligns; paver/driveway/walkway/pool scopes are broader interlocking candidates, not asserted exact equivalents.'
            elif city and f'/locations/{city}' in targets:
                choice=f'/locations/{city}'; target=targets[choice]; kind='SAME_CITY_LOCATION_FALLBACK'
                reason='No exact service-location/service target established; same-city location page is a conditional fallback only after advertised service is confirmed.'
            elif not city and '/services' in targets:
                choice='/services'; target=targets[choice]; kind='CONSOLIDATED_SERVICES_REVIEW'
                reason='No geographically neutral exact service route established. Services index is a review candidate, not an exact equivalent or approved redirect.'
        if city=='oro-station':
            reason+=' Oro Station must not silently be treated as equivalent to all Oro-Medonte; confirm geography and service scope.'
        candidate=target['final_url'] if target else ''
        row.update({'service_slug':service,'municipality_slug':city,'service_offered':'OWNER_CONFIRMATION_REQUIRED','municipality_offered':'OWNER_CONFIRMATION_REQUIRED' if city else 'NOT_APPLICABLE_TO_HUB','main_domain_equivalent':candidate,'proposed_destination':candidate,'match_type':kind,'service_municipality_offering_evidence':reason,'recommended_disposition':'OWNER_CONFIRMATION_REQUIRED','confirmed_executable_redirect':'','decision_rationale':reason+' Owner must confirm actual offering and target relevance before any routing action.','gsc_clicks':None,'gsc_impressions':None,'gsc_data_status':'NOT_OBTAINED_AUTHENTICATED_ACCESS_NOT_VERIFIED','external_backlinks':None,'external_backlinks_status':'NOT_OBTAINED_NO_BACKLINK_PROVIDER_QUERIED','robots_txt_allows_googlebot':parser.can_fetch('Googlebot',row['source_url']) if robots['status']==200 else None})
        row['indexability_note']='Technical crawl eligibility only, not proof of Google indexing; observed robots.txt allows crawling.' if row['robots_txt_allows_googlebot'] else 'robots.txt crawling blocked or unavailable; review before drawing indexability conclusions.'
        rows.append(row)
    return rows

if __name__=='__main__':
    raw=json.loads((OUT/'raw-crawl-evidence.json').read_text(encoding='utf-8'))
    rows=refine(raw,json.loads((OUT/'redirect-inventory.json').read_text(encoding='utf-8')))
    assert rows and len(rows)==len(raw['old_sitemap_urls'])
    assert all(not r['confirmed_executable_redirect'] for r in rows)
    assert all(not r['proposed_destination'] or urlparse(r['source_url']).path=='/' or urlparse(r['proposed_destination']).path!='/' for r in rows)
    (OUT/'reviewed-redirect-map.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False),encoding='utf-8')
    with (OUT/'reviewed-redirect-map.csv').open('w',newline='',encoding='utf-8-sig') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader()
        writer.writerows([{**r,'internal_link_urls':json.dumps(r['internal_link_urls'])} for r in rows])
    summary={'rows':len(rows),'candidate_types':dict(Counter(r['match_type'] for r in rows)),'proposed_destinations':sum(bool(r['proposed_destination']) for r in rows),'confirmed_redirects':0,'robots_allowed':sum(r['robots_txt_allows_googlebot'] is True for r in rows),'scope':'Reviewed conditional proposals; unknown metrics are null, never fabricated zero.'}
    (OUT/'reviewed-map-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary,indent=2))
