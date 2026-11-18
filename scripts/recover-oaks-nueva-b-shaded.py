"""Review-only exact closure of the actual NuevaB eight shaded source stocks."""
from pathlib import Path
import math,itertools,json,collections
W=Path(__file__).resolve().parents[1].parent/'paver-pattern-recovery'
cells=[(5,0,2,2),(0,1,2,1),(2,1,3,2),(0,2,2,3),(5,2,2,1),(2,3,2,2),(4,3,2,2),(6,3,1,2)]
out=[]
vectors=[(x,y)for x in range(-10,11)for y in range(-10,11)if(x,y)!=(0,0)]
for a,b in itertools.combinations(vectors,2):
 D=a[0]*b[1]-a[1]*b[0]
 if abs(D)!=30:continue
 def canon(x,y):
  i=math.floor((x*b[1]-y*b[0])/D+1e-9);j=math.floor((a[0]*y-a[1]*x)/D+1e-9);return x-i*a[0]-j*b[0],y-i*a[1]-j*b[1]
 occ=collections.Counter(canon(x+i,y+j)for x,y,w,h in cells for i in range(w)for j in range(h))
 if len(occ)==30 and set(occ.values())=={1}:out.append([a,b])
out.sort(key=lambda pair:sum(abs(v)for vec in pair for v in vec))
(W/'nueva-b-shaded-bases.json').write_text(json.dumps(dict(cells=cells,bases=out),indent=2));print(json.dumps(dict(closures=len(out),first=out[:10])))
