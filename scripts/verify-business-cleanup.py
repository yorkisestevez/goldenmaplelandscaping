"""Offline local cleanup verification. No submissions, deployment or production mutation.
Requires the read-only localhost preview on port 4187 and the existing browser-operator Python environment.
"""
from pathlib import Path
import datetime, hashlib, json, subprocess, sys, shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/business-facts-audit'
BROWSER_PY=Path.home()/'hermes/hermes-agent/venv/Scripts/python.exe'
NODE=Path(shutil.which('node')).as_posix()
COMMANDS=[
 ('business-tests','npm run test:business'),
 ('numeric-preservation',f'"{NODE}" node_modules/tsx/dist/cli.mjs scripts/test-estimator-numeric-preservation.ts'),
 ('lint-and-pricing','npm run lint'),
 ('component-publication',f'"{NODE}" scripts/test-components-publication.ts'),
 ('chat-boundaries',f'"{NODE}" node_modules/tsx/dist/cli.mjs scripts/check-chat-business-facts.ts'),
 ('production-build','npm run build'),
 ('mobile-browser',f'"{BROWSER_PY.as_posix()}" scripts/check-business-browser.py'),
 ('browser-claims','python3 scripts/check-rendered-business-claims.py'),
 ('migration-proposal-integrity','python3 scripts/verify-migration-artifacts.py'),
 ('diff-whitespace','git diff --check'),
]

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 report={'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'local cleanup verification, not owner fact certification or deployment approval','steps':[],'passed':False}
 for name,cmd in COMMANDS:
  result=subprocess.run([shutil.which('bash'),'-c',cmd],cwd=ROOT,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
  log=OUT/f'final-{name}.log'
  log.write_text(result.stdout,encoding='utf-8')
  report['steps'].append({'name':name,'command':cmd,'exit_code':result.returncode,'log':str(log.relative_to(ROOT))})
  (OUT/'final-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
  print(f'{name}: {"PASS" if result.returncode==0 else "FAIL"}',flush=True)
  if result.returncode:
   print(result.stdout[-3000:]);return 1
 original=ROOT/'public/downloads/2026-simcoe-county-backyard-cost-guide.pdf'
 copied=ROOT/'build/client/downloads/2026-simcoe-county-backyard-cost-guide.pdf'
 assert original.read_bytes()==copied.read_bytes(),'Build PDF differs from reviewed source PDF'
 report['pdf_sha256']=hashlib.sha256(original.read_bytes()).hexdigest()
 report['protected_route_and_hosting_diff']=subprocess.check_output(['git','diff','--','src/routes.ts','react-router.config.ts','netlify.toml'],cwd=ROOT,text=True)
 assert not report['protected_route_and_hosting_diff'],'Protected routing or hosting configuration changed; review required'
 report['passed']=True
 report['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 (OUT/'final-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
 print('ALL LOCAL CLEANUP CHECKS PASSED. No deployment performed.')
 return 0
if __name__=='__main__':sys.exit(main())
