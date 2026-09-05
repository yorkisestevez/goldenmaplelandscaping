import json,subprocess,shutil,shlex,sys,hashlib
from pathlib import Path
site=sys.argv[1];label=sys.argv[2]
def api(method,data):
 r=subprocess.run([shutil.which('bash'),'-c','netlify api '+method+' --data '+shlex.quote(json.dumps(data))],capture_output=True,text=True,encoding='utf-8',errors='replace')
 if r.returncode:raise RuntimeError(method+' failed')
 return json.loads(r.stdout)
s=api('getSite',{'site_id':site});p=s['published_deploy'];d=api('getDeploy',{'deploy_id':p['id']});f=api('searchSiteFunctions',{'site_id':site})
report={'id':site,'name':s['name'],'custom_domain':s.get('custom_domain'),'deploy_id':p['id'],'state':p['state'],'functions':f,'function_schedules':d.get('function_schedules'),'summary':d.get('summary')}
if label=='seo-after':
 files=api('listSiteFiles',{'site_id':site});root=Path('C:/Users/yorki/hermes/cache/gm-seo-phone-release/public');mismatch=[x['path'] for x in files if not (root/x['path'].lstrip('/')).exists() or hashlib.sha1((root/x['path'].lstrip('/')).read_bytes()).hexdigest()!=x['sha']];report.update({'file_count':len(files),'mismatch':mismatch});assert not mismatch;assert p['id']=='6a9c5f3c2b9919ee94f040aa'
Path('docs/business-facts-audit/'+label+'-release-state.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
