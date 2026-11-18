"""Source-reviewed hidden bodies, never an inferred pack-only original.

The PDF strokes below its gray highlighted stocks are separate objects. The
review-only candidate generator does not use those hidden objects. Candidate
one is accepted only after actual red/source comparison independently agrees.
This script stages a separate overlay; the import manifest must not include it
until source review clears all staged records.
"""
from pathlib import Path
import json,math,collections,hashlib
ROOT=Path(__file__).resolve().parents[1];W=ROOT.parent/'paver-pattern-recovery'
catalogue=json.loads((ROOT/'public/deckcraft/hardscape-catalogue.json').read_text(encoding='utf8'))
p=next(p for p in catalogue['products']if p['id']=='oaks-nueva-60mm-slab');f=p['finishes'][0]
pdf=W/'oaks-nueva60-patterns.pdf';sha=hashlib.sha256(pdf.read_bytes()).hexdigest();url='https://bramptonbrick.com/en/resource-file/nuevar-60mm-slab-laying-patterns/264/download'
grids={g['pattern']:g for g in json.loads((W/'oaks-nueva-mixed-grids.json').read_text())};rows=[]
for h in json.loads((W/'oaks-nueva-hole-candidates.json').read_text()):
 letter=h['pattern'];g=grids[letter];m=h['moduleMm'];a,b=h['basis'];D=a[0]*b[1]-a[1]*b[0]
 cells=h['knownCells']+h['solutions'][0]
 def canon(x,y):
  i=math.floor((x*b[1]-y*b[0])/D+1e-9);j=math.floor((a[0]*y-a[1]*x)/D+1e-9);return(x-i*a[0]-j*b[0],y-i*a[1]-j*b[1])
 occupied=collections.Counter(canon(x+i,y+j)for x,y,w,hh in cells for i in range(w)for j in range(hh))
 assert len(occupied)==abs(D)and set(occupied.values())=={1}
 def bind(x,y,w,hh):
  u,rotation=next((u,r)for u in f['units']for r,(uw,uh)in[(0,(u['lengthMm'],u['widthMm'])),(90,(u['widthMm'],u['lengthMm']))]if(uw,uh)==(w*m,hh*m))
  return dict(unitId=u['id'],xMm=x*m,yMm=y*m,rotationDeg=rotation)
 cs=[bind(*c)for c in cells];basis=[[n*m for n in v]for v in h['basis']]
 sourceNote='Exact full-stock source motif. Red-outline source comparison confirms the missing bodies concealed by the PDF gray highlight; no pack-only inferred seam is adopted. Installed numerical joint spacing is unspecified.'
 if letter=='T':sourceNote+=' Source table piece Ratio says one16×32, while actual diagram contains two and stated area56.1% also requires two; diagram and source area percentages govern this documented discrepancy.'
 rows.append(dict(productId=p['id'],finishId=f['id'],patternId='nueva60-source-pattern-'+letter.lower(),patternName='Pattern '+letter+' — Original mixed-size stock module (nominal repeat)',originalPatternId='laying-patterns',sourceUrl=url,sourcePdfSha256=sha,sourcePdfPage=2,verifiedOn='2026-09-27',layout=dict(version=1,widthMm=max(abs(v[0])for v in basis)+max(c['xMm']for c in cs)-min(c['xMm']for c in cs)+800,depthMm=max(abs(v[1])for v in basis)+max(c['yMm']for c in cs)-min(c['yMm']for c in cs)+800,repeatBasisMm=basis,jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes=sourceNote,cells=cs),digitization=dict(sourcePatternLetter=letter,sourceDiagramInspected=True,sourceBoundsPt=g['frame'],sourceOriginPt=g['origin'],sourceGridResidual=g['sourceGridResidual'],visibleSourceStocks=h['sourceFaces'],hiddenSourceStocks=len(h['solutions'][0]),sourceCandidateSolutions=len(h['solutions']),selectedActualDiagramCandidate=1,sourceComparison=str(W/f'nueva-{letter.lower()}-hole-source-review.png'),sourceScope='Actual source full-stock repeat with gray-highlight hidden outlines separately visually verified',stockMix=dict(collections.Counter(str(sorted([w,hh]))for x,y,w,hh in cells))),checks=dict(physicalStocks=len(cs),repeatAreaMm2=abs(D)*m*m,gapAreaMm2=0,overlapAreaMm2=0)))
# PatternB is bound only to the eight actual shaded source faces. The source
# random-field background is not claimed as the same deterministic repeat.
bCells=[(5,0,2,2),(0,1,2,1),(2,1,3,2),(0,2,2,3),(5,2,2,1),(2,3,2,2),(4,3,2,2),(6,3,1,2)];bBasis=[(2,4),(7,-1)];bD=-30
def bCanon(x,y):
 i=math.floor((x*(-1)-y*7)/bD+1e-9);j=math.floor((2*y-4*x)/bD+1e-9);return x-i*2-j*7,y-i*4+j
bOcc=collections.Counter(bCanon(x+i,y+j)for x,y,w,h in bCells for i in range(w)for j in range(h));assert len(bOcc)==30 and set(bOcc.values())=={1}
bcs=[]
for x,y,w,h in bCells:
 u,rot=next((u,r)for u in f['units']for r,(uw,uh)in[(0,(u['lengthMm'],u['widthMm'])),(90,(u['widthMm'],u['lengthMm']))]if(uw,uh)==(w*200,h*200));bcs.append(dict(unitId=u['id'],xMm=x*200,yMm=y*200,rotationDeg=rot))
rows.append(dict(productId=p['id'],finishId=f['id'],patternId='nueva60-source-pattern-b',patternName='Pattern B — Original shaded stock module (nominal repeat)',originalPatternId='laying-patterns',sourceUrl=url,sourcePdfSha256=sha,sourcePdfPage=1,verifiedOn='2026-09-27',layout=dict(version=1,widthMm=1400,depthMm=1000,repeatBasisMm=[[400,800],[1400,-200]],jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes='Original explicitly shaded eight-stock source module, full200×400/400×400/400×600mm stocks. Exact3small/3square/2medium mix. Source random-field background is not certified as this deterministic repeat; nominal installed joints are unspecified.',cells=bcs),digitization=dict(sourcePatternLetter='B',sourceDiagramInspected=True,sourceScope='Eight actual shaded source faces only; original random background not asserted',sourceComparison=str(W/'nueva-b-source.png'),sourceModuleMm=200,sourceStocks=8,stockMix={'200x400':3,'400x400':3,'400x600':2}),checks=dict(physicalStocks=8,repeatAreaMm2=1200000,gapAreaMm2=0,overlapAreaMm2=0)))
# PatternV is the explicitly illustrated four-course running layout. Its medium
# course horizontal phase is measured from the drawing, not rounded to an
# invented half/third bond. Vertical course dimensions are full nominal stock.
phase=(195.141-183.468)/(30.161/800)
vCells=[]
for y,w,l,offset in[(0,400,800,0),(400,300,600,phase),(700,200,400,0),(900,300,600,phase)]:
 for i in range(2400//l):
  u=next(u for u in f['units']if(u['widthMm'],u['lengthMm'])==(w,l));vCells.append(dict(unitId=u['id'],xMm=offset+i*l,yMm=y,rotationDeg=0))
rows.append(dict(productId=p['id'],finishId=f['id'],patternId='nueva60-source-pattern-v',patternName='Pattern V — Original four-course running layout (source-derived phase)',originalPatternId='laying-patterns',sourceUrl=url,sourcePdfSha256=sha,sourcePdfPage=2,verifiedOn='2026-09-27',layout=dict(version=1,widthMm=2400,depthMm=1200,jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes='Four full-stock courses400/300/200/300mm as the actual source. The schematic medium-course phase is measured309.618mm from the original source drawing; it is not a manufacturer dimensioned set-out or a rounded generic bond. Source area mix16.7%small,50%medium,33.3%large retained. Installed numerical joint spacing is unspecified.',cells=vCells),digitization=dict(sourcePatternLetter='V',sourceDiagramInspected=True,sourceMeasurementPt=dict(largeCourseX=183.468,mediumCourseX=195.141,largeStockLength=30.161),sourceDerivedPhaseMm=phase,sourceScope='Original four-course topology and measured horizontal phase; not a dimensioned installation schedule'),checks=dict(physicalStocks=len(vCells),repeatAreaMm2=2880000,gapAreaMm2=0,overlapAreaMm2=0)))
out=dict(schemaVersion=1,verifiedOn='2026-09-27',recipes=rows)
(ROOT/'scripts/hardscape-oaks-nueva-completion-recovery.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False),encoding='utf8')
print(json.dumps(dict(recipes=len(rows),cells=sum(len(r['layout']['cells'])for r in rows),vSourcePhaseMm=phase),indent=2))
