"""Extract mixed original Nueva patterns from actual PDF stock rectangles.

The drawing's graphical joint gap is used only to identify nominal topology;
published full stock dimensions are retained. No numerical installed joint is
inferred. Emits reviewed source coordinates; does not change application data.
"""
from pathlib import Path
import pdfplumber,json,math,collections
from pypdf import PdfReader
from pypdf.generic import ContentStream
ROOT=Path(__file__).resolve().parents[1];WORK=ROOT.parent/'paver-pattern-recovery'
doc=pdfplumber.open(WORK/'oaks-nueva60-patterns.pdf')
reader=PdfReader(WORK/'oaks-nueva60-patterns.pdf')
def visible_rectangles(pageNo):
 # The PDF contains complete repeated drawing groups behind small clip windows.
 # Raw pdfplumber rectangles include invisible ghost faces from those groups;
 # honor q/Q, cm and rectangular W clips before using any source coordinates.
 page=reader.pages[pageNo];height=float(page.mediabox.height);ctm=(1,0,0,1,0,0);clip=(0,0,float(page.mediabox.width),height);stack=[];path=[];pending=False;visible=set()
 def transform(x,y):
  a,b,c,d,e,f=ctm;return a*x+c*y+e,b*x+d*y+f
 for args,op in ContentStream(page.get_contents(),reader).operations:
  if op==b'q':stack.append((ctm,clip))
  elif op==b'Q':ctm,clip=stack.pop()
  elif op==b'cm':
   a,b,c,d,e,f=map(float,args);A,B,C,D,E,F=ctm;ctm=(A*a+C*b,B*a+D*b,A*c+C*d,B*c+D*d,A*e+C*f+E,B*e+D*f+F)
  elif op==b're':
   x,y,w,h=map(float,args);p=[transform(x,y),transform(x+w,y),transform(x+w,y+h),transform(x,y+h)];path.append((min(v[0]for v in p),min(v[1]for v in p),max(v[0]for v in p),max(v[1]for v in p)))
  elif op in[b'W',b'W*']:pending=True
  elif op in[b'n',b'S',b's',b'f',b'f*',b'F',b'B',b'B*',b'b',b'b*']:
   if op in[b'S',b's',b'B',b'B*',b'b',b'b*']:
    for x,y,x2,y2 in path:
     if clip[0]-.02<=x and x2<=clip[2]+.02 and clip[1]-.02<=y and y2<=clip[3]+.02:visible.add(tuple(round(v,2)for v in[x,height-y2,x2,height-y]))
   if pending and path:
    box=(min(p[0]for p in path),min(p[1]for p in path),max(p[2]for p in path),max(p[3]for p in path));clip=(max(clip[0],box[0]),max(clip[1],box[1]),min(clip[2],box[2]),min(clip[3],box[3]))
   path=[];pending=False
 return visible
stocks={
 'A':[(200,400),(400,400),(400,600)],'B':[(200,400),(400,400),(400,600)],'C':[(200,400),(400,400),(400,600)],
 'O':[(200,400),(400,400),(400,600),(400,800)],'P':[(200,400),(400,800)],'Q':[(200,400),(400,800)],
 'R':[(200,400),(400,400),(400,600),(400,800)],'S':[(200,400),(300,600),(400,800)],'T':[(200,400),(300,600),(400,800)],'U':[(200,400),(300,600)],'V':[(200,400),(300,600),(400,800)]}
results=[]
for pageNo,page in enumerate(doc.pages[:2],1):
 visible=visible_rectangles(pageNo-1)
 for label in page.search(r'Pattern ([A-V])'):
  letter=label['groups'][0]
  if letter not in stocks:continue
  candidates=[r for r in page.rects if r.get('stroke') and 90<r['width']<130 and 90<r['height']<130 and abs(r['x0']-label['x0'])<8 and 0<label['top']-r['bottom']<18]
  if not candidates:results.append(dict(pattern=letter,status='no-source-frame'));continue
  frame=min(candidates,key=lambda r:abs(r['x0']-label['x0'])+abs(label['top']-r['bottom']-5));ox,oy,ex,ey=frame['x0'],frame['top'],frame['x1'],frame['bottom']
  faces=[r for r in page.rects if r.get('stroke') and not r.get('fill') and tuple(round(v,2)for v in[r['x0'],r['top'],r['x1'],r['bottom']])in visible and 2<r['width']<80 and 2<r['height']<80 and ox-.2<r['x0'] and r['x1']<ex+.2 and oy-.2<r['top'] and r['bottom']<ey+.2]
  units=stocks[letter];poss=[]
  for r in faces:
   for w,h in units:
    for uw,uh in[(w,h),(h,w)]:
     if uw==uh or abs(r['width']-r['height'])<.01:continue
     s=(r['width']-r['height'])/(uw-uh)
     if s<=0:continue
     gap=(uw*s-r['width']+uh*s-r['height'])/2
     if gap<-.03 or gap>s*min(uw,uh)*.05:continue
     mapped=[];err=0
     for face in faces:
      matches=[(abs(face['width']-(u[0]*s-gap))+abs(face['height']-(u[1]*s-gap)),u)for unit in units for u in[unit,unit[::-1]]]
      e,u=min(matches,key=lambda v:v[0])
      if e<.04:mapped.append((face['x0'],face['top'],*u));err+=e
     module=math.gcd(*[v for u in units for v in u]);pitch=s*module
     if mapped:
      minx,miny=min(x for x,y,w,h in mapped),min(y for x,y,w,h in mapped)
      gridError=max(max(abs((x-minx)/pitch-round((x-minx)/pitch)),abs((y-miny)/pitch-round((y-miny)/pitch)))for x,y,w,h in mapped)
      poss.append((gridError<.03,len(mapped),-err,s,gap,mapped,gridError))
  if not poss:results.append(dict(pattern=letter,status='no-exact-stock-scale'));continue
  gridFits,count,error,s,gap,faces,gridError=max(poss,key=lambda v:v[:3]);module=math.gcd(*[v for u in units for v in u]);pitch=s*module
  if count<10:results.append(dict(pattern=letter,status='too-few-source-faces',faces=count));continue
  minx,miny=min(x for x,y,w,h in faces),min(y for x,y,w,h in faces)
  cells=set((round((x-minx)/pitch),round((y-miny)/pitch),w//module,h//module)for x,y,w,h in faces)
  residual=max(max(abs((x-minx)/pitch-round((x-minx)/pitch)),abs((y-miny)/pitch-round((y-miny)/pitch)))for x,y,w,h in faces)
  if residual>.03:results.append(dict(pattern=letter,status='source-grid-does-not-close',residual=residual,pointPitchPerMm=s,graphicalGapPt=gap,matchedFaces=count));continue
  # Only complete interior stocks count for translation evidence.
  n=int((ex-ox)/pitch);m=int((ey-oy)/pitch);cells=set(c for c in cells if c[0]>0 and c[1]>0 and c[0]+c[2]<n-1 and c[1]+c[3]<m-1);periods=[]
  for tx in range(-max(1,n-3),max(1,n-3)+1):
   for ty in range(-max(1,m-3),max(1,m-3)+1):
    if(tx,ty)==(0,0):continue
    hits=miss=0
    for x,y,w,h in cells:
     if 0<x+tx and 0<y+ty and x+tx+w<n-1 and y+ty+h<m-1:
      if(x+tx,y+ty,w,h)in cells:hits+=1
      else:miss+=1
    if hits>=3 and miss==0:periods.append((tx,ty,hits))
  results.append(dict(pattern=letter,page=pageNo,status='exact-source-nominal-grid',frame=[ox,oy,ex,ey],origin=[minx,miny],pointPitchPerMm=s,graphicalGapPt=gap,physicalModuleMm=module,sourceGridResidual=residual,cells=sorted(cells),periods=periods,n=n,m=m))
(WORK/'oaks-nueva-mixed-grids.json').write_text(json.dumps(results,indent=2))
print(json.dumps([{k:v for k,v in r.items()if k not in['cells','periods']}|dict(cells=len(r.get('cells',[])),periods=r.get('periods',[]))for r in results],indent=2))
