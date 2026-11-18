import type {LandscapePoint} from '../../landscapeTypes';

const insideRings=(rings:LandscapePoint[][],x:number,z:number)=>{let hit=false;for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)hit=!hit;}return hit;};
/** A bed outline as the runs its edging follows: closed, less the stretches it shares with `joins` (beds of the same
 * surface laid against it), where the two read as one bed and no edging runs between them. */
export function edgingRuns(ring:LandscapePoint[],joins:LandscapePoint[][]):LandscapePoint[][]{
 const n=ring.length,keep=ring.map((a,i)=>{const b=ring[(i+1)%n],l=Math.hypot(b.x-a.x,b.z-a.z)||1,x=(a.x+b.x)/2,z=(a.z+b.z)/2,nx=(a.z-b.z)/l,nz=(b.x-a.x)/l;return !joins.length||!insideRings(joins,x+nx,z+nz)&&!insideRings(joins,x-nx,z-nz);});
 if(keep.every(Boolean))return [[...ring,ring[0]]];
 const runs:LandscapePoint[][]=[],start=keep.indexOf(false);let run:LandscapePoint[]=[];
 for(let k=1;k<=n;k++){const i=(start+k)%n;if(keep[i]){if(!run.length)run.push(ring[i]);run.push(ring[(i+1)%n]);}else if(run.length){runs.push(run);run=[];}}
 if(run.length)runs.push(run);
 return runs;
}
