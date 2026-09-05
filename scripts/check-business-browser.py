"""Read-only browser proof against local prerendered output; no form submissions."""
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
sys.path.insert(0,'C:/Users/yorki/OneDrive/Desktop/Antigravity projects')
from browser_operator.engine import StealthBrowserEngine

async def main():
    out=Path(__file__).resolve().parents[1]/'docs/business-facts-browser-proof'
    out.mkdir(parents=True,exist_ok=True)
    engine=StealthBrowserEngine(profile_name='default',headless=True)
    records=[]; errors=[]
    try:
        await engine.start()
        await engine.page.set_viewport_size({'width':390,'height':844})
        async def local_only(route):
            if urlparse(route.request.url).hostname in ('127.0.0.1','localhost') and route.request.method in ('GET','HEAD'):
                await route.continue_()
            else:
                await route.abort()
        await engine.page.route('**/*',local_only)
        engine.page.on('pageerror',lambda exc:errors.append(str(exc)))
        for slug in ['','contact/','about/','services/interlocking-innisfil/','locations/orillia/','locations/barrie/','book/','cost-estimator/','portfolio/','process/construction/','resources/retaining-wall-cost-oro-medonte/']:
            response=await engine.page.goto('http://127.0.0.1:4187/'+slug,wait_until='domcontentloaded')
            await engine.page.locator('h1').first.wait_for()
            await engine.page.wait_for_function("() => { let e=document.querySelector('h1'); if(!e) return false; while(e) { if(Number(getComputedStyle(e).opacity)<0.99) return false; e=e.parentElement; } return true; }", timeout=20000)
            data=await engine.page.evaluate('''() => ({ title: document.title, h1:[...document.querySelectorAll('h1')].map(x=>x.innerText), phones:[...document.querySelectorAll('a[href^="tel:"]')].map(x=>x.getAttribute('href')), emails:[...document.querySelectorAll('a[href^="mailto:"]')].map(x=>x.getAttribute('href')), schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(x=>JSON.parse(x.textContent)), canonical:document.querySelector('link[rel="canonical"]')?.href, overflow:document.documentElement.scrollWidth>window.innerWidth+1, text:document.body.innerText })''')
            data.update({'route':'/'+slug,'status':response.status,'observed_at':datetime.now(timezone.utc).isoformat()})
            assert response.status==200,data['route']
            assert data['h1'],data['route']
            assert not data['overflow'],f"Horizontal overflow: {data['route']}"
            assert not any('7903838' in x for x in data['phones'])
            assert not any('AggregateRating' in json.dumps(s) or 'ratingValue' in json.dumps(s) for s in data['schemas'])
            await engine.page.screenshot(path=str(out/(slug.strip('/').replace('/','-') or 'home'))+'.png',full_page=True)
            records.append(data)
        assert not errors,errors
        result={'pages':records,'page_errors':errors,'external_requests':'blocked in test browser','form_submissions':0,'scope':'Local static build only, no production deployment or provider calls'}
        (out/'proof.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps({'pages':len(records),'status_codes':[r['status'] for r in records],'horizontal_overflow':[r['route'] for r in records if r['overflow']],'page_errors':errors,'forms_submitted':0},indent=2))
    finally:
        await engine.close()

if __name__=='__main__':asyncio.run(main())
