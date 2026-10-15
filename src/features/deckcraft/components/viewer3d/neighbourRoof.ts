/** Neighbour roofs, in feet. The house is centred, grade is y = 0, and the walls
 * occupy ±w/2 by ±d/2 up to `wallTop`. Each roof plane passes through those top
 * corners, overhangs past them, and is a closed slab so the soffit and the
 * edges are present. Gable ends sit on the wall heads. Nothing here is saved. */

export type NeighbourRoofKind='gable'|'hip';
type V=[number,number,number];
const OVERHANG=1.2,THICK=0.15,FASCIA_DROP=0.55,FASCIA_OUT=0.06;

const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:V):V=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
const add=(a:V,b:V,s=1):V=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s];

function push(out:number[],a:V,b:V,c:V,outward:V){
 const n=cross(sub(b,a),sub(c,a));
 if(dot(n,outward)<0)out.push(...a,...c,...b);else out.push(...a,...b,...c);
}

/** A pitched slab. `corners` is the top face, counter-clockwise from above. */
function slab(top:number[],soffit:number[],corners:V[]){
 const up=norm(cross(sub(corners[1],corners[0]),sub(corners[2],corners[0])));
 const face:V=up[1]>=0?up:[-up[0],-up[1],-up[2]];
 const low=corners.map(p=>add(p,face,-THICK));
 push(top,corners[0],corners[1],corners[2],face);
 if(corners.length>3)push(top,corners[0],corners[2],corners[3],face);
 const down:V=[-face[0],-face[1],-face[2]];
 push(soffit,low[0],low[2],low[1],down);
 if(corners.length>3)push(soffit,low[0],low[3],low[2],down);
 for(let i=0;i<corners.length;i++){const j=(i+1)%corners.length,edge=norm(cross(sub(corners[j],corners[i]),face));push(top,corners[i],corners[j],low[j],edge);push(top,corners[i],low[j],low[i],edge);}
}

function fasciaBoard(out:number[],a:V,b:V,outward:V){
 const o=norm(outward),down:V=[0,-1,0];
 const a0=add(add(a,o,FASCIA_OUT),down,.02),b0=add(add(b,o,FASCIA_OUT),down,.02);
 const a1=add(a0,down,FASCIA_DROP),b1=add(b0,down,FASCIA_DROP);
 const t=add(a0,[0,.08,0]);
 push(out,a0,b0,b1,o);push(out,a0,b1,a1,o);
 push(out,a0,t,b0,[0,1,0]);
}

export interface NeighbourRoofParts {roof:number[];soffit:number[];gables:number[];fascia:number[];wallTop:number;rise:number}

/**
 * A 5–8 in 12 pitch. Gable ridges run across the width, so the street front
 * reads as an eave. A hip uses the same pitch over the shorter run.
 */
export function neighbourRoof(w:number,d:number,wallTop:number,kind:NeighbourRoofKind,pitch=kind==='hip'?5:6):NeighbourRoofParts{
 const run=kind==='hip'?Math.min(w,d)/2:d/2,rise=run*pitch/12,eaveDrop=rise*OVERHANG/run,ridgeY=wallTop+rise,eaveY=wallTop-eaveDrop;
 const hx=w/2+OVERHANG,hz=d/2+OVERHANG;
 const roof:number[]=[],soffit:number[]=[],gables:number[]=[],fascia:number[]=[];
 const eave=(x:number,z:number):V=>[x,eaveY,z];
 if(kind==='gable'){
  const ridgeL:V=[-hx,ridgeY,0],ridgeR:V=[hx,ridgeY,0];
  const frontL=eave(-hx,-hz),frontR=eave(hx,-hz),backL=eave(-hx,hz),backR=eave(hx,hz);
  slab(roof,soffit,[ridgeL,ridgeR,frontR,frontL]);
  slab(roof,soffit,[ridgeR,ridgeL,backL,backR]);
  // Gable ends on the wall heads, tucked just under the ridge so they cannot
  // poke through the cap. The base is the wall top, so there is no gap.
  const peak=ridgeY-THICK*.55;
  for(const side of [-1,1] as const){
   const x=side*w/2,out:V=[side,0,0];
   const a:V=[x,wallTop,-d/2],b:V=[x,peak,0],c:V=[x,wallTop,d/2];
   push(gables,a,side<0?c:b,side<0?b:c,out);
   const outX:V=[side,0,0];
   fasciaBoard(fascia,side<0?frontL:frontR,side<0?ridgeL:ridgeR,outX);
   fasciaBoard(fascia,side<0?ridgeL:ridgeR,side<0?backL:backR,outX);
  }
  fasciaBoard(fascia,frontL,frontR,[0,0,-1]);
  fasciaBoard(fascia,backR,backL,[0,0,1]);
 }else{
  const alongX=w>=d,ridge=Math.max(0,(Math.max(w,d)-Math.min(w,d))/2);
  const fl=eave(-hx,-hz),fr=eave(hx,-hz),bl=eave(-hx,hz),br=eave(hx,hz);
  if(ridge<1e-3){
   const peak:V=[0,ridgeY,0];
   slab(roof,soffit,[peak,fr,fl]);slab(roof,soffit,[peak,br,fr]);slab(roof,soffit,[peak,bl,br]);slab(roof,soffit,[peak,fl,bl]);
  }else if(alongX){
   const rl:V=[-ridge,ridgeY,0],rr:V=[ridge,ridgeY,0];
   slab(roof,soffit,[rl,rr,fr,fl]);slab(roof,soffit,[rr,rl,bl,br]);slab(roof,soffit,[rl,fl,bl]);slab(roof,soffit,[rr,br,fr]);
  }else{
   const rl:V=[0,ridgeY,-ridge],rr:V=[0,ridgeY,ridge];
   slab(roof,soffit,[rl,fl,fr,rr]);slab(roof,soffit,[rr,br,bl,rl]);slab(roof,soffit,[rl,bl,fl]);slab(roof,soffit,[rr,fr,br]);
  }
  fasciaBoard(fascia,fl,fr,[0,0,-1]);fasciaBoard(fascia,br,bl,[0,0,1]);
  fasciaBoard(fascia,bl,fl,[-1,0,0]);fasciaBoard(fascia,fr,br,[1,0,0]);
 }
 return {roof,soffit,gables,fascia,wallTop,rise};
}

/** Height of the roof cap above a plan point, or null outside the overhang. */
export function neighbourRoofHeight(w:number,d:number,wallTop:number,kind:NeighbourRoofKind,x:number,z:number,pitch=kind==='hip'?5:6):number|null{
 const hx=w/2+OVERHANG,hz=d/2+OVERHANG;
 if(Math.abs(x)>hx+1e-6||Math.abs(z)>hz+1e-6)return null;
 if(kind==='gable'){const run=d/2,rise=run*pitch/12;return wallTop+rise-rise*Math.abs(z)/run;}
 const run=Math.min(w,d)/2,rise=run*pitch/12,along=w>=d;
 const inset=along?Math.max(0,Math.abs(x)-(w-d)/2):Math.max(0,Math.abs(z)-(d-w)/2);
 const across=along?Math.abs(z):Math.abs(x);
 return wallTop+rise-rise*Math.max(inset,across)/run;
}

/** The cap meets every wall-top corner, slopes down to the eaves, and every
 * stored triangle faces its intended side. */
export function neighbourRoofSeated(w:number,d:number,wallTop:number,kind:NeighbourRoofKind):boolean{
 const parts=neighbourRoof(w,d,wallTop,kind);
 for(const x of [-w/2,w/2])for(const z of [-d/2,d/2]){const y=neighbourRoofHeight(w,d,wallTop,kind,x,z);if(y===null||Math.abs(y-wallTop)>1e-6)return false;}
 const eave=neighbourRoofHeight(w,d,wallTop,kind,0,d/2+OVERHANG);if(eave===null||eave>=wallTop)return false;
 const solid=(flat:number[])=>{
  for(let i=0;i<flat.length;i+=9){
   const a:V=[flat[i],flat[i+1],flat[i+2]],b:V=[flat[i+3],flat[i+4],flat[i+5]],c:V=[flat[i+6],flat[i+7],flat[i+8]];
   if(dot(cross(sub(b,a),sub(c,a)),cross(sub(b,a),sub(c,a)))<1e-8)return false;
  }
  return flat.length>0;
 };
 if(kind==='gable')for(let i=0;i<parts.gables.length;i+=9){const x=parts.gables[i],y=parts.gables[i+1],z=parts.gables[i+2],bx=parts.gables[i+3],by=parts.gables[i+4],bz=parts.gables[i+5],cx=parts.gables[i+6],cy=parts.gables[i+7],cz=parts.gables[i+8];const nx=(by-y)*(cz-z)-(bz-z)*(cy-y);if(Math.sign(nx)!==Math.sign(x)||Math.abs(nx)<1e-4)return false;}
 let capUp=false;
 for(let i=0;i<parts.roof.length;i+=9){
  const a:V=[parts.roof[i],parts.roof[i+1],parts.roof[i+2]],b:V=[parts.roof[i+3],parts.roof[i+4],parts.roof[i+5]],c:V=[parts.roof[i+6],parts.roof[i+7],parts.roof[i+8]];
  const n=cross(sub(b,a),sub(c,a));if(n[1]>Math.abs(n[0])*.2&&n[1]>Math.abs(n[2])*.2)capUp=true;
 }
 return solid(parts.roof)&&solid(parts.soffit)&&solid(parts.fascia)&&capUp&&(kind==='hip'?parts.gables.length===0:parts.gables.length===18&&solid(parts.gables));
}
