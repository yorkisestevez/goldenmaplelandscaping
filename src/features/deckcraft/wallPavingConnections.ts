import type {YardFeatureModel,YardBox} from './yardModel';
import {yardClip,yardSolidCells} from './yardModel';
import {lowerPrisms,prismVolume,type Prism} from './materialPrisms';
import type {SitePlane} from './siteSurface';
import {planeAt} from './yardElevationGeometry';
const flat=(constant:number):SitePlane=>({x:0,z:0,constant});
/** A specified interface permits paving over construction space. Wall fill stops
 * below the real paving formation; shared support details remain an explicit scope. */
export function reconcileWallPaving(features:YardFeatureModel[],boxes:YardBox[],formations:{featureId:string;polys:{x:number;y:number}[][];bottom:number;formationPlane?:SitePlane}[]){
 const patioIds=new Set(features.filter(f=>!f.excluded&&f.config.kind==='patio').map(f=>f.config.id)),floors=formations.filter(f=>patioIds.has(f.featureId));
 const changed=new Set<string>();
 for(const wall of features.filter(f=>!f.excluded&&f.config.pavingInterface)){
  const result:YardBox[]=[];let removed=0;
  for(const b of wall.boxes){
   if(!b.polygon||!['backfill','wall-drainage'].includes(b.role)){result.push(b);continue;}
   const top=b.topPlane??flat(b.y+b.h/2),bottom=b.bottomPlane??flat(b.bottomIn??b.y-b.h/2);let parts:Prism[]=[{polygon:b.polygon,topPlane:top,bottomPlane:bottom}];const before=prismVolume(parts[0]);
   for(const f of floors)parts=lowerPrisms(parts,f.polys,f.formationPlane??flat(f.bottom));
   removed+=before-parts.reduce((n,p)=>n+prismVolume(p),0);
   for(const [i,p] of parts.entries()){const xs=p.polygon.map(v=>v.x),zs=p.polygon.map(v=>v.y),hi=Math.max(...p.polygon.map(v=>planeAt(p.topPlane,v.x,v.y))),lo=Math.min(...p.polygon.map(v=>planeAt(p.bottomPlane,v.x,v.y)));result.push({...b,id:`${b.id}:paving:${i}`,polygon:p.polygon,topPlane:p.topPlane,bottomPlane:p.bottomPlane,bottomIn:undefined,normalThicknessIn:undefined,x:(Math.min(...xs)+Math.max(...xs))/2,z:(Math.min(...zs)+Math.max(...zs))/2,y:(hi+lo)/2,h:hi-lo,w:Math.max(...xs)-Math.min(...xs),d:Math.max(...zs)-Math.min(...zs)});}
  }
  wall.boxes.splice(0,wall.boxes.length,...result);changed.add(wall.config.id);
  for(const [role,key] of [['backfill','backfillYd3'],['wall-drainage','drainageYd3']] as const)wall.quantities[key]=result.filter(b=>b.role===role&&b.polygon).reduce((n,b)=>n+prismVolume({polygon:b.polygon!,topPlane:b.topPlane??flat(b.y+b.h/2),bottomPlane:b.bottomPlane??flat(b.y-b.h/2)}),0);
  wall.quantities.pavingSupportPartitionYd3=Math.max(0,removed);wall.quoteRequired=true;
  wall.warnings.push(`Paving connection: ${wall.config.pavingInterface!.jointIn} in joint; ${removed.toFixed(3)} cu yd wall fill/drainage replaced by paving support layers. Bearing, drainage continuity, reinforcement and edge restraint require the recorded interface detail${wall.config.pavingInterface!.supportNote?`: ${wall.config.pavingInterface!.supportNote}`:' (pending)'}.`);
 }
 if(changed.size)boxes.splice(0,boxes.length,...boxes.filter(b=>!changed.has(b.featureId)),...features.filter(f=>changed.has(f.config.id)).flatMap(f=>f.boxes));
}
