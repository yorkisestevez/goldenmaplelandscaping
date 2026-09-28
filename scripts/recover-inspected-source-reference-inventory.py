"""Enumerate actual inspected figures separately from generic resource links."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1];S=ROOT/'scripts';p=S/'hardscape-source-reference-cleanup.json';out=json.loads(p.read_text(encoding='utf8'))
raw=json.loads((ROOT/'public/deckcraft/hardscape-catalogue.json').read_text(encoding='utf8'));products={p['id']:p for p in raw['products']}
refs=[];gaps=[];retired=[r for r in out['retiredReferences']if r['productId']not in ['oaks-nueva-60mm-slab','oaks-colonnade']]
for pid,prefix,letters,url,files in[
 ('oaks-nueva-60mm-slab','nueva60-source-pattern-','ABCDEFGHIJKLMNOPQRSTUV','https://bramptonbrick.com/en/resource-file/nuevar-60mm-slab-laying-patterns/264/download',['hardscape-oaks-pattern-recovery.json','hardscape-oaks-nueva-completion-recovery.json']),
 ('oaks-colonnade','colonnade-source-pattern-','ABCDEFGH','https://bramptonbrick.com/en/resource-file/colonnade-laying-patterns/250/download',['hardscape-oaks-colonnade-pattern-recovery.json'])]:
 names={r['patternId']:r['patternName']for name in files if(S/name).exists()for r in json.loads((S/name).read_text(encoding='utf8')).get('recipes',[])}
 for f in products[pid]['finishes']:
  refs.append(dict(productId=pid,finishId=f['id'],patterns=[dict(id=prefix+l.lower(),name=names.get(prefix+l.lower(),'Pattern '+l+' — Original manufacturer diagram'),sourceUrl=url)for l in letters]))
 retired.append(dict(productId=pid,patternIds=['laying-patterns','autocad-patterns','current-canada-guide-laying-pattern-diagrams'],reason='Generic resource-link placeholders superseded by an explicit inventory of every actual inspected PDF figure; unrecovered figures remain individually named with their source and evidence gap.'))
 if pid=='oaks-colonnade':
  for letter in 'ADEGH':gaps.append(dict(productId=pid,patternId=prefix+letter.lower(),sourceUrl=url,reason='Actual official Colonnade pattern'+letter+' exists in the inspected eight-figure PDF. Full stock sizes are documented, but the original source diagram stock-to-stock placement and nominal closed repeat have not yet been recovered. Raster/compound outline extraction is partial; no generic substitute is labelled original.'))
for pid,page,cross in [('permacon-mega-melville-slab',15,'Melville60'),('permacon-mega-melville-paver',40,'Melville80')]:
 url='https://permacon.ca/wp-content/uploads/2022/12/2026-guideproduitsamengta-14avr-3.pdf#page='+str(page)
 for f in products[pid]['finishes']:
  refs.append(dict(productId=pid,finishId=f['id'],patterns=[dict(id='source-modular-83-17',name='Original Modular —83%'+cross+'/17%MegaMelville',sourceUrl=url)]))
 gaps.append(dict(productId=pid,patternId='source-modular-83-17',sourceUrl=url,reason='Actual official PDF'+str(page)+' mixed original combines83%'+cross+' and17%MegaMelville across separate product families. Current per-finish recipe schema cannot bind external product stocks, and no closed source-derived mixed placement module is recovered. Original reference retained; unsupported inferred Herringbone/Third labels removed.'))
out['sourceReferences']=refs;out['evidenceGaps']=gaps;out['retiredReferences']=retired;p.write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False),encoding='utf8');print(json.dumps(dict(sourceReferenceInventories=len(refs),individualFigures=sum(len(r['patterns'])for r in refs),gaps=len(gaps),retirements=len(retired))))
