import type {YardFeature} from './types';
import type {SitePlane} from './siteSurface';

/** The finished-surface plane of a patio, on its own so the eager estimate graph can read a paver's height without the
 * rest of the elevation geometry. yardElevationGeometry re-exports both. */
/** A local patio plane follows the object's rotation, preserving its centre datum. */
export function patioTopPlane(f:YardFeature,grade:number):SitePlane {
 const a=f.rotationDeg*Math.PI/180,c=Math.cos(a),s=Math.sin(a),u=(f.patioSlope?.xPct??0)/100,v=(f.patioSlope?.zPct??0)/100,x=c*u-s*v,z=s*u+c*v;
 return {x,z,constant:(f.finishedElevationIn??grade+f.heightIn)-x*f.xFt*12-z*f.zFt*12};
}
export const planeAt=(p:SitePlane,x:number,z:number)=>p.x*x+p.z*z+p.constant;
