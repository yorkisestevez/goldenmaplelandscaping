import type {YardFeature} from './types';
import {hardscapeSelection,hardscapeProblem} from './hardscapeCatalogue';
import {hardscapeProfile,shapedBond} from './hardscapeShapes';
export interface HardscapeBlank {cx:number;cy:number;length:number;width:number;angle:number;id:string;unitId?:string}
/** Nominal stock sizes stay intact. Joints are added to pitch, never subtracted
 * from a manufacturer's board/stone size. Coordinates are feature-local inches. */
export function hardscapeBlanks(f:YardFeature,limit=20001):HardscapeBlank[]{
 const s=hardscapeSelection(f);if(!s||hardscapeProblem(f))return [];
 const h=f.hardscape!,l=s.unit.lengthMm/25.4,w=s.unit.widthMm/25.4,j=h.jointMm/25.4,L=l+j,W=w+j,a=(h.angleDeg+(s.finish.patterns.find(p=>p.id===h.patternId)?.layout.angleDeg??0))*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),points=f.outline??[{x:-f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:f.depthFt*6},{x:-f.widthFt*6,y:f.depthFt*6}],local=points.map(p=>({x:c*p.x+sn*p.y,y:-sn*p.x+c*p.y})),xs=local.map(p=>p.x),ys=local.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),out:HardscapeBlank[]=[];
 const add=(x:number,y:number,length:number,width:number,angle:number,id:string)=>{const ac=Math.abs(Math.cos(angle)),as=Math.abs(Math.sin(angle)),hw=(ac*length+as*width)/2,hd=(as*length+ac*width)/2;if(out.length>=limit||x+hw<x0||x-hw>x1||y+hd<y0||y-hd>y1)return;out.push({cx:c*x-sn*y,cy:sn*x+c*y,length,width,angle:a+angle,id});};
 const profile=hardscapeProfile(s.product.id,s.unit),bond=shapedBond(s.product.id,s.unit);
 if(bond&&h.patternId===bond.id){
  const kind=profile!.bond;
  if(kind==='hex-point'||kind==='hex-flat'||kind==='diamond'){
   // A uniform joint: move every outline edge out by half the joint and tile that outline edge to edge
   // (translations across facing edges). Facing edges are then exactly the joint apart at any edge angle;
   // adding the joint to the rectangular envelope would narrow sloped joints (a rhombus to about 0.68 of it).
   const v=profile!.polygons[0].map(([u,q])=>({x:(u-.5)*l,y:(q-.5)*w})),n=v.length,ccw=v.reduce((a,p,i)=>a+p.x*v[(i+1)%n].y-v[(i+1)%n].x*p.y,0)>0;
   const outward=(a:{x:number;y:number},b:{x:number;y:number})=>{const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);return ccw?{x:dy/len,y:-dx/len}:{x:-dy/len,y:dx/len};};
   const o=v.map((p,i)=>{const a=outward(v[(i+n-1)%n],p),b=outward(p,v[(i+1)%n]),k=j/2/(1+a.x*b.x+a.y*b.y);return {x:p.x+(a.x+b.x)*k,y:p.y+(a.y+b.y)*k};});
   const t0={x:o[0].x+o[1].x,y:o[0].y+o[1].y},t1={x:o[1].x+o[2].x,y:o[1].y+o[2].y},det=t0.x*t1.y-t0.y*t1.x,reach=l+w+j;
   const corners=[{x:x0-reach,y:y0-reach},{x:x1+reach,y:y0-reach},{x:x1+reach,y:y1+reach},{x:x0-reach,y:y1+reach}],ms=corners.map(p=>(t1.y*p.x-t1.x*p.y)/det),ns=corners.map(p=>(t0.x*p.y-t0.y*p.x)/det);
   for(let m=Math.floor(Math.min(...ms));m<=Math.ceil(Math.max(...ms))&&out.length<limit;m++)for(let q=Math.floor(Math.min(...ns));q<=Math.ceil(Math.max(...ns))&&out.length<limit;q++)add(m*t0.x+q*t1.x,m*t0.y+q*t1.y,l,w,0,`shape-${m}-${q}`);
  }else{
   // Triangle pairs part along the hypotenuse normal by the joint; vertex pairs along their sloped edge.
   const hyp=Math.hypot(l,w),sx=j/2*w/hyp,sy=j/2*l/hyp,short=kind==='vertex'?profile!.polygons[0].at(-1)![1]*w:0,slope=kind==='vertex'?j*Math.hypot(1,(w-short)/l):0;
   const py=kind==='vertex'?w+short+slope+j:w+j+2*sy,px=kind==='triangle'?l+j+2*sx:L;
   for(let r=Math.floor(y0/py)-2;r<=Math.ceil(y1/py)+1&&out.length<limit;r++)for(let col=Math.floor(x0/px)-2;col<=Math.ceil(x1/px)+1&&out.length<limit;col++){
    const x=col*px,y=r*py;
    if(kind==='triangle'){add(x+l/2+sx,y+w/2-sy,l,w,0,`shape-${r}-${col}-a`);add(x+l/2-sx,y+w/2+sy,l,w,Math.PI,`shape-${r}-${col}-b`);}
    else {add(x+L/2,y+w/2,l,w,0,`shape-${r}-${col}-a`);add(x+L/2,y+w/2+short+slope,l,w,Math.PI,`shape-${r}-${col}-b`);}
   }
  }
  return out;
 }
 const recipe=s.finish.patterns.find(p=>p.id===h.patternId);
 if(recipe){
  const layout=recipe.layout,tw=layout.widthMm/25.4,td=layout.depthMm/25.4;
  // Source x/y anchors are the upper-left of the rotated stock envelope.
  // Keep the physical body intact for angular originals, including 60° rhombi.
  const stockBounds=(cell:typeof layout.cells[number])=>{const u=s.finish.units.find(u=>u.id===cell.unitId)!,a=cell.rotationDeg*Math.PI/180,ac=Math.abs(Math.cos(a)),as=Math.abs(Math.sin(a));return {x:cell.xMm/25.4,y:cell.yMm/25.4,w:(ac*u.lengthMm+as*u.widthMm)/25.4,h:(as*u.lengthMm+ac*u.widthMm)/25.4};};
  const emit=(x:number,y:number,row:number,col:number)=>{for(let i=0;i<layout.cells.length&&out.length<limit;i++){const cell=layout.cells[i],u=s.finish.units.find(u=>u.id===cell.unitId)!,b=stockBounds(cell),before=out.length;add(x+b.x+b.w/2,y+b.y+b.h/2,u.lengthMm/25.4,u.widthMm/25.4,cell.rotationDeg*Math.PI/180,`recipe-${row}-${col}-${i}`);if(out.length>before)out.at(-1)!.unitId=cell.unitId;}};
  if(layout.repeatBasisMm){
   // Oblique source repeats retain full stock even when a rectangular supercell
   // would require thousands of cells, such as 98 × 198 mm herringbone.
   const [[axMm,ayMm],[bxMm,byMm]]=layout.repeatBasisMm,ax=axMm/25.4,ay=ayMm/25.4,bx=bxMm/25.4,by=byMm/25.4,det=ax*by-ay*bx;
   if(!Number.isFinite(det)||Math.abs(det)<1e-8)return [];
   const bounds=layout.cells.map(stockBounds);
   const minX=Math.min(...bounds.map(b=>b.x)),maxX=Math.max(...bounds.map(b=>b.x+b.w)),minY=Math.min(...bounds.map(b=>b.y)),maxY=Math.max(...bounds.map(b=>b.y+b.h));
   const corners=[{x:x0-maxX,y:y0-maxY},{x:x1-minX,y:y0-maxY},{x:x1-minX,y:y1-minY},{x:x0-maxX,y:y1-minY}],ms=corners.map(p=>(by*p.x-bx*p.y)/det),ns=corners.map(p=>(ax*p.y-ay*p.x)/det);
   for(let m=Math.floor(Math.min(...ms));m<=Math.ceil(Math.max(...ms))&&out.length<limit;m++)for(let n=Math.floor(Math.min(...ns));n<=Math.ceil(Math.max(...ns))&&out.length<limit;n++)emit(m*ax+n*bx,m*ay+n*by,m,n);
  }else for(let row=Math.floor(y0/td)-1;row<=Math.ceil(y1/td)&&out.length<limit;row++)for(let col=Math.floor(x0/tw)-1;col<=Math.ceil(x1/tw)&&out.length<limit;col++)emit(col*tw,row*td,row,col);
 }
 else if(h.patternId==='herringbone'){
  // Two perpendicular rectangles on lattice (L,-L),(W,W). Its cell area
  // is 2LW: it tiles for every rectangular module, not only 2:1 bricks.
  const corners=[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],ms=corners.map(p=>(p.x-p.y)/(2*L)),ns=corners.map(p=>(p.x+p.y)/(2*W));
  for(let m=Math.floor(Math.min(...ms))-2;m<=Math.ceil(Math.max(...ms))+2&&out.length<limit;m++)for(let n=Math.floor(Math.min(...ns))-2;n<=Math.ceil(Math.max(...ns))+2&&out.length<limit;n++){const x=m*L+n*W,y=-m*L+n*W;add(x+L/2,y+W/2,l,w,0,`h-${m}-${n}`);add(x+W/2,y+W+L/2,l,w,Math.PI/2,`v-${m}-${n}`);}
 }else if(h.patternId==='basket-weave'){
  for(let r=Math.floor(y0/L)-1;r<=Math.ceil(y1/L)&&out.length<limit;r++)for(let col=Math.floor(x0/L)-1;col<=Math.ceil(x1/L)&&out.length<limit;col++){const x=col*L,y=r*L;for(let k=0;k<2;k++)(r+col)%2?add(x+(k+.5)*W,y+L/2,l,w,Math.PI/2,`${r}-${col}-${k}`):add(x+L/2,y+(k+.5)*W,l,w,0,`${r}-${col}-${k}`);}
 }else{
  for(let r=Math.floor(y0/W)-1;r<=Math.ceil(y1/W)&&out.length<limit;r++){const offset=h.patternId==='running-bond'&&Math.abs(r)%2?L/2:0;for(let col=Math.floor((x0-offset)/L)-1;col<=Math.ceil((x1-offset)/L)&&out.length<limit;col++)add(col*L+offset+L/2,r*W+W/2,l,w,0,`${r}-${col}`);}
 }
 return out;
}
