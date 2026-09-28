"""Recover original Blu01..03 directly from source PDF edge coordinates.

Current Blu60 page drawings01..03 were visually matched to atlas01..03.
No later current number is mapped automatically: source renumbering differs.
The output is a separate review overlay and does not import app data.
"""
from pathlib import Path
import json,math,hashlib,re
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
raw=json.loads((OUT/'techo-unilock.json').read_text(encoding='utf8'))['products'];grids=json.loads((WORK/'blu-vector-grids.json').read_text())
source='https://www.techo-bloc.com/assets/a2/b0/a2b028a8-8390-491a-a35f-f8111cc607bb/AutoCAD%20Hatch%20Patterns%20PDF.pdf#page=4';sha=hashlib.sha256((WORK/'techo-hatch-atlas.pdf').read_bytes()).hexdigest()
vectors={1:((3,-3),(6,6)),2:((6,0),(1,6)),3:((6,0),(0,6))};recipes=[]
for g in grids:
 n=g['number'];v1,v2=vectors[n];det=abs(v1[0]*v2[1]-v1[1]*v2[0]);tw=det//math.gcd(v1[1],v2[1]);th=det//math.gcd(v1[0],v2[0]);rs=set()
 for a in range(-14,15):
  for b in range(-14,15):
   dx,dy=a*v1[0]+b*v2[0],a*v1[1]+b*v2[1]
   for x,y,w,h in g['cells']:rs.add(((x+dx)%tw,(y+dy)%th,w,h))
 assert len(rs)<=256
 # Exact periodic topology validation; every source face maps unchanged.
 for x,y,w,h in g['cells']:assert(x%tw,y%th,w,h)in rs
 rectangles=[];xs={0,tw};ys={0,th}
 for x,y,w,h in rs:
  for dx in[-tw,0,tw]:
   for dy in[-th,0,th]:
    a,b,c,d=x+dx,y+dy,x+w+dx,y+h+dy
    if a<tw and c>0 and b<th and d>0:rectangles.append((a,b,c,d));xs|={max(a,0),min(c,tw)};ys|={max(b,0),min(d,th)}
 for a,b in zip(sorted(xs),sorted(xs)[1:]):
  for c,d in zip(sorted(ys),sorted(ys)[1:]):assert sum(x<=(a+b)/2<x2 and y<=(c+d)/2<y2 for x,y,x2,y2 in rectangles)==1,(n,a,b,c,d)
 # Keep the verified same topology with the source's own oblique translations.
 # Deduplicate full-stock anchors in one lattice cell; never reduce stock size.
 signed=v1[0]*v2[1]-v1[1]*v2[0];canonical=set()
 for x,y,w,h in rs:
  a=math.floor((x*v2[1]-y*v2[0])/signed+1e-9);b=math.floor((v1[0]*y-v1[1]*x)/signed+1e-9)
  canonical.add((x-a*v1[0]-b*v2[0],y-a*v1[1]-b*v2[1],w,h))
 rebuilt=set()
 for x,y,w,h in canonical:
  for a in range(-14,15):
   for b in range(-14,15):rebuilt.add(((x+a*v1[0]+b*v2[0])%tw,(y+a*v1[1]+b*v2[1])%th,w,h))
 assert rebuilt==rs,(n,'oblique topology must equal the source-verified rectangular supercell')
 for p in raw:
  if not p['id'].startswith('techo-blu') or 'overlay' in p['id']:continue
  for f in p['finishes']:
   stock=f['units'];patterns=[r for r in f['patterns']if re.search(r'pattern\s*0?'+str(n)+r'\b',r['name'],re.I)and ('modular' if n<3 else 'linear')in r['name'].lower()]
   if len(patterns)!=1:continue
   cs=[]
   for x,y,w,h in sorted(canonical):
    matches=[(u,rot)for u in stock for rot,(uw,uh)in [(0,(u.get('lengthMm'),u.get('widthMm'))),(90,(u.get('widthMm'),u.get('lengthMm')))]if uw==w*165 and uh==h*165]
    if not matches:break
    u,rot=matches[0];cs.append(dict(unitId=u['id'],xMm=x*165,yMm=y*165,rotationDeg=rot))
   if len(cs)!=len(canonical):continue
   r=patterns[0];layout=dict(version=1,widthMm=tw*165,depthMm=th*165,repeatBasisMm=[[v*165 for v in v1],[v*165 for v in v2]],jointMm=0,jointStatus='unspecified-zero-nominal-model',installationJointMm=7,jointNotes='Current Blu60/Blu80 sources specify7mm joints. This original nominal hatch topology preserves full165/330/495mm stock sizes; the source has no numerically reconciled installed joint module. Do not use it as a joint/cutting schedule.',cells=cs)
   recipes.append(dict(productId=p['id'],finishId=f['id'],patternId=r['id'],patternName=r['name'],sourceUrl=source,sourcePdfSha256=sha,sourcePdfPage=4,verifiedOn='2026-09-27',layout=layout,digitization=dict(sourceHeader=f'TB01_BLU {n:02}',sourceBoundsPt=g['frame'],sourceGridMm=165,sourceFaces=len(g['cells']),repeatTranslationVectors=[v1,v2],verifiedRectangularSupercellAreaMm2=tw*th*165**2,currentPageDrawingsMatched='Blu01/Blu02/Blu03 on https://www.techo-bloc.com/shop/slabs/blu-60-smooth'),checks=dict(physicalStocks=len(cs),gapAreaMm2=0,overlapAreaMm2=0,repeatAreaMm2=det*165**2)))
# Current page asset numbers after the inserted Blu60 pattern04 do not match
# the older atlas labels. Bind only directly inspected drawings; leave the
# actual 07/08/10 label-versus-image conflicts as guide references.
assets60={5:'64/ce/64ce02a3-2236-4440-88dc-404d5b8f4708/Blu%205.webp',6:'90/a6/90a66060-f768-4623-a7d7-8b82ef5048ca/Blu%206.webp',9:'d1/3f/d13f3296-2ff5-4010-afe4-352dd63582c5/Blu%209.webp',11:'56/d3/56d3fbe8-9fbd-498a-83df-92d98aa7d7a3/Blu%2011.webp',12:'e4/87/e4876bc6-14ae-4cd5-a38c-63e57f2a6507/Blu%2012.webp'}
assets80={8:'47/6b/476b01f0-0d26-4a29-ae59-f8b7efee713d/Blu%206.5x13%2001%20-%20Linear%20pattern.jpg',9:'10/ee/10eef6f1-d30e-452e-968e-8688a6868069/Blu%206.5x13%2002%20-%20Linear%20pattern.jpg',10:'51/ee/51eefaae-2ea8-4db2-8f10-952927b690c7/Blu%206.5x13%2003%20-%20Parquet%20pattern.jpg',11:'29/ed/29edc89c-ac77-4bbe-ae1a-1722fbbd16ee/Blu%206.5x13%2004%20-%20Harringbone%20pattern.jpg'}
for p in raw:
 if p['id'] not in ['techo-blu60-smooth-slab','techo-blu60-slate-slab','techo-blu80-smooth-paver','techo-blu80-slate-paver']:continue
 is60='60' in p['id'];specs=[(5,(495,825),'stack',0),(6,(495,825),'half',0),(9,(165,330),'stack',90),(11,(165,330),'basket',0),(12,(165,330),'herringbone',0)]if is60 else[(8,(165,330),'stack',90),(9,(165,330),'half',0),(10,(165,330),'basket',0),(11,(165,330),'herringbone',0)]
 for f in p['finishes']:
  for number,dims,kind,rotation in specs:
   units=[u for u in f['units']if(u['widthMm'],u['lengthMm'])==dims];patterns=[r for r in f['patterns']if re.search(r'pattern\s*0?'+str(number)+r'\b',r['name'],re.I)]
   if len(units)!=1 or len(patterns)!=1:continue
   u,r=units[0],patterns[0];l,w=u['lengthMm'],u['widthMm'];cell=lambda x,y,rot=0:dict(unitId=u['id'],xMm=x,yMm=y,rotationDeg=rot)
   if kind=='stack':body=dict(widthMm=w if rotation else l,depthMm=l if rotation else w,cells=[cell(0,0,rotation)])
   elif kind=='half':body=dict(widthMm=l,depthMm=2*w,cells=[cell(0,0),cell(l/2,w)])
   elif kind=='basket':body=dict(widthMm=2*l,depthMm=2*l,cells=[cell(0,0),cell(0,w),cell(l,0,90),cell(l+w,0,90),cell(0,l,90),cell(w,l,90),cell(l,l),cell(l,l+w)])
   else:body=dict(widthMm=l,depthMm=l+w,repeatBasisMm=[[l,-l],[w,w]],cells=[cell(0,0),cell(0,w,90)])
   asset='https://www.techo-bloc.com/assets/'+(assets60 if is60 else assets80)[number]
   j=7;status='unspecified-zero-nominal-model';notes='Inspected current manufacturer image preserves full published stock. Published7mm joints are separate from the nominal basket topology; no reconciled installed basket module is asserted.'
   if kind=='stack':body=dict(widthMm=(w if rotation else l)+j,depthMm=(l if rotation else w)+j,cells=[cell(0,0,rotation)])
   elif kind=='half':body=dict(widthMm=l+j,depthMm=2*(w+j),cells=[cell(0,0),cell((l+j)/2,w+j)])
   elif kind=='herringbone':body=dict(widthMm=l+j,depthMm=l+w+2*j,repeatBasisMm=[[l+j,-l-j],[w+j,w+j]],cells=[cell(0,0),cell(0,w+j,90)])
   if kind!='basket':status='documented-manufacturer-joint';notes='Inspected current supplier topology with documented7mm joints. Exact full stock bodies are retained; module positions use nominal body dimensions plus7mm pitch, without shrinking boards or stones.'
   joint=0 if kind=='basket'else j;area=abs(body['repeatBasisMm'][0][0]*body['repeatBasisMm'][1][1]-body['repeatBasisMm'][0][1]*body['repeatBasisMm'][1][0])if body.get('repeatBasisMm')else body['widthMm']*body['depthMm'];stockArea=len(body['cells'])*l*w
   recipes.append(dict(productId=p['id'],finishId=f['id'],patternId=r['id'],patternName=r['name'],sourceUrl=asset,verifiedOn='2026-09-27',layout=dict(version=1,jointMm=joint,jointStatus=status,installationJointMm=7,jointNotes=notes,**body),digitization=dict(sourceDiagram=asset,sourceDiagramInspected=True,currentPage='https://www.techo-bloc.com/shop/'+('slabs/blu-60-smooth'if is60 else'pavers/blu-80-smooth'),sourcePatternNumber=number,sourceTopology=kind,sourceUnitMm=[w,l,u['heightMm']],sourceUnitAxesDeg=rotation,installationJointSource='Current Blu60/Blu80 product page / Technical specifications / jointwidth7mm'),checks=dict(physicalStocks=len(body['cells']),gapAreaMm2=area-stockArea,overlapAreaMm2=0,repeatAreaMm2=area)))
out=dict(schemaVersion=1,verifiedOn='2026-09-27',recipes=recipes)
(ROOT/'scripts/hardscape-blu-pattern-recovery.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'blu-pattern-recovery.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(dict(recipes=len(recipes),physicalCells=sum(len(r['layout']['cells'])for r in recipes),families=sorted(set(r['productId']for r in recipes)),repeatCells={g['number']:len([r for r in recipes if r['digitization'].get('sourceHeader','').endswith(str(g['number']).zfill(2))][0]['layout']['cells'])for g in grids}),indent=2))
