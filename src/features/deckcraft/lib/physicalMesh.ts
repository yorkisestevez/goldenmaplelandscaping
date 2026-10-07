import type {PlanPoint} from './deckGeometry';
export interface MeshPoint {x:number;y:number;z:number}
export type PhysicalMesh={name:string;vertices:MeshPoint[];faces:number[][]};
const cross=(a:MeshPoint,b:MeshPoint):MeshPoint=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
/** Ear clipping keeps concave notches and clipped corners instead of filling their bounds. */
export function extrudePolygon(name:string,input:PlanPoint[],at:(p:PlanPoint,t:number)=>MeshPoint):PhysicalMesh{
  const poly=input.filter((p,i)=>{const q=input[(i+input.length-1)%input.length];return Math.hypot(p.x-q.x,p.y-q.y)>1e-7;});
  const turn=(a:PlanPoint,b:PlanPoint,c:PlanPoint)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const area=poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p.x*q.y-q.x*p.y;},0);
  if(area<0)poly.reverse();
  const remaining=poly.map((_,i)=>i),triangles:number[][]=[];
  while(remaining.length>3){let found=false;for(let i=0;i<remaining.length;i++){
    const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
    if(Math.abs(turn(poly[a],poly[b],poly[c]))<1e-7){remaining.splice(i,1);found=true;break;}
    if(turn(poly[a],poly[b],poly[c])<0)continue;
    if(remaining.some(k=>k!==a&&k!==b&&k!==c&&turn(poly[a],poly[b],poly[k])>=-1e-7&&turn(poly[b],poly[c],poly[k])>=-1e-7&&turn(poly[c],poly[a],poly[k])>=-1e-7))continue;
    triangles.push([a,b,c]);remaining.splice(i,1);found=true;break;
  }if(!found)throw new Error(`Cannot triangulate ${name}; the outline needs review.`);}
  if(remaining.length===3)triangles.push([...remaining]);
  const n=poly.length,vertices=[...poly.map(p=>at(p,0)),...poly.map(p=>at(p,1))];
  const fs=[...triangles.map(t=>[...t].reverse()),...triangles.map(t=>t.map(i=>i+n)),...poly.map((_,i)=>[i,(i+1)%n,(i+1)%n+n,i+n])];
  const volume=fs.reduce((sum,face)=>sum+face.slice(1,-1).reduce((s,_,i)=>{const a=vertices[face[0]],b=vertices[face[i+1]],c=vertices[face[i+2]],bc=cross(b,c);return s+(a.x*bc.x+a.y*bc.y+a.z*bc.z)/6;},0),0);
  return {name,vertices,faces:volume<0?fs.map(face=>[...face].reverse()):fs};
}
