import type {PoolFeatureModel} from '../../poolModel';

/** Render-only optics for clear outdoor water; these are visual coefficients,
 * not water-treatment specifications. Depth always comes from the saved basin. */
export const WATER_OPTICS={shallow:'#85c5cb',deep:'#247684',extinctionPerFt:.28,minimumAlpha:.14,maximumAlpha:.66};
export function waterOpacity(depthIn:number){const depthFt=Math.max(0,depthIn)/12;return WATER_OPTICS.minimumAlpha+(WATER_OPTICS.maximumAlpha-WATER_OPTICS.minimumAlpha)*(1-Math.exp(-WATER_OPTICS.extinctionPerFt*depthFt));}
/** The floor regions cover the opening, so their local minimum supplies the
 * authoritative depth-profile origin, including retained circular boundaries. */
export function poolDepthSampler(pool:PoolFeatureModel){
 const p=pool.config,a=p.rotationDeg*Math.PI/180,s=Math.sin(a),c=Math.cos(a),localZ=(x:number,z:number)=>-(x-p.xIn)*s+(z-p.zIn)*c;
 const minZ=Math.min(...pool.floorRegions.flatMap(r=>r.polygon.map(q=>localZ(q.x,q.y))));
 return (x:number,z:number)=>{
  if(!Number.isFinite(minZ))return null;
  const station=localZ(x,z)-minZ,profile=p.depthProfile;
  let index=profile.findIndex((d,i)=>i>0&&station<=d.stationIn);if(index<0)index=profile.length-1;
  const u=profile[index-1],v=profile[index];if(!u||!v)return null;
  const t=Math.max(0,Math.min(1,(station-u.stationIn)/(v.stationIn-u.stationIn)));
  return Math.max(0,u.depthIn+(v.depthIn-u.depthIn)*t);
 };
}
