"""Offline independent verification; never fetches or deploys anything."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / 'docs/seo-migration'
ALLOWED = {'301_TO_EXACT_EQUIVALENT','301_TO_CLOSEST_RELEVANT_PAGE','KEEP_TEMPORARILY_FOR_REBUILD','410_NOT_OFFERED_OR_NO_VALUE','OWNER_CONFIRMATION_REQUIRED'}

def verify(raw, rows):
    urls=raw['old_sitemap_urls']
    assert urls, 'Empty source inventory is not successful coverage'
    assert len(rows)==len(urls), 'Count mismatch'
    assert len({r['source_url'] for r in rows})==len(rows), 'Duplicate decision rows'
    assert {r['source_url'] for r in rows}==set(urls), 'Missing or extra source URL'
    required={'source_url','status','canonical','indexability','title','h1','description','word_count','internal_link_urls','gsc_clicks','gsc_impressions','recommended_disposition','main_domain_equivalent'}
    for row in rows:
        assert required.issubset(row), f'Missing fields: {required-set(row)}'
        assert row['recommended_disposition'] in ALLOWED
        if row['recommended_disposition']=='OWNER_CONFIRMATION_REQUIRED':
            assert not row.get('confirmed_executable_redirect'), 'Unconfirmed row must not be executable'
        if row.get('confirmed_executable_redirect'):
            assert row['confirmed_executable_redirect'] not in ['https://goldenmaplelandscaping.ca','https://goldenmaplelandscaping.ca/'], 'No blanket homepage destinations'
    return {'source_urls':len(urls),'decision_rows':len(rows),'coverage':'complete','statuses':dict(Counter(str(r['status']) for r in rows)),'dispositions':dict(Counter(r['recommended_disposition'] for r in rows))}

if __name__=='__main__':
    raw=json.loads((AUDIT/'raw-crawl-evidence.json').read_text(encoding='utf-8'))
    rows=json.loads((AUDIT/'redirect-inventory.json').read_text(encoding='utf-8'))
    result=verify(raw,rows)
    reviewed=json.loads((AUDIT/'reviewed-redirect-map.json').read_text(encoding='utf-8'))
    result['reviewed_map']=verify(raw,reviewed)
    assert all(r['gsc_clicks'] is None and r['gsc_impressions'] is None and r['external_backlinks'] is None for r in reviewed), 'Missing analytics must remain null'
    failures=[]
    fixtures=[({'old_sitemap_urls':[]},[]), (raw,rows+rows[:1]), (raw,rows[1:])]
    for n,(r,items) in enumerate(fixtures):
        try: verify(r,items)
        except AssertionError: failures.append(n)
        else: raise AssertionError(f'Negative fixture {n} accepted')
    result['negative_fixtures_rejected']=len(failures)
    result['scope']='offline structural proof only; not owner offering approval or live migration verification'
    (AUDIT/'independent-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
