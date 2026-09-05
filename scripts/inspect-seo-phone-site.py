import subprocess,shutil,json,sys,shlex
from pathlib import Path
site='68d0e773-53a5-438c-9220-a77abae47964'
def api(method,data):
 command='netlify api '+method+' --data '+shlex.quote(json.dumps(data))
 r=subprocess.run([shutil.which('bash'),'-c',command],capture_output=True,text=True,encoding='utf-8',errors='replace')
 if r.returncode: raise RuntimeError('Netlify read API failed: '+method)
 return json.loads(r.stdout)
s=api('getSite',{'site_id':site})
p=s.get('published_deploy') or {}
r={'id':s['id'],'name':s['name'],'custom_domain':s.get('custom_domain'),'published_deploy':{k:p.get(k) for k in ['id','state','deploy_ssl_url','functions','function_schedules','published_at']},'build_settings':{k:(s.get('build_settings') or {}).get(k) for k in ['repo_url','base','dir','cmd']}}
assert r['custom_domain']=='seo.goldenmaplelandscaping.ca'
Path('docs/business-facts-audit/seo-phone-site-identity.json').write_text(json.dumps(r,indent=2),encoding='utf-8')
print(json.dumps(r,indent=2))
for method,data in [('getSiteDeploy',{'site_id':site,'deploy_id':p['id']}),('listSiteFiles',{'site_id':site}),('searchSiteFunctions',{'site_id':site}),('getDeploy',{'deploy_id':p['id']}),('getSiteFileByPathName',{'site_id':site,'file_path':'netlify.toml'})]:
 try:
  data=api(method,data)
  if method in ('getSiteDeploy','getDeploy'):data={k:data.get(k) for k in ['id','state','functions','required_functions','function_schedules','framework','summary','edge_functions','edge_functions_present','config'] }
  Path('docs/business-facts-audit/seo-phone-'+method+'.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
  print(method, 'count='+str(len(data)) if isinstance(data,list) else json.dumps(data))
 except Exception as ex: print(method,type(ex).__name__)
