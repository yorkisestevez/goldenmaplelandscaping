import type {DeckData} from './types';
import type {Box,V3} from './deckTakeoff';
import {pergolaProduct} from './pergolaCatalog';
import type {pergolaLayout} from './pergolaLayout';
export type PergolaPart=Box&{pitch:number;color:string;role:string};
export const PERGOLA_FACES=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
/** One transform for rendering, collision envelopes and model exports. */
export function pergolaVertices(b:PergolaPart):V3[]{
 const c=Math.cos(b.angle??0),s=Math.sin(b.angle??0),cp=Math.cos(b.pitch),sp=Math.sin(b.pitch);
 return [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([u,v,t])=>{
  const x=u*b.w/2,y=v*b.h/2*cp-t*b.d/2*sp,z=v*b.h/2*sp+t*b.d/2*cp;
  return {x:b.x+c*x+s*z,y:b.y+y,z:b.z-s*x+c*z};
 });
}
/** Render and export identical solids, loaded only with those views. */
export function pergolaParts(data:DeckData,layout:NonNullable<ReturnType<typeof pergolaLayout>>):PergolaPart[]{
 const sel=data.pergola!,p=pergolaProduct(sel)!,dim=layout.dimensions,base=layout.base;
 const a=sel.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=sel.xFt*12,z=sel.zFt*12,post=p.postIn??5,parts:PergolaPart[]=[];
 const add=(role:string,lx:number,y:number,lz:number,w:number,h:number,d:number,color:string,pitch=0)=>parts.push({role,x:x+c*lx-s*lz,y:base+y,z:z+s*lx+c*lz,w,h,d,angle:-a,pitch,color});
 const frame=p.frameFinishes.find(f=>f.id===sel.frameFinish)!.hex,roof=p.roofFinishes.find(f=>f.id===sel.roofFinish)!.hex,W=dim.widthIn,D=dim.depthIn,H=dim.heightIn;
 for(const px of [-1,1])for(const pz of [-1,1])add('post',px*(W-post)/2,(H-7)/2,pz*(D-post)/2,post,H-7,post,frame);
 for(const pz of [-1,1])add('frame',0,H-3.5,pz*(D-4)/2,W,7,4,frame);
 for(const px of [-1,1])add('frame',px*(W-4)/2,H-3.5,0,4,7,D-8,frame);
 const count=Math.max(1,Math.ceil((D-8)/8)),pitch=sel.louverDeg*Math.PI/180,spacing=(D-8)/count;
 // Closed louvers still fill the bay. Opening them narrows each blade so the gap, not a slab, is what you see.
 const open=Math.min(1,Math.max(0,sel.louverDeg/75)),chord=Math.max(1.5,spacing*(1-.5*open)-.15);
 for(let i=0;i<count;i++)add('louver',0,H-4,-(D-8)/2+(i+.5)*spacing,W-8,.8,chord,roof,pitch);
 if(sel.lighting){for(const side of [-1,1]){add('LED',0,H-7.2,side*(D-6)/2,W-12,.5,.6,'#ffe8a9');add('LED',side*(W-6)/2,H-7.2,0,.6,.5,D-12,'#ffe8a9');}}
 for(const id of sel.accessories){const ac=p.accessories.find(k=>k.id===id)!;
  if(ac.kind==='led')add('LED',0,H-7.2,-(D-5)/2,W-10,.3,.5,'#ffe8a9');
  if(ac.kind==='motor')add('motor',(W-7)/2,H-6,0,2,3,12,frame);
  if(ac.kind==='screen'){const side=ac.side!,horizontal=side==='front'||side==='back';add('screen',horizontal?0:(side==='left'?-1:1)*(W-6)/2,(H-8)/2,horizontal?(side==='back'?-1:1)*(D-6)/2:0,horizontal?W-2*post:.5,H-8,horizontal?.5:D-2*post,'#767a7c');}
 }
 return parts;
}
