"""Bind exact Canadian manufacturer sizes previously left as unknown units."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
file=ROOT/'scripts/hardscape-pattern-recovery.json';data=json.loads(file.read_text(encoding='utf8'));recoveries=data.get('unitRecoveries',[])
rows=[('oaks-beaumont','Beaumont_Product%20Sheets_Cnd_Eng.pdf','oaks-beaumont.pdf',80,[(100,100),(100,200),(200,200),(200,300)]),('oaks-classic-series','Classic-Series_Product%20Sheets_Cnd_Eng.pdf','oaks-classic-series.pdf',60,[(100,100),(100,200),(200,200)]),('oaks-presidio','Presidio_Product%20Sheets_Cnd_Eng.pdf','oaks-presidio.pdf',80,[(126,301),(126,401),(126,501),(168,301),(168,401),(168,501),(168,336)]),('oaks-hydr-eau-pave','Hydreau-Pave_Product%20Sheets_Cnd_Eng.pdf','oaks-hydreau.pdf',80,[(100,100),(100,200),(200,200),(200,300)]),('oaks-turf-slab','Turf-Slab_Product%20Sheets_Cnd_Eng.pdf','oaks-turf-slab.pdf',80,[(400,600)])]
for pid,urlname,filename,thickness,sizes in rows:
 source='https://bramptonbrick.com/sites/default/files/resource_file/'+urlname;sha=hashlib.sha256((WORK/filename).read_bytes()).hexdigest();made=pid!='oaks-turf-slab'
 units=[dict(id=f'{w}-{l}-{thickness}-mm',name=f'{w} × {l} × {thickness} mm'+(' · made to order'if made else''),widthMm=w,lengthMm=l,heightMm=thickness,shape='open-grid'if pid=='oaks-turf-slab'else'rectangular-nominal',availability='made-to-order'if made else'Canada-confirmation-needed',sourceUrl=source,sourcePdfSha256=sha,sourcePdfPage=1,dimensionNotes='Exact manufacturer Canadian stock dimensions; original mould-outline geometry and installed joint module remain separately subject to their own evidence.'+(' Each Turf-Slab unit has40%void area perPDFpage2.'if pid=='oaks-turf-slab'else''))for w,l in sizes]
 record=dict(productId=pid,finishId='manufacturer-standard-finish',replacePending=True,units=units,availability='made-to-order'if made else'Canada-confirmation-needed',sourcePdfSha256=sha,sourceUrl=source)
 recoveries=[r for r in recoveries if r['productId']!=pid]+[record]
data['unitRecoveries']=recoveries;file.write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False),encoding='utf8')
(OUT/'original-pattern-recovery.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf8')
print(json.dumps(dict(recoveredFamilies=len(rows),documentedStocks=sum(len(s)for _,_,_,_,s in rows),fullSourceSheetsRead=True)))
