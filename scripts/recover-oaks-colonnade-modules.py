"""Prove source-bound periodic full-stock modules from inspected raster grids."""
from pathlib import Path
import json,math,itertools,collections
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';grids=json.loads((WORK/'oaks-colonnade-raster-grids.json').read_text());out=[]
for g in grids:
 if not g.get('cells')or g['pattern']in['C','F','H']or g.get('sourceGridResidual',1)>.09:continue
 found=[]
 for v1,v2 in itertools.combinations([tuple(v[:2])for v in g['periods']if v[2]>=4],2):
  signed=v1[0]*v2[1]-v1[1]*v2[0];det=abs(signed)
  if not det or det>224:continue
  canonical=set()
  for x,y,w,h in g['cells']:
   a=math.floor((x*v2[1]-y*v2[0])/signed+1e-9);b=math.floor((v1[0]*y-v1[1]*x)/signed+1e-9)
   canonical.add((x-a*v1[0]-b*v2[0],y-a*v1[1]-b*v2[1],w,h))
  if sum(w*h for x,y,w,h in canonical)!=det:continue
  tw=det//math.gcd(v1[1],v2[1]);th=det//math.gcd(v1[0],v2[0]);rs=set()
  for a in range(-det,det+1):
   for b in range(-det,det+1):
    for x,y,w,h in canonical:rs.add(((x+a*v1[0]+b*v2[0])%tw,(y+a*v1[1]+b*v2[1])%th,w,h))
  occ=collections.Counter(((x+i)%tw,(y+j)%th)for x,y,w,h in rs for i in range(w)for j in range(h))
  if len(occ)!=tw*th or set(occ.values())!={1}:continue
  if not all((x%tw,y%th,w,h)in rs for x,y,w,h in g['cells']):continue
  found.append(dict(pattern=g['pattern'],page=g['page'],moduleMm=75,basis=[v1,v2],det=det,cells=sorted(canonical),stockMix=dict(collections.Counter('x'.join(map(str,sorted([w,h])))for x,y,w,h in canonical)),rectangularProof=[tw,th],sourceFaces=len(g['cells']),sourceGridResidual=g['sourceGridResidual'],sourceRegionPt=g['frame']))
 if found:out.append(min(found,key=lambda r:(r['det'],sum(abs(v)for b in r['basis']for v in b))))
(WORK/'oaks-colonnade-modules.json').write_text(json.dumps(out,indent=2))
print(json.dumps([{k:v for k,v in r.items()if k!='cells'}for r in out],indent=2))
