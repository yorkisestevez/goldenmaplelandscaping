from pathlib import Path
import json,math,hashlib
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
raw=[*json.loads((OUT/'techo-unilock.json').read_text(encoding='utf8'))['products'],*json.loads((OUT/'permacon-oaks.json').read_text(encoding='utf8'))]
overlay=json.loads((ROOT/'scripts/hardscape-pattern-recovery.json').read_text(encoding='utf8'));added=[]
# Bind only inspected drawing topology, never a pattern name alone. Other
# official references stay guide-only until the exact drawing is recovered.
inspected={
 'permacon-city-slab': {'running-bond':0},
 'permacon-esbelto-slab': {'herringbone':0,'stack-bond':0},
 'permacon-esbelto-durafusion-paver': {'herringbone':0},
 'permacon-mega-melville-slab': {'running-bond':0},
 'permacon-mega-melville-paver': {'running-bond':0},
 'permacon-melia-18-36-durafusion-slab': {'herringbone':45,'offset-1-3':0,'parquet':0,'running-bond':0,'stack-bond':0},
 'permacon-melville-18-36-durafusion-slab': {'herringbone':45,'offset-1-3':0,'parquet':0,'running-bond':0,'stack-bond':0},
 'permacon-melia-6-6-durafusion-paver': {'running-bond':0,'stack-bond':0},
 'permacon-melville-24-24-slab': {'running-bond':0,'stack-bond':0},
 'permacon-brooklyn-paver': {'running-bond':0,'stack-bond':0,'offset-1-3':0},
 'permacon-melville-80-small-rectangle-paver': {'running-bond':0,'herringbone':0},
 'permacon-boulevard-tactile-paver': {'checkerboard':0},
 'permacon-november-mirage-porcelain-tile': {'checkerboard':0},
}
# Reproduction replaces this script's own records, including rejected earlier
# candidates. Earlier pattern references are preserved by the importer.
overlay['recipes']=[r for r in overlay['recipes'] if 'sourceDiagram' not in r.get('digitization',{})]
def cells(u,kind):
 l,w=u['lengthMm'],u['widthMm'];c=lambda x,y,r=0:dict(unitId=u['id'],xMm=x,yMm=y,rotationDeg=r)
 if kind=='stack':return l,w,[c(0,0)]
 if kind=='half':return l,2*w,[c(0,0),c(l/2,w)]
 if kind=='third':return l,3*w,[c(0,0),c(l/3,w),c(2*l/3,2*w)]
 if kind=='basket':
  if l!=2*w:return None
  return 2*l,2*l,[c(0,0),c(0,w),c(l,0,90),c(l+w,0,90),c(0,l,90),c(w,l,90),c(l,l),c(l,l+w)]
 if kind=='herringbone':
  tile=2*math.lcm(round(l),round(w))
  if tile*tile/(l*w)>256:return None
  stocks=set()
  for m in range(-20,21):
   for n in range(-20,21):
    x,y=m*l+n*w,-m*l+n*w;stocks.add((x%tile,y%tile,0));stocks.add((x%tile,(y+w)%tile,90))
  return tile,tile,[c(x,y,r)for x,y,r in sorted(stocks)]
def check(tw,th,cs,unit):
 rs=[];xs={0,tw};ys={0,th};l,w=unit['lengthMm'],unit['widthMm']
 for c in cs:
  cw,ch=(l,w)if c['rotationDeg']==0 else(w,l)
  for dx in[-tw,0,tw]:
   for dy in[-th,0,th]:
    a,b,e,f=c['xMm']+dx,c['yMm']+dy,c['xMm']+dx+cw,c['yMm']+dy+ch
    if a<tw and e>0 and b<th and f>0:rs.append((a,b,e,f));xs|={max(a,0),min(e,tw)};ys|={max(b,0),min(f,th)}
 for a,b in zip(sorted(xs),sorted(xs)[1:]):
  for c,e in zip(sorted(ys),sorted(ys)[1:]):assert sum(x<=(a+b)/2<x2 and y<=(c+e)/2<y2 for x,y,x2,y2 in rs)==1
for p in raw:
 for f in p['finishes']:
  for r in f.get('patterns',[]):
   if r.get('layout')or any(v['productId']==p['id']and v['finishId']==f['id']and v['patternId']==r['id']for v in overlay['recipes']):continue
   stock=[];kind=None;sourcefile=None;page=None
   if p['brand']=='Unilock':
    if p['id']not in ['unilock-copthorne','unilock-mattoni','unilock-skyline','unilock-soreno','unilock-town-hall','unilock-natural-stone-pavers']:continue
    if '-rb-'in r['id']:kind='half'
    elif '-sb-'in r['id']:kind='stack'
    else:continue
    if 'fixed'in r['id']:continue
    sourcefile=WORK/(r['id']+'.pdf');page=1
    if not sourcefile.exists():continue
    target=(290,590)if '12x24'in r['id']else(590,590)if'24x24'in r['id']else(600,600)if'skyline'in p['id']else None
    stock=[u for u in f['units']if u.get('widthMm')and u.get('lengthMm')and u.get('heightMm')and (not target or(u['widthMm'],u['lengthMm'])==target)]
   elif p['brand']=='Permacon':
    if r['id'] not in inspected.get(p['id'],{}):continue
    stock=[u for u in f['units']if u.get('widthMm')and u.get('lengthMm')and u.get('heightMm')]
    if len(stock)!=1 or stock[0].get('shape','rectangle')not in['rectangle','rectangular-nominal','square','rectangular']:continue
    if r['id']in['stack-bond','checkerboard']:kind='stack'
    elif r['id']in['running-bond','offset-1-2']:kind='half'
    elif r['id']=='offset-1-3':kind='third'
    elif r['id']=='parquet':kind='basket'
    elif r['id']=='herringbone':kind='herringbone'
    else:continue
    sourcefile=ROOT.parent/'landscape-research/permacon-2026-ontario-product-guide.pdf';page=int(stock[0]['sourceUrl'].split('#page=')[-1])
   else:continue
   # A source title with multiple thickness stocks receives separate explicit bindings.
   for unit in stock:
    if len(stock)>1 and p['id']!='unilock-natural-stone-pavers':continue
    result=cells(unit,kind)
    if not result:continue
    tw,th,cs=result;check(tw,th,cs,unit)
    pid=r['id']if len(stock)==1 else r['id']+'-'+str(unit['heightMm'])+'mm'
    layout=dict(version=1,widthMm=tw,depthMm=th,jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes='Source-reviewed original stock bond and full documented stock. Numerical installation joint is not specified by this diagram; the nominal model does not shrink stock to force closure.',cells=cs)
    angle=inspected[p['id']][r['id']] if p['brand']=='Permacon' else 0
    if angle:layout['angleDeg']=angle
    added.append(dict(productId=p['id'],finishId=f['id'],patternId=pid,patternName=r['name']+((' ('+str(unit['heightMm'])+' mm stock)')if len(stock)>1 else''),originalPatternId=r['id'],sourceUrl=r['sourceUrl'],sourcePdfSha256=hashlib.sha256(sourcefile.read_bytes()).hexdigest(),sourcePdfPage=page,verifiedOn='2026-09-27',layout=layout,digitization=dict(sourceStockBond=kind,sourceNominalStockSizeMm=[unit['widthMm'],unit['lengthMm'],unit['heightMm']],sourceDiagram='PDF/'+str(page)),checks=dict(physicalStocks=len(cs),gapAreaMm2=0,overlapAreaMm2=0,repeatAreaMm2=tw*th)))
overlay['recipes']+=added
(ROOT/'scripts/hardscape-pattern-recovery.json').write_text(json.dumps(overlay,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'original-pattern-recovery.json').write_text(json.dumps(overlay,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(dict(added=len(added),families=sorted(set(r['productId']for r in added)),stocks=sum(len(r['layout']['cells'])for r in added)),indent=2))
