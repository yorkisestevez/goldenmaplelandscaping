"""Review-only alignment of source-hidden stock candidates with actual PDF faces."""
from pathlib import Path
import json,math
import pypdfium2 as pdfium
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];W=ROOT.parent/'paver-pattern-recovery'
grids={r['pattern']:r for r in json.loads((W/'oaks-nueva-mixed-grids.json').read_text())}
holes=json.loads((W/'oaks-nueva-hole-candidates.json').read_text())
doc=pdfium.PdfDocument(W/'oaks-nueva60-patterns.pdf');scale=7
for h in holes:
 g=grids[h['pattern']];page=doc[g['page']-1].render(scale=scale).to_pil().convert('RGB')
 ox,oy,ex,ey=g['frame'];box=(round(ox*scale),round(oy*scale),round(ex*scale),round(ey*scale));source=page.crop(box)
 panels=[]
 for solutionNo,solution in enumerate(h['solutions']):
  over=source.copy();d=ImageDraw.Draw(over);pitch=g['pointPitchPerMm']*g['physicalModuleMm'];origin=g['origin'];a,b=h['basis'];D=a[0]*b[1]-a[1]*b[0]
  for x,y,w,hh in solution:
   for i in range(-12,13):
    for j in range(-12,13):
     xx=x+i*a[0]+j*b[0];yy=y+i*a[1]+j*b[1]
     left=(origin[0]+xx*pitch-ox)*scale;top=(origin[1]+yy*pitch-oy)*scale
     right=left+w*pitch*scale;bottom=top+hh*pitch*scale
     if left>=-1 and top>=-1 and right<=source.width+1 and bottom<=source.height+1:
      d.rectangle((left,top,right,bottom),outline=(210,0,0),width=3)
  panel=Image.new('RGB',(source.width*2,source.height+32),'white');panel.paste(source,(0,32));panel.paste(over,(source.width,32));ImageDraw.Draw(panel).text((12,8),f"Nueva {h['pattern']} source / missing-body candidate {solutionNo+1}; red = review only",fill='black');panels.append(panel)
 result=Image.new('RGB',(panels[0].width,sum(p.height for p in panels)),'white');y=0
 for p in panels:result.paste(p,(0,y));y+=p.height
 dest=W/f"nueva-{h['pattern'].lower()}-hole-source-review.png";result.save(dest);print(dest)
