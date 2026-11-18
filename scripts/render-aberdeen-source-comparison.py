"""Render actual supplier PDF geometry beside recovered full-stock topology."""
from pathlib import Path
import json,math
from PIL import Image,ImageDraw,ImageFont
import pypdfium2 as pdf
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';OUT=ROOT.parents[1]/'outputs'
data=json.loads((ROOT/'public/deckcraft/hardscape-catalogue.json').read_text(encoding='utf8'))
p=next(p for p in data['products'] if p['id']=='techo-aberdeen-slab');f=p['finishes'][0]
grids=json.loads((WORK/'aberdeen-grids.json').read_text())
doc=pdf.PdfDocument(str(WORK/'techo-hatch-atlas.pdf'));source=doc[2].render(scale=3).to_pil()
canvas=Image.new('RGB',(1460,1650),'#f9f7f1');draw=ImageDraw.Draw(canvas)
try:font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',24);small=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
except:font=small=ImageFont.load_default()
draw.text((30,15),'Aberdeen original source drawing / recovered full-stock nominal geometry',fill='#263b31',font=font)
draw.text((30,48),'Manufacturer hatch atlas PDF page3. Same32×32half-unit window; gray repeat shading omitted at right.',fill='#263b31',font=small)
for row,grid in enumerate(grids):
 top=95+row*490;pattern=f['patterns'][row];layout=pattern['layout'];bbox=grid['bounds'];x,y,w,h=bbox
 original=source.crop((round(x*3),round(y*3),round((x+w)*3),round((y+h)*3))).resize((430,430))
 canvas.paste(original,(40,top+35));draw.text((40,top),f'Current pattern0{row+1} / atlas{grid["index"]:02}: source',fill='#263b31',font=font)
 sx,sy=760,top+35;size=430;window=32*127;scale=size/window
 tile=Image.new('RGB',(size,size),'white');td=ImageDraw.Draw(tile)
 for c in layout['cells']:
  unit=next(u for u in f['units'] if u['id']==c['unitId']);a,b=unit['lengthMm'],unit['widthMm']
  if c['rotationDeg']==90:a,b=b,a
  for rx in range(-2,math.ceil(window/layout['widthMm'])+2):
   for ry in range(-2,math.ceil(window/layout['depthMm'])+2):
    px,py=c['xMm']+rx*layout['widthMm'],c['yMm']+ry*layout['depthMm']
    if px<window and px+a>0 and py<window and py+b>0:td.rectangle((round(px*scale),round(py*scale),round((px+a)*scale),round((py+b)*scale)),fill='#ffffff',outline='#171717',width=1)
 canvas.paste(tile,(sx,sy));draw.text((sx,top),'Recovered exact nominal stock topology',fill='#263b31',font=font)
draw.text((30,1590),'Full254/508/762mm stock sizes retained. Published5mm installation joints require a reconciled module;',fill='#263b31',font=small)
draw.text((30,1618),'this comparison verifies nominal pattern topology, not an installed joint or cutting/fabrication schedule.',fill='#263b31',font=small)
path=OUT/'deckcraft-aberdeen-original-pattern-comparison.png';canvas.save(path);print(path)
