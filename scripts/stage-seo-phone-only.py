import asyncio,json,sys,hashlib,shutil,zipfile
from pathlib import Path
sys.path.insert(0,'C:/Users/yorki/OneDrive/Desktop/Antigravity projects')
from browser_operator.engine import StealthBrowserEngine
ROOT=Path('C:/Users/yorki/Desktop/Goldenmaplelandscaping.ca/golden-maple-landscaping')
SRC=Path('C:/Users/yorki/Hermes Agent/skills/seo-matrix/out/golden-maple')
DEST=Path('C:/Users/yorki/hermes/cache/gm-seo-phone-release')
async def main():
 manifest=json.loads((ROOT/'docs/business-facts-audit/seo-phone-listSiteFiles.json').read_text())
 site=json.loads((ROOT/'docs/business-facts-audit/seo-phone-site-identity.json').read_text())
 e=StealthBrowserEngine(profile_name='gm-public-phone-audit',headless=True)
 data={}
 deploy=json.loads((ROOT/'docs/business-facts-audit/seo-phone-getDeploy.json').read_text())
 titles={m['title'] for m in deploy['summary']['messages']}
 assert {'No redirect rules processed','No header rules processed','No functions deployed','No edge functions deployed'} <= titles
 assert not deploy['function_schedules']
 try:
  await e.start()
  for item in manifest:
   path=item['path'].lstrip('/')
   assert '..' not in Path(path).parts
   p=SRC/path
   if p.exists():b=p.read_bytes()
   else:
    response=await e.page.request.get(site['published_deploy']['deploy_ssl_url']+'/'+path)
    if path=='netlify.toml' and response.status==404:continue
    assert response.status==200,(path,response.status)
    b=await response.body()
   assert hashlib.sha1(b).hexdigest()==item['sha'],path
   data[path]=b
 finally:await e.close()
 DEST.mkdir(parents=True,exist_ok=True)
 backup=ROOT/'docs/business-facts-audit/seo-before-phone-only.zip'
 changes=[]
 with zipfile.ZipFile(backup,'w',compression=zipfile.ZIP_DEFLATED) as z:
  for path,b in data.items():
   z.writestr(path,b)
   new=b.replace(b'+1-705-790-3838',b'+1-705-300-8015')
   if b!=new:changes.append(path)
   dest=DEST/'public'/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(new)
 report={'matched_production_files':len(data),'phone_only_changed_files':len(changes),'changed_files':changes,'stage':str(DEST),'rollback_deploy':site['published_deploy']['id'],'deployed':False}
 (ROOT/'docs/business-facts-audit/seo-phone-stage-proof.json').write_text(json.dumps(report,indent=2))
 print(json.dumps({k:v for k,v in report.items() if k!='changed_files'},indent=2))
 print('Production manifest proves no redirects, headers, functions, edge functions or schedules. Non-servable old netlify.toml returns 404; isolated release config will remain outside publish directory.')
if __name__=='__main__':asyncio.run(main())
