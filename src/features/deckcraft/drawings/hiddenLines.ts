import type {V3} from '../deckTakeoff';
import type {LayerId,Pt} from './drawingTypes';

/**
 * Hidden-line removal for the elevations: the design's solids (inches; x along the house, y up, z toward the yard)
 * seen square-on from the front or either side, with every edge the viewer cannot see removed exactly.
 *
 * - Edges drawn: creases (faces meeting at more than 30°), open edges, and the silhouette of smooth surfaces such as
 *   a pier's cylinder. The diagonals between coplanar triangles are never drawn.
 * - Occlusion: each face is a convex planar polygon (a non-convex or warped one is split into triangles). Along an
 *   edge, both the edge's depth and the face's plane depth are linear, so the stretch a nearer face hides is one exact
 *   interval, found by Cyrus-Beck clipping against the face's outline.
 * - A tolerance keeps an edge from being hidden by the faces it bounds or by a face it lies on.
 */
export type ElevationView='front'|'left'|'right';
export interface Solid{vertices:V3[];faces:number[][];layer:LayerId;
  /** The layer for the part below grade (y < 0), drawn dashed; without it, nothing below grade is drawn. */
  belowGrade?:LayerId;gradeElevationIn?:number}
/** A projected point: u to the viewer's right, v up, d away from the viewer. */
export type ViewPt={u:number;v:number;d:number};
export interface Occluder{pts:ViewPt[];minU:number;maxU:number;minV:number;maxV:number;minD:number;
  /** Plane depth d = A·u + B·v + C. */
  A:number;B:number;C:number;
  /** +1 when the outline runs anticlockwise in (u, v). */
  turn:number}
export interface ViewEdge{a:ViewPt;b:ViewPt;solid:number;
  /** The visible stretches, as parameters along a → b. */
  visible:[number,number][]}

/** Where the viewer stands: square-on to the house wall (front), or at either end of it looking along it. */
export function project(view:ElevationView,p:V3):ViewPt{
  return view==='front'?{u:p.x,v:p.y,d:-p.z}:view==='left'?{u:p.z,v:p.y,d:p.x}:{u:-p.z,v:p.y,d:-p.x};
}
const FORWARD:Record<ElevationView,V3>={front:{x:0,y:0,z:-1},left:{x:1,y:0,z:0},right:{x:-1,y:0,z:0}};
const SMOOTH=Math.cos(30*Math.PI/180),INSIDE=1e-3,DEPTH=.02,CELL=12;

function newell(pts:V3[]):V3{
  let x=0,y=0,z=0;
  for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];x+=(a.y-b.y)*(a.z+b.z);y+=(a.z-b.z)*(a.x+b.x);z+=(a.x-b.x)*(a.y+b.y);}
  const len=Math.hypot(x,y,z);return len<1e-12?{x:0,y:0,z:0}:{x:x/len,y:y/len,z:z/len};
}
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;

/** A face as occluders: itself when convex and planar in the view, otherwise a fan of triangles. */
function occluders(pts:ViewPt[]):Occluder[]{
  const make=(p:ViewPt[]):Occluder|null=>{
    let nu=0,nv=0,nd=0;
    for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];nu+=(a.v-b.v)*(a.d+b.d);nv+=(a.d-b.d)*(a.u+b.u);nd+=(a.u-b.u)*(a.v+b.v);}
    // nd is twice the signed area in (u, v): an edge-on face hides nothing, and one within 0.06° of edge-on hides only
    // a sliver while its plane depth is ill-conditioned, so it is not an occluder.
    if(Math.abs(nd)<1e-6||Math.abs(nd)<1e-3*Math.hypot(nu,nv,nd))return null;
    const k=p.reduce((s,q)=>s+nu*q.u+nv*q.v+nd*q.d,0)/p.length,A=-nu/nd,B=-nv/nd,C=k/nd;
    return {pts:p,A,B,C,turn:Math.sign(nd),minU:Math.min(...p.map(q=>q.u)),maxU:Math.max(...p.map(q=>q.u)),minV:Math.min(...p.map(q=>q.v)),maxV:Math.max(...p.map(q=>q.v)),minD:Math.min(...p.map(q=>q.d))};
  };
  if(pts.length>3){
    const whole=make(pts);
    if(whole){
      const planar=pts.every(q=>Math.abs(whole.A*q.u+whole.B*q.v+whole.C-q.d)<1e-3);
      const convex=pts.every((a,i)=>{const b=pts[(i+1)%pts.length],c=pts[(i+2)%pts.length];return ((b.u-a.u)*(c.v-b.v)-(b.v-a.v)*(c.u-b.u))*whole.turn>=-1e-9;});
      if(planar&&convex)return [whole];
    }
  }
  const out:Occluder[]=[];
  for(let i=1;i+1<pts.length;i++){const o=make([pts[0],pts[i],pts[i+1]]);if(o)out.push(o);}
  return out;
}

/** The interval of a → b (parameters) that the occluder hides, or null. */
function hides(o:Occluder,a:ViewPt,b:ViewPt):[number,number]|null{
  let t0=0,t1=1;const du=b.u-a.u,dv=b.v-a.v;
  for(let i=0;i<o.pts.length;i++){
    const p=o.pts[i],q=o.pts[(i+1)%o.pts.length],nu=-(q.v-p.v)*o.turn,nv=(q.u-p.u)*o.turn,len=Math.hypot(nu,nv);
    if(len<1e-12)continue;
    // Inside by the margin: nIn · (P(t) − p) ≥ INSIDE·|n|.
    const num=nu*(a.u-p.u)+nv*(a.v-p.v)-INSIDE*len,den=nu*du+nv*dv;
    if(Math.abs(den)<1e-15){if(num<0)return null;continue;}
    const t=-num/den;if(den>0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
    if(t0>=t1)return null;
  }
  // Hidden where the face is nearer: g(t) = edge depth − face depth − DEPTH > 0, linear in t. It is evaluated at the
  // clipped ends, which lie on the face, rather than extrapolated from the edge's own ends.
  const at=(t:number)=>{const u=a.u+du*t,v=a.v+dv*t;return a.d+(b.d-a.d)*t-(o.A*u+o.B*v+o.C)-DEPTH;},e0=at(t0),e1=at(t1);
  if(e0<=0&&e1<=0)return null;
  if(e0>0&&e1>0)return [t0,t1];
  const r=t0+(t1-t0)*e0/(e0-e1);
  return e0>0?[t0,r]:[r,t1];
}

/** True when a point on a solid is hidden by any occluder: the brute-force test the checks compare against. */
export function hiddenPoint(all:Occluder[],p:ViewPt):boolean{
  return all.some(o=>{const h=hides(o,p,{u:p.u+1e-9,v:p.v,d:p.d});return h!==null&&h[0]<=0&&h[1]>=1;});
}

export function viewSolids(solids:Solid[],view:ElevationView):{edges:ViewEdge[];occluders:Occluder[]}{
  const w=FORWARD[view],all:Occluder[]=[],candidates:{a:V3;b:V3;solid:number}[]=[];
  solids.forEach((s,si)=>{
    const normals=s.faces.map(f=>newell(f.map(i=>s.vertices[i])));
    s.faces.forEach(f=>{if(f.length>=3)all.push(...occluders(f.map(i=>project(view,s.vertices[i]))));});
    // Edges keyed by position, so faces that repeat a vertex still meet.
    const key=(p:V3)=>`${Math.round(p.x*1e4)},${Math.round(p.y*1e4)},${Math.round(p.z*1e4)}`,edges=new Map<string,{a:V3;b:V3;faces:number[]}>();
    s.faces.forEach((f,fi)=>f.forEach((vi,k)=>{
      const a=s.vertices[vi],b=s.vertices[f[(k+1)%f.length]],ka=key(a),kb=key(b);if(ka===kb)return;
      const id=ka<kb?`${ka}|${kb}`:`${kb}|${ka}`,e=edges.get(id);if(e)e.faces.push(fi);else edges.set(id,{a,b,faces:[fi]});
    }));
    for(const e of edges.values()){
      if(e.faces.length===2){
        const n1=normals[e.faces[0]],n2=normals[e.faces[1]],c=dot(n1,n2);
        if(Math.abs(c)>.9999)continue;
        if(c>=SMOOTH&&dot(n1,w)*dot(n2,w)>=0)continue;
      }
      candidates.push({a:e.a,b:e.b,solid:si});
    }
  });
  // A uniform grid over the view, so each edge meets only the faces near it.
  const grid=new Map<number,number[]>(),cell=(x:number)=>Math.floor(x/CELL),id=(i:number,j:number)=>i*100003+j;
  all.forEach((o,k)=>{for(let i=cell(o.minU);i<=cell(o.maxU);i++)for(let j=cell(o.minV);j<=cell(o.maxV);j++){const c=id(i,j),list=grid.get(c);if(list)list.push(k);else grid.set(c,[k]);}});
  const seen=new Int32Array(all.length).fill(-1),edges:ViewEdge[]=[];
  candidates.forEach((c,n)=>{
    const a=project(view,c.a),b=project(view,c.b),len=Math.hypot(b.u-a.u,b.v-a.v);if(len<1e-4)return;
    const minU=Math.min(a.u,b.u),maxU=Math.max(a.u,b.u),minV=Math.min(a.v,b.v),maxV=Math.max(a.v,b.v),far=Math.max(a.d,b.d),hidden:[number,number][]=[];
    for(let i=cell(minU);i<=cell(maxU);i++)for(let j=cell(minV);j<=cell(maxV);j++)for(const k of grid.get(id(i,j))??[]){
      if(seen[k]===n)continue;seen[k]=n;const o=all[k];
      if(o.minD>=far-DEPTH||o.maxU<minU||o.minU>maxU||o.maxV<minV||o.minV>maxV)continue;
      const h=hides(o,a,b);if(h&&h[1]-h[0]>1e-12)hidden.push(h);
    }
    // Stretches hidden by neighbouring faces join across the thin margin between them.
    hidden.sort((p,q)=>p[0]-q[0]);const join=.05/len,visible:[number,number][]=[];let t=0;
    for(const [h0,h1] of hidden){if(h0>t+join&&h0-t>.05/len)visible.push([t,h0]);t=Math.max(t,h1);}
    if(1-t>join)visible.push([t,1]);
    edges.push({a,b,solid:c.solid,visible:visible.filter(([p,q])=>(q-p)*len>=.05)});
  });
  return {edges,occluders:all};
}

/** The visible lines of a view on their layers, in (u, v) with v up: below grade on the solid's dashed layer. */
export function viewLines(solids:Solid[],view:ElevationView):{a:Pt;b:Pt;layer:LayerId}[]{
  const out:{a:Pt;b:Pt;layer:LayerId}[]=[];
  for(const e of viewSolids(solids,view).edges){
    const s=solids[e.solid],at=(t:number):Pt=>({x:e.a.u+(e.b.u-e.a.u)*t,y:e.a.v+(e.b.v-e.a.v)*t});
    for(const [t0,t1] of e.visible){
      // Split at grade (v = 0).
      const cuts=[t0,t1],dv=e.b.v-e.a.v;if(Math.abs(dv)>1e-12){const g=((s.gradeElevationIn??0)-e.a.v)/dv;if(g>t0&&g<t1)cuts.splice(1,0,g);}
      for(let i=0;i+1<cuts.length;i++){
        const p=at(cuts[i]),q=at(cuts[i+1]),below=(p.y+q.y)/2<(s.gradeElevationIn??0)-1e-6;
        if(!below)out.push({a:p,b:q,layer:s.layer});else if(s.belowGrade)out.push({a:p,b:q,layer:s.belowGrade});
      }
    }
  }
  return mergeLines(out);
}

/** Collinear lines on one layer that overlap or touch become one; ends round to 1/64 in; the order is fixed. */
export function mergeLines(lines:{a:Pt;b:Pt;layer:LayerId}[]):{a:Pt;b:Pt;layer:LayerId}[]{
  const r=(n:number)=>Math.round(n*64)/64,groups=new Map<string,{layer:LayerId;ang:number;c:number;spans:[number,number][]}>();
  for(const l of lines){
    let dx=l.b.x-l.a.x,dy=l.b.y-l.a.y;const len=Math.hypot(dx,dy);if(len<1e-6)continue;dx/=len;dy/=len;
    if(dx<-1e-9||(Math.abs(dx)<=1e-9&&dy<0)){dx=-dx;dy=-dy;}
    const ang=Math.round(Math.atan2(dy,dx)*1e4)/1e4,ux=Math.cos(ang),uy=Math.sin(ang),c=r(-uy*l.a.x+ux*l.a.y);
    const s0=ux*l.a.x+uy*l.a.y,s1=ux*l.b.x+uy*l.b.y,k=`${l.layer}|${ang}|${c}`,g=groups.get(k)??{layer:l.layer,ang,c,spans:[]};
    g.spans.push([Math.min(s0,s1),Math.max(s0,s1)]);groups.set(k,g);
  }
  const out:{a:Pt;b:Pt;layer:LayerId}[]=[];
  for(const g of groups.values()){
    const ux=Math.cos(g.ang),uy=Math.sin(g.ang),pt=(s:number):Pt=>({x:r(ux*s-uy*g.c),y:r(uy*s+ux*g.c)});
    g.spans.sort((p,q)=>p[0]-q[0]);let cur:[number,number]|null=null;
    const flush=()=>{if(cur&&cur[1]-cur[0]>=1/32)out.push({a:pt(cur[0]),b:pt(cur[1]),layer:g.layer});};
    for(const s of g.spans){if(cur&&s[0]<=cur[1]+1e-3)cur[1]=Math.max(cur[1],s[1]);else{flush();cur=[...s] as [number,number];}}
    flush();
  }
  return out.sort((p,q)=>p.layer.localeCompare(q.layer)||p.a.x-q.a.x||p.a.y-q.a.y||p.b.x-q.b.x||p.b.y-q.b.y);
}
