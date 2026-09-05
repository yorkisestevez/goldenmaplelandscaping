"""Read-only public live phone inventory via browser_operator; never submits forms."""
import asyncio,json,sys,re
from datetime import datetime,timezone
from pathlib import Path
sys.path.insert(0,'C:/Users/yorki/OneDrive/Desktop/Antigravity projects')
from browser_operator.engine import StealthBrowserEngine
async def main():
 e=StealthBrowserEngine(profile_name='gm-public-phone-audit',headless=True)
 rows=[]
 try:
  await e.start()
  for url in ['https://goldenmaplelandscaping.ca/','https://goldenmaplelandscaping.ca/contact','https://seo.goldenmaplelandscaping.ca/','https://guides.goldenmaplelandscaping.ca/']:
   try:
    response=await e.page.goto(url,wait_until='domcontentloaded',timeout=45000)
    text=await e.page.locator('body').inner_text()
    links=await e.page.locator('a[href^="tel:"]').evaluate_all('(es)=>es.map(e=>e.getAttribute("href"))')
    rows.append({'url':url,'final_url':e.page.url,'title':await e.page.title(),'scripts':await e.page.locator('script[src]').evaluate_all('(es)=>es.map(e=>e.src.split("?")[0]).slice(0,8)'),'status':response.status,'telephone_links':sorted(set(links)),'sophie_visible':bool(re.search(r'705[\s().-]*300[\s.-]*8015',text)),'personal_phone_visible':bool(re.search(r'705[\s().-]*500[\s.-]*3581',text)),'legacy_phone_visible':bool(re.search(r'705[\s().-]*790[\s.-]*3838',text))})
   except Exception as ex: rows.append({'url':url,'error':str(ex)[:300]})
  out={'observed_at':datetime.now(timezone.utc).isoformat(),'surfaces':rows,'scope':'public page body and tel links; no account or telephony changes'}
  Path('docs/business-facts-audit/live-phone-public-audit.json').write_text(json.dumps(out,indent=2),encoding='utf-8')
  print(json.dumps(out,indent=2))
 finally: await e.close()
if __name__=='__main__':asyncio.run(main())
