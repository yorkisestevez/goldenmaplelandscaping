"""Inspected official Nueva60 A–V diagrams; output a review-only overlay."""
from pathlib import Path
import json,math,hashlib
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
source='https://bramptonbrick.com/en/resource-file/nuevar-60mm-slab-laying-patterns/264/download';pdf=WORK/'oaks-nueva60-patterns.pdf';sha=hashlib.sha256(pdf.read_bytes()).hexdigest()
raw=json.loads((OUT/'permacon-oaks.json').read_text(encoding='utf8'));p=next(p for p in raw if p['id']=='oaks-nueva-60mm-slab');f=p['finishes'][0]
table=[('D',1,(200,400),'half',0),('E',1,(200,400),'herringbone',0),('F',1,(200,400),'third',0),('G',1,(200,400),'basket',0),('H',1,(300,600),'half',0),('I',2,(300,600),'herringbone',0),('J',2,(300,600),'third',0),('K',2,(300,600),'basket',0),('L',2,(400,800),'half',0),('M',2,(400,800),'herringbone',0),('N',2,(400,800),'quarter',0)]
def layout(u,kind):
 l,w=u['lengthMm'],u['widthMm'];c=lambda x,y,r=0:dict(unitId=u['id'],xMm=x,yMm=y,rotationDeg=r)
 if kind in ['half','third','quarter']:
  rows={'half':2,'third':3,'quarter':4}[kind];return dict(widthMm=l,depthMm=rows*w,cells=[c(i*l/rows,i*w)for i in range(rows)])
 if kind=='basket':return dict(widthMm=2*l,depthMm=2*l,cells=[c(0,0),c(0,w),c(l,0,90),c(l+w,0,90),c(0,l,90),c(w,l,90),c(l,l),c(l,l+w)])
 if kind=='herringbone':return dict(widthMm=l,depthMm=l+w,repeatBasisMm=[[l,-l],[w,w]],cells=[c(0,0),c(0,w,90)])
recipes=[]
for letter,page,dims,kind,angle in table:
 u=next(u for u in f['units']if(u['widthMm'],u['lengthMm'])==dims);body=layout(u,kind)
 recipes.append(dict(productId=p['id'],finishId=f['id'],patternId='nueva60-source-pattern-'+letter.lower(),patternName='Pattern '+letter+' — '+({'half':'Half running bond','third':'Third running bond','quarter':'Quarter running bond','basket':'Basketweave','herringbone':'Herringbone'}[kind])+f' ({dims[0]} × {dims[1]} mm)',originalPatternId='laying-patterns',sourceUrl=source,sourcePdfSha256=sha,sourcePdfPage=page,verifiedOn='2026-09-27',layout=dict(version=1,jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes='Original source-reviewed Nueva60 stock topology; full published stock retained. The official diagram does not specify a numerical installed joint module; nominal diagram is not a fabrication or installation schedule.',**body),digitization=dict(sourcePatternLetter=letter,sourceStockMm=[*dims,60],sourceDiagramInspected=True,sourceAxesDeg=0),checks=dict(physicalStocks=len(body['cells']),gapAreaMm2=0,overlapAreaMm2=0,repeatAreaMm2=(2*u['lengthMm']*u['widthMm']if body.get('repeatBasisMm')else body['widthMm']*body['depthMm']))))
for module in json.loads((WORK/'oaks-nueva-mixed-modules.json').read_text()):
 letter=module['pattern'];m=module['moduleMm'];cs=[]
 for x,y,w,h in module['cells']:
  matches=[(u,rot)for u in f['units']for rot,(uw,uh)in[(0,(u['lengthMm'],u['widthMm'])),(90,(u['widthMm'],u['lengthMm']))]if(uw,uh)==(w*m,h*m)]
  assert matches,(letter,w,h)
  u,rot=matches[0];cs.append(dict(unitId=u['id'],xMm=x*m,yMm=y*m,rotationDeg=rot))
 tw,th=module['rectangularProof'];basis=[[v*m for v in b]for b in module['basis']]
 recipes.append(dict(productId=p['id'],finishId=f['id'],patternId='nueva60-source-pattern-'+letter.lower(),patternName='Pattern '+letter+' — '+({'A':'Original shaded L-shape module (nominal repeat)','C':'Random bundle running bond','P':'8 × 16 and16 × 32 L-shape'}[letter]),originalPatternId='laying-patterns',sourceUrl=source,sourcePdfSha256=sha,sourcePdfPage=module['page'],verifiedOn='2026-09-27',layout=dict(version=1,widthMm=tw*m,depthMm=th*m,repeatBasisMm=basis,jointMm=0,jointStatus='unspecified-zero-nominal-model',jointNotes='Exact stock-bound original source drawing module. Full published stock retained; source does not numerically specify an installed joint module. '+module.get('sourceScope',''),cells=cs),digitization=dict(sourcePatternLetter=letter,sourceDiagramInspected=True,sourceBoundsPt=module['sourceFrame'],sourceOriginPt=module['sourceOrigin'],sourceFullStocks=module['sourceFaces'],sourceGridResidual=module['sourceGridResidual'],repeatTranslationVectors=module['basis'],stockMix=module['stockMix'],sourceScope=module.get('sourceScope','Complete pictured stock-bound repeat'),sourceBackgroundMatches=module.get('sourceBackgroundMatches'),sourceBackgroundStocks=module.get('sourceBackgroundStocks'),verifiedRectangularSupercellAreaMm2=tw*th*m*m),checks=dict(physicalStocks=len(cs),gapAreaMm2=0,overlapAreaMm2=0,repeatAreaMm2=module['det']*m*m)))
out=dict(schemaVersion=1,verifiedOn='2026-09-27',recipes=recipes)
(ROOT/'scripts/hardscape-oaks-pattern-recovery.json').write_text(json.dumps(out,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'oaks-nueva-pattern-recovery.json').write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(dict(recipes=len(recipes),physicalCells=sum(len(r['layout']['cells'])for r in recipes)),indent=2))
