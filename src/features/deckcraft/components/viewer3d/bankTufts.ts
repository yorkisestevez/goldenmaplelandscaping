import type * as THREE from 'three';
import type {LawnTuft} from './lawnTufts';
import type {PlanPoint} from '../../lib/deckGeometry';
/** Sample the rendered bank triangles, so blades follow the continuous crest,
 * curves, patio cutouts and finished elevations rather than the original flat
 * terrain. Uses projected area and one bounded shared budget, not every block. */
export function bankTufts(geometry:THREE.BufferGeometry,budget:number,masks:PlanPoint[][]=[]):LawnTuft[]{
 const p=geometry.getAttribute('position'),ix=geometry.getIndex(),count=ix?.count??p.count;
 const triangles:{a:number;b:number;c:number;end:number}[]=[];let area=0;
 for(let i=0;i<count;i+=3){
  const a=ix?ix.getX(i):i,b=ix?ix.getX(i+1):i+1,c=ix?ix.getX(i+2):i+2;
  const next=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;
  if(next>1e-5){area+=next;triangles.push({a,b,c,end:area});}
 }
 const capacity=Math.min(Math.max(0,Math.floor(budget)),Math.ceil(area/24));
 if(!capacity||!triangles.length)return [];
 let seed=6917;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const regions=masks.map(poly=>({poly,x0:Math.min(...poly.map(p=>p.x)),x1:Math.max(...poly.map(p=>p.x)),z0:Math.min(...poly.map(p=>p.y)),z1:Math.max(...poly.map(p=>p.y))}));
 const blocked=(x:number,z:number)=>{let hit=false;for(const r of regions){if(x<r.x0||x>r.x1||z<r.z0||z>r.z1)continue;let local=false;for(let i=0,j=r.poly.length-1;i<r.poly.length;j=i++){const a=r.poly[i],b=r.poly[j];if((a.y>z)!==(b.y>z)&&x<(b.x-a.x)*(z-a.y)/(b.y-a.y)+a.x)local=!local;}if(local)hit=!hit;}return hit;};
 const out:LawnTuft[]=[];
 for(let i=0;i<capacity*3&&out.length<capacity;i++){
  const station=random()*area;let lo=0,hi=triangles.length-1;
  while(lo<hi){const mid=(lo+hi)>>>1;if(triangles[mid].end<station)lo=mid+1;else hi=mid;}
  const {a,b,c}=triangles[lo],s=Math.sqrt(random()),v=random(),weights=[1-s,s*(1-v),s*v],ids=[a,b,c];
  const position=(axis:'X'|'Y'|'Z')=>ids.reduce((n,id,k)=>n+p['get'+axis as 'getX'|'getY'|'getZ'](id)*weights[k],0);
  const x=position('X'),z=position('Z');if(blocked(x,z))continue;
  out.push({x,y:position('Y')+.01,z,height:.7+random()*.9,width:.75+random()*.6,yaw:random()*Math.PI*2,tone:1.35+random()*.35});
 }
 return out;
}
