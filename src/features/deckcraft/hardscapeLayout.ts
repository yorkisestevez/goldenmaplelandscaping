import type {YardFeature} from './types';
import {hardscapeSelection,hardscapeProblem} from './hardscapeCatalogue';
export interface HardscapeBlank {cx:number;cy:number;length:number;width:number;angle:number;id:string;unitId?:string}
/** Nominal stock sizes stay intact. Joints are added to pitch, never subtracted
 * from a manufacturer's board/stone size. Coordinates are feature-local inches. */
export function hardscapeBlanks(f:YardFeature,limit=20001):HardscapeBlank[]{
 const s=hardscapeSelection(f);if(!s||hardscapeProblem(f))return [];
 const h=f.hardscape!,l=s.unit.lengthMm/25.4,w=s.unit.widthMm/25.4,j=h.jointMm/25.4,L=l+j,W=w+j,a=h.angleDeg*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),points=f.outline??[{x:-f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:-f.depthFt*6},{x:f.widthFt*6,y:f.depthFt*6},{x:-f.widthFt*6,y:f.depthFt*6}],local=points.map(p=>({x:c*p.x+sn*p.y,y:-sn*p.x+c*p.y})),xs=local.map(p=>p.x),ys=local.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys),out:HardscapeBlank[]=[];
 const add=(x:number,y:number,length:number,width:number,angle:number,id:string)=>{const hw=(angle?width:length)/2,hd=(angle?length:width)/2;if(out.length>=limit||x+hw<x0||x-hw>x1||y+hd<y0||y-hd>y1)return;out.push({cx:c*x-sn*y,cy:sn*x+c*y,length,width,angle:a+angle,id});};
 const recipe=s.finish.patterns.find(p=>p.id===h.patternId);
 if(recipe){const layout=recipe.layout,tw=layout.widthMm/25.4,td=layout.depthMm/25.4;for(let row=Math.floor(y0/td)-1;row<=Math.ceil(y1/td)&&out.length<limit;row++)for(let col=Math.floor(x0/tw)-1;col<=Math.ceil(x1/tw)&&out.length<limit;col++)for(let i=0;i<layout.cells.length&&out.length<limit;i++){const cell=layout.cells[i],u=s.finish.units.find(u=>u.id===cell.unitId)!;const length=u.lengthMm/25.4,width=u.widthMm/25.4,rot=cell.rotationDeg*Math.PI/180,before=out.length;add(col*tw+cell.xMm/25.4+(cell.rotationDeg===90?width:length)/2,row*td+cell.yMm/25.4+(cell.rotationDeg===90?length:width)/2,length,width,rot,`recipe-${row}-${col}-${i}`);if(out.length>before)out.at(-1)!.unitId=cell.unitId;}}
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
