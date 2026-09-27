"""Recover source lattice motifs only when full-stock periodic coverage proves closure."""
from pathlib import Path
import json,math,itertools,collections
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery'
grids=json.loads((WORK/'oaks-nueva-mixed-grids.json').read_text());out=[]
# A is a random-bundle source: its explicitly shaded module is authoritative,
# while four background stocks are illustrated in a different arrangement.
# Preserve the exact eight shaded coordinates, never claim the complete source
# background is this deterministic repeat.
a=next(g for g in grids if g['pattern']=='A');sourceCells=[(4,8,1,2),(5,8,2,2),(7,8,2,3),(9,7,2,2),(9,9,2,1),(9,10,2,2),(7,11,2,1),(4,10,3,2)]
assert all(c in set(map(tuple,a['cells']))for c in sourceCells)
motif=[(x-4,y-7,w,h)for x,y,w,h in sourceCells];v1=(2,4);v2=(7,-1);tw=th=30
rs=set(((x+i*v1[0]+j*v2[0])%tw,(y+i*v1[1]+j*v2[1])%th,w,h)for i in range(-30,31)for j in range(-30,31)for x,y,w,h in motif)
occ=collections.Counter(((x+i)%tw,(y+j)%th)for x,y,w,h in rs for i in range(w)for j in range(h))
assert len(occ)==tw*th and set(occ.values())=={1}
sourceMatches=sum(((x-4)%tw,(y-7)%th,w,h)in rs for x,y,w,h in a['cells'])
assert sourceMatches==58 and len(a['cells'])==62
out.append(dict(pattern='A',page=1,moduleMm=200,basis=[v1,v2],det=30,cells=motif,stockMix=dict(collections.Counter(str(sorted([w,h]))for x,y,w,h in motif)),rectangularProof=[30,30],sourceFrame=a['frame'],sourceOrigin=[a['origin'][0]+4*a['pointPitchPerMm']*200,a['origin'][1]+7*a['pointPitchPerMm']*200],sourceFaces=8,sourceGridResidual=a['sourceGridResidual'],sourceScope='Original explicitly shaded L-shape module; nominal deterministic repeat. Source random-bundle background varies at4 of62 full stock positions.',sourceBackgroundMatches=sourceMatches,sourceBackgroundStocks=62))
for g in grids:
 if g['pattern']=='A':continue
 if not g.get('cells'):continue
 found=[]
 for v1,v2 in itertools.combinations([tuple(v[:2])for v in g['periods']if v[2]>=4],2):
  signed=v1[0]*v2[1]-v1[1]*v2[0];det=abs(signed)
  if not det or det>400:continue
  canonical=set()
  for x,y,w,h in g['cells']:
   a=math.floor((x*v2[1]-y*v2[0])/signed+1e-9);b=math.floor((v1[0]*y-v1[1]*x)/signed+1e-9)
   canonical.add((x-a*v1[0]-b*v2[0],y-a*v1[1]-b*v2[1],w,h))
  if sum(w*h for x,y,w,h in canonical)!=det:continue
  tw=det//math.gcd(v1[1],v2[1]);th=det//math.gcd(v1[0],v2[0])
  if tw*th>50000:continue
  rs=set()
  for a in range(-det,det+1):
   for b in range(-det,det+1):
    dx,dy=a*v1[0]+b*v2[0],a*v1[1]+b*v2[1]
    for x,y,w,h in canonical:rs.add(((x+dx)%tw,(y+dy)%th,w,h))
  occupied=collections.Counter()
  for x,y,w,h in rs:
   for dx in range(w):
    for dy in range(h):occupied[(x+dx)%tw,(y+dy)%th]+=1
  if len(occupied)!=tw*th or any(v!=1 for v in occupied.values()):continue
  # Every visible source stock must be regenerated with its original orientation.
  if not all((x%tw,y%th,w,h)in rs for x,y,w,h in g['cells']):continue
  found.append(dict(pattern=g['pattern'],page=g['page'],moduleMm=g['physicalModuleMm'],basis=[v1,v2],det=det,cells=sorted(canonical),stockMix=dict(collections.Counter(str(sorted([w,h]))for x,y,w,h in canonical)),rectangularProof=[tw,th],sourceFrame=g['frame'],sourceOrigin=g['origin'],sourceFaces=len(g['cells']),sourceGridResidual=g['sourceGridResidual']))
 if found:
  best=min(found,key=lambda r:(r['det'],sum(abs(v)for b in r['basis']for v in b)))
  out.append(best)
print(json.dumps([{k:v for k,v in r.items()if k!='cells'}for r in out],indent=2))
(WORK/'oaks-nueva-mixed-modules.json').write_text(json.dumps(out,indent=2))
