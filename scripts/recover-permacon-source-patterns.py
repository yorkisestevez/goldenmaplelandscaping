"""Inspected 2026 Ontario diagrams, bound to their actual stock sizes.

Writes a separate recovery overlay; the catalogue owner merges it explicitly.
No installed joint is inferred from a nominal illustration.
"""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
PDF=ROOT.parent/'landscape-research/permacon-2026-ontario-product-guide.pdf'
URL='https://permacon.ca/wp-content/uploads/2022/12/2026-guideproduitsamengta-14avr-3.pdf'
data=json.loads((OUT/'permacon-oaks.json').read_text(encoding='utf8'))
existing=json.loads((ROOT/'scripts/hardscape-pattern-recovery.json').read_text(encoding='utf8'))['recipes']
table=[
 ('permacon-melville-60-small-rectangle-paver',22,(190,380),'Linear','half'),
 ('permacon-melville-60-small-rectangle-paver',22,(190,380),'Herringbone','herringbone'),
 ('permacon-metrik-slab',23,(70,280),'Checkerboard','stack'),
 ('permacon-metrik-slab',23,(70,280),'Offset 1/2','half'),
 ('permacon-metrik-slab',23,(70,280),'Offset 1/3','third'),
 ('permacon-metrik-slab',23,(70,280),'Herringbone','herringbone'),
 ('permacon-mondrian-plus-60-small-rectangle-paver',25,(165,330),'Linear','half'),
 ('permacon-mondrian-plus-60-small-rectangle-paver',25,(165,330),'Herringbone','herringbone'),
 ('permacon-cassara-large-rectangle-paver',34,(300,700),'Linear','stack'),
 ('permacon-esbelto-durafusion-paver',37,(305,610),'Checkerboard','stack'),
 ('permacon-esbelto-durafusion-paver',37,(305,610),'Running Bond','half'),
 ('permacon-esbelto-durafusion-paver',37,(305,610),'Offset 1/3','third'),
 ('permacon-mondrian-plus-80-small-rectangle-paver',45,(165,330),'Linear','half'),
 ('permacon-mondrian-plus-80-small-rectangle-paver',45,(165,330),'Herringbone','herringbone'),
 ('permacon-niagara-60-and-80-paver',46,(98,198),'Running Bond','half'),
 ('permacon-niagara-60-and-80-paver',46,(98,198),'Herringbone','herringbone'),
 ('permacon-aquapave-paver',96,(98,198),'Herringbone','herringbone'),
 ('permacon-boulevard-500-paver',99,(500,500),'Linear','half'),
 ('permacon-boulevard-500-paver',99,(500,500),'Checkerboard','stack'),
 ('permacon-boulevard-drain-paver',100,(209,209),'Linear','half'),
 ('permacon-boulevard-drain-paver',100,(209,209),'Checkerboard','stack'),
 ('permacon-boulevard-tactile-paver',103,(300,300),'Linear','half'),
 ('permacon-paleo-tec-paver',108,(140,220),'Linear','half'),
 ('permacon-patio-sidewalk-slab',27,(600,600),'Square','stack'),
 ('permacon-patio-sidewalk-slab',27,(600,600),'Offset Square','half'),
 ('permacon-boulevard-drain-paver',100,(150,300),'Linear','half'),
 ('permacon-boulevard-drain-paver',100,(150,300),'Herringbone','herringbone'),
 ('permacon-boulevard-drain-paver',100,(150,300),'Herringbone 45°','herringbone45'),
 ('permacon-boulevard-tli-80-paver',105,(120,240),'Mechanical','half'),
 ('permacon-boulevard-tli-100-paver',106,(150,300),'Linear','half'),
 ('permacon-boulevard-tli-100-paver',106,(300,300),'Linear','half'),
 ('permacon-boulevard-tli-100-paver',106,(150,300),'Modular 50% 150×300 + 50% 300×300','tli-modular'),
 ('permacon-brooklyn-paver',32,(76,230),'Herringbone','herringbone'),
 ('permacon-kensington-paver',38,(209,279),'Herringbone','herringbone45'),
 ('permacon-kensington-paver',38,(209,279),'Running bond','half'),
 ('permacon-kensington-smooth-paver',39,(209,279),'Herringbone','herringbone45'),
 ('permacon-kensington-smooth-paver',39,(209,279),'Running bond','half'),
 ('permacon-melville-80-small-rectangle-paver',42,(190,380),'Linear','half'),
 ('permacon-melville-80-small-rectangle-paver',42,(190,380),'Herringbone','herringbone'),
 ('permacon-boulevard-300-paver',97,(100,300),'Linear','half'),
 ('permacon-boulevard-300-paver',97,(100,450),'Linear','half'),
 ('permacon-boulevard-300-paver',97,(150,450),'Linear','half'),
 ('permacon-boulevard-300-paver',97,(150,300),'Linear','half'),
 ('permacon-boulevard-300-paver',97,(300,600),'Linear','half'),
 ('permacon-boulevard-300-paver',98,(150,450),'Herringbone','herringbone'),
 ('permacon-boulevard-300-paver',98,(150,300),'Herringbone','herringbone'),
 ('permacon-boulevard-300-paver',98,(300,600),'Herringbone','herringbone'),
 ('permacon-boulevard-300-paver',97,(150,300),'Modular 50% F + 50% E','modular-50F50E'),
 ('permacon-boulevard-300-paver',97,(150,300),'Modular 89% H + 11% E','modular-89H11E'),
 ('permacon-boulevard-300-paver',97,(150,300),'Modular 67% H + 33% E','modular-67H33E'),
 ('permacon-boulevard-300-paver',97,(100,300),'Linear modified','boulevard-linear-mix'),
 ('permacon-boulevard-300-paver',98,(100,300),'Checkerboard modified','boulevard-checker'),
]
def normal(n):return n.lower().replace(' ','').replace('-','')
def repeat(u,bond,joint=0,finish=None):
 l,w=u['lengthMm']+joint,u['widthMm']+joint
 def c(x,y,r=0):return dict(unitId=u['id'],xMm=x,yMm=y,rotationDeg=r)
 if bond=='stack':return dict(widthMm=l,depthMm=w,cells=[c(0,0)])
 if bond=='half':return dict(widthMm=l,depthMm=2*w,cells=[c(0,0),c(l/2,w)])
 if bond=='third':return dict(widthMm=l,depthMm=3*w,cells=[c(0,0),c(l/3,w),c(2*l/3,2*w)])
 if bond in['herringbone','herringbone45']:return dict(widthMm=l,depthMm=l+w,repeatBasisMm=[[l,-l],[w,w]],angleDeg=45 if bond=='herringbone45'else 0,cells=[c(0,0),c(0,w,90)])
 if bond=='tli-modular':
  square=next(s for s in finish['units']if s['widthMm']==300 and s['lengthMm']==300 and s['heightMm']==u['heightMm'])
  return dict(widthMm=750,depthMm=450,repeatBasisMm=[[300,300],[-450,450]],cells=[dict(unitId=square['id'],xMm=0,yMm=150,rotationDeg=0),c(150,0),c(300,150,90),dict(unitId=square['id'],xMm=450,yMm=0,rotationDeg=0)])
 if bond.startswith('modular-'):
  grid=json.loads((ROOT/'scripts/permacon-source-grid-evidence.json').read_text(encoding='utf8'))[bond]
  motif=grid['motifs'][0];cells=motif['cells'];ox=min(c[0]for c in cells);oy=min(c[1]for c in cells);result=[]
  for x,y,w,h in cells:
   stock=next(s for s in finish['units']if sorted([s['widthMm'],s['lengthMm']])==sorted([w*150,h*150])and s['heightMm']==u['heightMm'])
   result.append(dict(unitId=stock['id'],xMm=(x-ox)*150,yMm=(y-oy)*150,rotationDeg=0 if stock['lengthMm']==w*150 else 90))
  return dict(widthMm=(max(x+w for x,y,w,h in cells)-ox)*150,depthMm=(max(y+h for x,y,w,h in cells)-oy)*150,repeatBasisMm=[[x*150,y*150]for x,y in motif['basis']],cells=result)
 if bond in['boulevard-linear-mix','boulevard-checker']:
  other=next(s for s in finish['units']if s['widthMm']==(300 if bond=='boulevard-linear-mix'else 150)and s['lengthMm']==300 and s['heightMm']==u['heightMm'])
  def alt(x,y):return dict(unitId=other['id'],xMm=x,yMm=y,rotationDeg=0)
  if bond=='boulevard-linear-mix':return dict(widthMm=300,depthMm=400,cells=[alt(0,0),c(150,300)])
  return dict(widthMm=600,depthMm=250,cells=[c(0,0),alt(0,100),c(300,100),alt(300,200)])
 raise ValueError(bond)
sha=hashlib.sha256(PDF.read_bytes()).hexdigest();recipes=[]
for pid,page,dims,name,bond in table:
 p=next(p for p in data if p['id']==pid)
 for f in p['finishes']:
  stocks=[u for u in f['units'] if (u['widthMm'],u['lengthMm'])==dims]
  for u in stocks:
   named=next((r for r in f['patterns'] if normal(r['name'])==normal(name)),None)
   original=named or f['patterns'][0]
   if named and any(r['productId']==pid and r['finishId']==f['id'] and r['patternId']==named['id'] for r in existing):continue
   alternatives=[t for t in table if t[0]==pid and t[3]==name]
   primary=len(alternatives)==1 or dims==alternatives[0][2]
   patternId=named['id'] if named and len(stocks)==1 and primary else 'source-'+str(page)+'-'+bond+'-'+str(u['widthMm'])+'x'+str(u['lengthMm'])+'-'+str(u['heightMm'])+'mm'
   joint=12 if pid=='permacon-boulevard-drain-paver'else 0
   layout=dict(version=1,jointMm=joint,jointStatus='documented-installed-joint'if joint else'unspecified-zero-nominal-model',jointNotes=('The 2026 Ontario guide specifies12 mm joints. Full stock dimensions are retained, with12 mm added to each repeat pitch and the source bond phase. Supplier pack quantities and physical spacer-mould details require their separate product evidence.'if joint else'Source-reviewed manufacturer diagram and documented full stock. This nominal topology does not establish an installed joint schedule or supplier pack quantities; no physical stone is resized to close a repeat.'),**repeat(u,bond,joint,f))
   if joint:layout['installationJointMm']=joint
   basis=layout.get('repeatBasisMm')
   area=abs(basis[0][0]*basis[1][1]-basis[0][1]*basis[1][0])if basis else layout['widthMm']*layout['depthMm']
   bodyArea=sum(next(s['lengthMm']*s['widthMm']for s in f['units']if s['id']==cell['unitId']) for cell in layout['cells'])
   assert bodyArea<=area if joint else bodyArea==area
   recipes.append(dict(productId=pid,finishId=f['id'],patternId=patternId,patternName=name+(' ('+str(u['widthMm'])+' × '+str(u['lengthMm'])+' mm)'if len(alternatives)>1 else'')+(' ('+str(u['heightMm'])+' mm)' if len(stocks)>1 else ''),originalPatternId=original['id'],sourceUrl=URL+'#page='+str(page),sourcePdfPage=page,sourcePdfSha256=sha,verifiedOn='2026-09-27',layout=layout,digitization=dict(sourcePageVisuallyReviewed=True,sourceStockBond=bond,sourceNominalStockSizeMm=[u['widthMm'],u['lengthMm'],u['heightMm']],sourceDiagram='2026 Ontario product guide / PDF '+str(page)),checks=dict(physicalStocks=len(layout['cells']),repeatAreaMm2=area)))
   if bond=='tli-modular':recipes[-1]['digitization'].update(sourceCoordinates='Clipping-aware official PDF strokes, endpoint tolerance0.03pt;45 complete source faces match150mm grid with residual<0.0019 cell. Source translations(2,2)and(-3,3) have31and25 complete-stock matches respectively with no interior misses; quotient has2rectangles and2squares, area270000mm². All full stock dimensions come from the product table, not fitted drawing widths.',sourceGridProof='work/permacon-patterns/grid-106-modular.json')
   if bond.startswith('modular-'):
    proof=json.loads((ROOT/'scripts/permacon-source-grid-evidence.json').read_text(encoding='utf8'))[bond]
    recipes[-1]['digitization'].update(sourceGridProof='scripts/permacon-source-grid-evidence.json#'+bond,sourceFaces=len(proof['cells']),sourceGridResidual=proof['sourceGridResidual'],sourceRepeatBasis=proof['motifs'][0]['basis'],sourceDiagramCells=proof['cells'],sourceStockCountByUnitId={sid:sum(c['unitId']==sid for c in layout['cells'])for sid in set(c['unitId']for c in layout['cells'])})
    if bond=='modular-50F50E':
     layout['jointNotes']+=' The source50% F/50% E mix is by piece count: five300×300 squares and five150×300 rectangles. Their physical areas are66.67% F and33.33% E; the estimate uses the actual individual full stocks.'
unitRecoveries=[]
for pid,page in [('permacon-kensington-paver',38),('permacon-kensington-smooth-paver',39)]:
 p=next(p for p in data if p['id']==pid)
 for f in p['finishes']:
  units=[]
  for u in f['units']:
   colorIds=['sierra-black']if u['widthMm']==209 else[c['id']for c in f['colors']if c['id']!='sierra-black']
   units.append({**u,**dict(colorIds=colorIds,sourceUrl=URL+'#page='+str(page),sourcePdfPage=page,sourcePdfSha256=sha,dimensionNotes='2026Ontario product table: the separately sold209×279rectangle is SierraBlack only; the three mixed-bundle sizes use only the listed blend colours. Full published dimensions retained.')})
  unitRecoveries.append(dict(productId=pid,finishId=f['id'],units=units))
result=dict(schemaVersion=1,verifiedOn='2026-09-27',recipes=recipes,unitRecoveries=unitRecoveries,evidenceGaps=json.loads((ROOT/'scripts/permacon-source-pattern-gaps.json').read_text(encoding='utf8')))
(ROOT/'scripts/permacon-source-pattern-recovery.json').write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'permacon-source-pattern-recovery.json').write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(dict(recipes=len(recipes),lines=len(set(r['productId'] for r in recipes)),stocks=sum(len(r['layout']['cells']) for r in recipes))))
