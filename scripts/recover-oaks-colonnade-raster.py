"""Recover stock adjacency from actual rendered supplier drawings, not strip paths.

Manufacturer PDF artwork scales X/Y differently. Physical sizes always come
from its dimension table; fitting only identifies the labelled drawing faces.
"""
from pathlib import Path
import json,collections,math
import numpy as np,pypdfium2
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';doc=pypdfium2.PdfDocument(WORK/'oaks-colonnade-patterns.pdf')
regions={'A':(1,32,339,165,475),'B':(1,217,344,373,469),'C':(1,408,346,548,470),'D':(1,30,517,190,662),'E':(1,222,536,333,650),'F':(1,404,517,544,642),'G':(2,32,82,270,190),'H':(2,309,58,480,196)}
sizes={'A':[(1,2),(2,2),(2,3)],'B':[(1,2),(2,2),(2,3),(3,3),(3,4)],'C':[(2,3),(3,3),(3,4)],'D':[(1,2),(2,2),(2,3),(3,3)],'E':[(2,2),(2,3)],'F':[(2,3),(3,4)],'G':[(1,2),(2,2),(2,3)],'H':[(1,2),(2,2),(2,3),(3,3),(3,4)]}
out=[];scale=4
for letter,(pageNo,ox,oy,ex,ey)in regions.items():
 image=doc[pageNo-1].render(scale=scale).to_pil().convert('L').crop((ox*scale,oy*scale,ex*scale,ey*scale));pixels=np.array(image);dark=pixels<180
 # Close sub-pixel breaks in the source's dashed/antialiased CAD boundaries.
 # This affects only graphic segmentation; published physical stocks stay full.
 padded=np.pad(dark,1,constant_values=False);dark=np.logical_or.reduce([padded[dy:dy+dark.shape[0],dx:dx+dark.shape[1]]for dy in range(3)for dx in range(3)])
 openMask=~dark;seen=np.zeros_like(openMask);H,W=openMask.shape;faces=[]
 for Y,X in zip(*np.where(openMask)):
  if seen[Y,X]:continue
  queue=collections.deque([(X,Y)]);seen[Y,X]=True;pts=[];touch=False
  while queue:
   x,y=queue.popleft();pts.append((x,y));touch|=x in[0,W-1]or y in[0,H-1]
   for dx,dy in[(0,1),(0,-1),(1,0),(-1,0)]:
    a,b=x+dx,y+dy
    if 0<=a<W and 0<=b<H and openMask[b,a]and not seen[b,a]:seen[b,a]=True;queue.append((a,b))
  if touch or len(pts)<40:continue
  x,y=min(v[0]for v in pts),min(v[1]for v in pts);w=max(v[0]for v in pts)-x+1;h=max(v[1]for v in pts)-y+1
  if len(pts)/(w*h)<.90:continue
  grey=float(np.mean([pixels[b,a]for a,b in pts]))<240
  faces.append((x,y,w,h,grey))
 print('source faces',letter,len(faces),flush=True)
 best=None
 for anchor in faces:
  for unit in sizes[letter]:
   for uw,uh in[unit,unit[::-1]]:
    for gap in[2.5,3,3.5,4,4.5,5,5.5,6]:
     sx=(anchor[2]+gap)/uw;sy=(anchor[3]+gap)/uh;mapped=[];error=0
     for x,y,w,h,grey in faces:
      e,u=min((abs(w+gap-a*sx)+abs(h+gap-b*sy),(a,b))for unit in sizes[letter]for a,b in[unit,unit[::-1]])
      if e<2:mapped.append((x,y,*u,grey));error+=e
     if len(mapped)<4:continue
     minx,miny=min(x for x,y,w,h,grey in mapped),min(y for x,y,w,h,grey in mapped)
     residual=max(max(abs((x-minx)/sx-round((x-minx)/sx)),abs((y-miny)/sy-round((y-miny)/sy)))for x,y,w,h,grey in mapped)
     value=(residual<.09,len(mapped),-residual,-error)
     if best is None or value>best[0]:best=(value,sx,sy,gap,mapped,residual,minx,miny)
 if best is None:out.append(dict(pattern=letter,page=pageNo,status='no-stock-fitting-cells',detectedFaces=len(faces)));continue
 value,sx,sy,gap,mapped,residual,minx,miny=best
 # Pixel rounding on a single stock accumulates across a large diagram. Fit
 # each source graphic axis to all observed grid anchors, without changing any
 # physical stock dimension or adding a numerical installation joint.
 for _ in range(4):
  gx=[round((x-minx)/sx)for x,y,w,h,grey in mapped];gy=[round((y-miny)/sy)for x,y,w,h,grey in mapped]
  sx,minx=np.polyfit(gx,[x for x,y,w,h,grey in mapped],1);sy,miny=np.polyfit(gy,[y for x,y,w,h,grey in mapped],1)
 residual=max(max(abs((x-minx)/sx-round((x-minx)/sx)),abs((y-miny)/sy-round((y-miny)/sy)))for x,y,w,h,grey in mapped)
 cells=set((round((x-minx)/sx),round((y-miny)/sy),w,h)for x,y,w,h,grey in mapped);grey=set((round((x-minx)/sx),round((y-miny)/sy),w,h)for x,y,w,h,isgrey in mapped if isgrey)
 n=max(x+w for x,y,w,h in cells);m=max(y+h for x,y,w,h in cells);periods=[]
 for tx in range(-n,n+1):
  for ty in range(-m,m+1):
   if(tx,ty)==(0,0):continue
   hits=miss=0
   for x,y,w,h in cells:
    if 2<x+tx and x+tx+w<n-2 and 2<y+ty and y+ty+h<m-2:
     if(x+tx,y+ty,w,h)in cells:hits+=1
     else:miss+=1
   if hits>=3 and miss==0:periods.append((tx,ty,hits))
 out.append(dict(pattern=letter,page=pageNo,physicalModuleMm=75,frame=[ox,oy,ex,ey],sourceGridResidual=residual,rasterPixelsPer75mm=[sx,sy],graphicalBoundaryPixels=gap,cells=sorted(cells),shadedCells=sorted(grey),periods=periods,n=n,m=m))
(WORK/'oaks-colonnade-raster-grids.json').write_text(json.dumps(out,indent=2))
print(json.dumps([{k:v for k,v in r.items()if k not in['cells','shadedCells','periods']}|dict(cells=len(r.get('cells',[])),shaded=r.get('shadedCells'),periods=r.get('periods'))for r in out],indent=2))
