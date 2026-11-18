"""Recover actual shaded Colonnade source modules; retain full table stocks."""
from pathlib import Path
import json,math,collections,hashlib
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
source='https://bramptonbrick.com/en/resource-file/colonnade-laying-patterns/250/download';sha=hashlib.sha256((WORK/'oaks-colonnade-patterns.pdf').read_bytes()).hexdigest()
raw=json.loads((OUT/'permacon-oaks.json').read_text(encoding='utf8'));p=next(p for p in raw if p['id']=='oaks-colonnade');f=p['finishes'][0]
# Coordinates are the enlarged source's actual shaded stock boundaries, with
# X/Y drawing scales interpreted independently against the75mm dimension grid.
modules={'C':dict(cells=[(0,0,3,4),(3,0,3,2),(3,2,3,3),(3,5,4,3),(1,4,2,3)],basis=[(6,1),(3,-7)],expectedMix={'2x3':2,'3x3':1,'3x4':2}),
 'F':dict(cells=[(0,0,4,3),(4,0,2,3),(6,0,3,4),(6,4,3,2)],basis=[(-3,3),(0,12)],expectedMix={'2x3':2,'3x4':2})}
b=next(g for g in json.loads((WORK/'oaks-colonnade-raster-grids.json').read_text())if g['pattern']=='B')
modules['B']=dict(cells=[(x-6,y-6,w,h)for x,y,w,h in b['shadedCells']],basis=[(5,3),(16,-11)],expectedMix={'1x2':2,'2x2':6,'2x3':7,'3x3':1,'3x4':2},sourceScope='Explicit shaded18-stock original module. Its repeat matches107 of109 raster-recovered complete background stocks;2background placements vary.',sourceGridResidual=b['sourceGridResidual'],sourceBackgroundMatches=107,sourceBackgroundStocks=109)
recipes=[]
for letter,mod in modules.items():
 c=mod['cells'];v1,v2=mod['basis'];det=abs(v1[0]*v2[1]-v1[1]*v2[0]);tw=det//math.gcd(v1[1],v2[1]);th=det//math.gcd(v1[0],v2[0]);assert sum(w*h for x,y,w,h in c)==det
 rs=set(((x+a*v1[0]+b*v2[0])%tw,(y+a*v1[1]+b*v2[1])%th,w,h)for a in range(-det,det+1)for b in range(-det,det+1)for x,y,w,h in c)
 occ=collections.Counter(((x+i)%tw,(y+j)%th)for x,y,w,h in rs for i in range(w)for j in range(h));assert len(occ)==tw*th and set(occ.values())=={1},letter
 mix=dict(collections.Counter('x'.join(map(str,sorted([w,h])))for x,y,w,h in c));assert mix==mod['expectedMix'],letter
 cs=[]
 for x,y,w,h in c:
  matches=[(u,rot)for u in f['units']for rot,(uw,uh)in[(0,(u['lengthMm'],u['widthMm'])),(90,(u['widthMm'],u['lengthMm']))]if(uw,uh)==(w*75,h*75)];assert matches
  u,rot=matches[0];cs.append(dict(unitId=u['id'],xMm=x*75,yMm=y*75,rotationDeg=rot))
 bw=max(x+w for x,y,w,h in c)-min(x for x,y,w,h in c);bh=max(y+h for x,y,w,h in c)-min(y for x,y,w,h in c)
 recipes.append(dict(productId=p['id'],finishId=f['id'],patternId='colonnade-source-pattern-'+letter.lower(),patternName='Pattern '+letter+' — Original shaded stock module (nominal repeat)',originalPatternId='laying-patterns',sourceUrl=source,sourcePdfSha256=sha,sourcePdfPage=1,verifiedOn='2026-09-27',layout=dict(version=1,widthMm=bw*75,depthMm=bh*75,repeatBasisMm=[[v*75 for v in b]for b in mod['basis']],jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes='Original shaded Colonnade source module and published full stock dimensions. The PDF artwork uses differentX/Y graphic scales; geometry preserves physical75mm stock modules. Numerical installed joints are not specified. '+mod.get('sourceScope',''),cells=cs),digitization=dict(sourcePatternLetter=letter,sourceDiagramInspected=True,sourceStockMix=mix,sourceStockSizeTablePage=1,sourceProportionsTablePage=2,sourceModuleMm=75,sourceGraphicAxesScales='independently fit to actual source stock boundaries; no physical size is fitted or reduced',sourceScope=mod.get('sourceScope','Explicit shaded manufacturer module; nominal full-stock repeat'),sourceGridResidual=mod.get('sourceGridResidual'),sourceBackgroundMatches=mod.get('sourceBackgroundMatches'),sourceBackgroundStocks=mod.get('sourceBackgroundStocks'),verifiedRectangularSupercellAreaMm2=tw*th*75**2),checks=dict(physicalStocks=len(cs),gapAreaMm2=0,overlapAreaMm2=0,repeatAreaMm2=det*75**2)))
out=dict(schemaVersion=1,verifiedOn='2026-09-27',recipes=recipes)
(ROOT/'scripts/hardscape-oaks-colonnade-pattern-recovery.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'oaks-colonnade-pattern-recovery.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf8');print(json.dumps(dict(recipes=len(recipes),cells=sum(len(r['layout']['cells'])for r in recipes)),indent=2))
