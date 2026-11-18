"""Recover original nominal repeats from archived manufacturer vector diagrams.

Requires the original Techo hatch atlas; emits a portable source-backed overlay.
No installed joint is inferred, no stock dimensions are changed to fit a diagram.
"""
from pathlib import Path
import json, hashlib, math, copy
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT.parent/'paver-pattern-recovery'
OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
SOURCE='https://www.techo-bloc.com/assets/a2/b0/a2b028a8-8390-491a-a35f-f8111cc607bb/AutoCAD%20Hatch%20Patterns%20PDF.pdf'
data=json.loads((OUT/'techo-unilock.json').read_text(encoding='utf8'))
product=next(p for p in data['products'] if p['id']=='techo-aberdeen-slab')
finish=product['finishes'][0]
units={(u['lengthMm'],u['widthMm']):u['id'] for u in finish['units']}
grids=json.loads((WORK/'aberdeen-grids.json').read_text())
recipes=[]
NOTES='Manufacturer nominal pattern topology, with the original full stock dimensions. The current product page specifies 5 mm installation joints; the mixed-size diagrams provide no dimensioned module reconciling those joints with 254/508/762 mm stocks. This joint-free diagram is not an exact installed joint schedule; no slab has been shrunk or a joint invented to force closure.'
def add(pattern,tw,th,cells,method,angle=0):
 layout=dict(version=1,widthMm=tw,depthMm=th,jointMm=0,angleDeg=angle,jointStatus='unspecified-zero-nominal-model',jointNotes=NOTES,installationJointMm=5,cells=cells,sourceUrl=SOURCE+'#page=3',verifiedBy='Original PDF vector edges and repeat translations; complete periodic coverage and non-overlap; visual source comparison')
 # Test complete rectangular repeat with translated full physical cells.
 rects=[];xs={0,tw};ys={0,th}
 for c in cells:
  u=next(u for u in finish['units'] if u['id']==c['unitId']);w,h=(u['lengthMm'],u['widthMm']) if c['rotationDeg']==0 else (u['widthMm'],u['lengthMm'])
  for dx in [-tw,0,tw]:
   for dy in [-th,0,th]:
    a,b,e,f=c['xMm']+dx,c['yMm']+dy,c['xMm']+dx+w,c['yMm']+dy+h
    if a<tw and e>0 and b<th and f>0:rects.append((a,b,e,f));xs|={max(a,0),min(e,tw)};ys|={max(b,0),min(f,th)}
 gap=overlap=0
 for a,b in zip(sorted(xs),sorted(xs)[1:]):
  for c,e in zip(sorted(ys),sorted(ys)[1:]):
   n=sum(x<=(a+b)/2<x2 and y<=(c+e)/2<y2 for x,y,x2,y2 in rects)
   if n==0:gap+=(b-a)*(e-c)
   if n>1:overlap+=(b-a)*(e-c)
 assert gap==overlap==0,(pattern,gap,overlap)
 recipes.append(dict(productId=product['id'],finishId=finish['id'],patternId=pattern['id'],patternName=pattern['name'],sourceUrl=SOURCE+'#page=3',sourcePdfSha256=hashlib.sha256((WORK/'techo-hatch-atlas.pdf').read_bytes()).hexdigest(),sourcePdfPage=3,verifiedOn='2026-09-27',layout=layout,digitization=method,checks=dict(physicalStocks=len(cells),gapAreaMm2=gap,overlapAreaMm2=overlap,repeatAreaMm2=tw*th)))
 # One repeat in red plus surrounding complete original stones.
 im=Image.new('RGB',(1000,700),'white');draw=ImageDraw.Draw(im);s=min(850/(3*tw),580/(3*th));ox,oy=60,60
 draw.text((10,10),pattern['name'],fill='black')
 for ix in range(-1,4):
  for iy in range(-1,4):
   for cell in cells:
    u=next(u for u in finish['units'] if u['id']==cell['unitId']);w,h=(u['lengthMm'],u['widthMm']) if cell['rotationDeg']==0 else (u['widthMm'],u['lengthMm']);x,y=ix*tw+cell['xMm'],iy*th+cell['yMm']
    if x<3*tw and x+w>0 and y<3*th and y+h>0:draw.rectangle((ox+max(x,0)*s,oy+max(y,0)*s,ox+min(x+w,3*tw)*s,oy+min(y+h,3*th)*s),fill=['#cbbda7','#acbac5','#d8d1c2','#bdc9b7'][list(units.values()).index(u['id'])],outline='black')
 draw.rectangle((ox,oy,ox+tw*s,oy+th*s),outline='red',width=3)
 proof=OUT/'pattern-evidence';proof.mkdir(exist_ok=True);im.save(proof/('aberdeen-'+pattern['id']+'.png'))
def lattice(index,periods,tw,th):
 g=next(g for g in grids if g['index']==index);stocks=set()
 for a in range(-40,41):
  for b in range(-40,41):
   dx,dy=a*periods[0][0]+b*periods[1][0],a*periods[0][1]+b*periods[1][1]
   for x,y,w,h in g['cells']:stocks.add(((x+dx)%tw,(y+dy)%th,w,h))
 cells=[]
 for x,y,w,h in sorted(stocks):
  dimensions=(w*127,h*127)
  assert dimensions in units or dimensions[::-1]in units,(index,dimensions)
  rot=0 if dimensions in units else 90
  cells.append(dict(unitId=units[dimensions if rot==0 else dimensions[::-1]],xMm=x*127,yMm=y*127,rotationDeg=rot))
 return cells,dict(pdfBoundsPt=g['bounds'],pdfGridModulePt=g['modulePt'],stockGridMm=127,pdfMatchedInteriorStocks=len(g['cells']),repeatTranslationVectors=periods,allInteriorTranslationsVerified=True)
for atlas,pat,periods,tw,th in [(1,0,[(12,2),(6,-10)],66,22),(6,1,[(14,0),(4,8)],14,56),(7,2,[(6,0),(3,4)],6,8)]:
 cells,method=lattice(atlas,periods,tw,th);add(finish['patterns'][pat],tw*127,th*127,cells,method)
square=units[(762,762)]
add(finish['patterns'][3],762,762,[dict(unitId=square,xMm=0,yMm=0,rotationDeg=0)],dict(description='Atlas09 checkerboard drawing: 30×30 square stock on a45-degree grid. Source current page labels this Pattern04.'),45)
add(finish['patterns'][4],762,1524,[dict(unitId=square,xMm=0,yMm=0,rotationDeg=0),dict(unitId=square,xMm=381,yMm=762,rotationDeg=0)],dict(description='Atlas10 linear30×30 drawing: two offset rows; source current page labels this Pattern05.'))
existing=json.loads((ROOT/'scripts/hardscape-pattern-recovery.json').read_text(encoding='utf8'))if(ROOT/'scripts/hardscape-pattern-recovery.json').exists()else{}
overlay={**existing,'schemaVersion':1,'verifiedOn':'2026-09-27','recipes':[r for r in existing.get('recipes',[])if r['productId']!=product['id']]+recipes}
(ROOT/'scripts/hardscape-pattern-recovery.json').write_text(json.dumps(overlay,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'original-pattern-recovery.json').write_text(json.dumps(overlay,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps({'recipes':len(recipes),'stocks':[len(r['layout']['cells'])for r in recipes],'zeroGapAndOverlap':True}))
