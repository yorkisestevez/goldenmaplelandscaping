"""Reject hardcoded current contacts outside the canonical config (stdlib only)."""
from pathlib import Path
import json,re
ROOT=Path(__file__).resolve().parents[1]
pattern=re.compile(r'705[\s().-]*300[\s.-]*8015|705[\s().-]*500[\s.-]*3581|705[\s().-]*790[\s.-]*3838|yorkis@goldenmaplelandscaping\.ca',re.I)
findings=[]
for p in (ROOT/'src').rglob('*'):
    if p.suffix not in ('.ts','.tsx') or p.name=='business.ts': continue
    for n,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):
        if line.lstrip().startswith(('//','*')): continue
        if pattern.search(line): findings.append({'file':str(p.relative_to(ROOT)),'line':n,'excerpt':line.strip()[:180]})
print(json.dumps({'passed':not findings,'findings':findings},indent=2))
raise SystemExit(1 if findings else 0)
