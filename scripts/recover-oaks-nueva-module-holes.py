"""Find source-hidden stock positions from a uniquely closed source lattice.

Does not promote a recipe. Completion candidates must be visually compared
against the actual manufacturer shaded faces before any runtime binding.
"""
from pathlib import Path
import json,math,collections
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';grids=json.loads((WORK/'oaks-nueva-mixed-grids.json').read_text())
specs={'O':([(7,2),(2,-6)],{(1,2):3,(2,2):3,(2,3):2,(2,4):2}),'Q':([(2,4),(8,1)],{(1,2):7,(2,4):2}),'R':([(2,6),(7,1)],{(1,2):4,(2,2):3,(2,3):2,(2,4):1}),'S':([(4,7),(-6,8)],{(2,4):3,(3,6):1,(4,8):1}),'T':([(3,8),(-12,6)],{(2,4):4,(3,6):1,(4,8):2}),'U':([(3,-13),(0,20)],{(2,4):3,(3,6):2})};out=[]
for g in grids:
 if g['pattern']not in specs:continue
 (a,b),desired=specs[g['pattern']];D=a[0]*b[1]-a[1]*b[0]
 def canon(x,y):
  i=math.floor((x*b[1]-y*b[0])/D+1e-9);j=math.floor((a[0]*y-a[1]*x)/D+1e-9);return(x-i*a[0]-j*b[0],y-i*a[1]-j*b[1])
 known=set((*canon(x,y),w,h)for x,y,w,h in g['cells']);have=collections.Counter(tuple(sorted([w,h]))for x,y,w,h in known);remaining=desired.copy()
 for k,n in have.items():remaining[k]-=n
 assert all(v>=0 for v in remaining.values())
 tw=abs(D)//math.gcd(a[1],b[1]);th=abs(D)//math.gcd(a[0],b[0]);points=set(canon(x,y)for x in range(tw)for y in range(th));assert len(points)==abs(D)
 def cover(c):
  x,y,w,h=c;return{canon(x+i,y+j)for i in range(w)for j in range(h)}
 occupied=set()
 for c in known:
  co=cover(c);assert len(co)==c[2]*c[3]and not(co&occupied);occupied|=co
 holes=points-occupied;candidates=[]
 for stock,count in remaining.items():
  if count<=0:continue
  for w,h in set([stock,stock[::-1]]):
   for x,y in points:
    c=(x,y,w,h);co=cover(c)
    if len(co)==w*h and co<=holes:candidates.append((c,co,stock))
 solutions=[]
 def search(left,counts,path):
  if len(solutions)>=64:return
  if not left:
   if all(v==0 for v in counts.values()):solutions.append(path)
   return
  point=min(left,key=lambda p:sum(p in co and counts[stock]>0 and co<=left for c,co,stock in candidates))
  for c,co,stock in candidates:
   if point in co and counts[stock]>0 and co<=left:
    n=counts.copy();n[stock]-=1;search(left-co,n,path+[c])
 search(holes,remaining,[])
 out.append(dict(pattern=g['pattern'],page=g['page'],moduleMm=g['physicalModuleMm'],basis=[a,b],det=abs(D),knownCells=sorted(known),missingStockCounts={str(k):v for k,v in remaining.items()if v},solutions=solutions,sourceFaces=len(g['cells']),sourceGridResidual=g['sourceGridResidual']))
(WORK/'oaks-nueva-hole-candidates.json').write_text(json.dumps(out,indent=2))
print(json.dumps([{k:v for k,v in r.items()if k not in['knownCells','solutions']}|dict(solutions=len(r['solutions']),first=r['solutions'][0]if r['solutions']else None)for r in out],indent=2))
