"""Extract exact visible stock grids from inspected Oaks Colonnade source."""
from pathlib import Path
import pdfplumber,json,math,collections
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery';doc=pdfplumber.open(WORK/'oaks-colonnade-patterns.pdf')
regions={'A':(1,32,339,165,475),'B':(1,217,344,373,469),'C':(1,408,346,548,470),'D':(1,30,517,190,662),'E':(1,222,536,333,650),'F':(1,404,517,544,642),'G':(2,32,82,270,190),'H':(2,309,58,480,196)}
sizes={'A':[(75,150),(150,150),(150,225)],'B':[(75,150),(150,150),(150,225),(225,225),(225,300)],'C':[(150,225),(225,225),(225,300)],'D':[(75,150),(150,150),(150,225),(225,225)],'E':[(150,150),(150,225)],'F':[(150,225),(225,300)],'G':[(75,150),(150,150),(150,225)],'H':[(75,150),(150,150),(150,225),(225,225),(225,300)]}
out=[]
for letter,(pageNo,ox,oy,ex,ey)in regions.items():
 p=doc.pages[pageNo-1];faces=[r for r in p.rects if r.get('stroke') and 2<r['width']<70 and 2<r['height']<70 and ox<r['x0'] and r['x1']<ex and oy<r['top'] and r['bottom']<ey];poss=[]
 for r in faces:
  for w,h in sizes[letter]:
   for uw,uh in[(w,h),(h,w)]:
    s=r['width']/uw
    mapped=[];error=0
    for face in faces:
     matches=[(abs(face['width']-u[0]*s)+abs(face['height']-u[1]*s),u)for unit in sizes[letter]for u in[unit,unit[::-1]]];e,u=min(matches,key=lambda v:v[0])
     if e<.035:mapped.append((face['x0'],face['top'],*u));error+=e
    if len(mapped)<4:continue
    minx,miny=min(x for x,y,w,h in mapped),min(y for x,y,w,h in mapped);pitch=75*s
    residual=max(max(abs((x-minx)/pitch-round((x-minx)/pitch)),abs((y-miny)/pitch-round((y-miny)/pitch)))for x,y,w,h in mapped)
    poss.append((residual<.02,len(mapped),-error,s,mapped,residual))
 if not poss:out.append(dict(pattern=letter,status='no-exact-rectangle-objects',faces=len(faces)));continue
 good,count,error,s,faces,residual=max(poss,key=lambda v:v[:3]);minx,miny=min(x for x,y,w,h in faces),min(y for x,y,w,h in faces);cells=set((round((x-minx)/(75*s)),round((y-miny)/(75*s)),w//75,h//75)for x,y,w,h in faces)
 if not good:out.append(dict(pattern=letter,status='source-stock-grid-not-closed',residual=residual,count=count));continue
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
 out.append(dict(pattern=letter,page=pageNo,status='exact-source-nominal-grid',frame=[ox,oy,ex,ey],origin=[minx,miny],physicalModuleMm=75,sourceGridResidual=residual,cells=sorted(cells),periods=periods,n=n,m=m))
(WORK/'oaks-colonnade-grids.json').write_text(json.dumps(out,indent=2))
print(json.dumps([{k:v for k,v in r.items()if k not in['cells','periods']}|dict(cells=len(r.get('cells',[])),periods=r.get('periods',[]))for r in out],indent=2))
