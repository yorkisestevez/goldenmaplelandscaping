import {poolFloorElevation,poolLocalPoint,poolLocalBounds} from './poolGeometry';
import type {PoolFeatureModel,PoolSolidRole} from './poolModel';
import {extrudePolygon,type PhysicalMesh} from './lib/physicalMesh';
/** Inch vertices are shared verbatim by interactive rendering and every model export.
 * Visual water uses the recorded level; shader detail never changes its position. */
export interface PoolRenderMesh extends PhysicalMesh {poolId:string;role:PoolSolidRole;color:string;planning:boolean;stockId?:string}
const cache=new WeakMap<PoolFeatureModel,PoolRenderMesh[]>();
export function poolRenderMeshes(pool:PoolFeatureModel):PoolRenderMesh[]{
 const saved=cache.get(pool);if(saved)return saved;
 const out:PoolRenderMesh[]=pool.solids.map(s=>{
  const prism=extrudePolygon(`pool_${pool.config.id}_${s.id}`,s.polygon,(p,t)=>{const plane=t?s.topPlane:s.bottomPlane;return {x:p.x,y:plane.x*p.x+plane.z*p.y+plane.constant,z:p.y};});
  // Water volume is measured from the solid. Its visible/exported surface is
  // the fixed water plane: internal depth-station prism walls are not surfaces.
  const n=prism.vertices.length/2,visible=s.role==='water'?{...prism,vertices:prism.vertices.slice(n),faces:prism.faces.filter(f=>f.every(k=>k>=n)).map(f=>f.map(k=>k-n))}:prism;
  return {...visible,poolId:pool.config.id,role:s.role,color:s.color,planning:s.planning,stockId:s.stockId};
 });
 // Unknown assembly still has a measured interior finish. These are surfaces,
 // explicitly unpriced, with no fabricated thickness or supplier approval.
 if(!pool.solids.some(s=>s.role==='floor'))for(const [i,r] of pool.floorRegions.entries()){
  const prism=extrudePolygon(`pool_${pool.config.id}_planning_floor_${i}`,r.polygon,(p)=>({x:p.x,y:r.plane.x*p.x+r.plane.z*p.y+r.plane.constant,z:p.y})),n=prism.vertices.length/2;
  out.push({...prism,vertices:prism.vertices.slice(n),faces:prism.faces.filter(f=>f.every(k=>k>=n)).map(f=>f.map(k=>k-n).reverse()),poolId:pool.config.id,role:'floor',color:'#81b6c1',planning:true});
 }
 if(!pool.solids.some(s=>s.role==='wall')){
  const p=pool.config,minimumZ=poolLocalBounds(p).minZ,top=pool.copingTopElevationIn-(p.coping?.thicknessIn??0)-(p.coping?.settingBedThicknessIn??0);
  for(const [ring,poly] of pool.openingFootprints.entries())for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],u=poolLocalPoint(p,a).y-minimumZ,v=poolLocalPoint(p,b).y-minimumZ,breaks=[0,1,...p.depthProfile.map(d=>(d.stationIn-u)/(v-u)).filter(t=>Number.isFinite(t)&&t>1e-9&&t<1-1e-9)].sort((a,b)=>a-b);
   for(let j=0;j+1<breaks.length;j++){const at=(t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}),x=at(breaks[j]),z=at(breaks[j+1]);out.push({name:`pool_${p.id}_planning_wall_${ring}_${i}_${j}`,vertices:[{x:x.x,y:poolFloorElevation(p,x),z:x.y},{x:z.x,y:poolFloorElevation(p,z),z:z.y},{x:z.x,y:top,z:z.y},{x:x.x,y:top,z:x.y}],faces:[[0,1,2,3]],poolId:p.id,role:'wall',color:'#91bfc7',planning:true});}
  }
 }
 cache.set(pool,out);return out;
}

/** Intersection of the actual mesh faces with a vertical section plane.
 * Returns project inches; no silhouette bounds or invented floor depth. */
export function poolMeshSection(mesh:PoolRenderMesh,a:{x:number;y:number},b:typeof a){
 const length=Math.hypot(b.x-a.x,b.y-a.y),dx=(b.x-a.x)/length,dz=(b.y-a.y)/length,out:{a:{stationIn:number;elevationIn:number};b:{stationIn:number;elevationIn:number}}[]=[];
 if(!Number.isFinite(dx+dz))return out;
 const signed=(p:typeof mesh.vertices[number])=>(p.x-a.x)*dz-(p.z-a.y)*dx,project=(p:typeof mesh.vertices[number])=>({stationIn:(p.x-a.x)*dx+(p.z-a.y)*dz,elevationIn:p.y});
 for(const face of mesh.faces){const cuts:typeof mesh.vertices=[],add=(p:typeof cuts[number])=>{if(!cuts.some(q=>Math.hypot(q.x-p.x,q.y-p.y,q.z-p.z)<1e-6))cuts.push(p);};
  for(let i=0;i<face.length;i++){const u=mesh.vertices[face[i]],v=mesh.vertices[face[(i+1)%face.length]],su=signed(u),sv=signed(v);if(Math.abs(su)<1e-7)add(u);if(su*sv<0){const t=su/(su-sv);add({x:u.x+(v.x-u.x)*t,y:u.y+(v.y-u.y)*t,z:u.z+(v.z-u.z)*t});}}
  if(cuts.length<2)continue;
  // A coplanar face retains its full perimeter; a crossing has two extremes.
  const pairs=cuts.length>2?cuts.map((u,i)=>[u,cuts[(i+1)%cuts.length]]):[[cuts[0],cuts[1]]];
  for(const [u,v] of pairs){let pa=project(u),pb=project(v);if(pa.stationIn>pb.stationIn)[pa,pb]=[pb,pa];if(pb.stationIn<0||pa.stationIn>length)continue;const slope=(pb.elevationIn-pa.elevationIn)/(pb.stationIn-pa.stationIn);if(pa.stationIn<0)pa={stationIn:0,elevationIn:pa.elevationIn-pa.stationIn*slope};if(pb.stationIn>length)pb={stationIn:length,elevationIn:pb.elevationIn-(pb.stationIn-length)*slope};if(Math.hypot(pb.stationIn-pa.stationIn,pb.elevationIn-pa.elevationIn)>1e-6)out.push({a:pa,b:pb});}
 }
 return out;
}
