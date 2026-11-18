from pathlib import Path
import json,math
from collections import deque
import pdfplumber
WORK=Path(__file__).resolve().parents[1].parent/'paver-pattern-recovery';doc=pdfplumber.open(WORK/'techo-hatch-atlas.pdf');frames=json.loads((WORK/'atlas-stock-faces.json').read_text());results=[]
for number in [1,2,3]:
 frame=max([f for f in frames if f['page']==4 and f['header'].splitlines()[-1].strip()==f'TB01_BLU {number:02}'],key=lambda r:len(r['faces']))
 ox,oy,ex,ey=frame['bounds'];n=12;module=(ex-ox)/n;walls=set()
 page=doc.pages[3]
 for line in page.lines:
  if line.get('stroking_color') not in [0,None,(0,),(0,0,0),(0,0,0,1)]:continue
  if not (ox-.15<=line['x0']<=line['x1']<=ex+.15 and oy-.15<=line['top']<=line['bottom']<=ey+.15):continue
  x,y,a,b=[round(v) for v in [(line['x0']-ox)/module,(line['top']-oy)/module,(line['x1']-ox)/module,(line['bottom']-oy)/module]]
  if x==a:
   for yy in range(y,b):walls.add(('v',x,yy))
  if y==b:
   for xx in range(x,a):walls.add(('h',xx,y))
 seen=set();faces=[]
 for y in range(n):
  for x in range(n):
   if (x,y)in seen:continue
   todo=deque([(x,y)]);seen.add((x,y));group=set()
   while todo:
    xx,yy=todo.popleft();group.add((xx,yy))
    for q,r,edge in [(xx-1,yy,('v',xx,yy)),(xx+1,yy,('v',xx+1,yy)),(xx,yy-1,('h',xx,yy)),(xx,yy+1,('h',xx,yy+1))]:
     if 0<=q<n and 0<=r<n and(q,r)not in seen and edge not in walls:seen.add((q,r));todo.append((q,r))
   xs=[a for a,b in group];ys=[b for a,b in group];cx,cy=min(xs),min(ys);w,h=max(xs)-cx+1,max(ys)-cy+1
   if w*h!=len(group):continue
   if cx>0 and cy>0 and cx+w<n and cy+h<n and sorted((w,h))in[[1,2],[2,2],[2,3]]:faces.append((cx,cy,w,h))
 stocks=set(faces);periods=[]
 for tx in range(-9,10):
  for ty in range(-9,10):
   if(tx,ty)==(0,0):continue
   hits=miss=0
   for x,y,w,h in faces:
    if 0<x+tx and 0<y+ty and x+tx+w<n and y+ty+h<n:
     if(x+tx,y+ty,w,h)in stocks:hits+=1
     else:miss+=1
   if hits>=3 and miss==0:periods.append((tx,ty,hits))
 results.append(dict(number=number,frame=frame['bounds'],moduleMm=165,cells=faces,periods=periods))
 print(number,'faces',faces,'periods',periods)
(WORK/'blu-vector-grids.json').write_text(json.dumps(results,indent=2))
