"""Source-reviewed simple repeats; no diagram-to-current-number guesswork.

The Techo atlas pages were visually inspected. Only labels that still bind
the current product/stock family are listed below. Full stocks stay intact.
"""
from pathlib import Path
import json,math,re,hashlib
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
source='https://www.techo-bloc.com/assets/a2/b0/a2b028a8-8390-491a-a35f-f8111cc607bb/AutoCAD%20Hatch%20Patterns%20PDF.pdf'
raw=json.loads((OUT/'techo-unilock.json').read_text(encoding='utf8'));overlay=json.loads((ROOT/'scripts/hardscape-pattern-recovery.json').read_text(encoding='utf8'))
# Product, current pattern number, atlaspage, exact nominal WxL, stock bond,
# intrinsic source rotation. Source gaps are not recast as numerical joints.
table=[
 ('techo-everest-slab',1,6,(250,250),'stack',45),('techo-everest-slab',2,6,(250,250),'half',0),('techo-everest-slab',3,6,(250,500),'stack',0),('techo-everest-slab',4,6,(250,500),'half',0),('techo-everest-slab',6,6,(250,500),'herringbone',45),
 ('techo-para-slab',5,9,(500,500),'stack',0),('techo-para-slab',6,9,(500,750),'stack',0),('techo-para-slab',7,9,(500,750),'half',0),('techo-para-slab',9,9,(500,750),'herringbone',45),
 ('techo-valet-paver',1,19,(165,165),'stack',45),('techo-valet-paver',2,19,(165,165),'half',0),('techo-valet-paver',3,19,(165,165),'half',0),
 ('techo-squadra-paver',1,18,None,'stack',0),('techo-squadra-paver',2,19,None,'half',0),
 ('techo-victorien-paver',1,19,(108,216),'half',0),('techo-victorien-paver',2,19,(108,216),'vertical-stack',0),('techo-victorien-paver',3,20,(108,216),'half',0),('techo-victorien-paver',4,20,(108,216),'vertical-stack',0),('techo-victorien-paver',5,20,(108,216),'basket',0),('techo-victorien-paver',6,20,(108,216),'herringbone',0),
 ('techo-westmount-paver',1,20,None,'stack',0),('techo-westmount-paver',2,20,None,'half',0),
 ('techo-sleek-paver',1,18,None,'stack',0),('techo-sleek-paver',2,18,None,'half',0),
]
def bond(u,kind):
 l,w=u['lengthMm'],u['widthMm'];uid=u['id'];c=lambda x,y,r=0:dict(unitId=uid,xMm=x,yMm=y,rotationDeg=r)
 if kind=='stack':return l,w,[c(0,0)]
 if kind=='vertical-stack':return w,l,[c(0,0,90)]
 if kind=='half':return l,2*w,[c(0,0),c(l/2,w)]
 if kind=='basket':
  assert l==2*w
  return 2*l,2*l,[c(0,0),c(0,w),c(l,0,90),c(l+w,0,90),c(0,l,90),c(w,l,90),c(l,l),c(l,l+w)]
 if kind=='herringbone':
  tile=2*math.lcm(round(l),round(w));cells=set()
  if tile*tile/(l*w)>256:return None
  for m in range(-20,21):
   for n in range(-20,21):
    x,y=m*l+n*w,-m*l+n*w;cells.add((x%tile,y%tile,0));cells.add((x%tile,(y+w)%tile,90))
  return tile,tile,[c(x,y,r)for x,y,r in sorted(cells)]
 raise ValueError(kind)
def check(tw,th,cells,u):
 rectangles=[];xs={0,tw};ys={0,th};l,w=u['lengthMm'],u['widthMm']
 for cell in cells:
  cw,ch=(l,w)if cell['rotationDeg']==0 else(w,l)
  for dx in[-tw,0,tw]:
   for dy in[-th,0,th]:
    a,b,c,d=cell['xMm']+dx,cell['yMm']+dy,cell['xMm']+dx+cw,cell['yMm']+dy+ch
    if a<tw and c>0 and b<th and d>0:rectangles.append((a,b,c,d));xs|={max(a,0),min(c,tw)};ys|={max(b,0),min(d,th)}
 for a,b in zip(sorted(xs),sorted(xs)[1:]):
  for c,d in zip(sorted(ys),sorted(ys)[1:]):assert sum(x<=(a+b)/2<x2 and y<=(c+d)/2<y2 for x,y,x2,y2 in rectangles)==1,(u['id'],a,b,c,d)
sha=hashlib.sha256((WORK/'techo-hatch-atlas.pdf').read_bytes()).hexdigest();added=[]
for pid,num,page,dimensions,kind,angle in table:
 p=next(p for p in raw['products']if p['id']==pid)
 for f in p['finishes']:
  patterns=[r for r in f.get('patterns',[])if re.search(r'pattern\s*0?'+str(num)+r'\b',r['name'],re.I)]
  stock=[u for u in f['units']if u.get('widthMm')and u.get('lengthMm')and(not dimensions or(u['widthMm'],u['lengthMm'])==dimensions)]
  if len(patterns)!=1 or len(stock)!=1:continue
  pattern=patterns[0];u=stock[0]
  if any(r['productId']==pid and r['finishId']==f['id']and r['patternId']==pattern['id']for r in overlay['recipes']):continue
  result=bond(u,kind)
  if not result:continue
  tw,th,cells=result;check(tw,th,cells,u)
  layout=dict(version=1,widthMm=tw,depthMm=th,jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes='Original source-reviewed nominal stock topology. The hatch atlas shows joints graphically but does not specify numeric installed pitch. No stock has been resized and no numerical joint inferred.',cells=cells,**({'angleDeg':angle}if angle else{}))
  added.append(dict(productId=pid,finishId=f['id'],patternId=pattern['id'],patternName=pattern['name'],sourceUrl=source+'#page='+str(page),sourcePdfSha256=sha,sourcePdfPage=page,verifiedOn='2026-09-27',layout=layout,digitization=dict(sourcePageVisuallyReviewed=True,sourceStockBond=kind,intrinsicDiagramRotationDeg=angle,nominalStockSizeMm=[u['widthMm'],u['lengthMm'],u['heightMm']]),checks=dict(physicalStocks=len(cells),gapAreaMm2=0,overlapAreaMm2=0,repeatAreaMm2=tw*th)))
overlay['recipes']+=added
(ROOT/'scripts/hardscape-pattern-recovery.json').write_text(json.dumps(overlay,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'original-pattern-recovery.json').write_text(json.dumps(overlay,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(dict(added=len(added),families=sorted(set(r['productId']for r in added)),stocks=sum(len(r['layout']['cells'])for r in added)),indent=2))
