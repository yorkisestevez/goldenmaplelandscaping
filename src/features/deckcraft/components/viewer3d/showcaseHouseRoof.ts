/** Showcase-only eave trim for the editable house, in inches (the house group is
 * not scaled). The saved roof mesh and the editor's soffit box stay as they are.
 * This draws a fascia and an overhang soffit that sit under the cap, so the
 * flat soffit slab and the full-length gutter bars can stay hidden in showcase. */

export type ShowcaseRoofShape='Hip'|'Gable'|'Flat';
type V=[number,number,number];
const EAVE=12,DROP=7,TUCK=0.5,OUT=0.2,SOFFIT_GAP=0.45,SKIN=4;

const sub=(a:V,b:V):V=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:V):V=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];};
const add=(a:V,b:V,s=1):V=>[a[0]+b[0]*s,a[1]+b[1]*s,a[2]+b[2]*s];

function push(out:number[],a:V,b:V,c:V,outward:V){
 const n=cross(sub(b,a),sub(c,a));
 if(dot(n,n)<1e-8)return;
 if(dot(n,outward)<0)out.push(...a,...c,...b);else out.push(...a,...b,...c);
}

function board(out:number[],a:V,b:V,outward:V,drop=DROP){
 if(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2])<1)return;
 const o=norm(outward),down:V=[0,-1,0];
 const a0=add(add(a,o,OUT),down,TUCK),b0=add(add(b,o,OUT),down,TUCK);
 const a1=add(a0,down,drop),b1=add(b0,down,drop);
 push(out,a0,b0,b1,o);push(out,a0,b1,a1,o);
 push(out,a0,add(a0,[0,1,0],.4),b0,[0,1,0]);
 push(out,a1,b1,add(b1,[0,-1,0],.4),[0,-1,0]);
}

function soffit(out:number[],inner0:V,inner1:V,outer1:V,outer0:V){
 const down:V=[0,-1,0];
 push(out,inner0,outer0,outer1,down);push(out,inner0,outer1,inner1,down);
 const up:V=[0,1,0],t=SOFFIT_GAP*.35;
 push(out,add(inner0,up,t),add(inner1,up,t),add(outer1,up,t),up);
}

export interface ShowcaseRoofTrimInput {x0:number;x1:number;y0:number;y1:number;wallTop:number;rise:number;shape:ShowcaseRoofShape;ridge:'x'|'z'}

/** Fascia and soffit positions (x, y, z inches). Empty soffit on a flat roof, which gets a parapet instead. */
export function showcaseRoofTrim(input:ShowcaseRoofTrimInput):{fascia:number[];soffit:number[]}{
 const {x0,x1,y0,y1,wallTop,rise,shape,ridge}=input;
 const l=x0-EAVE,right=x1+EAVE,f=y1+EAVE,b=y0-EAVE,sy=wallTop-SKIN-SOFFIT_GAP;
 const fascia:number[]=[],soffitPts:number[]=[];
 const eave=(x:number,z:number,y=shape==='Flat'?wallTop+6:wallTop):V=>[x,y,z];
 if(shape==='Flat'){
  const top=wallTop+6,parapet=top+16;
  for(const [a,c,o] of [
   [eave(l,f,parapet),eave(right,f,parapet),[0,0,1]],
   [eave(right,b,parapet),eave(l,b,parapet),[0,0,-1]],
   [eave(l,b,parapet),eave(l,f,parapet),[-1,0,0]],
   [eave(right,f,parapet),eave(right,b,parapet),[1,0,0]],
  ] as [V,V,V][])board(fascia,a,c,o,parapet-top+2);
  return {fascia,soffit:soffitPts};
 }
 const a=eave(l,f),bb=eave(right,f),c=eave(right,b),d=eave(l,b);
 const syA=(p:V):V=>[p[0],sy,p[2]];
 const overhang=(p0:V,p1:V,in0:V,in1:V)=>soffit(soffitPts,syA(in0),syA(in1),syA(p1),syA(p0));
 board(fascia,a,bb,[0,0,1]);board(fascia,c,d,[0,0,-1]);board(fascia,d,a,[-1,0,0]);board(fascia,bb,c,[1,0,0]);
 overhang(a,bb,[x0,wallTop,y1],[x1,wallTop,y1]);
 overhang(c,d,[x1,wallTop,y0],[x0,wallTop,y0]);
 overhang(d,a,[x0,wallTop,y0],[x0,wallTop,y1]);
 overhang(bb,c,[x1,wallTop,y1],[x1,wallTop,y0]);
 if(shape==='Gable'&&ridge==='x'){
  const cz=(f+b)/2,rl:V=[l,wallTop+rise,cz],rr:V=[right,wallTop+rise,cz];
  board(fascia,a,rl,[-1,0,0]);board(fascia,rl,d,[-1,0,0]);
  board(fascia,bb,rr,[1,0,0]);board(fascia,rr,c,[1,0,0]);
 }else if(shape==='Gable'){
  const cx=(l+right)/2,rf:V=[cx,wallTop+rise,f],rb:V=[cx,wallTop+rise,b];
  board(fascia,a,rf,[0,0,1]);board(fascia,rf,bb,[0,0,1]);
  board(fascia,d,rb,[0,0,-1]);board(fascia,rb,c,[0,0,-1]);
 }
 // A hip's ridges are the roof planes themselves. A vertical board along a hip
 // cuts through those planes, so hips get eave fascia and soffit only.
 return {fascia,soffit:soffitPts};
}

/** Eave fascia sits under the cap, soffit under the roof skin, rake boards stay at or below the ridge, and no triangle is degenerate. */
export function showcaseRoofTrimSeated(input:ShowcaseRoofTrimInput):boolean{
 const {fascia,soffit}=showcaseRoofTrim(input),cap=input.shape==='Flat'?input.wallTop+6:input.wallTop,ridge=input.shape==='Gable'?cap+input.rise:input.shape==='Flat'?cap+16:cap;
 if(fascia.length<36)return false;
 let dropped=false;
 for(let i=1;i<fascia.length;i+=3){if(fascia[i]>ridge-.05)return false;if(fascia[i]<cap-1)dropped=true;}
 if(!dropped)return false;
 if(input.shape!=='Flat'){
  if(soffit.length<36)return false;
  for(let i=1;i<soffit.length;i+=3)if(soffit[i]>cap-SKIN)return false;
 }
 const solid=(flat:number[])=>{for(let i=0;i<flat.length;i+=9){const ax=flat[i],ay=flat[i+1],az=flat[i+2],bx=flat[i+3],by=flat[i+4],bz=flat[i+5],cx=flat[i+6],cy=flat[i+7],cz=flat[i+8];const n=cross(sub([bx,by,bz],[ax,ay,az]),sub([cx,cy,cz],[ax,ay,az]));if(dot(n,n)<1e-6)return false;}return true;};
 return solid(fascia)&&(input.shape==='Flat'||solid(soffit));
}
